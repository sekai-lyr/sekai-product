import requests
import re
import time
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'}

OUT = r'B:\Sekai\Sekai\sekai\memory-1\uploads\images'

chars = {
    'shingeki_eren': 'https://myanimelist.net/character/40882/Eren_Yeager',
    'shingeki_levi': 'https://myanimelist.net/character/4212/Levi_Ackerman',
    'shingeki_armin': 'https://myanimelist.net/character/46494/Armin_Arlert',
    'steins_kurisu': 'https://myanimelist.net/character/34470/Kurisu_Makise',
    'hagaren_mustang': 'https://myanimelist.net/character/68/Roy_Mustang',
    'spy_anya': 'https://myanimelist.net/character/170256/Anya_Forger',
    'spy_yor': 'https://myanimelist.net/character/170329/Yor_Forger',
    'ghibli_haku': 'https://myanimelist.net/character/499/Haku',
}

for fname, url in chars.items():
    try:
        r = requests.get(url, headers=H, timeout=15)
        og = re.findall(r'<meta\s+property="og:image"\s+content="([^"]+)"', r.text)
        if not og:
            print(fname, '-> NO OG IMAGE')
            time.sleep(2)
            continue
        img_url = og[0]
        ext = os.path.splitext(img_url.split('?')[0])[1] or '.jpg'
        if not ext.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
            ext = '.jpg'
        fpath = os.path.join(OUT, fname + ext)
        ir = requests.get(img_url, headers=H, timeout=30)
        if ir.status_code == 200 and len(ir.content) > 1000:
            with open(fpath, 'wb') as f:
                f.write(ir.content)
            print(f'OK {fname}{ext} ({len(ir.content)} bytes) <- {img_url[:90]}')
        else:
            print(f'FAIL {fname} img status={ir.status_code}')
    except Exception as e:
        print(f'ERR {fname} : {str(e)[:60]}')
    time.sleep(2)

# 利威尔确认：MAL 4212 是不是 Levi？
r = requests.get('https://myanimelist.net/character/4212/Levi_Ackerman', headers=H, timeout=15)
title = re.findall(r'<title>(.*?)</title>', r.text)
print('4212 title:', title[:1])
