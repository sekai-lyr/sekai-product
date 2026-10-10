"""
卡图转码：把被卡牌引用的原始图片转成两档 WebP。
  thumb/  宽 320px  q72  —— 手牌、场上、收藏网格、卡组编辑器
  card/   宽 640px  q80  —— 详情弹窗、卡包演出
输出目录：assets/cards/webp/<tier>/<原相对路径去掉扩展名>.webp
原始文件保持不动，作为前端加载失败时的回退源。
"""
import json
import os
import sys
import time
from PIL import Image, ImageOps

WORKLIST = r"D:\Sekai_two\memory-16\.bug-review\image-worklist.json"
REPORT = r"D:\Sekai_two\memory-16\.bug-review\image-conversion-report.json"
TIERS = [("thumb", 320, 72), ("card", 640, 80)]

with open(WORKLIST, encoding="utf-8") as fh:
    work = json.load(fh)
ROOT = work["root"]
IMAGES = work["images"]

out_root = os.path.join(ROOT, "assets", "cards", "webp")
results = []
failures = []
before_total = 0
after_total = {name: 0 for name, _, _ in TIERS}
started = time.time()

for index, rel in enumerate(IMAGES, 1):
    src = os.path.join(ROOT, rel.replace("/", os.sep))
    # 目标路径要与前端 card-images.js 的约定一致：
    # assets/cards/<子目录>/<名字>.<ext>  ->  assets/cards/webp/<tier>/<子目录>/<名字>.webp
    rel_in_cards = rel[len("assets/cards/"):] if rel.startswith("assets/cards/") else rel
    stem = os.path.splitext(rel_in_cards)[0]
    size_before = os.path.getsize(src)
    before_total += size_before
    try:
        with Image.open(src) as image:
            image = ImageOps.exif_transpose(image)
            has_alpha = image.mode in ("RGBA", "LA") or (
                image.mode == "P" and "transparency" in image.info
            )
            if has_alpha:
                alpha = image.convert("RGBA").getchannel("A")
                if alpha.getextrema()[0] < 255:
                    base = image.convert("RGBA")
                else:
                    base = image.convert("RGB")
            else:
                base = image.convert("RGB")

            entry = {"source": rel, "bytes": size_before, "size": list(base.size), "tiers": {}}
            for tier, max_width, quality in TIERS:
                if base.width > max_width:
                    height = max(1, round(base.height * max_width / base.width))
                    resized = base.resize((max_width, height), Image.LANCZOS)
                else:
                    resized = base
                target_dir = os.path.join(out_root, tier, os.path.dirname(stem))
                os.makedirs(target_dir, exist_ok=True)
                target = os.path.join(out_root, tier, stem + ".webp")
                resized.save(target, "WEBP", quality=quality, method=5)
                produced = os.path.getsize(target)
                after_total[tier] += produced
                entry["tiers"][tier] = {"bytes": produced, "size": list(resized.size)}
            results.append(entry)
    except Exception as error:  # noqa: BLE001 - 逐文件记录，避免整体中断
        failures.append({"source": rel, "error": f"{type(error).__name__}: {error}"})
    if index % 50 == 0 or index == len(IMAGES):
        print(f"  {index}/{len(IMAGES)} 已处理，用时 {time.time() - started:.0f}s", flush=True)

summary = {
    "images": len(IMAGES),
    "failed": len(failures),
    "bytes_before": before_total,
    "bytes_after": after_total,
    "seconds": round(time.time() - started, 1),
    "failures": failures,
}
with open(REPORT, "w", encoding="utf-8") as fh:
    json.dump({"summary": summary, "files": results}, fh, ensure_ascii=False, indent=1)

mb = 1024 * 1024
print(f"\n原始合计: {before_total / mb:.1f} MB")
for tier, _, _ in TIERS:
    print(f"{tier:6s} 合计: {after_total[tier] / mb:.1f} MB  (平均 {after_total[tier] / max(1, len(results)) / 1024:.0f} KB/张)")
print(f"失败: {len(failures)}")
if failures:
    for item in failures[:10]:
        print("  ", item)
