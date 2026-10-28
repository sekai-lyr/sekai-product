"""Cross-check downloaded covers against artwork embedded in the audio files.

Files that carry embedded artwork give us ground truth: if the PNG we wrote is
visually the same album, the two hashes must be close.
"""
import io, json, os, struct
from PIL import Image

AUDIO_DIR = r"D:\Sekai_Song\audio"
QA = r"B:\Sekai\Sekai\sekai\memory-5\qa-output"
META = os.path.join(QA, "audio-meta.json")


def flac_picture_bytes(fp):
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
            d = f.read(ln)
            f.close()
            p = 4
            mlen = struct.unpack(">I", d[p:p+4])[0]; p += 4 + mlen
            dlen = struct.unpack(">I", d[p:p+4])[0]; p += 4 + dlen
            p += 20
            return d[p:]
        f.seek(ln, 1)
        if last:
            break
    f.close()
    return None


def mp3_picture_bytes(fp):
    f = open(fp, "rb")
    head = f.read(10)
    if head[:3] != b"ID3":
        f.close(); return None
    size = ((head[6] & 0x7F) << 21) | ((head[7] & 0x7F) << 14) | ((head[8] & 0x7F) << 7) | (head[9] & 0x7F)
    body = f.read(size)
    f.close()
    p = 0
    while p + 10 <= len(body):
        fid = body[p:p+4].decode("latin-1")
        if not fid.strip("\x00") or not fid.isalnum():
            break
        fsz = struct.unpack(">I", body[p+4:p+8])[0]
        data = body[p+10:p+10+fsz]
        if fid == "APIC" and fsz > 0:
            enc = data[0]
            q = 1
            m = data.index(b"\x00", q); q = m + 1 + 1
            if enc in (1, 2):
                m = q
                while not (data[m] == 0 and data[m+1] == 0):
                    m += 2
                q = m + 2
            else:
                m = data.index(b"\x00", q); q = m + 1
            return data[q:]
        p += 10 + fsz
    return None


def ahash(im, n=16):
    im = im.convert("L").resize((n, n), Image.LANCZOS)
    px = list(im.getdata())
    avg = sum(px) / len(px)
    return [1 if v >= avg else 0 for v in px]


def distance(a, b):
    return sum(1 for x, y in zip(a, b) if x != y) / len(a)


def main():
    meta = json.load(open(META, encoding="utf-8"))
    checked = 0
    flagged = []
    for row in meta:
        if not row.get("embedded_pic"):
            continue
        png = os.path.join(AUDIO_DIR, row["file"] + ".png")
        if not os.path.isfile(png):
            continue
        fp = os.path.join(AUDIO_DIR, row["file"])
        raw = flac_picture_bytes(fp) if row["ext"] == ".flac" else mp3_picture_bytes(fp)
        if not raw:
            continue
        try:
            emb = Image.open(io.BytesIO(raw))
            emb.load()
            got = Image.open(png)
            got.load()
        except Exception:
            continue
        d = distance(ahash(emb), ahash(got))
        checked += 1
        if d > 0.22:
            flagged.append((row["file"], round(d, 3), row.get("title")))
    print("cross-checked against embedded artwork:", checked)
    print("mismatches flagged:", len(flagged))
    for f, d, t in flagged:
        print("   diff=%.3f  %-58s %s" % (d, f, t))


main()
