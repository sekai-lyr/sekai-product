# -*- coding: utf-8 -*-
"""
SEKAI ARCHIVE — offline programmatic poster renderer.

Renders one 16:9 experimental editorial poster per card, with NO API and NO network:
the design system is drawn procedurally, and the card's own existing artwork
(pricture/) is composited through it as a printed plate.

Text is rendered by real fonts, so it cannot come out garbled.

    python render_posters.py --only picture_ex_011 water_010 --out ./out
    python render_posters.py --workers 4
"""
import argparse
import hashlib
import io
import json
import math
import os
import random
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = r'D:\Sekai_two\memory-11'
MANIFEST = os.path.join(HERE, 'manifest.json')
CARDS = os.path.join(ROOT, 'SekaiGameGodot', 'data', 'cards.json')
PRICTURE = os.path.join(ROOT, 'pricture')
DEFAULT_OUT = r'D:\Sekai\_Picture\AI-generated'

F_REG = r'C:\Windows\Fonts\msyh.ttc'
F_BOLD = r'C:\Windows\Fonts\msyhbd.ttc'
F_MONO = r'C:\Windows\Fonts\consola.ttf'
F_MONOB = r'C:\Windows\Fonts\consolab.ttf'
F_SERIF = r'C:\Windows\Fonts\simsun.ttc'

# --------------------------------------------------------------------------
# Palette: restrained, desaturated. paper / ink / mid / accent per attribute.
# --------------------------------------------------------------------------
PALETTE = {
    'light': dict(paper=(238, 235, 228), ink=(38, 38, 40), mid=(150, 148, 143), accent=(183, 154, 94)),
    'dark':  dict(paper=(228, 227, 226), ink=(26, 24, 30), mid=(120, 118, 124), accent=(96, 74, 118)),
    'water': dict(paper=(232, 235, 236), ink=(28, 36, 40), mid=(126, 140, 144), accent=(78, 124, 134)),
    'fire':  dict(paper=(238, 233, 226), ink=(40, 30, 26), mid=(150, 134, 124), accent=(168, 72, 47)),
    'wind':  dict(paper=(234, 236, 232), ink=(30, 38, 34), mid=(132, 142, 134), accent=(122, 144, 130)),
    'earth': dict(paper=(237, 232, 222), ink=(38, 32, 24), mid=(148, 134, 112), accent=(138, 106, 69)),
    'none':  dict(paper=(234, 234, 234), ink=(32, 32, 34), mid=(128, 130, 134), accent=(110, 116, 128)),
}

# --------------------------------------------------------------------------
# Motif primitives — actual drawn geometry, keyed to the card's style token.
# --------------------------------------------------------------------------
STYLE_DRAW = {
    'time-stop': ('rings', 'scan'), 'bomb': ('rings', 'fracture'), 'bullet': ('blades', 'scan'),
    'rose': ('petals', 'dots'), 'cream': ('blobs', 'strata'), 'beast': ('blades', 'dots'),
    'dimension': ('bars', 'lattice'), 'sunfire': ('rings', 'dots'), 'serpent': ('flow', 'ladder'),
    'thunder': ('fracture', 'scan'), 'love-whip': ('ribbons', 'petals'), 'stone-chain': ('ladder', 'bars'),
    'poison-butterfly': ('petals', 'dots'), 'water-dragon': ('tide', 'flow'), 'wind-blade': ('blades', 'flow'),
    'blood-flame': ('blobs', 'strata'), 'mist': ('strata', 'flow'), 'flame-tiger': ('blades', 'bars'),
    'sound-bomb': ('wave', 'rings'), 'compass': ('rose', 'lattice'), 'ice-lotus': ('petals', 'lattice'),
    'blood-moon': ('void_disc', 'blobs'), 'moon-blade': ('rings', 'blades'), 'domain': ('lattice', 'bars'),
    'domain-slash': ('lattice', 'blades'), 'hollow-purple': ('void_disc', 'rings'),
    'infinity': ('ribbons', 'rings'), 'flame-arrow': ('blades', 'dots'), 'digital-song': ('wave', 'scan'),
    'dark-song': ('wave', 'strata'), 'bass-wave': ('wave', 'flow'), 'flame': ('blobs', 'strata'),
    'water': ('tide', 'strata'), 'wind': ('flow', 'blades'), 'earth': ('strata', 'ladder'),
    'light': ('rings', 'dots'), 'dark': ('strata', 'void_disc'),
}
ATTR_DRAW = {
    'light': 'dots', 'dark': 'strata', 'water': 'tide',
    'fire': 'blobs', 'wind': 'flow', 'earth': 'ladder', 'none': 'lattice',
}


