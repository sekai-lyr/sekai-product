"""Resolve each Bilibili local video back to its source video and fetch the official cover.

File names in D:\\Sekai_Song\\sekai(B站) are `bilibili-<songId>-<cid>.mp4`, where <cid> is a
Bilibili page id. Search returns candidate videos; the cid in their page list identifies the
exact upload, whose `pic` field is the cover Bilibili itself shows.

Usage:
    python fix-bilibili-covers.py probe     # try a few, print what happens
    python fix-bilibili-covers.py plan      # resolve every cid -> bilibili-cover-plan.json
    python fix-bilibili-covers.py fetch     # download the resolved covers
"""
import io, json, os, re, struct, subprocess, sys, time, unicodedata, urllib.parse
from difflib import SequenceMatcher

DIR = r"D:\Sekai_Song\sekai(B站)"
QA = r"B:\Sekai\Sekai\sekai\memory-5\qa-output"
PLAN = os.path.join(QA, "bilibili-cover-plan.json")
CACHE_FILE = os.path.join(QA, "bilibili-cover-cache.json")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
HEADERS = ["-H", "Referer: https://www.bilibili.com/",
           "-H", "Origin: https://www.bilibili.com",
           "-H", "Cookie: buvid3=A1B2C3D4-1234-5678-9012-345678901234infoc; b_nut=1700000000"]

_cache = None
TRY_EXACT = False        # the original uploads for these cids are gone


def cache():
    global _cache
    if _cache is None:
        try:
            _cache = json.load(open(CACHE_FILE, encoding="utf-8"))
        except Exception:
            _cache = {}
    return _cache


