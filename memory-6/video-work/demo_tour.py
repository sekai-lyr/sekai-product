# -*- coding: utf-8 -*-
"""Sekai 2048 demo tour: TTS narration + Playwright Edge demo + gdigrab record + final edit.
Style borrowed from reference video: first-person walkthrough with bottom subtitles."""
import asyncio, ctypes, os, subprocess, sys, time, math
import numpy as np, wave

BASE = os.path.dirname(os.path.abspath(__file__))
FF = r"B:/Anaconda/envs/fakenews/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
PY = sys.executable
URL = "http://localhost:8086"
RAW = os.path.join(BASE, "demo_raw.mp4")
FINAL = os.path.join(BASE, "sekai2048_tour.mp4")
TTS_DIR = os.path.join(BASE, "tts")

SEGMENTS = [
    ("s1", "大家好呀，我是sekai，一个喜欢折腾小游戏的普通开发者。今天带大家看看我用AI辅助做出来的网页小游戏，原创角色版2048。",
     "login", None),
    ("s2", "你看，每个数字都不是冷冰冰的方块，而是一只只原创的小角色。",
     "home_top", None),
    ("s3", "四步一合成，两只小家伙撞在一起，就会进化成更高阶的角色，真的越玩越上头。",
     "play", ["ArrowLeft", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowDown",
              "ArrowLeft", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight",
              "ArrowLeft", "ArrowDown"]),
    ("s4", "我还给它做了会员商店，Plus月卡、角色包，甚至还有一个AI教练，直接帮你算最佳走法。",
     "store", None),
    ("s5", "再看看全站排行榜，第一名已经卷到九十九万九千分了。",
     "leaderboard", None),
    ("s6", "游戏地址就在评论区，我是sekai，感谢观看，记得点个关注。",
     "outro", None),
]

def mp3_duration(p):
    r = subprocess.run([FF, "-i", p], capture_output=True, text=True)
    import re
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1))*3600 + int(m.group(2))*60 + float(m.group(3)) if m else 8.0

# ---------------- phase 1: TTS ----------------
async def tts_one(text, out, voice="zh-CN-YunxiNeural"):
    import edge_tts
    c = edge_tts.Communicate(text, voice, rate="+6%")
    await c.save(out)

def phase_tts():
    os.makedirs(TTS_DIR, exist_ok=True)
    durs = {}
    for sid, text, _, _ in SEGMENTS:
        out = os.path.join(TTS_DIR, sid + ".mp3")
        if not os.path.exists(out):
            try:
                asyncio.run(tts_one(text, out))
                durs[sid] = mp3_duration(out)
                print(f"tts {sid}: {durs[sid]:.2f}s")
            except Exception as e:
                print("TTS FAILED", sid, e)
                durs[sid] = len(text) * 0.21 + 1.2
        else:
            durs[sid] = mp3_duration(out)
    return durs