def seed_of(cid):
    return int(hashlib.sha1(cid.encode('utf-8')).hexdigest()[:8], 16)


# --------------------------------------------------------------------------
# paper + tone helpers
# --------------------------------------------------------------------------
def noise_layer(w, h, rng, scale, amp):
    sw, sh = max(2, w // scale), max(2, h // scale)
    a = rng.integers(0, 256, (sh, sw), dtype=np.uint8)
    img = Image.fromarray(a, 'L').resize((w, h), Image.Resampling.BICUBIC)
    return (np.asarray(img, dtype=np.float32) - 127.5) / 127.5 * amp


def paper_base(w, h, paper, rng):
    base = np.zeros((h, w, 3), np.float32)
    base[:, :] = paper
    base += noise_layer(w, h, rng, 3, 3.0)[:, :, None]      # fine grain
    base += noise_layer(w, h, rng, 90, 4.5)[:, :, None]     # mottling
    return np.clip(base, 0, 255)


def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')


def duotone(img, dark, light):
    """Map luminance onto a two-tone print ramp, then flatten contrast into paper."""
    g = np.asarray(img.convert('L'), np.float32)
    lo, hi = np.percentile(g, 3), np.percentile(g, 97)
    if hi - lo < 1:
        hi = lo + 1
    g = np.clip((g - lo) / (hi - lo), 0, 1)
    g = g * 0.82 + 0.10                       # pull contrast down -> printed, not photo
    d = np.array(dark, np.float32)
    l = np.array(light, np.float32)
    out = d[None, None, :] * (1 - g[:, :, None]) + l[None, None, :] * g[:, :, None]
    return out


def halftone_mask(img, cell):
    """Vectorised dot screen (numpy). Returns an L-mode halftone of the image."""
    g = np.asarray(img.convert('L'), np.float32) / 255.0          # 0..1 luminance
    h, w = g.shape
    H, W = h * cell, w * cell
    yy, xx = np.mgrid[0:H, 0:W]
    cy = (yy % cell) - cell / 2.0
    cx = (xx % cell) - cell / 2.0
    dist = np.sqrt(cx * cx + cy * cy)
    v = 1.0 - g                                                    # darkness
    r = (cell * 0.64) * np.sqrt(np.clip(v, 0, 1))
    rr = np.repeat(np.repeat(r, cell, axis=0), cell, axis=1)[:H, :W]
    vv = np.repeat(np.repeat(v, cell, axis=0), cell, axis=1)[:H, :W]
    dot = dist <= rr
    out = np.where(dot, 255.0 * (1.0 - vv * 0.88), 255.0)
    return Image.fromarray(out.astype(np.uint8), 'L')


# --------------------------------------------------------------------------
# motif drawing
# --------------------------------------------------------------------------
def m_strata(dr, rng, W, H, ink, accent, M):
    y = M
    while y < H - M:
        h = rng.integers(6, 40)
        if rng.random() < 0.34:
            a = rng.integers(8, 26)
            dr.rectangle((M, y, W - M, y + h), fill=ink + (a,))
        dr.line((M, y, W - M, y), fill=ink + (rng.integers(28, 70),), width=1)
        y += h + rng.integers(4, 26)


def m_lattice(dr, rng, W, H, ink, accent, M):
    cols = rng.integers(6, 12)
    rows = int(cols * H / W)
    for i in range(cols + 1):
        x = M + (W - 2 * M) * i / cols
        dr.line((x, M, x, H - M), fill=ink + (rng.integers(16, 40),), width=1)
    for j in range(rows + 1):
        y = M + (H - 2 * M) * j / rows
        dr.line((M, y, W - M, y), fill=ink + (rng.integers(16, 40),), width=1)
    for _ in range(rng.integers(3, 7)):
        cx = rng.integers(M, W - M); cy = rng.integers(M, H - M)
        dr.rectangle((cx - 3, cy - 3, cx + 3, cy + 3), outline=accent + (200,), width=1)


def m_bars(dr, rng, W, H, ink, accent, M):
    for _ in range(rng.integers(5, 11)):
        x = rng.integers(M, W - M - 40)
        y = rng.integers(M, H - M - 40)
        w = rng.integers(30, 190); h = rng.integers(18, 120)
        dr.rectangle((x, y, x + w, y + h), fill=ink + (rng.integers(10, 30),))
        dr.rectangle((x, y, x + w, y + h), outline=ink + (rng.integers(40, 90),), width=1)


def m_ladder(dr, rng, W, H, ink, accent, M):
    n = rng.integers(5, 9)
    x0, x1 = M + rng.integers(0, 120), W - M - rng.integers(0, 120)
    y0, y1 = M + rng.integers(0, 80), H - M - rng.integers(0, 80)
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        dr.line((x, y0, x, y1), fill=ink + (rng.integers(20, 46),), width=1)
    for j in range(int(n * 0.7) + 1):
        t = j / max(1, int(n * 0.7))
        y = y0 + (y1 - y0) * t
        dr.line((x0, y, x1, y), fill=ink + (rng.integers(20, 46),), width=1)


def m_tide(dr, rng, W, H, ink, accent, M):
    for i in range(rng.integers(7, 16)):
        yb = rng.uniform(M, H - M)
        amp = rng.uniform(6, 46)
        per = rng.uniform(0.6, 2.4)
        ph = rng.uniform(0, 6.28)
        pts = [(x, yb + amp * math.sin(per * (x / W) * 6.28 + ph)) for x in range(M, W - M, 16)]
        dr.line(pts, fill=ink + (rng.integers(24, 70),), width=1)


def m_flow(dr, rng, W, H, ink, accent, M):
    for i in range(rng.integers(9, 20)):
        y0 = rng.uniform(M, H - M)
        bend = rng.uniform(-160, 160)
        pts = []
        for k in range(0, 25):
            t = k / 24
            x = M + (W - 2 * M) * t
            y = y0 + bend * math.sin(math.pi * t) * rng.uniform(0.85, 1.15)
            pts.append((x, y))
        dr.line(pts, fill=ink + (rng.integers(18, 54),), width=1)


def m_wave(dr, rng, W, H, ink, accent, M):
    n = rng.integers(40, 90)
    base = H * rng.uniform(0.45, 0.75)
    for i in range(n):
        x = M + (W - 2 * M) * i / n
        h = abs(rng.normal(0, 1)) * H * 0.16
        col = accent if rng.random() < 0.06 else ink
        dr.line((x, base - h, x, base + h), fill=col + (rng.integers(40, 120),), width=max(1, int((W - 2 * M) / n * 0.5)))
    dr.line((M, base, W - M, base), fill=ink + (90,), width=1)


def m_scan(dr, rng, W, H, ink, accent, M):
    y = M
    while y < H - M:
        a = rng.integers(10, 46)
        dr.line((M, y, W - M, y), fill=ink + (a,), width=1)
        if rng.random() < 0.14:
            dr.rectangle((M, y, M + rng.integers(60, W - 2 * M), y + 1), fill=accent + (70,))
        y += rng.integers(2, 9)


def m_rings(dr, rng, W, H, ink, accent, M):
    cx = W * rng.uniform(0.25, 0.75); cy = H * rng.uniform(0.3, 0.7)
    r = min(W, H) * rng.uniform(0.030, 0.130)
    for i in range(rng.integers(9, 20)):
        rr = r + i * rng.uniform(8, 34)
        if rr > max(W, H):
            break
        dr.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=ink + (rng.integers(16, 52),), width=1)
    dr.line((cx, M, cx, H - M), fill=ink + (40,), width=1)


