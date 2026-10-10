#!/usr/bin/env python3
"""把卡背母图（白底立绘）处理成可直接上场的卡背 WebP。

母图是一张白底的「金色镂空边框 + 蓝色晶核」立绘，四角与边框外是白色背景。
直接铺在深色战场上会露出白角，而且画框几乎顶满四边，任何纵横比裁切都会切到
画框，所以这里做三件事：

1. 从图像边缘做连通域泛洪，只把「与边框相连的白色」判为背景；画框内部被
   线稿圈住的孤立白块（晶核星芒）保留，边框外的碎块与灰线稿清掉；
2. 生成与游戏主题一致的深空底（径向渐变 + 冷色辉光 + 底部暖光 + 星尘 + 暗角），
   用它替换背景；
3. 把立绘按「画布高度 89%」缩放置中，贴到一块宽高比 0.70 的画布上。
   深空底是**按画布**一次性生成的，所以贴上去之后没有接缝。

为什么是 0.70 / 89%：卡背在不同位置被拉伸的宽高比不一样（场地卡 100×130 =
0.769 最宽，卡包预览 0.7 最窄）。CSS 用 `cover` 填充，元素比图宽就上下裁、
比图窄就左右裁。把画布定在最窄的 0.70、并让立绘只占高度的 89%，两个方向的
裁切量（最坏 36 px）都落在留白里，画框在任何位置都不会被切到。

用法：
    python scripts/build-card-back.py
产物：
    src/main/resources/static/assets/cardbacks/sekai-card-back.webp
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = Path(__file__).resolve().parent
STATIC = HERE.parent / "src" / "main" / "resources" / "static"

DEFAULT_MASTER = STATIC / "assets" / "cardbacks" / "source" / "sekai-card-back-master.png"
DEFAULT_OUT = STATIC / "assets" / "cardbacks" / "sekai-card-back.webp"

# 与 css/style.css 里卡背兜底渐变保持同一套深空色
SPACE_STOPS = [
    (0.00, (47, 51, 120)),   # #2f3378
    (0.36, (27, 32, 85)),    # #1b2055
    (0.72, (11, 15, 40)),    # #0b0f28
    (1.00, (5, 6, 15)),      # #05060f
]
BLOOM = (86, 150, 255, 0.20)      # 画框背后冷色辉光
WARM = (255, 208, 138, 0.13)      # 底部暖光（呼应立绘底部的光点）

# 「白」的判定：足够亮 + 足够中性。象牙色/奶油金 (max-min 很大) 不会被误判。
WHITE_MIN_CHANNEL = 232
WHITE_MAX_SPREAD = 14

# 立绘轮廓之外只保留「有彩度的」装饰（蓝花瓣等）；低彩度的浅色线稿/碎块一并清掉，
# 否则它们在深色底上会变成脏灰斑。
OUTSIDE_MIN_CHROMA = 30
OUTSIDE_CHROMA_RANGE = 60
OUTSIDE_FEATHER = 2

STAR_SEED = 20260924


def clip255(a: np.ndarray) -> np.ndarray:
    return np.clip(a, 0, 255)


def radial(w: int, h: int, cx: float, cy: float, radius: float) -> np.ndarray:
    """归一化径向距离场：中心 0，半径处 1，之外 >1。"""
    ys, xs = np.mgrid[0:h, 0:w]
    return np.sqrt(((xs - cx) / radius) ** 2 + ((ys - cy) / radius) ** 2)


def space_background(w: int, h: int) -> np.ndarray:
    """深空底：径向渐变 + 冷色辉光 + 底部暖光 + 星尘 + 暗角。"""
    # 1) 主渐变
    d = radial(w, h, 0.50 * w, 0.32 * h, 1.35 * h)
    layer = np.zeros((h, w, 3), dtype=np.float64)
    for i in range(len(SPACE_STOPS) - 1):
        p0, c0 = SPACE_STOPS[i]
        p1, c1 = SPACE_STOPS[i + 1]
        t = np.clip((d - p0) / (p1 - p0), 0.0, 1.0)
        seg = np.array(c0, dtype=np.float64) * (1 - t)[..., None] + np.array(c1, dtype=np.float64) * t[..., None]
        layer = np.where(((d >= p0) & (d <= p1))[..., None], seg, layer)
    layer = np.where((d < SPACE_STOPS[0][0])[..., None], np.array(SPACE_STOPS[0][1], float), layer)
    layer = np.where((d > SPACE_STOPS[-1][0])[..., None], np.array(SPACE_STOPS[-1][1], float), layer)

    # 2) 卡框背后的冷色辉光，让边框「发光」而不是贴在平底上
    r, g, b, a = BLOOM
    glow = np.clip(1.0 - radial(w, h, 0.50 * w, 0.50 * h, 0.72 * h), 0.0, 1.0) ** 1.6 * a
    layer = layer * (1 - glow[..., None]) + np.array([r, g, b], float) * glow[..., None]

    # 3) 底部暖光
    r, g, b, a = WARM
    warm = np.clip(1.0 - radial(w, h, 0.50 * w, 0.97 * h, 0.30 * h), 0.0, 1.0) ** 2.0 * a
    layer = layer * (1 - warm[..., None]) + np.array([r, g, b], float) * warm[..., None]

    # 4) 暗角
    vig = 1.0 - np.clip(radial(w, h, 0.50 * w, 0.50 * h, 1.15 * h), 0.0, 1.0) ** 2.2 * 0.55
    layer = layer * vig[..., None]

    # 5) 确定性的星尘，让留白不空
    rng = np.random.default_rng(STAR_SEED)
    stars = np.zeros((h, w), dtype=np.float64)
    for _ in range(int(w * h / 2600)):
        x = int(rng.integers(0, w))
        y = int(rng.integers(0, h))
        stars[y, x] = max(stars[y, x], float(rng.random()) ** 2.4)
    stars = np.asarray(
        Image.fromarray((stars * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)),
        dtype=np.float64,
    ) / 255.0
    layer = layer + stars[..., None] * np.array([210, 228, 255], float) * 0.85

    return clip255(layer)


def near_white_mask(src: np.ndarray) -> np.ndarray:
    lo = src.min(axis=2)
    hi = src.max(axis=2)
    return (lo >= WHITE_MIN_CHANNEL) & ((hi - lo) <= WHITE_MAX_SPREAD)


def artwork_silhouette(src: np.ndarray) -> np.ndarray:
    """立绘的实心轮廓（含填洞）。

    母图里近白像素分两类：一类与图像边缘连通（真正的背景），另一类是被线稿
    圈住的孤立白色小块——晶核里的星芒是**有意保留**的高光，边框外的碎块则是
    要清掉的残渣。先把立绘本体取出来填洞，得到一张「哪些地方属于这张图」的
    地图，用来区分这两类。
    """
    labels, count = ndimage.label(near_white_mask(src))
    if count == 0:
        return np.ones(src.shape[:2], dtype=bool)

    border = set(np.unique(np.concatenate([
        labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1],
    ])))
    border.discard(0)

    foreground = ~np.isin(labels, list(border))
    flabels, fcount = ndimage.label(foreground)
    if fcount == 0:
        return np.ones(src.shape[:2], dtype=bool)
    sizes = ndimage.sum(foreground, flabels, range(1, fcount + 1))
    body = flabels == (int(np.argmax(sizes)) + 1)
    return ndimage.binary_fill_holes(body)


def build_background_mask(src: np.ndarray) -> np.ndarray:
    """背景软掩膜（1 = 应当被深空底替换，0 = 保留立绘像素）。"""
    lo = src.min(axis=2)
    hi = src.max(axis=2)
    chroma = hi - lo

    labels, count = ndimage.label(near_white_mask(src))
    if count == 0:
        mask = np.zeros(src.shape[:2], dtype=np.float64)
    else:
        border_labels = set(np.unique(np.concatenate([
            labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1],
        ])))
        border_labels.discard(0)
        mask = np.isin(labels, list(border_labels)).astype(np.float64)

    # 轮廓之外：只有「有明显彩度」的像素算立绘，其余（白块、灰线稿）一律清掉
    outside = ~ndimage.binary_dilation(artwork_silhouette(src), iterations=OUTSIDE_FEATHER)
    keep_outside = np.clip((chroma - OUTSIDE_MIN_CHROMA) / OUTSIDE_CHROMA_RANGE, 0.0, 1.0)
    mask = np.maximum(mask, np.where(outside, 1.0 - keep_outside, 0.0))

    soft = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
    return np.asarray(soft, dtype=np.float64) / 255.0


def render(im: Image.Image, art_width: int, canvas_ratio: float, art_height_fraction: float) -> np.ndarray:
    """把立绘合成到带留白的深空画布上，返回 RGB 数组。"""
    if art_width and art_width != im.width:
        im = im.resize((art_width, round(im.height * art_width / im.width)), Image.LANCZOS)

    art = np.asarray(im, dtype=np.float64)
    art_h, art_w = art.shape[:2]

    # 画布高度由「立绘占 89%」反推，宽度由画布宽高比反推
    canvas_h = int(round(art_h / art_height_fraction))
    canvas_w = int(round(canvas_h * canvas_ratio))
    offset_x = (canvas_w - art_w) // 2
    offset_y = (canvas_h - art_h) // 2

    canvas = space_background(canvas_w, canvas_h)

    # 立绘自己的底色直接取画布上同位置的切片 —— 保证贴上去之后没有接缝
    local_bg = canvas[offset_y:offset_y + art_h, offset_x:offset_x + art_w]

    alpha = 1.0 - build_background_mask(art)
    merged = local_bg * (1 - alpha[..., None]) + art * alpha[..., None]

    canvas[offset_y:offset_y + art_h, offset_x:offset_x + art_w] = merged
    return clip255(canvas).astype(np.uint8)


def verify_canvas(canvas_w: int, canvas_h: int, art_w: int, art_h: int) -> list[tuple[float, float]]:
    """校验常见卡背宽高比在 cover 下的裁切量是否都落在留白内。"""
    margin_x = (canvas_w - art_w) / 2 / canvas_w
    margin_y = (canvas_h - art_h) / 2 / canvas_h
    ratio = canvas_w / canvas_h
    report = []
    for name, e in (("场地卡 100×130", 100 / 130), ("卡组堆 64×88", 64 / 88),
                    ("对手手牌 58×80", 58 / 80), ("卡包预览 .70", 0.70)):
        if e >= ratio:
            crop = (1 - ratio / e) / 2          # 上下各裁掉画布高度的比例
            report.append((name, crop / margin_y))   # <1 即安全
        else:
            crop = (1 - e / ratio) / 2          # 左右各裁掉画布宽度的比例
            report.append((name, crop / margin_x))
    return report


def main() -> int:
    ap = argparse.ArgumentParser(description="生成卡背 WebP")
    ap.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--art-width", type=int, default=528, help="立绘渲染宽度（留白前）")
    ap.add_argument("--canvas-ratio", type=float, default=0.70, help="画布宽高比，取卡背最窄的那个")
    ap.add_argument("--art-height-fraction", type=float, default=0.89, help="立绘占画布高度的比例")
    ap.add_argument("--quality", type=int, default=84)
    ap.add_argument("--keep-png", action="store_true", help="同时输出 PNG 便于人工比对")
    args = ap.parse_args()

    if not args.master.exists():
        print(f"母图不存在: {args.master}", file=sys.stderr)
        return 1

    source = Image.open(args.master).convert("RGB")
    out = render(source, args.art_width, args.canvas_ratio, args.art_height_fraction)
    result = Image.fromarray(out)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.out, "WEBP", quality=args.quality, method=6)

    art_w = min(args.art_width, source.width)
    art_h = round(source.height * art_w / source.width)
    checks = verify_canvas(result.width, result.height, art_w, art_h)

    print(f"母图      : {args.master.name}  {source.width}×{source.height}")
    print(f"画布      : {result.width}×{result.height}  (比例 {result.width / result.height:.3f})"
          f"  立绘 {art_w}×{art_h} 居中，留白 横向 {(result.width - art_w) // 2}px / 纵向 {(result.height - art_h) // 2}px")
    print("裁切校验  : " + "  ".join(f"{n} 用掉留白的 {v:.0%}{'✔' if v <= 1 else '✘'}" for n, v in checks))
    print(f"产物      : {args.out}  {args.out.stat().st_size / 1024:.1f} KB")
    if args.keep_png:
        png = args.out.with_suffix(".png")
        result.save(png)
        print(f"对照 PNG  : {png}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
