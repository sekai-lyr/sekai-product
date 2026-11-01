# -*- coding: utf-8 -*-
"""Sekai 2048 Douyin-style intro video renderer.
1080x1920 @30fps, ~22.5s, 128BPM beat-synced, synthesized SFX+BGM."""
import numpy as np, subprocess, wave, math, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
SRC_RAW = os.path.join(BASE, "src.raw")
OUT = os.path.join(BASE, "sekai2048_intro.mp4")
FF = r"B:/Anaconda/envs/fakenews/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"

W, H, FPS = 1080, 1920, 30
SR = 44100
DUR = 22.5
N_FRAMES = int(DUR * FPS)
BPM = 128.0
BEAT = 60.0 / BPM
FW, FH = 1080, 624
FBYTES = FW * FH * 3

DROP = 6 * BEAT            # 2.8125 scene A start
SCB = 16 * BEAT            # 7.5    scene B
SCC = 26 * BEAT            # 12.1875 scene C
END = 36 * BEAT            # 16.875 end card

# ---------------- fonts ----------------
def load_font(size, bold=True):
    cands = ([r"C:/Windows/Fonts/msyhbd.ttc"] if bold else []) + \
            [r"C:/Windows/Fonts/msyh.ttc", r"C:/Windows/Fonts/simhei.ttf"]
    for p in cands:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()