def m_void_disc(dr, rng, W, H, ink, accent, M):
    cx = W * rng.uniform(0.3, 0.7); cy = H * rng.uniform(0.35, 0.65)
    r = min(W, H) * rng.uniform(0.16, 0.26)
    dr.ellipse((cx - r, cy - r, cx + r, cy + r), outline=ink + (70,), width=2)
    dr.ellipse((cx - r * 0.94, cy - r * 0.94, cx + r * 0.94, cy + r * 0.94), outline=ink + (30,), width=1)
    for i in range(3):
        rr = r * (1.3 + i * 0.35)
        dr.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=ink + (18,), width=1)


def m_blades(dr, rng, W, H, ink, accent, M):
    for _ in range(rng.integers(5, 13)):
        ang = rng.uniform(-0.75, 0.75)
        x0 = rng.uniform(M, W - M); y0 = M if rng.random() < 0.5 else H - M
        L = rng.uniform(H * 0.6, H * 1.5)
        x1 = x0 + L * math.sin(ang); y1 = y0 + L * math.cos(ang) * (1 if y0 == M else -1)
        col = accent if rng.random() < 0.18 else ink
        dr.line((x0, y0, x1, y1), fill=col + (rng.integers(30, 95),), width=1)


def m_fracture(dr, rng, W, H, ink, accent, M):
    for _ in range(rng.integers(3, 7)):
        x, y = rng.uniform(M, W - M), rng.uniform(M, H - M)
        pts = [(x, y)]
        for _ in range(rng.integers(4, 9)):
            x += rng.uniform(-190, 190); y += rng.uniform(-140, 140)
            pts.append((x, y))
        dr.line(pts, fill=ink + (rng.integers(40, 100),), width=1)
        for p in pts[1:-1]:
            dr.line((p[0], p[1], p[0] + rng.uniform(-70, 70), p[1] + rng.uniform(-70, 70)),
                    fill=ink + (rng.integers(20, 50),), width=1)


