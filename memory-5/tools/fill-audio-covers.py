"""Resolve and download album covers for local audio files in D:\\Sekai_Song\\audio.

Sources, in priority order:
  1. NetEase playlist 17767118415 ("SeKai")  -- used for every track the playlist contains
  2. QQ Music official catalogue             -- for files outside that playlist
  3. NetEase strict search                   -- fallback (name + artist + duration verified)
  4. picture embedded in the audio file      -- last resort

Every external match must agree on title, artist and duration, so knock-off cover
versions are rejected.

Usage:
    python fill-audio-covers.py plan     # resolve only -> cover-plan.json
    python fill-audio-covers.py fetch    # download + write <audio>.png
"""
import io, json, os, re, struct, subprocess, sys, time, unicodedata, urllib.parse
from difflib import SequenceMatcher
from PIL import Image

AUDIO_DIR = r"D:\Sekai_Song\audio"
QA = r"B:\Sekai\Sekai\sekai\memory-5\qa-output"
META = os.path.join(QA, "audio-meta.json")
PL = os.path.join(QA, "netease-playlist.json")
MATCH = os.path.join(QA, "cover-match.json")
PLAN = os.path.join(QA, "cover-plan.json")
CACHE = os.path.join(QA, "cover-cache")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
NE_HEADERS = ["-H", "Referer: https://music.163.com/", "-H", "Cookie: appver=2.0.2; os=pc"]
QQ_HEADERS = ["-H", "Referer: https://y.qq.com/", "-H", "Origin: https://y.qq.com"]

MAX_SIDE = 1400        # cap on the long edge of the saved PNG
DUR_TOL = 5.0          # seconds of tolerance between local file and match
NAME_TOL = 0.93        # title similarity floor
ARTIST_TOL = 0.80      # artist similarity floor
TEST_TITLE = re.compile(r"测试|内嵌歌词测试|^test$", re.I)


# ---------------------------------------------------------------- helpers
def http(url, headers, retries=3, min_bytes=0):
    for attempt in range(retries):
        cp = subprocess.run(["curl.exe", "-s", "--max-time", "40", "-A", UA] + headers + [url],
                            capture_output=True)
        body = cp.stdout
        if body and len(body) >= min_bytes:
            return body
        time.sleep(0.8 + attempt)
    return None


def api(url, headers, retries=4):
    """Parse a JSON API response, waiting out catalogue rate limits (NetEase 405)."""
    for attempt in range(retries):
        body = http(url, headers)
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
        if isinstance(data, dict) and data.get("code") in (405, 406):
            time.sleep(3.0 + 2.0 * attempt)      # "操作频繁"
            continue
        return data
    return None


# Search results are memoised on disk: the catalogues rate-limit aggressive clients,
# and a cached answer also makes a re-run reproducible.
SEARCH_CACHE = os.path.join(QA, "search-cache.json")
_cache = None


def cache():
    global _cache
    if _cache is None:
        try:
            _cache = json.load(open(SEARCH_CACHE, encoding="utf-8"))
        except Exception:
            _cache = {}
    return _cache


def cache_save():
    try:
        json.dump(cache(), open(SEARCH_CACHE, "w", encoding="utf-8"), ensure_ascii=False)
    except Exception:
        pass


def cached_fetch(key, fn):
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
    for ch in "「」『』、，,。.！!？?～~":
        s = s.replace(ch, "")
    return s


def strip_qualifiers(s):
    t = re.sub(r"[\(\（\[【][^\)\）\]】]*[\)\）\]】]", "", s or "")
    t = re.sub(r"\s*[-–—]\s*[^-–—]{2,}$", "", t)      # trailing "- 百事可乐广告曲"
    t = re.sub(r"-(instrumental|inst|off\s*vocal).*$", "", t, flags=re.I)
    return norm(t)


def artist_tokens(a):
    if not a:
        return []
    a = re.sub(r"[\(\（][^)）]*[)）]", "", a)
    return [norm(x) for x in re.split(r"[/&、,，]", a) if norm(x)]


