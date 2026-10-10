# -*- coding: utf-8 -*-
"""
Export lighter variants of the SEKAI ARCHIVE posters.

The 2560x1440 PNGs are the masters; this produces resized JPEG sets for sharing,
web use and any pipeline that does not want a 1.1 GB folder.

    python export_jpeg.py                                  # 1920x1080 q93 -> out-jpg-1920
    python export_jpeg.py --long-edge 1280 --quality 90 --out out-jpg-1280
    python export_jpeg.py --long-edge 0                    # keep 2560x1440, just re-encode
"""
import argparse
import io
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def one(src_path, dst_path, long_edge, quality):
    with Image.open(src_path) as im:
        im = im.convert('RGB')
        if long_edge:
            w, h = im.size
            scale = long_edge / float(max(w, h))
            if scale < 1.0:
                im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                               Image.Resampling.LANCZOS)
        im.save(dst_path, 'JPEG', quality=quality, optimize=True,
                progressive=True, subsampling=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(HERE, 'out'))
    ap.add_argument('--out', default=os.path.join(HERE, 'out-jpg-1920'))
    ap.add_argument('--long-edge', type=int, default=1920,
                    help='0 keeps the original 2560x1440')
    ap.add_argument('--quality', type=int, default=93)
    ap.add_argument('--workers', type=int, default=6)
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()

    if not os.path.isdir(args.src):
        print('source folder missing:', args.src)
        return 1
    files = sorted(f for f in os.listdir(args.src) if f.lower().endswith('.png'))
    if args.limit:
        files = files[:args.limit]
    if not files:
        print('no PNGs found in', args.src)
        return 1

    os.makedirs(args.out, exist_ok=True)
    jobs = [(os.path.join(args.src, f),
             os.path.join(args.out, os.path.splitext(f)[0] + '.jpg')) for f in files]

    print('converting %d files -> %s (long edge %s, q%d)'
          % (len(jobs), args.out, args.long_edge or 'original', args.quality))
    done, errors = 0, []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(one, s, d, args.long_edge, args.quality): d for s, d in jobs}
        for f in as_completed(futs):
            try:
                f.result()
                done += 1
                if done % 50 == 0 or done == len(jobs):
                    print('  %d / %d' % (done, len(jobs)))
            except Exception as e:                                   # noqa: BLE001
                errors.append((os.path.basename(futs[f]), repr(e)[:90]))

    total = sum(os.path.getsize(d) for _, d in jobs if os.path.exists(d))
    print('done: %d converted, %d failed, %.0f MB' % (done, len(errors), total / 1024 / 1024))
    for n, e in errors[:10]:
        print('  FAILED', n, e)
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