def m_petals(dr, rng, W, H, ink, accent, M):
    for _ in range(rng.integers(6, 16)):
        cx = rng.uniform(M, W - M); cy = rng.uniform(M, H - M)
        rr = min(W, H) * rng.uniform(0.017, 0.084)
        dr.ellipse((cx - rr, cy - rr * 0.7, cx + rr, cy + rr * 0.7),
                   outline=ink + (rng.integers(26, 70),), width=1)
        if rng.random() < 0.28:
            dr.ellipse((cx - rr, cy - rr * 0.7, cx + rr, cy + rr * 0.7), fill=accent + (26,))


def m_ribbons(dr, rng, W, H, ink, accent, M):
    for i in range(rng.integers(4, 10)):
        y0 = rng.uniform(M, H - M)
        pts = []
        for k in range(0, 40):
            t = k / 39
            x = M + (W - 2 * M) * t
            y = y0 + math.sin(t * 6.28 * rng.uniform(1, 3) + rng.uniform(0, 6)) * rng.uniform(30, 130)
            pts.append((x, y))
        dr.line(pts, fill=(accent if rng.random() < 0.2 else ink) + (rng.integers(24, 64),), width=1)


def m_blobs(dr, rng, W, H, ink, accent, M):
    for _ in range(rng.integers(4, 10)):
        cx = rng.uniform(M, W - M); cy = rng.uniform(M, H - M)
        pts = []
        for k in range(14):
            a = 6.28 * k / 14
            r = min(W, H) * rng.uniform(0.021, 0.105)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        dr.polygon(pts, fill=ink + (rng.integers(10, 26),))


def m_dots(dr, rng, W, H, ink, accent, M):
    step = max(6, int(W * rng.uniform(0.0062, 0.0135)))
    for y in range(M, H - M, step):
        for x in range(M, W - M, step):
            v = rng.random()
            if v < 0.55:
                continue
            r = v * step * 0.34
            dr.ellipse((x - r, y - r, x + r, y + r),
                       fill=(accent if rng.random() < 0.05 else ink) + (int(20 + v * 60),))


MOTIF_FN = {
    'strata': m_strata, 'lattice': m_lattice, 'bars': m_bars, 'ladder': m_ladder,
    'tide': m_tide, 'flow': m_flow, 'wave': m_wave, 'scan': m_scan, 'rings': m_rings,
    'void_disc': m_void_disc, 'blades': m_blades, 'fracture': m_fracture,
    'petals': m_petals, 'ribbons': m_ribbons, 'blobs': m_blobs, 'dots': m_dots,
}
# per-vertex-heavy motifs are drawn on a half-scale layer and upscaled: same look,
# ~4x fewer Python-level drawing calls.
SCALED_MOTIFS = {'dots': 0.5, 'petals': 0.5, 'blobs': 0.5, 'rings': 0.6}


def draw_motif(img, kind, rng, W, H, ink, accent, M):
    fn = MOTIF_FN.get(kind)
    if fn is None:
        return
    s = SCALED_MOTIFS.get(kind, 1.0)
    if s >= 1.0:
        fn(ImageDraw.Draw(img, 'RGBA'), rng, W, H, ink, accent, M)
        return
    sw, sh = max(8, int(W * s)), max(8, int(H * s))
    layer = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    fn(ImageDraw.Draw(layer, 'RGBA'), rng, sw, sh, ink, accent, int(M * s))
    img.paste(layer.resize((W, H), Image.Resampling.LANCZOS), (0, 0),
              layer.resize((W, H), Image.Resampling.LANCZOS))