# ---------------- audio ----------------
def synth_audio():
    n = int(DUR * SR)
    L = np.zeros(n); R = np.zeros(n)

    def add(sig, t, pan=0.0, gain=1.0):
        i = int(t * SR)
        if i < 0 or i >= n: return
        m = min(len(sig), n - i)
        L[i:i+m] += sig[:m] * gain * (1 - max(pan, 0))
        R[i:i+m] += sig[:m] * gain * (1 + min(pan, 0))

    def kick(dur=0.28):
        t = np.arange(int(dur*SR)) / SR
        f = 42 + 130 * np.exp(-t*28)
        ph = 2*np.pi*np.cumsum(f)/SR
        return np.sin(ph) * np.exp(-t*16) * 1.1

    def hat(dur=0.05, open_=False):
        d = 0.12 if open_ else dur
        t = np.arange(int(d*SR)) / SR
        x = np.random.RandomState(7).randn(len(t))
        x = np.diff(x, prepend=0); x = np.diff(x, prepend=0)   # crude highpass
        return x * np.exp(-t*(60 if not open_ else 22)) * 0.25

    def clap():
        t = np.arange(int(0.16*SR)) / SR
        rs = np.random.RandomState(3)
        x = rs.randn(len(t))
        x = np.diff(x, prepend=0)
        env = np.exp(-t*26).copy()
        for tb in (0.0, 0.012, 0.025):
            i = int(tb*SR); env[i:] += np.exp(-(t[i:])*30)*0.7
        return x * env * 0.5

    def bass(f0, dur):
        t = np.arange(int(dur*SR)) / SR
        x = np.sin(2*np.pi*f0*t) + 0.35*np.sin(4*np.pi*f0*t) + 0.15*np.sin(6*np.pi*f0*t)
        env = np.minimum(t*90, 1) * np.exp(-t*3.2)
        return x * env * 0.5

    def pluck(f0, dur=0.32):
        t = np.arange(int(dur*SR)) / SR
        x = np.sin(2*np.pi*f0*t) + 0.4*np.sin(4*np.pi*f0*t) + 0.2*np.sin(6*np.pi*f0*t)
        return x * np.exp(-t*11) * 0.32

    def riser(dur=0.95):
        t = np.arange(int(dur*SR)) / SR
        rs = np.random.RandomState(11)
        x = rs.randn(len(t)) * (t/dur)**2.2
        f = 220 * 2**(t/dur*2.2)
        x = x*0.7 + np.sin(2*np.pi*np.cumsum(f)/SR) * (t/dur)**2 * 0.5
        return x * 0.5

    def whoosh(dur=0.55):
        t = np.arange(int(dur*SR)) / SR
        rs = np.random.RandomState(5)
        x = rs.randn(len(t))
        k = 21
        x = np.convolve(x, np.ones(k)/k, 'same') - np.convolve(x, np.ones(k*6)/(k*6), 'same')
        env = np.sin(np.pi * t/dur)**2
        return x * env * 1.6

    def ding(f0=1567.98, dur=0.5):
        t = np.arange(int(dur*SR)) / SR
        x = np.sin(2*np.pi*f0*t) + 0.5*np.sin(4*np.pi*f0*t)
        return x * np.exp(-t*7) * 0.4

    nbeats = int(DUR / BEAT) + 1
    for b in range(nbeats):
        t = b * BEAT
        if t > DUR - 0.3: break
        pre = t < DROP
        add(kick(), t, gain=0.85 if pre else 1.0)
        if not pre:
            bar = (b - 6) % 8
            if bar in (2, 6): add(clap(), t, gain=0.9)
            add(hat(), t + BEAT/2, gain=0.9)
            if bar in (3, 7): add(hat(open_=True), t + BEAT/2, gain=0.7)
            roots = [55.0, 43.65, 65.41, 49.0]          # A F C G
            root = roots[((b - 6)//4) % 4]
            for e in range(2):
                add(bass(root, BEAT/2*0.95), t + e*BEAT/2, gain=0.95)
        if b >= 14 and not pre:
            pent = [440, 523.25, 587.33, 659.26, 783.99, 880]
            mel = [0, 2, 4, 5, 4, 2, 3, 4, 1, 2, 4, 3, 5, 4, 2, 0]
            add(pluck(pent[mel[(b-14) % 16]]), t, pan=0.3*((b%3)-1))
    # hook dings
    add(ding(1567.98), 0.60); add(ding(2093.0), 1.22, pan=0.2)
    add(ding(1046.5), DROP, gain=1.2)
    # riser into drop
    add(riser(), DROP - 0.95, gain=1.0)
    # whooshes at scene cuts
    for tc in (DROP, SCB, SCC, END):
        add(whoosh(), tc - 0.30, gain=1.0)
    add(ding(1318.5), END + 0.15, gain=0.9)     # end-card accent
    add(ding(1760.0), END + 0.55, gain=0.7)

    mix = np.stack([L, R], axis=1)
    mix = np.tanh(mix * 1.25) * 0.88
    # fades
    fi = int(0.03*SR); mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(1.8*SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(os.path.join(BASE, "bgm.wav"), "wb") as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())

# ---------------- visual assets ----------------
CYAN = (64, 229, 255); YELLOW = (255, 214, 64); WHITE = (245, 248, 255)

def text_img(s, size, color, stroke=6, stroke_fill=(8, 10, 22), bold=True, ls=1.15):
    font = load_font(size, bold)
    lines = s.split("\n")
    d0 = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    boxes = [d0.textbbox((0, 0), ln, font=font, stroke_width=stroke) for ln in lines]
    w = max(b[2] - b[0] for b in boxes) + stroke*2 + 40
    lh = int(size * ls)
    h = lh * len(lines) + stroke*2 + 40
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    y = 20
    for ln, b in zip(lines, boxes):
        x = (w - (b[2]-b[0])) // 2 - b[0]
        d.text((x, y), ln, font=font, fill=color,
               stroke_width=stroke, stroke_fill=stroke_fill)
        y += lh
    return im

def glow_text(s, size, color, glow_color=None, blur=10):
    base = text_img(s, size, color, stroke=4)
    gl = base.filter(ImageFilter.GaussianBlur(blur))
    gl2 = gl.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    out = Image.alpha_composite(out, gl2)
    out = Image.alpha_composite(out, gl)
    out = Image.alpha_composite(out, base)
    return out

def build_assets():
    a = {}
    # background: vertical gradient deep navy -> purple-ish, vignette
    y = np.linspace(0, 1, H)[:, None]
    top = np.array([10, 12, 28]); mid = np.array([16, 14, 46]); bot = np.array([28, 12, 40])
    grad = np.where(y < 0.55, top + (mid-top)*(y/0.55), mid + (bot-mid)*((y-0.55)/0.45))
    bg = np.repeat(grad[:, :, None].transpose(0, 2, 1) if False else grad[:, None, :], W, axis=1)
    a["bg"] = Image.fromarray(bg.astype(np.uint8), "RGB").convert("RGBA")

    def glow_sprite(r, color):
        s = r*2
        im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse([0, 0, s-1, s-1], fill=color + (110,))
        return im.filter(ImageFilter.GaussianBlur(r*0.45))
    a["glow1"] = glow_sprite(430, (30, 120, 200))
    a["glow2"] = glow_sprite(360, (120, 40, 160))
    a["glow3"] = glow_sprite(260, (0, 160, 170))

    # rounded card mask + border + shadow
    mask = Image.new("L", (FW, FH), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, FW-1, FH-1], radius=38, fill=255)
    a["mask"] = mask
    border = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d = ImageDraw.Draw(border)
    d.rounded_rectangle([2, 2, FW-3, FH-3], radius=37, outline=CYAN + (255,), width=5)
    a["border"] = border.filter(ImageFilter.GaussianBlur(1.2))
    bglow = Image.new("RGBA", (FW+60, FH+60), (0, 0, 0, 0))
    d = ImageDraw.Draw(bglow)
    d.rounded_rectangle([10, 10, FW+49, FH+49], radius=44, outline=CYAN + (160,), width=10)
    a["border_glow"] = bglow.filter(ImageFilter.GaussianBlur(9))
    shadow = Image.new("RGBA", (FW+80, FH+80), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.rounded_rectangle([20, 20, FW+59, FH+59], radius=44, fill=(0, 0, 0, 170))
    a["shadow"] = shadow.filter(ImageFilter.GaussianBlur(18))

    a["hook1"] = text_img("这个 2048", 128, WHITE, stroke=10)
    a["hook2"] = text_img("也太可爱了吧！！", 128, YELLOW, stroke=10)
    a["capA1"] = text_img("原创角色版 2048", 84, CYAN, stroke=8)
    a["capA2"] = text_img("每个数字，都是一只原创角色", 64, WHITE, stroke=7)
    a["capB1"] = text_img("合成！进化成高阶角色！", 84, YELLOW, stroke=8)
    a["capB2"] = text_img("四步一合成，越玩越上头", 60, WHITE, stroke=7)
    a["capC1"] = text_img("全站排行榜，卷起来了！", 84, CYAN, stroke=8)
    a["capC2"] = text_img("还能领每日 VIP 礼包", 60, WHITE, stroke=7)
    a["wm"] = text_img("@20070831miku", 46, (255, 255, 255, 215), stroke=4)
    a["logo"] = glow_text("Sekai 2048", 168, CYAN, blur=12)
    a["logo_sub"] = text_img("原创角色 · 合成进化", 66, WHITE, stroke=6)
    a["acc"] = text_img("@20070831miku", 100, YELLOW, stroke=8)
    a["acc2"] = text_img("关注不迷路 · 电脑网页直接玩", 62, WHITE, stroke=7)
    a["acc3"] = text_img("点赞 · 关注 · 评论区扣「想玩」", 58, CYAN, stroke=7)
    return a

# ---------------- source frames ----------------
src_f = open(SRC_RAW, "rb")
SRC_N = 361
def get_src(t):
    idx = max(0, min(SRC_N - 1, int(t * 30)))
    src_f.seek(idx * FBYTES)
    return Image.frombytes("RGB", (FW, FH), src_f.read(FBYTES))

# ---------------- helpers ----------------
def pop_scale(x, amp=0.22, decay=7.5, freq=20.0):
    if x < 0: return 0.0
    return 1.0 + amp * math.exp(-x * decay) * math.cos(x * freq)

def paste_scaled(canvas, img, cx, cy, s):
    if s <= 0.02: return
    w = max(2, int(img.width * s)); h = max(2, int(img.height * s))
    im = img.resize((w, h), Image.BILINEAR)
    canvas.alpha_composite(im, (int(cx - w/2), int(cy - h/2)))

def flash_amount(t, cuts):
    for c in cuts:
        dt = t - c
        if 0 <= dt < 0.16:
            return 0.85 * (1 - dt/0.16)
    return 0.0

def beat_pulse(t):
    if t < DROP: return 0.0
    x = (t - DROP) % BEAT
    return math.exp(-x * 11)

# scene source mapping
def scene_src(t):
    if t < DROP:
        return None
    if t < SCB:                       # A: login -> dashboard
        loc = t - DROP
        if loc < 2.34:
            return get_src(0.3 + loc)
        return get_src(min(5.6, 4.05 + (loc - 2.34)))
    if t < SCC:                       # B: game board
        return get_src(min(9.3, 6.0 + (t - SCB) * 0.72))
    if t < END:                       # C: leaderboard ping-pong
        loc = t - SCC
        u = loc % 4.6
        u = u if u < 2.3 else 4.6 - u
        return get_src(9.55 + min(2.2, u))
    return get_src(6.5)               # end card backdrop (not used)

CAPS = [
    ("capA1", "capA2", DROP + 0.25, SCB - 0.2),
    ("capB1", "capB2", SCB + 0.25, SCC - 0.2),
    ("capC1", "capC2", SCC + 0.25, END - 0.2),
]

def render(a):
    bg = a["bg"]
    card_cy = 830
    cuts = [DROP, SCB, SCC, END]
    proc = subprocess.Popen(
        [FF, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-i", os.path.join(BASE, "bgm.wav"),
         "-c:v", "libx264", "-preset", "medium", "-crf", "19",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-shortest", "-movflags", "+faststart", OUT],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for i in range(N_FRAMES):
        t = i / FPS
        f = bg.copy()
        # animated glows
        for (spr, cx0, cy0, spd, ph) in (
                (a["glow1"], 200, 420, 0.35, 0.0),
                (a["glow2"], 900, 1500, 0.28, 1.8),
                (a["glow3"], 540, 1050, 0.5, 3.6)):
            x = cx0 + 60 * math.sin(t * spd + ph)
            y = cy0 + 50 * math.cos(t * spd * 0.8 + ph)
            f.alpha_composite(spr, (int(x - spr.width/2), int(y - spr.height/2)))
        p = beat_pulse(t)
        if p > 0.01:
            f = Image.blend(f, Image.new("RGBA", (W, H), (120, 180, 255, 255)), 0.10 * p)

        if t < DROP:
            if t < 0.5:
                s = pop_scale(t - 0.12, amp=0.5)
                paste_scaled(f, a["wm"], W/2, 120, s)
            # hook text
            s1 = pop_scale(t - 0.62, amp=0.4)
            s2 = pop_scale(t - 1.24, amp=0.4)
            paste_scaled(f, a["hook1"], W/2, 880, s1)
            paste_scaled(f, a["hook2"], W/2, 1080, s2)
            if t > 1.9:
                k = (t - 1.9) / 0.9
                for img, dy in ((a["hook1"], -40*k), (a["hook2"], 40*k)):
                    paste_scaled(f, img, W/2, (880 + dy) if img is a["hook1"] else (1080 + dy), 1 + 0.1*k)
        else:
            # top watermark
            f.alpha_composite(a["wm"], (W//2 - a["wm"].width//2, 95))
            if t < END:
                im = scene_src(t)
                z = 1.015 + 0.02 * math.sin(t * 0.7) + 0.028 * p
                cw, ch = int(FW * z), int(FH * z)
                card = im.resize((cw, ch), Image.BILINEAR).convert("RGBA")
                if ch != FH or cw != FW:
                    m = a["mask"].resize((cw, ch), Image.BILINEAR)
                    card.putalpha(m)
                cx, cy = W/2, card_cy + 14 * math.sin(t * 0.9)
                sh = a["shadow"]
                f.alpha_composite(sh, (int(cx - sh.width/2), int(cy - sh.height/2)))
                f.alpha_composite(card, (int(cx - cw/2), int(cy - ch/2)))
                bgl = a["border_glow"]
                f.alpha_composite(bgl, (int(cx - bgl.width/2), int(cy - bgl.height/2)))
                bd = a["border"]
                if (cw, ch) != (FW, FH):
                    bd = bd.resize((cw, ch), Image.BILINEAR)
                f.alpha_composite(bd, (int(cx - cw/2), int(cy - ch/2)))
                # captions
                for k1, k2, t0, t1 in CAPS:
                    if t0 <= t < t1:
                        loc = t - t0
                        s1 = pop_scale(loc, amp=0.28)
                        s2 = pop_scale(loc - 0.45, amp=0.28)
                        rise = max(0, 1 - loc * 4) * 40
                        paste_scaled(f, a[k1], W/2, 1420 - rise/2, s1)
                        paste_scaled(f, a[k2], W/2, 1540 - rise, s2)
            else:
                # end card
                loc = t - END
                s1 = pop_scale(loc - 0.05, amp=0.35)
                s2 = pop_scale(loc - 0.55, amp=0.3)
                s3 = pop_scale(loc - 0.85, amp=0.3)
                s4 = pop_scale(loc - 1.15, amp=0.3)
                paste_scaled(f, a["logo"], W/2, 760, s1)
                paste_scaled(f, a["logo_sub"], W/2, 960, s2)
                paste_scaled(f, a["acc"], W/2, 1210, s3)
                paste_scaled(f, a["acc2"], W/2, 1390, s4)
                paste_scaled(f, a["acc3"], W/2, 1520, pop_scale(loc - 1.45, amp=0.3))
        fl = flash_amount(t, cuts)
        if fl > 0.01:
            f = Image.blend(f, Image.new("RGBA", (W, H), (255, 255, 255, 255)), fl)
        proc.stdin.write(f.convert("RGB").tobytes())
        if i % 90 == 0:
            print(f"frame {i}/{N_FRAMES}", flush=True)
    proc.stdin.close()
    proc.wait()
    src_f.close()
    print("done, rc =", proc.returncode)

if __name__ == "__main__":
    if not os.path.exists(os.path.join(BASE, "bgm.wav")) or "--remix" in sys.argv:
        print("synthesizing audio ...", flush=True)
        synth_audio()
    print("building assets ...", flush=True)
    A = build_assets()
    render(A)