# ---------------- phase 2: record ----------------
def bring_edge_to_front(WP, HP):
    """Find msedge window and pin it to (0,0) sized WPxHP (physical px), topmost."""
    import ctypes
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    found = []
    @ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
    def cb(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        cls = ctypes.create_unicode_buffer(64)
        user32.GetClassNameW(hwnd, cls, 64)
        if cls.value != "Chrome_WidgetWin_1":
            return True
        pid = ctypes.c_uint()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        h = kernel32.OpenProcess(0x1000, False, pid.value)  # QUERY_LIMITED
        name = ctypes.create_unicode_buffer(512)
        size = ctypes.c_uint(512)
        try:
            psapi = ctypes.windll.psapi
            psapi.GetModuleFileNameExW(h, None, name, 512)
        except Exception:
            pass
        finally:
            kernel32.CloseHandle(h)
        if "msedge.exe" in name.value.lower():
            found.append(hwnd)
        return True
    user32.EnumWindows(cb, None)
    if not found:
        print("WARN: edge window not found")
        return False
    hwnd = found[0]
    user32.ShowWindow(hwnd, 9)  # SW_RESTORE
    user32.SetWindowPos(hwnd, -1, 0, 0, WP, HP, 0x0040)  # HWND_TOPMOST
    user32.keybd_event(0x12, 0, 0, 0)      # alt down (foreground-lock workaround)
    user32.SetForegroundWindow(hwnd)
    user32.keybd_event(0x12, 0, 2, 0)      # alt up
    time.sleep(0.6)
    print(f"edge pinned topmost {WP}x{HP}, hwnd={hwnd}")
    return True

def phase_record(durs):
    import ctypes
    user32 = ctypes.windll.user32
    user32.SetProcessDPIAware()
    scale = ctypes.windll.shcore.GetScaleFactorForDevice(0) / 100.0
    WL, HL = 1600, 900
    WP, HP = int(WL * scale), int(HL * scale)
    print(f"dpi scale={scale}, record region {WP}x{HP}")

    # planned timeline: action time at segment start, hold >= tts + 1.2s
    timeline = []
    t = 1.2  # lead-in
    for sid, text, action, keys in SEGMENTS:
        seg_hold = max(durs[sid] + 1.4, 6.0 if action != "play" else 8.0)
        timeline.append((sid, action, keys, t, seg_hold))
        t += seg_hold
    total = t + 1.0
    print("planned total %.1fs" % total)

    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            channel="msedge", headless=False,
            args=["--window-position=0,0", f"--window-size={WL},{HL}",
                  "--no-first-run", "--disable-session-crashed-bubble"])
        ctx = browser.new_context(viewport={"width": WL, "height": HL - 80},
                                  device_scale_factor=1)
        page = ctx.new_page()
        page.goto(URL + "/login")
        page.wait_for_load_state("networkidle")
        time.sleep(1.0)
        bring_edge_to_front(WP, HP)

        rec = subprocess.Popen(
            [FF, "-y", "-f", "gdigrab", "-framerate", "30",
             "-offset_x", "0", "-offset_y", "0", "-video_size", f"{WP}x{HP}",
             "-i", "desktop", "-t", f"{total:.1f}",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
             "-pix_fmt", "yuv420p", RAW],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        t0 = time.time()

        def wait_until(ts):
            d = t0 + ts - time.time()
            if d > 0: time.sleep(d)

        for sid, action, keys, ts, hold in timeline:
            print(f"[{time.time()-t0:6.1f}] {action}")
            bring_edge_to_front(WP, HP)
            if action == "login":
                wait_until(ts)
                page.fill("#userName", "20070831miku")
                page.fill("#password", "20482048")
            elif action == "home_top":
                wait_until(ts - 1.5)
                page.click("button[type=submit]")
                page.wait_for_load_state("networkidle")
                wait_until(ts)
                page.evaluate("window.scrollTo(0,0)")
            elif action == "play":
                wait_until(ts - 1.0)
                page.locator("#board").scroll_into_view_if_needed()
                wait_until(ts)
                step = hold / max(len(keys), 1)
                for k in keys:
                    page.keyboard.press(k)
                    time.sleep(step)
            elif action in ("store", "leaderboard"):
                wait_until(ts - 1.2)
                page.goto(URL + ("/store" if action == "store" else "/leaderboard"))
                page.wait_for_load_state("networkidle")
            elif action == "outro":
                wait_until(ts - 1.2)
                page.goto(URL + "/home")
                page.wait_for_load_state("networkidle")
                page.evaluate("window.scrollTo(0,0)")
            wait_until(ts + hold)
        wait_until(total + 2.0)
        try:
            rec.wait(timeout=30)   # -t 已设定，让 ffmpeg 自然收尾写完 mp4 索引
        except Exception:
            rec.terminate()
        browser.close()
    print("recorded", RAW)

# ---------------- phase 3: edit ----------------
def make_bgm(path, dur):
    sr = 22050
    n = int(dur * sr)
    t = np.arange(n) / sr
    # soft chord pad: Am - F - C - G, 4s each, gentle
    chords = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63),
              (130.81, 196.0, 261.63), (196.0, 246.94, 293.66)]
    out = np.zeros(n)
    seg = 4.0
    for i in range(int(dur / seg) + 1):
        ch = chords[i % 4]
        s0 = int(i * seg * sr); s1 = min(int((i + 1) * seg * sr), n)
        tt = t[s0:s1]
        env = np.minimum(tt / 0.8, 1) * np.minimum((seg - tt) / 1.2 + 0.15, 1)
        for f in ch:
            out[s0:s1] += np.sin(2 * np.pi * f * tt) * env * 0.11
            out[s0:s1] += np.sin(2 * np.pi * f * 2 * tt) * env * 0.03
    out = out[:n]
    # gentle pulse
    pulse = 1 + 0.12 * np.sin(2 * np.pi * (t * 90 / 60) ) * np.exp(-((t * 90 / 60) % 1) * 3)
    out *= pulse
    fo = int(2.5 * sr)
    out[-fo:] *= np.linspace(1, 0, fo)
    pcm = (np.stack([out, out], 1) * 32767 * 0.9).astype(np.int16)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())

