import json, os, re, unicodedata, difflib, sys

META = r"B:\Sekai\Sekai\sekai\memory-5\qa-output\audio-meta.json"
PL = r"B:\Sekai\Sekai\sekai\memory-5\qa-output\netease-playlist.json"
OUT = r"B:\Sekai\Sekai\sekai\memory-5\qa-output\cover-match.json"

def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = s.lower()
    s = re.sub(r"[\s\u3000]+", "", s)
    s = s.replace("「", "").replace("」", "").replace("『", "").replace("』", "")
    s = s.replace("、", "").replace("，", "").replace(",", "")
    return s

def strip_suffix(s):
    """remove trailing parenthetical/bracket qualifiers like (Cover) (TV Size) -instrumental-"""
    t = re.sub(r"[\(\（\[【][^\)\）\]】]*[\)\）\]】]", "", s)
    t = re.sub(r"-instrumental-.*$", "", t, flags=re.I)
    t = re.sub(r"\s*-\s*(tv|anime|movie|cover|inst).*$", "", t, flags=re.I)
    return norm(t)

rows = json.load(open(META, encoding="utf-8"))
pl = json.load(open(PL, encoding="utf-8"))
tracks = pl["tracks"]

by_name = {}
by_name_artist = {}
by_stripped = {}
for t in tracks:
    n = norm(t["name"])
    a = norm(t["artists"])
    by_name.setdefault(n, []).append(t)
    by_name_artist.setdefault((n, a), []).append(t)
    by_stripped.setdefault(strip_suffix(t["name"]), []).append(t)

result = []
for r in rows:
    title = r.get("title") or r.get("title_from_lrc")
    artist = r.get("artist") or ""
    entry = {
        "file": r["file"],
        "title": title,
        "artist": artist,
        "has_png": r["cover_png"],
        "has_embedded": bool(r.get("embedded_pic")),
        "track": None,
        "how": None,
        "score": 0.0,
    }
    if title:
        n = norm(title)
        a = norm(artist)
        cand = by_name_artist.get((n, a))
        how = "name+artist"
        if not cand and n in by_name:
            cand = by_name[n]
            how = "name"
        if not cand:
            st = strip_suffix(title)
            if st and st in by_stripped:
                cand = by_stripped[st]
                how = "stripped"
        if not cand:
            best, bs = None, 0.0
            for t in tracks:
                s1 = difflib.SequenceMatcher(None, n, norm(t["name"])).ratio()
                s2 = difflib.SequenceMatcher(None, st if title else n, strip_suffix(t["name"])).ratio()
                s = max(s1, s2)
                if s > bs:
                    bs, best = s, t
            if best is not None and bs >= 0.86:
                cand = [best]
                how = "fuzzy"
                entry["score"] = round(bs, 3)
        if cand:
            # prefer same artist among duplicates
            pick = cand[0]
            for c in cand:
                if a and norm(c["artists"]) == a:
                    pick = c
                    break
            entry["track"] = pick
            entry["how"] = how
    result.append(entry)

json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

matched = [e for e in result if e["track"]]
un = [e for e in result if not e["track"]]
print("audio files:", len(result))
print("matched to playlist:", len(matched))
print("unmatched:", len(un))
print("already have png:", sum(1 for e in result if e["has_png"]))
print("need png:", sum(1 for e in result if not e["has_png"]))
print("\n-- unmatched files --")
for e in un:
    print(" ", e["file"], "|", e["title"], "|", e["artist"], "| emb:", e["has_embedded"])