def cache_save():
    try:
        json.dump(cache(), open(CACHE_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    except Exception:
        pass


def http(url, retries=3, min_bytes=1):
    for attempt in range(retries):
        cp = subprocess.run(["curl.exe", "-s", "--max-time", "30", "-A", UA] + HEADERS + [url],
                            capture_output=True)
        if cp.stdout and len(cp.stdout) >= min_bytes:
            return cp.stdout
        time.sleep(1.0 + attempt)
    return None


def api(url, retries=3):
    for attempt in range(retries):
        body = http(url)
        if not body:
            time.sleep(1.2 + attempt)
            continue
        txt = body.decode("utf-8", "replace").strip()
        if not txt.startswith(("{", "[")):
            time.sleep(1.2 + attempt)
            continue
        try:
            data = json.loads(txt)
        except json.JSONDecodeError:
            time.sleep(1.2 + attempt)
            continue
        code = data.get("code")
        if code == 0:
            return data.get("data")
        if code in (-412, -509, -799):          # rate limited
            time.sleep(4.0 + 3.0 * attempt)
            continue
        return {"__code": code, "__message": data.get("message")}
    return None


def cached(key, fn):
    c = cache()
    if key in c:
        return c[key]
    val = fn()
    if val is not None:
        c[key] = val
        cache_save()
    return val


def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s).lower()
    s = re.sub(r"[\s\u3000]+", "", s)
    for ch in "「」『』【】、，,。.！!？?～~《》()（）[]-—+|/":
        s = s.replace(ch, "")
    return s


def search_videos(keyword, page=1):
    url = ("https://api.bilibili.com/x/web-interface/search/type"
           "?search_type=video&page=%d&keyword=%s" % (page, urllib.parse.quote(keyword)))
    data = cached("bs|%s|%d" % (keyword, page), lambda: api(url))
    if not isinstance(data, dict):
        return []
    return data.get("result") or []


def page_list(bvid):
    data = cached("bp|%s" % bvid,
                  lambda: api("https://api.bilibili.com/x/player/pagelist?bvid=%s" % bvid))
    if not isinstance(data, list):
        return []
    return data


def video_view(bvid):
    data = cached("bv|%s" % bvid,
                  lambda: api("https://api.bilibili.com/x/web-interface/view?bvid=%s" % bvid))
    return data if isinstance(data, dict) and "__code" not in data else None


def query_variants(title):
    """Search keyword variants, most specific first."""
    raw = title or ""
    out = [raw]
    clean = re.sub(r"[【\[（(][^】\]）)]*[】\]）)]", " ", raw)
    clean = re.sub(r"\s+", " ", clean).strip()
    if clean and norm(clean) != norm(raw):
        out.append(clean)
    # drop trailing translation glosses like （繁星坠海）
    short = re.sub(r"[（(][^）)]*[）)]\s*$", "", clean).strip()
    if short and norm(short) != norm(clean):
        out.append(short)
    seen, res = set(), []
    for q in out:
        q = q.strip()
        if len(q) >= 2 and q not in seen:
            seen.add(q)
            res.append(q)
    return res


def resolve(cid, title, max_pages=2, max_candidates=25):
    """Return (video, page_no) whose page list contains cid."""
    cid = str(cid)
    checked = set()
    ordered = []
    for q in query_variants(title):
        for page in range(1, max_pages + 1):
            results = search_videos(q, page)
            if not results:
                break
            for r in results:
                bv = r.get("bvid")
                if not bv or bv in checked:
                    continue
                checked.add(bv)
                sim = SequenceMatcher(None, norm(title), norm(r.get("title"))).ratio()
                ordered.append((sim, bv, r))
        if len(ordered) >= 6:
            break
    ordered.sort(key=lambda x: -x[0])
    for sim, bv, r in ordered[:max_candidates]:
        pages = page_list(bv)
        for p in pages:
            if str(p.get("cid")) == cid:
                view = video_view(bv) or {}
                pic = view.get("pic") or r.get("pic")
                return {"bvid": bv, "page": p.get("page"), "part": p.get("part"),
                        "pic": pic, "video_title": view.get("title") or r.get("title"),
                        "owner": (view.get("owner") or {}).get("name") or r.get("author"),
                        "cid": cid, "match_similarity": round(sim, 3)}, None
    return None, "cid not found in search results"


def scan():
    """(file stem, song id, cid, title) for every mp4 in the folder."""
    titles = {}
    try:
        for row in json.load(open(os.path.join(DIR, "歌曲清单.json"), encoding="utf-8")):
            if row.get("id") is not None and row.get("title"):
                titles[str(row["id"])] = row["title"]
    except Exception:
        pass
    items = []
    for name in sorted(os.listdir(DIR)):
        if not name.lower().endswith(".mp4"):
            continue
        stem = os.path.splitext(name)[0]
        m = re.match(r"bilibili-(\d+)(?:-(\d+))?$", stem)
        if not m:
            continue
        sid, cid = m.group(1), m.group(2)
        items.append({"file": name, "stem": stem, "song_id": sid, "cid": cid,
                      "title": titles.get(sid)})
    return items


def probe(n=4):
    items = scan()
    print("videos:", len(items), "| with cid:", sum(1 for i in items if i["cid"]),
          "| with title:", sum(1 for i in items if i["title"]))
    step = max(1, len(items) // n)
    for it in items[::step][:n]:
        got, err = resolve(it["cid"], it["title"])
        if got:
            print("  %-30s %-28s -> %s p%s  %s" % (it["stem"], it["title"],
                                                   got["bvid"], got["page"], (got["pic"] or "")[:60]))
        else:
            print("  %-30s %-28s -> FAIL %s" % (it["stem"], it["title"], err))


# ---------------------------------------------------------------- ciq-style matcher
def mp4_duration(path):
    """Exact runtime in seconds, read from the mvhd atom."""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        def walk(start, end):
            pos = start
            while pos + 8 <= end:
                f.seek(pos)
                hdr = f.read(8)
                if len(hdr) < 8:
                    return None
                bsize = struct.unpack(">I", hdr[:4])[0]
                typ = hdr[4:8].decode("latin-1")
                hlen = 8
                if bsize == 1:
                    bsize = struct.unpack(">Q", f.read(8))[0]
                    hlen = 16
                elif bsize == 0:
                    bsize = end - pos
                if bsize < hlen:
                    return None
                if typ in ("moov", "trak", "mdia"):
                    r = walk(pos + hlen, pos + bsize)
                    if r:
                        return r
                elif typ == "mvhd":
                    f.seek(pos + hlen)
                    ver = f.read(1)[0]
                    f.read(3)
                    if ver == 0:
                        f.read(8)
                        ts, dur = struct.unpack(">II", f.read(8))
                    else:
                        f.read(16)
                        ts = struct.unpack(">I", f.read(4))[0]
                        dur = struct.unpack(">Q", f.read(8))[0]
                    return dur / ts if ts else None
                pos += bsize
            return None
        return walk(0, size)


def lrc_info(stem):
    """Artist and runtime from the sidecar .lrc."""
    path = os.path.join(DIR, stem + ".lrc")
    if not os.path.isfile(path):
        return {}, None
    try:
        txt = open(path, encoding="utf-8", errors="replace").read()
    except Exception:
        return {}, None
    tags = {}
    for key in ("ti", "ar"):
        m = re.search(r"^\[%s:(.*)\]$" % key, txt, re.M)
        if m and m.group(1).strip():
            tags[key] = m.group(1).strip()
    ts = []
    for a, b in re.findall(r"\[(\d+):(\d+)", txt):
        try:
            ts.append(int(a) * 60 + int(b))
        except ValueError:
            pass
    return tags, (max(ts) if ts else None)


def core_names(title):
    """'【剧中歌】星降る海（繁星坠海）' -> ['星降る海', '繁星坠海']

    Also splits on the separators used for double titles ('ヴァンパイア ⧸ エルフピース',
    '双月：深潜林中') and drops descriptive suffixes ('Paprika日语', '真人版jane doe')."""
    t = title or ""
    t = re.sub(r"^[【\[][^】\]]*[】\]]\s*", "", t).strip()
    pool = []
    for part in re.findall(r"[（(]([^）)]*)[）)]", t):
        pool.append(part)
    stripped = re.sub(r"[（(][^）)]*[）)]", "", t).strip()
    pool.insert(0, stripped)
    out = []
    for item in pool:
        for piece in re.split(r"\s*[⧸/／｜|：:·・]\s*", item):
            piece = piece.strip()
            if not piece:
                continue
            out.append(piece)
            # 'Paprika日语' / '真人版jane doe' -> also try without the label
            trimmed = re.sub(r"(日语|中文|完整版|真人版|MV版|TV版|混音版|原版)\s*$", "", piece).strip()
            trimmed = re.sub(r"^(真人版|日语版|中文版|剧场版)\s*", "", trimmed).strip()
            if trimmed and trimmed != piece:
                out.append(trimmed)
    seen, res = set(), []
    for x in out:
        if len(x) >= 2 and x not in seen:
            seen.add(x)
            res.append(x)
    return res or ([title] if title else [])


def parse_duration(text):
    if not text:
        return None
    m = re.match(r"^(\d+):(\d{1,2})(?::(\d{1,2}))?$", str(text).strip())
    if not m:
        return None
    if m.group(3):
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
    return int(m.group(1)) * 60 + int(m.group(2))


PLACEHOLDER = re.compile(r"合集|歌单|循环|联播|小时|助眠|作业|搬运|全曲|串烧|medley|mix|8D|纯音乐|钢琴|"
                         r"翻唱|教程|反应|reaction|合集向|盘点|排行|歌ってみた|踊ってみた|弾いてみた|"
                         r"听歌向|随机|作业用|BGM", re.I)
SCOREBOOK = re.compile(r"[谱譜]|TAB\b|鼓谱|吉他谱|钢琴谱|伴奏|オフボーカル|off\s*vocal|ニコカラ|カラオケ|インスト", re.I)
OFFICIAL = re.compile(r"官方|公式|official|\bMV\b|中日|OST|原曲|Hi-?Res|无损|4K|8K|字幕", re.I)


def contains_name(name, text):
    """Short latin names like 'ray' must not match inside 'Ray7' or 'array'."""
    n, t = norm(name), norm(text)
    if not n:
        return False
    if re.fullmatch(r"[a-z0-9 ]+", n):
        return re.search(r"(?<![a-z0-9])" + re.escape(n) + r"(?![a-z0-9])", t) is not None
    return n in t


def bilibili_best(names, artist, dur, sim_floor=0.55, tol=6.0):
    """Best Bilibili upload of the same song, for its thumbnail.

    `dur` is the exact runtime of the local file. A different upload of the same song is
    within a few seconds of it, while the talks / game videos / playlist uploads that share
    a generic title are usually nowhere near."""
    best = None
    tried = set()
    queries = []
    for n in names[:2]:
        queries.append(n)
        if artist:
            queries.append("%s %s" % (n, artist))
    for q in queries:
        for page in (1, 2):
            results = search_videos(q, page)
            if not results:
                break
            for r in results:
                bv = r.get("bvid")
                if not bv or bv in tried:
                    continue
                tried.add(bv)
                raw_title = re.sub(r"<[^>]+>", "", r.get("title") or "")
                pic = r.get("pic") or ""
                if not pic:
                    continue
                sim = 0.0
                for n in names:
                    if not n:
                        continue
                    if contains_name(n, raw_title):
                        sim = max(sim, 1.0)
                    else:
                        sim = max(sim, SequenceMatcher(None, norm(n), norm(raw_title)).ratio())
                if sim < sim_floor:
                    continue
                rdur = parse_duration(r.get("duration"))
                if dur and rdur:
                    d = abs(dur - rdur)
                    if d > tol:
                        continue                 # cannot be the same recording
                    dur_s = 1.0 if d <= 2 else (0.85 if d <= 4 else 0.7)
                else:
                    dur_s = 0.5
                art_s = 0.0
                if artist:
                    a = norm(artist)
                    hay = norm(raw_title) + norm(r.get("author"))
                    art_s = 1.0 if a and a in hay else SequenceMatcher(None, a, norm(r.get("author"))).ratio() * 0.6
                sc = sim * 0.45 + dur_s * 0.40 + art_s * 0.15
                if PLACEHOLDER.search(raw_title):
                    sc *= 0.7
                if OFFICIAL.search(raw_title):
                    sc += 0.05
                if SCOREBOOK.search(raw_title):
                    sc *= 0.85
                if best is None or sc > best[0]:
                    best = (sc, {"bvid": bv, "title": raw_title, "pic": pic,
                                 "author": r.get("author"), "duration": rdur,
                                 "similarity": round(sim, 3), "dur_score": dur_s,
                                 "artist_score": round(art_s, 3)})
    if best is None or best[0] < 0.55:
        return None
    return best[1], best[0]


MUSIC_CONTEXT = re.compile(r"プロセカ|pjsk|世界计划|世界計畫|BanG\s*Dream|MyGO|Ave\s*Mujica|バンドリ|"
                           r"ボカロ|VOCALOID|初音|ミク|歌|MV|公式|官方|OST|音源|无损|Hi-?Res|字幕", re.I)


def bilibili_best_loose(names, artist, dur, sim_floor=0.85, tol=45.0):
    """Second pass for songs whose every upload differs in length from the local copy
    (official MV vs full song, TV size vs full). Requires a near-exact title plus
    evidence that the upload is the music itself, not a talk or a game video."""
    best = None
    tried = set()
    queries = []
    for n in names[:2]:
        queries.append(n)
        if artist:
            queries.append("%s %s" % (n, artist))
    for q in queries:
        for page in (1, 2):
            results = search_videos(q, page)
            if not results:
                break
            for r in results:
                bv = r.get("bvid")
                if not bv or bv in tried:
                    continue
                tried.add(bv)
                raw_title = re.sub(r"<[^>]+>", "", r.get("title") or "")
                pic = r.get("pic") or ""
                if not pic or PLACEHOLDER.search(raw_title):
                    continue
                sim = 0.0
                for n in names:
                    if not n:
                        continue
                    if contains_name(n, raw_title):
                        sim = max(sim, 1.0)
                    else:
                        sim = max(sim, SequenceMatcher(None, norm(n), norm(raw_title)).ratio())
                if sim < sim_floor:
                    continue
                if not (OFFICIAL.search(raw_title) or MUSIC_CONTEXT.search(raw_title)
                        or MUSIC_CONTEXT.search(r.get("author") or "")):
                    continue
                rdur = parse_duration(r.get("duration"))
                if dur and rdur:
                    d = abs(dur - rdur)
                    if d > tol:
                        continue
                    dur_s = 1.0 if d <= 10 else (0.8 if d <= 25 else 0.6)
                else:
                    dur_s = 0.5
                art_s = 0.0
                if artist:
                    a = norm(artist)
                    hay = norm(raw_title) + norm(r.get("author"))
                    art_s = 1.0 if a and a in hay else SequenceMatcher(None, a, norm(r.get("author"))).ratio() * 0.6
                sc = sim * 0.5 + dur_s * 0.3 + art_s * 0.2
                if SCOREBOOK.search(raw_title):
                    sc *= 0.85
                if best is None or sc > best[0]:
                    best = (sc, {"bvid": bv, "title": raw_title, "pic": pic,
                                 "author": r.get("author"), "duration": rdur,
                                 "similarity": round(sim, 3), "dur_score": dur_s,
                                 "artist_score": round(art_s, 3)})
    if best is None or best[0] < 0.55:
        return None
    return best[1], best[0]


def plan_all(limit=None):
    items = scan()
    rows = []
    for i, it in enumerate(items, 1):
        tags, lrc_dur = lrc_info(it["stem"])
        try:
            dur = mp4_duration(os.path.join(DIR, it["file"]))
        except Exception:
            dur = None
        names = core_names(it["title"]) or [it["title"] or ""]
        artist = tags.get("ar")
        # The source uploads behind these cids have been taken down (searched and verified),
        # so go straight to matching a same-song upload by title + exact runtime.
        exact = None
        if TRY_EXACT:
            exact, err = resolve(it["cid"], it["title"], max_pages=1, max_candidates=8)
        if exact:
            rows.append({**it, "source": "exact-video", "pic": exact["pic"],
                         "matched_title": exact["video_title"], "bvid": exact["bvid"],
                         "score": 1.0, "duration": dur})
        else:
            hit = bilibili_best(names, artist, dur)
            if hit:
                song, sc = hit
                rows.append({**it, "source": "search", "pic": song["pic"],
                             "matched_title": song["title"], "bvid": song["bvid"],
                             "matched_duration": song["duration"],
                             "score": round(sc, 3), "duration": dur, "artist": artist})
            else:
                loose = bilibili_best_loose(names, artist, dur)
                if loose:
                    song, sc = loose
                    rows.append({**it, "source": "search-loose", "pic": song["pic"],
                                 "matched_title": song["title"], "bvid": song["bvid"],
                                 "matched_duration": song["duration"],
                                 "score": round(sc, 3), "duration": dur, "artist": artist})
                else:
                    rows.append({**it, "source": "unresolved", "pic": None,
                                 "matched_title": None, "score": 0.0, "duration": dur,
                                 "artist": artist})
        r = rows[-1]
        if i % 10 == 0 or limit:
            print("  %d/%d %-32s %-11s %s" % (i, len(items), (r["title"] or "")[:30],
                                              r["source"], (r.get("matched_title") or "")[:46]))
        if limit and i >= limit:
            break
    json.dump(rows, open(PLAN, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    from collections import Counter
    print("\nsources:", Counter(r["source"] for r in rows))
    return rows


def fetch_all():
    rows = json.load(open(PLAN, encoding="utf-8"))
    todo = [r for r in rows if r.get("pic")]
    backup = os.path.join(QA, "bilibili-old-covers")
    os.makedirs(backup, exist_ok=True)
    print("covers to write:", len(todo), "of", len(rows), "| old frames kept in", backup)
    ok = fail = 0
    for i, r in enumerate(todo, 1):
        url = r["pic"]
        if url.startswith("//"):
            url = "https:" + url
        body = http(url, min_bytes=2000)
        if not body:
            print("  FAIL download", r["stem"])
            fail += 1
            continue
        target = os.path.join(DIR, r["stem"] + ".jpg")
        if os.path.isfile(target):
            try:
                with open(target, "rb") as src, open(os.path.join(backup, r["stem"] + ".jpg"), "wb") as dst:
                    dst.write(src.read())
            except Exception:
                pass
        with open(target, "wb") as f:
            f.write(body)
        ok += 1
        if i % 40 == 0:
            print("  .. %d/%d" % (i, len(todo)))
    print("written:", ok, "failed:", fail)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "probe"
    if mode == "probe":
        probe(int(sys.argv[2]) if len(sys.argv) > 2 else 4)
    elif mode == "plan":
        plan_all(int(sys.argv[2]) if len(sys.argv) > 2 else None)
    elif mode == "fetch":
        fetch_all()
    else:
        print("usage: fix-bilibili-covers.py probe|plan|fetch")
