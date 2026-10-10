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
            print(f'FAIL {filename} <- {url} status={r.status_code} size={len(r.content)}')
            return False
        path = os.path.join(OUT, filename)
        with open(path, 'wb') as f:
            f.write(r.content)
        print(f'OK   {filename} ({len(r.content)} bytes) <- {url[:100]}')
        return True
    except Exception as e:
        print(f'ERR  {filename} <- {url} : {str(e)[:60]}')
        return False


# ==== 1. 鬼灭之刃官网角色主视觉（01-08: 炭治郎/祢豆子/善逸/伊之助/义勇/忍/炼狱/宇髄） ====
kimetsu_base = 'https://kimetsu.com/anime/portal/assets/img/character/main/'
kimetsu_map = {
    '01': 'kimetsu_tanjiro.jpg',
    '02': 'kimetsu_nezuko.jpg',
    '03': 'kimetsu_zenitsu.jpg',
    '04': 'kimetsu_inosuke.jpg',
    '05': 'kimetsu_giyu.jpg',
    '06': 'kimetsu_shinobu.jpg',
    '07': 'kimetsu_rengoku.jpg',
    '08': 'kimetsu_uzui.jpg',
}
for num, fname in kimetsu_map.items():
    download(f'{kimetsu_base}{num}.jpg', fname, 'https://kimetsu.com/anime/character/risshihen/')

# ==== 2. 咒术回战官网角色（thumb 1-5: 虎杖/伏黑/钉崎/五条/宿傩） ====
jujutsu_base = 'https://jujutsukaisen.jp/images/chara_shimetsu/'
jujutsu_map = {
    '1': 'jujutsu_yuji.png',
    '2': 'jujutsu_megumi.png',
    '3': 'jujutsu_nobara.png',
    '4': 'jujutsu_gojo.png',
    '5': 'jujutsu_sukuna.png',
}
for num, fname in jujutsu_map.items():
    download(f'{jujutsu_base}chara_thumb{num}.png', fname, 'https://jujutsukaisen.jp/character/')

# ==== 3. 间谍过家家官网 ====
download('https://spy-family.net/assets/img/top/chara_bg_loid.png', 'spy_loid.png', 'https://spy-family.net/')
download('https://spy-family.net/assets/img/top/tv_p_s3.jpg', 'spy_keyvisual.jpg', 'https://spy-family.net/')

# ==== 4. 千与千寻官网海报 ====
download('https://www.ghibli.jp/images/chihiro.jpg', 'ghibli_chihiro.jpg', 'https://www.ghibli.jp/works/chihiro/')

# ==== 5. 进击的巨人 - 官网被CDN挡,用官方X/维基备用: 先试 shingeki 图床 ====
download('https://shingeki.tv/assets/img/top/mv01.jpg', 'shingeki_mv01.jpg', 'https://shingeki.tv/')

print('DONE')
