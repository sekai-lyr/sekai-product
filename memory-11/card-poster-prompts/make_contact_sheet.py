# -*- coding: utf-8 -*-
"""
Build a contact sheet of the SEKAI ARCHIVE posters: one image showing every card,
grouped by series, so a 368-file folder can be reviewed at a glance.

    python make_contact_sheet.py
    python make_contact_sheet.py --src out-jpg-1920 --cols 16
"""
import argparse
import io
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, 'manifest.json')

F_BOLD = r'C:\Windows\Fonts\msyhbd.ttc'
F_MONO = r'C:\Windows\Fonts\consola.ttf'

SERIES_LABEL = {
    'starter_ygo': 'STARTER YGO',
    'picture': 'PICTURE',
    'picture_ssr7': 'PICTURE SSR7',
    'source_archive': 'SOURCE ARCHIVE',
    'nightcord': 'NIGHTCORD',
}


def fit(dr, text, f, maxw):
    if dr.textlength(text, font=f) <= maxw:
        return text
    while text and dr.textlength(text + '…', font=f) > maxw:
        text = text[:-1]
    return text + '…'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(HERE, 'out-jpg-1920'))
    ap.add_argument('--out', default=os.path.join(HERE, '00-总览-contact-sheet.jpg'))
    ap.add_argument('--cols', type=int, default=16)
    ap.add_argument('--thumb-w', type=int, default=300)
    ap.add_argument('--scale', type=float, default=1.0, help='supersample factor for crisp text')
    ap.add_argument('--quality', type=int, default=90)
    args = ap.parse_args()

    recs = json.load(io.open(MANIFEST, encoding='utf-8'))
    order = ['source_archive', 'picture', 'picture_ssr7', 'nightcord', 'starter_ygo']
    recs.sort(key=lambda r: (order.index(r['series']) if r['series'] in order else 99, r['id']))

    tw = args.thumb_w
    th = int(tw * 9 / 16)
    s = args.scale
    TW, TH = int(tw * s), int(th * s)
    gap = int(10 * s)
    margin = int(44 * s)
    label_h = int(40 * s)
    header_h = int(76 * s)
    row_h = TH + label_h + gap

    cols = args.cols
    W = margin * 2 + cols * TW + (cols - 1) * gap

    # --- layout pass: work out total height ------------------------------
    rows = []
    for series in order + [s for s in {r['series'] for r in recs} if s not in order]:
        group = [r for r in recs if r['series'] == series]
        if not group:
            continue
        rows.append(('header', series, len(group)))
        for i in range(0, len(group), cols):
            rows.append(('row', group[i:i + cols], 0))
    H = margin * 2 + sum(header_h if k == 'header' else row_h for k, _, _ in rows)

    paper = (238, 236, 231)
    ink = (34, 34, 36)
    accent = (150, 122, 74)
    img = Image.new('RGB', (W, H), paper)
    dr = ImageDraw.Draw(img)

    f_head = ImageFont.truetype(F_BOLD, int(34 * s))
    f_name = ImageFont.truetype(F_BOLD, int(20 * s))
    f_id = ImageFont.truetype(F_MONO, int(15 * s))
    f_title = ImageFont.truetype(F_BOLD, int(46 * s))

    # title block
    dr.text((margin, int(margin * 0.35)), 'SEKAI ARCHIVE — 368 CARD POSTER SET',
            font=f_title, fill=ink)
    dr.text((W - margin - dr.textlength('2560x1440 PNG  /  1920x1080 JPEG',
                                        font=f_id), int(margin * 0.62)),
            '2560x1440 PNG  /  1920x1080 JPEG', font=f_id, fill=accent)

    y = margin + int(64 * s)
    missing = []
    for kind, payload, count in rows:
        if kind == 'header':
            dr.line((margin, y + int(header_h * 0.72), W - margin, y + int(header_h * 0.72)),
                    fill=ink, width=max(1, int(s)))
            dr.text((margin, y + int(header_h * 0.16)),
                    '%s   ~   %d CARDS' % (SERIES_LABEL.get(payload, payload.upper()), count),
                    font=f_head, fill=ink)
            y += header_h
            continue

        x = margin
        for rec in payload:
            p = os.path.join(args.src, rec['id'] + '.jpg')
            if not os.path.exists(p):
                p = os.path.join(args.src, rec['id'] + '.png')
            if os.path.exists(p):
                with Image.open(p) as im:
                    img.paste(im.convert('RGB').resize((TW, TH), Image.Resampling.LANCZOS), (x, y))
            else:
                missing.append(rec['id'])
                dr.rectangle((x, y, x + TW, y + TH), outline=(200, 90, 90), width=int(2 * s))
            dr.rectangle((x, y, x + TW, y + TH), outline=(180, 178, 173), width=max(1, int(s)))
            dr.text((x, y + TH + int(4 * s)), fit(dr, rec['name'], f_name, TW),
                    font=f_name, fill=ink)
            dr.text((x, y + TH + int(24 * s)), rec['id'], font=f_id, fill=(140, 138, 134))
            x += TW + gap
        y += row_h

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if args.out.lower().endswith(('.jpg', '.jpeg')):
        img.save(args.out, 'JPEG', quality=args.quality, optimize=True, progressive=True)
    else:
        img.save(args.out, 'PNG')
    print('contact sheet -> %s' % args.out)
    print('size          : %dx%d  (%.1f MB)' % (img.width, img.height,
                                                os.path.getsize(args.out) / 1024 / 1024))
    print('cards placed  : %d' % (len(recs) - len(missing)))
    if missing:
        print('MISSING       : %d  %s' % (len(missing), missing[:10]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
