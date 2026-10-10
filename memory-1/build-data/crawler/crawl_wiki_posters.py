import requests
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'}

OUT = r'B:\Sekai\Sekai\sekai\memory-1\uploads\images'
os.makedirs(OUT, exist_ok=True)


def download(url, filename, referer=None):
    headers = dict(H)
    if referer:
        headers['Referer'] = referer
    try:
        r = requests.get(url, headers=headers, timeout=30)
        if r.status_code != 200 or len(r.content) < 1000:
            print(f'FAIL {filename} <- {url[:80]} status={r.status_code} size={len(r.content)}')
            return False
        path = os.path.join(OUT, filename)
        with open(path, 'wb') as f:
            f.write(r.content)
        print(f'OK   {filename} ({len(r.content)} bytes)')
        return True
    except Exception as e:
        print(f'ERR  {filename} : {str(e)[:60]}')
        return False


# 维基百科官方海报（去掉 utm 参数）
posters = {
    'shingeki_poster.jpg': 'https://upload.wikimedia.org/wikipedia/zh/f/f1/Attack_on_Titan_vol1.jpg',
    'steins_poster.jpg': 'https://upload.wikimedia.org/wikipedia/zh/0/08/Steins_Gate_Boxart.jpg',
    'ghibli_poster.jpg': 'https://upload.wikimedia.org/wikipedia/zh/0/09/Spirited_away_poster.jpg',
    'kiminona_poster.jpg': 'https://upload.wikimedia.org/wikipedia/zh/4/4e/Your_name_poster.jpg',
    'jujutsu_poster.jpg': 'https://upload.wikimedia.org/wikipedia/zh/2/22/%E5%92%92%E8%A1%93%E8%BF%B4%E6%88%B0.jpg',
    'spy_poster.jpg': 'https://upload.wikimedia.org/wikipedia/zh/5/51/SPY%C3%97FAMILY.jpg',
    'hagaren_poster.jpg': 'https://upload.wikimedia.org/wikipedia/commons/6/61/Fullmetal_Alchemist_Sacred_Star_of_Milos_%28cropped%29.png',
}
for fname, url in posters.items():
    download(url, fname, 'https://zh.wikipedia.org/')

# 进击的巨人官网 news 页找角色图
try:
    r = requests.get('https://shingeki.tv/news/', headers=H, timeout=15)
    import re
    imgs = re.findall(r'(?:src|href)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"', r.text)
    print('=== shingeki news imgs:', len(imgs))
    for i in imgs[:15]:
        print('   ', i[:130])
except Exception as e:
    print('shingeki news ERR', str(e)[:60])

print('DONE')
