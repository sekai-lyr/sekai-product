from pathlib import Path
from PIL import Image

RAW = Path("tools/trap-v2-raw")
OUT = Path("src/main/resources/static/images/vfx")
CELL = 384

written = []
for source in sorted(RAW.glob("trap-*-sheet-v2-raw.png")):
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    sheet = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    for index in range(16):
        column, row = index % 4, index // 4
        left, right = round(column * width / 4), round((column + 1) * width / 4)
        top, bottom = round(row * height / 4), round((row + 1) * height / 4)
        frame = image.crop((left, top, right, bottom))
        frame.thumbnail((CELL, CELL), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        tile.alpha_composite(frame, ((CELL - frame.width) // 2, (CELL - frame.height) // 2))
        sheet.alpha_composite(tile, (column * CELL, row * CELL))
    target = OUT / source.name.replace("-raw", "")
    sheet.save(target, optimize=True)
    written.append((target.name, target.stat().st_size, sheet.getextrema()[3]))

print({"written": len(written), "transparent": sum(alpha[0] == 0 for _, _, alpha in written)})