# --------------------------------------------------------------------------
# text helpers
# --------------------------------------------------------------------------
_font_cache = {}


def font(path, size, index=0):
    key = (path, size, index)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size, index=index)
    return _font_cache[key]


def tracked(dr, xy, text, f, fill, track=0):
    x, y = xy
    for ch in text:
        dr.text((x, y), ch, font=f, fill=fill)
        x += dr.textlength(ch, font=f) + track
    return x


def spaced(text, n=1):
    return (' ' * n).join(list(text))


# --------------------------------------------------------------------------
# art plate
# --------------------------------------------------------------------------
_art_index = None
STATIC_CARDS = os.path.join(ROOT, 'SekaiGame', 'src', 'main', 'resources', 'static')
ART_ROOTS = [STATIC_CARDS, os.path.join(ROOT, 'SekaiGame'), ROOT, PRICTURE]


def art_index():
    """card id -> absolute path of its existing artwork (368/368 available)."""
    global _art_index
    if _art_index is None:
        _art_index = {}
        cards = json.load(io.open(CARDS, encoding='utf-8-sig'))
        for c in cards:
            img = str(c.get('image') or '').lstrip('./').replace('/', os.sep)
            for r in ART_ROOTS:
                p = os.path.join(r, img)
                if os.path.exists(p):
                    _art_index[c['id']] = p
                    break
    return _art_index


def load_art(cid):
    p = art_index().get(cid)
    if not p:
        return None
    try:
        return Image.open(p).convert('RGB')
    except Exception:
        return None


