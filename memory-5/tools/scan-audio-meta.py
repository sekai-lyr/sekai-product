import os, sys, io, json, struct

AUDIO_DIR = r"D:\Sekai_Song\audio"

def flac_blocks(fp):
    blocks = []
    f = open(fp, 'rb')
    magic = f.read(4)
    if magic != b'fLaC':
        f.close(); return None
    while True:
        h = f.read(4)
        if len(h) < 4:
            break
        bt = h[0] & 0x7F
        last = bool(h[0] & 0x80)
        ln = h[1] << 16 | h[2] << 8 | h[3]
        blocks.append((bt, ln, f.tell()))
        f.seek(ln, 1)
        if last:
            break
    f.close()
    return blocks

def read_vorbis(fp, off, ln):
    f = open(fp, 'rb'); f.seek(off); d = f.read(ln); f.close()
    if len(d) < 8:
        return {}
    vlen = struct.unpack('<I', d[0:4])[0]
    p = 4 + vlen
    if p + 4 > len(d):
        return {}
    n = struct.unpack('<I', d[p:p+4])[0]; p += 4
    tags = {}
    for _ in range(n):
        if p + 4 > len(d):
            break
        cl = struct.unpack('<I', d[p:p+4])[0]; p += 4
        item = d[p:p+cl].decode('utf-8', 'replace'); p += cl
        if '=' in item:
            k, v = item.split('=', 1)
            tags.setdefault(k.upper(), []).append(v)
    return tags

def read_picture(fp, off, ln):
    f = open(fp, 'rb'); f.seek(off); d = f.read(ln); f.close()
    p = 0
    ptype = struct.unpack('>I', d[p:p+4])[0]; p += 4
    mlen = struct.unpack('>I', d[p:p+4])[0]; p += 4
    mime = d[p:p+mlen].decode('ascii', 'replace'); p += mlen
    dlen = struct.unpack('>I', d[p:p+4])[0]; p += 4
    desc = d[p:p+dlen].decode('utf-8', 'replace'); p += dlen
    w, h, depth, colors, plen = struct.unpack('>IIIII', d[p:p+20]); p += 20
    return dict(type=ptype, mime=mime, desc=desc, w=w, h=h, plen=plen, data_off=off + p)

def read_mp3_id3(fp):
    f = open(fp, 'rb')
    head = f.read(10)
    out = {'tags': {}, 'pictures': []}
    if head[:3] != b'ID3':
        f.close(); return out
    size = ((head[6] & 0x7F) << 21) | ((head[7] & 0x7F) << 14) | ((head[8] & 0x7F) << 7) | (head[9] & 0x7F)
    out['id3_size'] = size + 10
    body = f.read(size)
    f.close()
    p = 0
    while p + 10 <= len(body):
        fid = body[p:p+4].decode('latin-1')
        if not fid.strip('\x00') or not fid.isalnum():
            break
        fsz = struct.unpack('>I', body[p+4:p+8])[0]
        if fsz <= 0 or p + 10 + fsz > len(body):
            break
        data = body[p+10:p+10+fsz]
        if fid == 'APIC':
            try:
                q = 0
                enc = data[q]; q += 1
                m = data.index(b'\x00', q); mime = data[q:m].decode('latin-1', 'replace'); q = m + 1
                q += 1  # picture type
                if enc in (1, 2):
                    m = q
                    while not (data[m] == 0 and data[m+1] == 0):
                        m += 2
                    desc = data[q:m].decode('utf-16', 'replace'); q = m + 2
                else:
                    m = data.index(b'\x00', q); desc = data[q:m].decode('latin-1', 'replace'); q = m + 1
                out['pictures'].append(dict(mime=mime, desc=desc, plen=len(data) - q))
            except Exception:
                pass
        elif fid in ('TIT2', 'TPE1', 'TALB'):
            try:
                enc = data[0]
                raw = data[1:]
                txt = raw.decode('utf-16', 'replace') if enc in (1, 2) else raw.decode('utf-8' if enc == 3 else 'latin-1', 'replace')
                out['tags'][{'TIT2': 'TITLE', 'TPE1': 'ARTIST', 'TALB': 'ALBUM'}[fid]] = [txt.strip('\x00')]
            except Exception:
                pass
        p += 10 + fsz
    return out

def flac_duration(fp, off, ln):
    """STREAMINFO: sample_rate(20b) channels(3b) bits(5b) total_samples(36b) at byte 10.."""
    f = open(fp, 'rb'); f.seek(off + 10); d = f.read(8); f.close()
    if len(d) < 8:
        return None
    v = int.from_bytes(d, 'big')
    sample_rate = (v >> 44) & 0xFFFFF
    total_samples = v & 0xFFFFFFFFF
    if not sample_rate:
        return None
    return round(total_samples / sample_rate, 2)

