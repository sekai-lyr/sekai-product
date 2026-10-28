"""Report where the resolved cover's album disagrees with the album tag in the audio file."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location("f", os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                               "fill-audio-covers.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

meta = {r["file"]: r for r in json.load(open(m.META, encoding="utf-8"))}
plan = json.load(open(m.PLAN, encoding="utf-8"))

rows = []
for p in plan:
    if p["source"] in ("skip", "unresolved", "embedded-art", None):
        continue
    tag_album = meta.get(p["file"], {}).get("album")
    got_album = p.get("album")
    if not tag_album or not got_album:
        continue
    score = m.name_match_x(tag_album, got_album)
    rows.append((score, p["file"], p["source"], tag_album, got_album, p.get("nt_name")))

rows.sort()
print("compared %d covers against the file's own album tag" % len(rows))
weak = [r for r in rows if r[0] < 0.93]
print("disagreements (<0.93): %d\n" % len(weak))
for sc, f, src, tag, got, name in weak:
    print("  %-6.2f %-58s %-14s tag=%-22s cover=%-24s (%s)" % (sc, f[:56], src, tag, got, name))
