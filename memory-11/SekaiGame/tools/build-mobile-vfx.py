"""为 APK 生成移动端图集：把 static/images/vfx 的 PNG 转成 www/images/vfx-mobile 的 WebP。

沿用既有约定（见本文件历史版本）：缩放到 768px 内含、quality 84、method 4。
默认只补齐 www 里缺失或过期的文件；--all 会整目录重转。

    python tools/build-mobile-vfx.py            # 只补缺失/过期
    python tools/build-mobile-vfx.py --all      # 全部重转
"""
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/main/resources/static/images/vfx"
DST = ROOT / "android-app/app/src/main/assets/www/images/vfx-mobile"
REBUILD_ALL = "--all" in sys.argv
MAX_EDGE = 768
QUALITY = 84


def convert(png: Path):
    out = DST / (png.stem + ".webp")
    if out.exists() and not REBUILD_ALL and out.stat().st_mtime >= png.stat().st_mtime:
        return png.name, out.stat().st_size, "skip"
    with Image.open(png) as raw:
        im = raw.convert("RGBA")
        im.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
        im.save(out, "WEBP", quality=QUALITY, method=4)
    return png.name, out.stat().st_size, "write"


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    files = sorted(SRC.glob("*.png"))
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(convert, files))
    written = [r for r in results if r[2] == "write"]
    total = sum(r[1] for r in results)
    print({
        "source": len(files),
        "written": len(written),
        "skipped": len(results) - len(written),
        "vfx_mobile_mb": round(total / 1024 / 1024, 1),
        "latest": [r[0] for r in written[-4:]],
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