def mp3_duration(fp, id3_size):
    f = open(fp, 'rb')
    f.seek(id3_size)
    buf = f.read(4096)
    f.close()
    if len(buf) < 4:
        return None
    # find frame sync
    i = 0
    while i + 4 <= len(buf):
        if buf[i] == 0xFF and (buf[i+1] & 0xE0) == 0xE0:
            break
        i += 1
    if i + 4 > len(buf):
        return None
    hdr = int.from_bytes(buf[i:i+4], 'big')
    version = (hdr >> 19) & 0x3
    layer = (hdr >> 17) & 0x3
    br_idx = (hdr >> 12) & 0xF
    sr_idx = (hdr >> 10) & 0x3
    pad = (hdr >> 9) & 0x1
    br_tables = {
        3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],   # MPEG1 layer3
        2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],       # MPEG2/2.5 layer3
    }
    sr_tables = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}
    if br_idx == 0 or sr_idx == 3 or layer != 1:
        return None
    vb = 3 if version == 3 else 2
    bitrate = br_tables[vb][br_idx] * 1000
    samplerate = sr_tables[version][sr_idx]
    if not bitrate or not samplerate:
        return None
    # Xing / Info frame count
    side_info = 17 if version == 3 else 9
    xoff = i + 4 + side_info
    tag = buf[xoff:xoff+4]
    if tag in (b'Xing', b'Info'):
        flags = int.from_bytes(buf[xoff+4:xoff+8], 'big')
        p = xoff + 8
        if flags & 1:
            frames = int.from_bytes(buf[p:p+4], 'big')
            spf = 1152 if version == 3 else 576
            return round(frames * spf / samplerate, 2)
    total = os.path.getsize(fp) - id3_size
    spf = 1152 if version == 3 else 576
    framesize = int((144 if version == 3 else 72) * bitrate / samplerate + pad)
    if framesize <= 0:
        return None
    frames = total // framesize
    return round(frames * spf / samplerate, 2)

def lrc_title(fp):
    try:
        with open(fp, 'r', encoding='utf-8', errors='replace') as f:
            for line in f:
                s = line.strip()
                if s.startswith('[ti:'):
                    return s[4:].rstrip(']').strip()
                if not s.startswith('[') and not s.startswith('{'):
                    break
    except Exception:
        pass
    return None

def main():
    rows = []
    for name in sorted(os.listdir(AUDIO_DIR)):
        fp = os.path.join(AUDIO_DIR, name)
        if not os.path.isfile(fp):
            continue
        ext = os.path.splitext(name)[1].lower()
        if ext not in ('.flac', '.mp3'):
            continue
        rec = {'file': name, 'ext': ext, 'cover_png': os.path.isfile(fp + '.png')}
        base = os.path.splitext(name)[0]
        parts = base.split('-')
        rec['user_id'] = parts[0] if len(parts) >= 3 else None
        rec['song_id'] = parts[1] if len(parts) >= 3 else None
        rec['title'] = None; rec['artist'] = None; rec['album'] = None
        rec['embedded_pic'] = None
        rec['duration'] = None
        if ext == '.flac':
            try:
                bl = flac_blocks(fp)
                if bl:
                    for bt, ln, off in bl:
                        if bt == 0:
                            rec['duration'] = flac_duration(fp, off, ln)
                        if bt == 4 and rec['title'] is None:
                            t = read_vorbis(fp, off, ln)
                            rec['title'] = (t.get('TITLE') or [None])[0]
                            rec['artist'] = (t.get('ARTIST') or [None])[0]
                            rec['album'] = (t.get('ALBUM') or [None])[0]
                        if bt == 6 and rec['embedded_pic'] is None:
                            pic = read_picture(fp, off, ln)
                            rec['embedded_pic'] = {k: pic[k] for k in ('mime', 'w', 'h', 'plen')}
                            rec['_pic'] = pic
                else:
                    rec['error'] = 'not-a-flac'
            except Exception as e:
                rec['error'] = 'flac:%s' % e
        else:
            m = read_mp3_id3(fp)
            rec['duration'] = mp3_duration(fp, m.get('id3_size', 0))
            rec['title'] = (m['tags'].get('TITLE') or [None])[0]
            rec['artist'] = (m['tags'].get('ARTIST') or [None])[0]
            rec['album'] = (m['tags'].get('ALBUM') or [None])[0]
            if m['pictures']:
                rec['embedded_pic'] = m['pictures'][0]
        if not rec['title']:
            rec['title_from_lrc'] = lrc_title(os.path.join(AUDIO_DIR, base + '.lrc'))
        rec.pop('_pic', None)
        rows.append(rec)
    out = r"B:\Sekai\Sekai\sekai\memory-5\qa-output\audio-meta.json"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    print('files:', len(rows))
    print('with title:', sum(1 for r in rows if r['title']))
    print('with embedded pic:', sum(1 for r in rows if r['embedded_pic']))
    print('has cover png:', sum(1 for r in rows if r['cover_png']))
    print('with lrc title:', sum(1 for r in rows if r.get('title_from_lrc')))

main()