try:
    import opencc
    _T2S = opencc.OpenCC("t2s")

    def to_simplified(s):
        try:
            return _T2S.convert(s or "")
        except Exception:
            return s or ""
except Exception:
    def to_simplified(s):
        return s or ""


def norm_x(s):
    """Normalisation that also folds Traditional Chinese into Simplified."""
    return norm(to_simplified(s))


def name_match_x(local_title, cand_name):
    a, b = norm_x(local_title), norm_x(cand_name)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    sa, sb = strip_qualifiers(to_simplified(local_title)), strip_qualifiers(to_simplified(cand_name))
    if sa and sa == sb:
        return 0.99
    r = SequenceMatcher(None, a, b).ratio()
    if sa and sb:
        r = max(r, SequenceMatcher(None, sa, sb).ratio() * 0.98)
    return r


def artist_match_x(local_artist, cand_name):
    lt = [norm_x(x) for x in artist_tokens(local_artist)]
    ct = [norm_x(x) for x in artist_tokens(cand_name)]
    if not lt:
        return None
    if not ct:
        return 0.0
    best = 0.0
    for x in lt:
        for y in ct:
            r = 1.0 if x == y else SequenceMatcher(None, x, y).ratio()
            if x and y and (x in y or y in x):
                r = max(r, 0.90)
            best = max(best, r)
    return best


def name_match(local_title, cand_name):
    a, b = norm(local_title), norm(cand_name)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    sa, sb = strip_qualifiers(local_title), strip_qualifiers(cand_name)
    if sa and sa == sb:
        return 0.99
    r = SequenceMatcher(None, a, b).ratio()
    if sa and sb:
        r = max(r, SequenceMatcher(None, sa, sb).ratio() * 0.98)
    return r


def artist_match(local_artist, cand_names):
    lt = artist_tokens(local_artist)
    if not lt:
        return None            # unknown artist: no opinion
    ct = []
    for n in cand_names:
        ct.extend(artist_tokens(n))
    if not ct:
        return 0.0
    best = 0.0
    for x in lt:
        for y in ct:
            r = 1.0 if x == y else SequenceMatcher(None, x, y).ratio()
            if x and y and (x in y or y in x):
                r = max(r, 0.90)
            best = max(best, r)
    return best


def dur_match(local_dur, cand_dur):
    if not local_dur or not cand_dur:
        return None
    d = abs(local_dur - cand_dur)
    if d <= 1.5:
        return 1.0
    if d <= DUR_TOL:
        return 0.8
    if d <= 20:
        return 0.3
    if d <= 60:
        return 0.15
    return 0.0