def phase_edit(durs):
    # rebuild actual timeline from video duration: distribute by same rule
    probe = subprocess.run([FF, "-i", RAW], capture_output=True, text=True)
    import re
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe.stderr)
    vtotal = int(m.group(1))*3600 + int(m.group(2))*60 + float(m.group(3))
    # recompute planned timeline exactly like record
    timeline = []
    t = 1.2
    for sid, text, action, keys in SEGMENTS:
        seg_hold = max(durs[sid] + 1.4, 6.0 if action != "play" else 8.0)
        timeline.append((sid, t, seg_hold))
        t += seg_hold
    print("video %.1fs vs plan %.1fs" % (vtotal, t + 1.0))

    # ASS subtitles
    ass = os.path.join(BASE, "subs.ass")
    with open(ass, "w", encoding="utf-8-sig") as f:
        f.write("""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Microsoft YaHei,58,&H00FFFFFF,&H000000FF,&H00101828,&H88000000,-1,0,0,0,100,100,1,0,1,3,1.5,2,60,60,52,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""")
        def ts(x):
            h = int(x // 3600); mm = int(x % 3600 // 60); s = x % 60
            return f"{h}:{mm:02d}:{s:05.2f}"
        for (sid, t0, hold), (sid2, text, _, _) in zip(timeline, SEGMENTS):
            d = durs[sid] if sid in durs else 8
            f.write(f"Dialogue: 0,{ts(t0)},{ts(t0+d+0.4)},Sub,,0,0,0,,{text}\n")

    bgm = os.path.join(BASE, "bgm_soft.wav")
    make_bgm(bgm, vtotal)

    # audio mix
    inputs = ["-i", RAW, "-i", bgm]
    fc = ""
    n = len(SEGMENTS)
    for i, (sid, text, action, keys) in enumerate(SEGMENTS):
        inputs += ["-i", os.path.join(TTS_DIR, sid + ".mp3")]
    mixins = []
    for i, (sid, t0, hold) in enumerate(timeline):
        delay = int(t0 * 1000)
        # 降噪 + 带通去电流声/底噪，限制电平防削波
        fc += (f"[{i+2}:a]aresample=44100,highpass=f=95,lowpass=f=12500,"
               f"afftdn=nf=-28,adelay={delay}|{delay},volume=1.12[n{i}];")
        mixins.append(f"[n{i}]")
    fc += (f"[1:a]aresample=44100,volume=0.10,lowpass=f=5200,atrim=0:{vtotal:.2f}[bg];")
    fc += ("".join(mixins) +
           f"[bg]amix=inputs={n+1}:normalize=0,alimiter=limit=0.88:level=false[a]")
    vf = "crop=iw:ih*9/16:0:(ih-oh)/2,scale=1920:1080,ass=subs.ass"
    cmd = [FF, "-y"] + inputs + ["-filter_complex", fc,
           "-map", "0:v", "-map", "[a]",
           "-vf", vf,
           "-c:v", "libx264", "-preset", "medium", "-crf", "20",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
           "-t", f"{vtotal:.2f}", "-movflags", "+faststart", FINAL]
    # note: crop for 2560x1600 (16:10) -> take center 16:9 band
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-3000:])
        raise SystemExit("edit failed")
    print("final:", FINAL)

if __name__ == "__main__":
    durs = phase_tts()
    if "--edit-only" not in sys.argv:
        phase_record(durs)
    phase_edit(durs)
