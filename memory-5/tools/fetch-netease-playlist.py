import json, os, subprocess, sys

OUT = r"B:\Sekai\Sekai\sekai\memory-5\qa-output\netease-playlist.json"
PLAYLIST_ID = "17767118415"
URL = ("https://music.163.com/api/v6/playlist/detail?id=%s&n=1000&s=8" % PLAYLIST_ID)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def fetch(url):
    cp = subprocess.run(["curl.exe", "-s", "-A", UA,
                         "-H", "Referer: https://music.163.com/",
                         "-H", "Cookie: appver=2.0.2; os=pc", url],
                        capture_output=True)
    return cp.stdout

raw = fetch(URL).decode("utf-8", "replace")
data = json.loads(raw)
pl = data.get("playlist") or {}
tracks = []
for t in pl.get("tracks", []):
    ar = "/".join(a.get("name", "") for a in (t.get("ar") or t.get("artists") or []))
    album = (t.get("al") or t.get("album") or {})
    tracks.append({
        "id": t.get("id"),
        "name": t.get("name"),
        "artists": ar,
        "album": album.get("name"),
        "picUrl": album.get("picUrl"),
        "duration": (t.get("dt") or t.get("duration") or 0) // 1000,
    })

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"id": pl.get("id"), "name": pl.get("name"),
               "trackCount": pl.get("trackCount"),
               "coverImgUrl": pl.get("coverImgUrl"),
               "tracks": tracks}, f, ensure_ascii=False, indent=1)

print("playlist:", pl.get("name"), "trackCount:", pl.get("trackCount"), "tracks parsed:", len(tracks))
for t in tracks[:8]:
    print(" ", t["id"], "|", t["name"], "|", t["artists"], "|", t["album"], "|", (t["picUrl"] or "")[:60])