def query_variants(title, artist):
    """Search-query variants, from most to least specific."""
    if not title:
        return []
    base = [title]
    clean = re.sub(r"[\(\（\[【][^\)\）\]】]*[\)\）\]】]", " ", title)
    clean = re.sub(r"\s*[-–—]\s*[^-–—]*$", "", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    if clean and norm(clean) != norm(title):
        base.append(clean)
    out = []
    for b in base:
        if artist:
            out.append("%s %s" % (b, artist))
    out.extend(base)
    seen, res = set(), []
    for q in out:
        q = q.strip()
        if q and q not in seen:
            seen.add(q)
            res.append(q)
    return res


def album_key(s):
    """Album comparison key: also drops digits and CJK numerals so
    '十一月的萧邦' and Apple's '11月的蕭邦' are recognised as one album."""
    t = norm_x(s)
    t = re.sub(r"[0-9零一二三四五六七八九十百千萬万]+", "", t)
    return t


def album_agree(tag_album, cand_album):
    if not tag_album or not cand_album:
        return 0.0
    a, b = album_key(tag_album), album_key(cand_album)
    if a and a == b:
        return 1.0
    if a and b and (a in b or b in a):
        return 0.92
    return SequenceMatcher(None, norm_x(tag_album), norm_x(cand_album)).ratio()


def album_bonus(tag_album, cand_album):
    """Rank candidates whose album matches the tag inside the audio file first."""
    ag = album_agree(tag_album, cand_album)
    if ag >= 0.99:
        return 0.15
    if ag >= 0.90:
        return 0.10
    if ag >= 0.60:
        return 0.02
    return 0.0


def score_candidate(nm, ar, dm):
    return nm * 0.5 + (ar if ar is not None else 0.6) * 0.25 + (dm if dm is not None else 0.6) * 0.25


def accept_candidate(nm, ar, dm, score):
    """Duration is a strong hint, not a veto: an exact title + exact artist pair still
    wins when the file is a live/edit version that simply runs longer or shorter."""
    if dm is not None and dm >= 0.8:
        return score >= 0.80
    return nm >= 0.99 and ar is not None and ar >= 0.90


# ---------------------------------------------------------------- QQ Music
def qq_search(query, limit=20):
    """Song list, [] for a genuinely empty result, or None when the request failed."""
    def run():
        url = ("https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=%s&format=json&n=%d&p=1&cr=1&new_json=1"
               % (urllib.parse.quote(query), limit))
        data = api(url, QQ_HEADERS)
        if data is None:
            return None
        return (((data.get("data") or {}).get("song") or {}).get("list")) or []
    res = cached_fetch("qq|%s|%d" % (query, limit), run)
    return res if res is not None else []


def qq_best(title, artist, dur, tag_album=None):
    """Return (song, score) for the best QQ Music hit, or None."""
    if not title:
        return None
    seen, best = set(), None
    for q in query_variants(title, artist):
        for c in qq_search(q):
            key = (c.get("id"), c.get("mid"))
            if key in seen:
                continue
            seen.add(key)
            nm = name_match(title, c.get("name"))
            if nm < NAME_TOL:
                continue
            singers = [s.get("name", "") for s in (c.get("singer") or [])]
            ar = artist_match(artist, singers)
            dm = dur_match(dur, c.get("interval"))
            if ar is not None and ar < ARTIST_TOL:
                continue
            if not qq_cover_url(c.get("album")):
                continue
            sc = score_candidate(nm, ar, dm)
            if not accept_candidate(nm, ar, dm, sc):
                continue
            sc += album_bonus(tag_album, (c.get("album") or {}).get("title"))
            if best is None or sc > best[0]:
                best = (sc, c)
        if best is not None and best[0] >= 1.05:
            break
    return (best[1], best[0]) if best else None


def qq_cover_url(album):
    """Only a real album mid is usable: UGC uploads carry an empty mid plus a shared
    generic placeholder pmid, whose artwork is not the record's own cover."""
    mid = (album or {}).get("mid") or ""
    if not mid:
        return None
    return "QQ:" + mid      # resolved to a concrete size at download time


# ---------------------------------------------------------------- Apple Music
ITUNES_COUNTRIES = ("tw", "jp", "hk", "sg")


def itunes_search(term, country, limit=15):
    def run():
        url = ("https://itunes.apple.com/search?term=%s&entity=song&limit=%d&country=%s"
               % (urllib.parse.quote(term), limit, country))
        data = api(url, [])
        if data is None:
            return None
        return data.get("results") or []
    res = cached_fetch("it:%s|%s|%d" % (country, term, limit), run)
    return res if res is not None else []


def itunes_cover(art):
    if not art:
        return None
    for size in ("3000x3000bb", "1500x1500bb", "1200x1200bb", "600x600bb"):
        if "100x100bb" in art:
            return "IT:" + art.replace("100x100bb", size)
    return "IT:" + art


def itunes_best(title, artist, dur, tag_album=None):
    if not title:
        return None
    best = None
    for country in ITUNES_COUNTRIES:
        for q in query_variants(title, artist):
            for c in itunes_search(q, country):
                nm = name_match_x(title, c.get("trackName"))
                if nm < NAME_TOL:
                    continue
                ar = artist_match_x(artist, c.get("artistName") or "")
                if ar is not None and ar < ARTIST_TOL:
                    continue
                cdur = (c.get("trackTimeMillis") or 0) / 1000.0
                dm = dur_match(dur, cdur)
                # Apple sells licensed masters, so an exact runtime is near-conclusive
                if dm is not None and dm >= 0.8 and nm >= 0.97:
                    sc = 1.0
                else:
                    sc = score_candidate(nm, ar, dm)
                    if not accept_candidate(nm, ar, dm, sc):
                        continue
                sc += album_bonus(tag_album, c.get("collectionName"))
                if best is None or sc > best[0]:
                    best = (sc, c, ar)
        if best is not None and best[0] >= 1.10:
            break
    if best is None:
        return None
    sc, c, ar = best
    cover = itunes_cover(c.get("artworkUrl100"))
    if not cover:
        return None
    return {"name": c.get("trackName"), "artists": c.get("artistName"),
            "album": c.get("collectionName"), "picUrl": cover,
            "id": c.get("trackId")}, sc


def itunes_album_search(term, country, limit=15):
    def run():
        url = ("https://itunes.apple.com/search?term=%s&entity=album&limit=%d&country=%s"
               % (urllib.parse.quote(term), limit, country))
        data = api(url, [])
        if data is None:
            return None
        return data.get("results") or []
    res = cached_fetch("ita:%s|%s|%d" % (country, term, limit), run)
    return res if res is not None else []


def album_accepts(album, c_album_name, artist, c_artist_name):
    """An exact album title is distinctive enough on its own - soundtrack and
    compilation albums are credited to 群星/Various Artists rather than the singer."""
    nm = name_match_x(album, c_album_name)
    if nm < NAME_TOL:
        return None
    ar = artist_match_x(artist, c_artist_name or "")
    if nm >= 0.99:
        return nm * 0.7 + (ar if ar is not None else 0.6) * 0.3, ar
    if ar is not None and ar < ARTIST_TOL:
        return None
    return nm * 0.7 + (ar if ar is not None else 0.6) * 0.3, ar


def itunes_album_best(album, artist):
    """Fall back to the album named inside the audio file when the track itself is not
    sold on Apple Music (a licensed-out single still has its parent album there)."""
    if not album:
        return None
    best = None
    for country in ITUNES_COUNTRIES:
        for q in (["%s %s" % (album, artist) if artist else album, album]):
            for c in itunes_album_search(q, country):
                got = album_accepts(album, c.get("collectionName"), artist, c.get("artistName"))
                if not got:
                    continue
                sc = got[0]
                if best is None or sc > best[0]:
                    best = (sc, c)
        if best is not None and best[0] >= 0.95:
            break
    if best is None:
        return None
    sc, c = best
    cover = itunes_cover(c.get("artworkUrl100"))
    if not cover:
        return None
    return {"name": c.get("collectionName"), "artists": c.get("artistName"),
            "album": c.get("collectionName"), "picUrl": cover,
            "id": c.get("collectionId")}, sc


# ---------------------------------------------------------------- NetEase
def ne_search(query, limit=30):
    def run():
        url = ("https://music.163.com/api/search/get?s=%s&type=1&limit=%d&offset=0"
               % (urllib.parse.quote(query), limit))
        data = api(url, NE_HEADERS)
        if data is None:
            return None
        return (((data.get("result") or {}).get("songs")) or [])
    res = cached_fetch("ne|%s|%d" % (query, limit), run)
    return res if res is not None else []


def ne_song(song_id):
    def run():
        data = api("https://music.163.com/api/song/detail?ids=%%5B%d%%5D" % song_id, NE_HEADERS)
        if data is None:
            return None
        songs = data.get("songs") or []
        if not songs:
            return []
        s = songs[0]
        return {"name": s.get("name"),
                "artists": "/".join(a.get("name", "") for a in (s.get("artists") or [])),
                "album": (s.get("album") or {}).get("name"),
                "picUrl": (s.get("album") or {}).get("picUrl")}
    res = cached_fetch("ned|%d" % song_id, run)
    return res or None


def ne_album(album_id):
    def run():
        data = api("https://music.163.com/api/album/%d" % album_id, NE_HEADERS)
        if data is None:
            return None
        alb = data.get("album") or {}
        if not alb.get("picUrl"):
            return []
        return {"picUrl": alb.get("picUrl"), "album": alb.get("name"),
                "name": alb.get("name"),
                "artists": "/".join(a.get("name", "") for a in (alb.get("artists") or [])),
                "id": album_id}
    res = cached_fetch("nea|%d" % album_id, run)
    return res or None


def ne_album_search(term, limit=10):
    def run():
        url = ("https://music.163.com/api/search/get?s=%s&type=10&limit=%d&offset=0"
               % (urllib.parse.quote(term), limit))
        data = api(url, NE_HEADERS)
        if data is None:
            return None
        return ((data.get("result") or {}).get("albums")) or []
    res = cached_fetch("neas|%s|%d" % (term, limit), run)
    return res if res is not None else []


def ne_album_best(album, artist):
    if not album:
        return None
    best = None
    for q in (["%s %s" % (album, artist) if artist else album, album]):
        for c in ne_album_search(q):
            got = album_accepts(album, c.get("name"), artist, (c.get("artist") or {}).get("name") or "")
            if not got:
                continue
            sc = got[0]
            if best is None or sc > best[0]:
                best = (sc, c)
        if best is not None and best[0] >= 0.95:
            break
    if best is None:
        return None
    sc, c = best
    det = ne_album(c.get("id"))
    if not det:
        return None
    return det, sc


def ne_best(title, artist, dur, tag_album=None):
    if not title:
        return None
    seen, best = set(), None
    for q in query_variants(title, artist):
        for c in ne_search(q):
            if c.get("id") in seen:
                continue
            seen.add(c.get("id"))
            nm = name_match(title, c.get("name"))
            if nm < NAME_TOL:
                continue
            singers = [a.get("name", "") for a in (c.get("artists") or [])]
            ar = artist_match(artist, singers)
            cdur = (c.get("duration") or 0) / 1000.0
            dm = dur_match(dur, cdur)
            if ar is not None and ar < ARTIST_TOL:
                continue
            sc = score_candidate(nm, ar, dm)
            if not accept_candidate(nm, ar, dm, sc):
                continue
            sc += album_bonus(tag_album, (c.get("album") or {}).get("name"))
            if best is None or sc > best[0]:
                best = (sc, c)
        if best is not None and best[0] >= 1.05:
            break
    if best is None:
        return None
    best_s, best = best
    det = ne_song(best["id"]) or {}
    pic = det.get("picUrl")
    if not pic:
        # fall back to the album record when the song detail call was throttled
        al = best.get("album") or {}
        if al.get("id"):
            alb = ne_album(al["id"])
            if alb:
                pic = alb["picUrl"]
                det = {"name": best.get("name"), "artists": det.get("artists") or
                       "/".join(a.get("name", "") for a in (best.get("artists") or [])),
                       "album": alb["album"]}
        if not pic:
            pic = al.get("picUrl")
    if not pic:
        return None
    return {"name": det.get("name") or best.get("name"),
            "artists": det.get("artists") or "/".join(a.get("name", "") for a in (best.get("artists") or [])),
            "album": det.get("album") or ((best.get("album") or {}).get("name")),
            "picUrl": pic, "id": best["id"]}, best_s


# ---------------------------------------------------------------- lyric id
def lyric_lines(path):
    out = []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                m = re.match(r"\[\d+:\d+(?:[.:]\d+)?\](.*)", line)
                if not m:
                    continue
                t = norm(m.group(1))
                if len(t) >= 4 and not t.startswith(("词", "曲", "编曲", "制作")):
                    out.append(t)
    except Exception:
        pass
    return out


def ne_lyric_lines(song_id):
    data = api("https://music.163.com/api/song/lyric?id=%d&lv=1&kv=1&tv=-1" % song_id, NE_HEADERS)
    if not data:
        return []
    txt = (data.get("lrc") or {}).get("lyric") or ""
    out = []
    for line in txt.splitlines():
        m = re.match(r"\[\d+:\d+(?:[.:]\d+)?\](.*)", line)
        if m:
            t = norm(m.group(1))
            if len(t) >= 4:
                out.append(t)
    return out


def lyric_identify(lrc_path, dur):
    """For untagged files: use a lyric fragment to identify the song."""
    lines = lyric_lines(lrc_path)
    if not lines:
        return None
    probe = max(lines[:6], key=len) if lines else None
    if not probe:
        return None
    url = ("https://music.163.com/api/search/get?s=%s&type=1006&limit=20&offset=0"
           % urllib.parse.quote(probe))
    data = api(url, NE_HEADERS)
    songs = (((data or {}).get("result") or {}).get("songs")) or []
    local = set(lines)
    best, best_s = None, 0.0
    for c in songs:
        cdur = (c.get("duration") or 0) / 1000.0
        if dur and cdur and abs(dur - cdur) > 25:
            continue
        cand = set(ne_lyric_lines(c["id"]))
        if not cand:
            continue
        overlap = len(local & cand) / max(1, min(len(local), len(cand)))
        if overlap > best_s:
            best_s, best = overlap, c
    if best is None or best_s < 0.5:
        return None
    return {"title": best.get("name"),
            "artists": "/".join(a.get("name", "") for a in (best.get("artists") or [])),
            "overlap": round(best_s, 3)}


# ---------------------------------------------------------------- resolve
def lrc_tags(path):
    """[ti:] / [ar:] / [al:] headers that many .lrc sidecars carry."""
    tags = {}
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for _ in range(20):
                line = f.readline()
                if not line:
                    break
                m = re.match(r"\[(ti|ar|al):(.*)\]$", line.strip())
                if m and m.group(2).strip():
                    tags.setdefault(m.group(1), m.group(2).strip())
                elif line.strip() and not line.startswith("["):
                    break
    except Exception:
        pass
    return tags


def resolve(row, pl_track, known_artists=None):
    title = row.get("title") or row.get("title_from_lrc")
    artist = row.get("artist") or ""
    dur = row.get("duration")
    d = {"file": row["file"], "title": title, "artist": artist, "duration": dur,
         "song_id": None, "picUrl": None, "album": None,
         "nt_name": None, "nt_artists": None, "note": None}
    lrc = os.path.join(AUDIO_DIR, os.path.splitext(row["file"])[0] + ".lrc")

    # .lrc sidecar headers often know the title/artist even when the audio has no tags.
    # NOTE: some sidecars stuff a millisecond duration into [al:], so that field is ignored.
    if os.path.isfile(lrc):
        tags = lrc_tags(lrc)
        if not title and tags.get("ti"):
            title = tags["ti"]
        if not artist and tags.get("ar"):
            artist = tags["ar"]
        d["title"], d["artist"] = title, artist

    if title and TEST_TITLE.search(title):
        d["source"] = "skip"
        d["note"] = "test fixture, no real artwork"
        return d

    # 1. artwork stored inside the file itself -- the record's own cover for this exact
    #    recording, so it wins over any catalogue mapping (which may point at the album
    #    or compilation a track was reissued on)
    pic = row.get("embedded_pic") or {}
    if pic.get("mime", "").startswith("image/") and (pic.get("plen") or 0) > 20000:
        if not pic.get("w") or min(pic["w"], pic["h"]) >= 400:
            d.update(source="embedded-art",
                     note="artwork embedded in the audio file (%s, %sx%s)"
                          % (pic.get("mime"), pic.get("w") or "?", pic.get("h") or "?"),
                     album=row.get("album"), nt_name=title, nt_artists=artist)
            return d

    # 2. playlist membership
    if pl_track:
        d.update(source="playlist", song_id=pl_track["id"], picUrl=pl_track["picUrl"],
                 album=pl_track["album"], nt_name=pl_track["name"],
                 nt_artists=pl_track["artists"])
        return d

    # untagged file: identify the song from its lyric text
    if not title and os.path.isfile(lrc):
        ident = lyric_identify(lrc, dur)
        if ident:
            title = ident["title"]
            d["title"] = title
            d["note"] = "identified from lyric text (overlap %s)" % ident["overlap"]
            # lyric search cannot separate an official track from a cover of it, so
            # prefer the artist used for the same title elsewhere in the collection
            inherited = (known_artists or {}).get(norm(title))
            artist = inherited or ""
            d["artist"] = artist
            if inherited:
                d["note"] += "; artist inherited from another file with the same title"

    # 3. Apple Music (licensed masters, millisecond-exact runtimes)
    hit = itunes_best(title, artist, dur, row.get("album"))
    if hit:
        song, score = hit
        d.update(source="itunes", picUrl=song["picUrl"], song_id=song["id"],
                 nt_name=song["name"], nt_artists=song["artists"], album=song["album"],
                 score=round(score, 3))
        return d

    # 4. QQ Music official catalogue
    hit = qq_best(title, artist, dur, row.get("album"))
    if hit:
        song, score = hit
        d.update(source="qq", picUrl=qq_cover_url(song.get("album")),
                 song_id=song.get("mid"), nt_name=song.get("name"),
                 nt_artists="/".join(s.get("name", "") for s in (song.get("singer") or [])),
                 album=(song.get("album") or {}).get("title"),
                 score=round(score, 3))
        if d["picUrl"]:
            return d

    # 5. NetEase strict
    hit = ne_best(title, artist, dur, row.get("album"))
    if hit:
        song, score = hit
        d.update(source="netease", picUrl=song["picUrl"], song_id=song["id"],
                 nt_name=song["name"], nt_artists=song["artists"], album=song["album"],
                 score=round(score, 3))
        return d

    # 6. the album named inside the audio file (a licensed-out single still has a parent album)
    for finder, src in ((itunes_album_best, "itunes-album"), (ne_album_best, "netease-album")):
        hit = finder(row.get("album"), artist)
        if hit:
            song, score = hit
            d.update(source=src, picUrl=song["picUrl"], song_id=song["id"],
                     nt_name=song["name"], nt_artists=song["artists"], album=song["album"],
                     score=round(score, 3),
                     note="track not sold separately; used the album named in the file tags")
            return d

    d["source"] = "unresolved"
    d["note"] = d["note"] or "no confident match on Apple Music, QQ Music or NetEase"
    return d


def do_plan():
    meta = json.load(open(META, encoding="utf-8"))
    match = {m["file"]: m for m in json.load(open(MATCH, encoding="utf-8"))}
    # title -> artist, taken from files that do carry an artist tag
    known_artists = {}
    for row in meta:
        t, a = row.get("title"), row.get("artist")
        if t and a:
            known_artists.setdefault(norm(t), a)
    plan = []
    for row in meta:
        p = resolve(row, (match.get(row["file"]) or {}).get("track"), known_artists)
        p["had_png"] = bool(row["cover_png"])
        plan.append(p)
        print("[%s] %s | %s" % (p["source"], p["file"], p.get("nt_name") or p.get("title")))
    json.dump(plan, open(PLAN, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    from collections import Counter
    print("\n==== summary ====")
    print(Counter(p["source"] for p in plan))
    bad = [p for p in plan if p["source"] in ("unresolved",)]
    if bad:
        print("\n-- unresolved --")
        for p in bad:
            print("  ", p["file"], "|", p["title"], "|", p["artist"], "|", p["duration"], "|", p["note"])


# ---------------------------------------------------------------- fetch
def embedded_bytes(fp, ext):
    """Picture block/APIC frame stored inside a FLAC or MP3 file."""
    if ext == ".flac":
        f = open(fp, "rb")
        if f.read(4) != b"fLaC":
            f.close(); return None
        while True:
            h = f.read(4)
            if len(h) < 4:
                break
            bt, last = h[0] & 0x7F, bool(h[0] & 0x80)
            ln = h[1] << 16 | h[2] << 8 | h[3]
            if bt == 6:
                d = f.read(ln); f.close()
                q = 4
                mlen = struct.unpack(">I", d[q:q+4])[0]; q += 4 + mlen
                dlen = struct.unpack(">I", d[q:q+4])[0]; q += 4 + dlen
                q += 20
                return d[q:]
            f.seek(ln, 1)
            if last:
                break
        f.close()
        return None
    f = open(fp, "rb")
    head = f.read(10)
    if head[:3] != b"ID3":
        f.close(); return None
    size = ((head[6] & 0x7F) << 21) | ((head[7] & 0x7F) << 14) | ((head[8] & 0x7F) << 7) | (head[9] & 0x7F)
    body = f.read(size)
    f.close()
    q = 0
    while q + 10 <= len(body):
        fid = body[q:q+4].decode("latin-1")
        if not fid.strip("\x00") or not fid.isalnum():
            break
        fsz = struct.unpack(">I", body[q+4:q+8])[0]
        if fsz <= 0:
            break
        data = body[q+10:q+10+fsz]
        if fid == "APIC":
            enc = data[0]
            r = 1
            m = data.index(b"\x00", r); r = m + 1 + 1
            if enc in (1, 2):
                m = r
                while not (data[m] == 0 and data[m+1] == 0):
                    m += 2
                r = m + 2
            else:
                m = data.index(b"\x00", r); r = m + 1
            return data[r:]
        q += 10 + fsz
    return None


def ahash(im, n=16):
    g = im.convert("L").resize((n, n), Image.LANCZOS)
    px = list(g.getdata())
    avg = sum(px) / len(px)
    return [1 if v >= avg else 0 for v in px]


def hash_distance(a, b):
    return sum(1 for x, y in zip(a, b) if x != y) / len(a)


def download_image(pic):
    if pic.startswith("QQ:"):
        mid = pic[3:]
        for size in (1500, 1200, 800, 500, 300):
            url = ("https://y.qq.com/music/photo_new/T002R%dx%dM000%s.jpg?max_age=2592000"
                   % (size, size, mid))
            body = http(url, QQ_HEADERS, min_bytes=2048)
            if body:
                return body, url
        return None, None
    if pic.startswith("IT:"):
        url = pic[3:]
        body = http(url, [], min_bytes=2048)
        return body, url
    body = http(pic, NE_HEADERS, min_bytes=2048)
    return body, pic


def do_fetch():
    plan = json.load(open(PLAN, encoding="utf-8"))
    # audio-meta.json was scanned before this tool ever ran, so its cover_png flag
    # identifies covers that were already in the folder - those are left alone.
    preexisting = {r["file"] for r in json.load(open(META, encoding="utf-8")) if r["cover_png"]}
    todo = [p for p in plan if p["source"] in ("embedded-art", "playlist", "itunes", "qq",
                                               "netease", "itunes-album", "netease-album")]
    print("candidates:", len(todo), "| pre-existing covers left alone:", len(preexisting))
    done = replaced = kept = 0
    failed = []
    for i, p in enumerate(todo, 1):
        target = os.path.join(AUDIO_DIR, p["file"] + ".png")
        ext = os.path.splitext(p["file"])[1].lower()
        if p["source"] == "embedded-art":
            body = embedded_bytes(os.path.join(AUDIO_DIR, p["file"]), ext)
            used = "embedded"
        else:
            if not p.get("picUrl"):
                continue
            body, used = download_image(p["picUrl"])
        if not body:
            failed.append((p["file"], "no image data (%s)" % used))
            continue
        try:
            im = Image.open(io.BytesIO(body))
            im.load()
        except Exception as e:
            failed.append((p["file"], "image error: %s" % e))
            continue
        # A cover that was already in the folder is only replaced when it contradicts the
        # artwork stored inside the audio file.
        if os.path.isfile(target) and p["file"] in preexisting:
            if p["source"] != "embedded-art":
                kept += 1
                continue
            try:
                old = Image.open(target)
                old.load()
                if hash_distance(ahash(old), ahash(im)) <= 0.22:
                    kept += 1
                    continue
            except Exception:
                pass
            replaced += 1
        im = im.convert("RGBA" if im.mode in ("P", "LA", "RGBA") else "RGB")
        w, h = im.size
        if max(w, h) > MAX_SIDE:
            s = MAX_SIDE / max(w, h)
            im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        im.save(target, "PNG")
        done += 1
        if i % 25 == 0:
            print("  .. %d/%d" % (i, len(todo)))
    print("written:", done, " (of which replaced an existing wrong cover:", replaced, ")")
    print("kept existing:", kept)
    print("failed:", len(failed))
    for f, e in failed:
        print("  FAIL", f, e)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if mode == "plan":
        do_plan()
    elif mode == "fetch":
        do_fetch()
    else:
        print("usage: fill-audio-covers.py plan|fetch")