def make_plate(src, pal, rng, pw, ph, mode):
    """Turn source art into a print plate: duotone, sliced, punched, fused into paper.

    Returns (plate, alpha_mask, lineart).  The alpha is modulated by the art's own
    luminance so bright background regions dissolve into the paper and only the
    figure's mass and shadow survive — that is the figure/ground fusion.
    """
    sw, sh = src.size
    # trim the outer border first: source fan-art often carries a baked-in
    # artist credit / watermark along an edge, and the brief forbids watermarks.
    ix, iy = int(sw * 0.055), int(sh * 0.055)
    src = src.crop((ix, iy, sw - ix, sh - iy))
    sw, sh = src.size
    target_ar = pw / ph
    if sw / sh > target_ar:
        nw = int(sh * target_ar)
        x0 = max(0, min(sw - nw, int(sw * 0.5 - nw * 0.5)))
        box = (x0, 0, x0 + nw, sh)
    else:
        nh = int(sw / target_ar)
        y0 = max(0, min(sh - nh, int(sh * 0.14)))
        box = (0, y0, sw, y0 + nh)
    img = src.crop(box).resize((pw, ph), Image.Resampling.LANCZOS)

    lum = np.asarray(img.convert('L'), np.float32) / 255.0
    plate = to_img(duotone(img, pal['ink'], pal['paper']))
    arr = np.asarray(plate, np.float32)

    if mode == 'screen':
        screen = halftone_mask(img.resize((pw // 3, ph // 3), Image.Resampling.BOX), 3)
        screen = screen.resize((pw, ph), Image.Resampling.NEAREST)
        arr = arr * 0.55 + np.asarray(screen.convert('RGB'), np.float32) * 0.45

    # sliced displacement — the figure is cut and shifted, not merely placed
    if mode == 'slice':
        bands = int(rng.integers(4, 8))
        for i in range(bands):
            y0 = int(ph * i / bands); y1 = int(ph * (i + 1) / bands)
            dx = int(rng.integers(-30, 31))
            if dx and y0 < y1:
                arr[y0:y1] = np.roll(arr[y0:y1], dx, axis=1)
                lum[y0:y1] = np.roll(lum[y0:y1], dx, axis=1)

    # modular punch-out so the paper shows through the body
    for _ in range(int(rng.integers(2, 6))):
        hw = int(pw * rng.uniform(0.05, 0.18)); hh = int(ph * rng.uniform(0.03, 0.14))
        hx = int(rng.uniform(0, pw - hw)); hy = int(rng.uniform(0, ph - hh))
        arr[hy:hy + hh, hx:hx + hw] = np.array(pal['paper'], np.float32)

    plate = to_img(arr)

    # alpha: rectangular base, feathered, then driven down on bright regions
    m = Image.new('L', (pw, ph), 0)
    inset = int(min(pw, ph) * 0.05)
    ImageDraw.Draw(m).rectangle((inset, inset, pw - inset, ph - inset), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(min(pw, ph) * 0.05))
    a = np.asarray(m, np.float32) / 255.0
    a *= np.clip(0.42 + 0.72 * (1.0 - lum), 0.0, 1.0)      # bright ground dissolves
    a = np.clip(a, 0, 1)

    # line-art separation: edges kept as their own print layer
    e = np.asarray(img.convert('L').filter(ImageFilter.FIND_EDGES), np.float32)
    if e.max() > 0:
        e = e / e.max()
    e = np.clip((e - 0.16) / 0.5, 0, 1) ** 0.8
    line = Image.fromarray((e * 255).astype(np.uint8), 'L')

    return plate, Image.fromarray((a * 255).astype(np.uint8), 'L'), line


def face_inset(src, pal, size, rng):
    """Magnified face slice — the one place the figure is allowed to be legible."""
    sw, sh = src.size
    w = int(sw * 0.46)
    h = int(w)
    x0 = max(0, min(sw - w, int(sw * 0.5 - w * 0.5)))
    y0 = max(0, min(sh - h, int(sh * rng.uniform(0.02, 0.10))))
    crop = src.crop((x0, y0, x0 + w, y0 + h)).resize((size, size), Image.Resampling.LANCZOS)
    arr = duotone(crop, pal['ink'], pal['paper'])
    g = np.asarray(crop.convert('L'), np.float32)
    edges = np.asarray(crop.convert('L').filter(ImageFilter.FIND_EDGES), np.float32)
    if edges.max() > 0:
        edges = edges / edges.max()
    arr = arr * (1 - edges[:, :, None] * 0.55) + np.array([0, 0, 0], np.float32) * (edges[:, :, None] * 0.55)
    out = to_img(arr)
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rectangle((2, 2, size - 3, size - 3), fill=255)
    return out, m


# --------------------------------------------------------------------------
# the poster
# --------------------------------------------------------------------------
def render_card(rec, cards_by_id, args):
    W, H = args.size
    cid = rec['id']
    card = cards_by_id[cid]
    attr = rec['attribute']
    pal = PALETTE.get(attr, PALETTE['none'])
    accent = tuple(pal['accent']); ink = tuple(pal['ink'])
    rng = np.random.default_rng(seed_of(cid))
    py_rng = random.Random(seed_of(cid))

    M = int(W * 0.052)                       # margin
    canvas = paper_base(W, H, pal['paper'], rng)
    img = to_img(canvas)
    dr = ImageDraw.Draw(img, 'RGBA')

    # --- 1. ground motif geometry ---------------------------------------
    kinds = []
    st = rec.get('style_token')
    if st in STYLE_DRAW:
        kinds += list(STYLE_DRAW[st])
    kinds.append(ATTR_DRAW.get(attr, 'lattice'))
    kinds.append('lattice' if py_rng.random() < 0.6 else 'scan')
    seen, ordered = set(), []
    for k in kinds:
        if k not in seen:
            seen.add(k); ordered.append(k)
    for k in ordered[:3]:
        draw_motif(img, k, rng, W, H, ink, accent, M)

    # --- 2. figure plate --------------------------------------------------
    src = load_art(cid)
    side_left = rec['side'].startswith('LEFT')
    plate_box = None
    if src is not None:
        pw = int(W * py_rng.uniform(0.31, 0.40))
        ph = int(H * py_rng.uniform(0.74, 0.94))
        mode = py_rng.choice(['slice', 'screen', 'plain', 'slice'])
        plate, pmask, lineart = make_plate(src, pal, rng, pw, ph, mode)
        px = M + int(W * 0.02) if side_left else W - M - pw - int(W * 0.02)
        py = int(H * py_rng.uniform(0.02, 0.08))
        img.paste(plate, (px, py), pmask)
        plate_box = (px, py, px + pw, py + ph)

        # ghost duplicate, offset a few mm — 重复残影
        gx, gy = px + py_rng.choice([-1, 1]) * int(W * 0.012), py + int(H * 0.02)
        img.paste(plate.copy(), (gx, gy), pmask.point(lambda v: int(v * 0.18)))

        # line drawing separated from its colour block and shifted — 线稿与色块分离
        lx, ly = px + py_rng.choice([-1, 1]) * int(W * 0.006), py - int(H * 0.012)
        la = Image.new('RGBA', (pw, ph), ink + (0,))
        la.putalpha(lineart.point(lambda v: int(v * 0.72)))
        img.paste(la, (lx, ly), la)

    # --- 3. layout chassis, drawn OVER the plate so it passes through ----
    dr = ImageDraw.Draw(img, 'RGBA')
    dr.rectangle((M, M, W - M, H - M), outline=ink + (110,), width=1)
    dr.rectangle((M + 8, M + 8, W - M - 8, H - M - 8), outline=ink + (34,), width=1)

    # structural lines continuing out of the figure — figure/ground fusion
    if plate_box:
        bx0, by0, bx1, by1 = plate_box
        for yy in (by0 + int((by1 - by0) * 0.28), by0 + int((by1 - by0) * 0.63)):
            dr.line((M, yy, W - M, yy), fill=ink + (46,), width=1)
        for xx in (bx0, bx1):
            dr.line((xx, M, xx, H - M), fill=accent + (60,), width=1)

    # tick marks
    tx0, tx1, ty0, ty1 = M, W - M, M, H - M
    step = (tx1 - tx0) / 24
    for i in range(25):
        x = tx0 + step * i
        long = (i % 4 == 0)
        dr.line((x, ty0, x, ty0 + (14 if long else 7)), fill=ink + (120,), width=1)
        dr.line((x, ty1, x, ty1 - (14 if long else 7)), fill=ink + (120,), width=1)
    step = (ty1 - ty0) / 14
    for j in range(15):
        y = ty0 + step * j
        long = (j % 4 == 0)
        dr.line((tx0, y, tx0 + (14 if long else 7), y), fill=ink + (120,), width=1)
        dr.line((tx1, y, tx1 - (14 if long else 7), y), fill=ink + (120,), width=1)

    # --- 4. face inset ----------------------------------------------------
    if src is not None:
        isz = int(min(W, H) * 0.20)
        fi, fm = face_inset(src, pal, isz, rng)
        if side_left:
            fx, fy = W - M - isz - int(W * 0.035), M + int(H * 0.13)
        else:
            fx, fy = M + int(W * 0.035), M + int(H * 0.13)
        img.paste(fi, (fx, fy), fm)
        dr = ImageDraw.Draw(img, 'RGBA')
        dr.rectangle((fx - 10, fy - 10, fx + isz + 10, fy + isz + 10), outline=accent + (190,), width=1)
        # corner registration marks
        for cx, cy, sx, sy in ((fx - 10, fy - 10, 1, 1), (fx + isz + 10, fy - 10, -1, 1),
                               (fx - 10, fy + isz + 10, 1, -1), (fx + isz + 10, fy + isz + 10, -1, -1)):
            dr.line((cx, cy, cx + 16 * sx, cy), fill=accent + (230,), width=2)
            dr.line((cx, cy, cx, cy + 16 * sy), fill=accent + (230,), width=2)
        tracked(dr, (fx - 10, fy + isz + 20), 'SPECIMEN / DETAIL', font(F_MONO, 13),
                ink + (150,), track=2)

    # --- 5. title + archive block ----------------------------------------
    text_left = W - M - 60 if side_left else M
    anchor_right = side_left
    tsize = int(H * 0.072)
    f_title = font(F_BOLD, tsize)
    f_sub = font(F_REG, int(H * 0.020))
    f_data = font(F_MONO, int(H * 0.0165))
    f_data_b = font(F_MONOB, int(H * 0.0165))
    f_small = font(F_MONO, int(H * 0.0128))

    ty = int(H * 0.545)
    name = rec['name']
    if anchor_right:
        dr.text((text_left, ty), name, font=f_title, fill=ink + (255,), anchor='ra')
    else:
        dr.text((text_left, ty), name, font=f_title, fill=ink + (255,), anchor='la')
    rule_y = ty + int(tsize * 1.30)
    rx0 = text_left - (dr.textlength(name, font=f_title) if anchor_right else 0)
    rx1 = text_left
    dr.line((rx0, rule_y, rx1, rule_y), fill=accent + (235,), width=2)

    lines = [
        ('SEKAI ARCHIVE', f_data_b),
        ('No. ' + cid.upper().replace('-', '_'), f_data),
        ('CLASS %s / %s / %s' % (rec['rarity'], rec['type'].upper(), attr.upper()), f_data),
    ]
    if rec['type'] == 'monster':
        lines.append(('LV %02d   ATK %04d   DEF %04d'
                      % (card.get('level', 0), card.get('attack', 0), card.get('defense', 0)), f_data))
    else:
        lines.append(('TYPE %s   ARCHIVE RECORD' % rec['type'].upper(), f_data))

    ly = rule_y + int(H * 0.030)
    for txt, f in lines:
        if anchor_right:
            dr.text((text_left, ly), txt, font=f, fill=ink + (215,), anchor='ra')
        else:
            dr.text((text_left, ly), txt, font=f, fill=ink + (215,), anchor='la')
        ly += int(H * 0.028)

    # scale bar + series mark
    sb_y = H - M - int(H * 0.045)
    sb_x = M + 24 if side_left else W - M - 24
    sb_len = int(W * 0.10)
    for k in range(10):
        x = sb_x + (k * sb_len / 10 if side_left else -k * sb_len / 10)
        seg = sb_len / 10
        dr.rectangle((min(x, x - seg), sb_y, max(x, x - seg), sb_y + 7),
                     fill=(ink + (200,)) if k % 2 == 0 else (ink + (60,)))
    labels = ['0', '5', '10']
    for k, lab in enumerate(labels):
        x = sb_x + (k * sb_len / 2 if side_left else -k * sb_len / 2)
        dr.text((x, sb_y + 12), lab, font=f_small, fill=ink + (170,),
                anchor='la' if side_left else 'ra')

    # corner data
    dr.text((M + 24, M + 22), '368 / ' + spaced(cid.upper().replace('-', '_')[:14]),
            font=f_small, fill=ink + (150,))
    dr.text((W - M - 24, M + 22), rec['series'].upper().replace('_', ' '),
            font=f_small, fill=accent + (200,), anchor='ra')
    dr.text((W - M - 24, H - M - 46), 'SEKAI DUEL — VISUAL ARCHIVE',
            font=f_small, fill=ink + (140,), anchor='ra')

    # --- 6. finish: paper grain over everything --------------------------
    arr = np.asarray(img, np.float32)
    arr += noise_layer(W, H, rng, 2, 2.6)[:, :, None]
    arr += noise_layer(W, H, rng, 60, 2.0)[:, :, None]
    img = to_img(arr)

    if args.grain:
        g = np.asarray(img.convert('L'), np.float32)
        vig = np.ones((H, W), np.float32)
        yy, xx = np.mgrid[0:H, 0:W]
        d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        vig = np.clip(1.0 - 0.16 * np.clip(d - 0.35, 0, None), 0.8, 1.0)
        img = to_img(np.stack([g * vig] * 3, -1) * 0.06 + np.asarray(img, np.float32) * 0.94)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('--width', type=int, default=2560)
    ap.add_argument('--height', type=int, default=1440)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--only', nargs='*', default=None)
    ap.add_argument('--type', dest='ctype', default=None, choices=['monster', 'spell', 'trap'])
    ap.add_argument('--rarity', default=None)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--grain', action='store_true', default=True)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    args.size = (args.width, args.height)

    recs = json.load(io.open(MANIFEST, encoding='utf-8'))
    cards_by_id = {c['id']: c for c in json.load(io.open(CARDS, encoding='utf-8-sig'))}
    if args.only:
        want = set(args.only); recs = [r for r in recs if r['id'] in want]
    if args.ctype:
        recs = [r for r in recs if r['type'] == args.ctype]
    if args.rarity:
        recs = [r for r in recs if r['rarity'] == args.rarity]

    pending = [r for r in recs if args.force or
               not os.path.exists(os.path.join(args.out, r['id'] + '.png'))]
    if args.limit:
        pending = pending[:args.limit]
    with_art = sum(1 for r in pending if load_art(r['id']))
    print('cards in scope : %d' % len(recs))
    print('to render      : %d  (with source art: %d, design-only: %d)'
          % (len(pending), with_art, len(pending) - with_art))
    print('size           : %dx%d' % args.size)
    print('output         : %s' % args.out)
    if args.dry_run:
        for r in pending[:10]:
            print('   ', r['id'], r['name'], '|', 'ART' if load_art(r['id']) else 'design-only')
        return 0

    os.makedirs(args.out, exist_ok=True)
    done = {'n': 0}

    def work(rec):
        img = render_card(rec, cards_by_id, args)
        dest = os.path.join(args.out, rec['id'] + '.png')
        img.save(dest, 'PNG')
        done['n'] += 1
        print('[%3d/%3d] %-22s %s' % (done['n'], len(pending), rec['id'], rec['name']))
        return rec['id']

    if args.workers <= 1:
        for r in pending:
            work(r)
    else:
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            for f in as_completed([ex.submit(work, r) for r in pending]):
                f.result()
    print('done -> %s' % args.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
