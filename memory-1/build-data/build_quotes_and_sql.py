# -*- coding: utf-8 -*-
"""
Sekai Data Object - 全量数据构建（阶段B：台词数据集匹配 + 全量 init.sql 生成）
台词数据源：HuggingFace 公开数据集（JA 10388条日文原文 / EN 8612条英文）
"""
import json
import os
import re
import difflib
import pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
DATA_DIR = os.path.join(BASE, 'data')
IMG_DIR = os.path.join(ROOT, 'uploads', 'images')
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\ADMINI~1\AppData\Local\Temp\opencode'), 'opencode')
JA_Q = os.path.join(TMP, 'anime_quotes_ja.parquet')
EN_Q = os.path.join(TMP, 'anime_quotes_en.csv')
SM_Q = os.path.join(TMP, 'anime_quotes_small.csv')

CN_TITLES = {
    20755: '暗杀教室', 20464: '排球少年!!', 101921: '辉夜大小姐想让我告白', 4224: '龙与虎',
    20613: '斩·赤红之瞳！', 21202: '为美好的世界献上祝福！', 112151: '鬼灭之刃 无限列车篇',
    20623: '寄生兽 生命的准则', 99423: 'DARLING in the FRANXX', 142329: '鬼灭之刃 游郭篇',
    101338: '灵能百分百 第二季', 6547: '天使的心跳', 112641: '辉夜大小姐想让我告白？',
    10620: '未来日记', 20832: '不死者之王', 20992: '排球少年!! 第二季',
    15809: '打工吧！魔王大人', 11111: '替身', 21699: '为美好的世界献上祝福！2',
    21170: '暗杀教室 第二季', 21698: '排球少年!! 乌野高中 VS 白鸟泽学园高中',
    129874: '鬼灭之刃 无限列车篇 (TV)', 14741: '中二病也要谈恋爱！', 10087: 'Fate/Zero 命运长夜前传',
    100240: '东京喰种:re', 119661: 'Re：从零开始的异世界生活 第二季 Part 2',
    176496: '我独自升级 第二季', 116006: '高校之神', 2167: 'CLANNAD',
    6746: '无头骑士异闻录', 106625: '排球少年!! TO THE TOP',
    125367: '辉夜大小姐想让我告白-超级浪漫-', 7054: '会长是女仆大人', 11771: '黑子的篮球',
    18153: '境界的彼方', 5680: '轻音少女', 20698: '我的青春恋爱物语果然有问题。续',
    21613: '幼女战记', 139630: '我的英雄学院 第六季', 18897: '伪恋',
    98437: '不死者之王 II', 19603: 'Fate/stay night 无限剑制',
    130003: '孤独摇滚！', 140439: '灵能百分百 第三季', 14227: '邻座的怪同学',
    21518: '食戟之灵 贰之皿', 113538: '排球少年!! TO THE TOP 2',
    32: '新世纪福音战士剧场版 Air/真心为你', 172463: '咒术回战 死灭回游 前篇',
    339: '玲音', 164: '命运石之门 负荷领域的既视感',
}

_PUNCT = '\\s' + u'\u30fb' + u'\u2010\\-_\'"`~' + u'\u301c!！?？:：.。、,，' + u'\uff08\uff09()\\[\\]\u3010\u3011\u201c\u201d' + u'&\u00d7*+\uff1d=\uff0f/\\\\'

def norm(s):
    s = (s or '').lower().replace('\u689d', '\u6761').replace('\u9ad9', '\u9ad8')
    s = re.sub('[' + _PUNCT + ']', '', s)
    return s

def norm_jp(s):
    s = (s or '').replace('\u689d', '\u6761').replace('\u9ad9', '\u9ad8')
    s = re.sub('[' + _PUNCT + ']', '', s)
    return s

def clean_quote(text):
    if not text:
        return None
    text = str(text).strip()
    if 'XNUMX' in text or '{{' in text or '}}' in text or 'http' in text.lower():
        return None
    return re.sub(r'\s+', ' ', text)

def strip_attr(text, char):
    if not text:
        return text
    for sep in ['–', '—', '-', '〜', '~']:
        for pat in [r'\s*%s\s*%s\s*$' % (re.escape(sep), re.escape(char)),
                    r'\s*%s\s*$' % re.escape(sep)]:
            try:
                if re.search(pat, text):
                    text = re.sub(pat, '', text)
            except re.error:
                pass
    return text.strip()

def main():
    with open(os.path.join(DATA_DIR, 'full_data.json'), encoding='utf-8') as f:
        full = json.load(f)
    with open(os.path.join(DATA_DIR, 'anilist_top200.json'), encoding='utf-8') as f:
        top = json.load(f)

    series = full['series']
    chars = full['characters']  # aid(str) -> list

    # ---- 标题索引 ----
    aids = [s['aid'] for s in series]
    title_map = {}
    for s in series:
        s['title'] = CN_TITLES.get(s['aid'], s['title'])
    for s in series:
        title_map[norm(s['title'])] = s['aid']
    for t in top:
        aid = t['id']
        if aid not in [s['aid'] for s in series]:
            continue
        for key in (t.get('title') or {}).values():
            if key:
                title_map.setdefault(norm(key), aid)
    for s in series:
        title_map.setdefault(norm(s['original']), s['aid'])

    # ---- 手动别名映射（续作/别名 slug） ----
    MANUAL = {
        'ワンダーエッグの優先順位': 124845,
        '無職転生': 127720,
        '転生スライム': 108511,
        'ヴィンランドサガ': 136430,
        'モブサイコ100': 101338,
        'ジョジョの奇妙な冒険': 21450,
        '七つの大罪': 99539,
        'ソードアートオンライン': 100182,
        'ワンパンマン': 97668,
        'ノラガミ': 21128,
        'エリートの名言の教室': 145545,
        '新世紀エヴァンゲリオン': 32,
        '炎炎ノ消防隊': 114236,
        'ドクターストーン': 105333,
        'ワンダーエッグプライオリティ': 124845,
        'ブルーロック': 137822,
        'バナナフィッシュ': 100388,
        'ゆめみる少女': 104157,
        'ぼっちざろっく': 130003,
        'ドレスアップダーリン': 132405,
        'ニセコイ': 18897,
        'このすば': 21699,
        'Attack on Titan Season 2': 20958,
        'Attack on Titan Season 3': 104578,
        'Attack on Titan Final Season': 110277,
        'Attack on Titan Final Season Part 2': 131681,
        'My Hero Academia Season 2': 21856,
        'My Hero Academia Season 3': 100166,
        'My Hero Academia Season 4': 104276,
        'My Hero Academia Season 5': 117193,
        'My Hero Academia Season 6': 139630,
        'Demon Slayer Mugen Train': 112151,
        'Demon Slayer Entertainment District': 142329,
        'Demon Slayer Swordsmith Village': 145139,
        'Demon Slayer Hashira Training': 166240,
        'Jujutsu Kaisen 0': 131573,
        'Jujutsu Kaisen Season 2': 145064,
        'Jujutsu Kaisen Shimetsu': 172463,
        'Kaguya-sama Love is War 2': 112641,
        'Kaguya-sama Ultra Romantic': 125367,
        'SPY x FAMILY Season 2': 142838,
        'Haikyuu Second Season': 20992,
        'Haikyuu Third Season': 21698,
        'Haikyuu To The Top': 106625,
        'Haikyuu To The Top 2': 113538,
        'Overlord II': 98437,
        'KonoSuba 2': 21699,
        'Banana Fish': 100388,
        'Blue Lock': 137822,
        'Solo Leveling': 151807,
        'Solo Leveling Arise from the Shadow': 176496,
        'My Dress-Up Darling': 132405,
        'Komi Cant Communicate': 133965,
        'I Want to Eat Your Pancreas': 99750,
        'Dororo': 101347,
        'Dr STONE': 105333,
        'Call of the Night': 141391,
        'Wonder Egg Priority': 124845,
        'Mashle': 151801,
        'Don t Toy with Me Miss Nagatoro': 120697,
        'Misfit of Demon King Academy': 112301,
        'Rascal Does Not Dream of a Dreaming Girl': 104157,
        'Vinland Saga Season 2': 136430,
        'Hell Paradise': 128893,
        'Apothecary Diaries': 161645,
        'Oshi no Ko': 150672,
        'Dandadan': 171018,
        'That Time I Got Reincarnated as a Slime Season 2': 116742,
        'Eighty Six': 116589,
        'The God of High School': 116006,
        'ReZero Season 2': 108632,
        'ReZero Season 2 Part 2': 119661,
        'JoJo Diamond is Unbreakable': 21450,
        'JoJo Stardust Crusaders': 20799,
        'JoJo Golden Wind': 102883,
        'Kimetsu no Yaiba Movie Mugen Train': 112151,
        'Demon Slayer Kimetsu no Yaiba Mugen Train': 112151,
    }
    for raw, aid in MANUAL.items():
        title_map.setdefault(norm(raw), aid)
        title_map.setdefault(norm_jp(raw), aid)

    # ---- 角色索引 ----
    char_idx = {}  # normalized original -> (aid, char)
    for aid, clist in chars.items():
        for c in clist:
            if c.get('original'):
                char_idx.setdefault(norm_jp(c['original']), (int(aid), c))
            if c.get('name'):
                char_idx.setdefault(norm(c['name']), (int(aid), c))

    def match_anime(name, jp=False):
        n = norm_jp(name) if jp else norm(name)
        if not n or len(n) < 2:
            return None
        if n in title_map:
            return title_map[n]
        for k, aid in title_map.items():
            if len(n) >= 4 and (n in k or k in n):
                return aid
        best, score = None, 0.0
        for k, aid in title_map.items():
            r = difflib.SequenceMatcher(None, n, k).ratio()
            if r > score:
                best, score = aid, r
        return best if score >= 0.82 else None

    def match_char(anime_aid, name, jp=False):
        n = norm_jp(name) if jp else norm(name)
        if not n or len(n) < 2:
            return None
        clist = chars.get(str(anime_aid)) or []
        for c in clist:
            cand = norm_jp(c.get('original')) if jp else norm(c.get('name'))
            if cand == n:
                return c
            if len(n) >= 3 and (n in cand or cand in n):
                return c
        for c in clist:
            cand = norm(c.get('name')) if not jp else norm(c.get('original'))
            if len(n) >= 3 and (n in cand or cand in n):
                return c
        return None

    quotes = []  # dict(series_id, character_id, character_name, content)

    # ---- JA 数据集 ----
    ja = pd.read_parquet(JA_Q)
    ja_matched_series = 0
    ja_total = 0
    for _, row in ja.iterrows():
        content = clean_quote(row['Quote'])
        if not content:
            continue
        char = str(row['Character']).strip()
        url = str(row['URL'])
        m = re.search(r'animemotivation\.com/([^/?]+)/?$', url)
        slug = urllib.parse.unquote(m.group(1)) if m else ''
        slug = re.sub(r'(の名言|の引用|の名言集|のセリフ|名言|引用|の言葉|のことば|のクォート|の格言)$', '', slug)
        aid = None
        if slug:
            aid = match_anime(slug, jp=True)
        if aid is None and char:
            c = char_idx.get(norm_jp(char))
            if c:
                aid = c[0]
        if aid is None:
            continue
        ja_total += 1
        content = strip_attr(content, char)
        content = clean_quote(content)
        if not content:
            continue
        c = match_char(aid, char, jp=True) if char else None
        quotes.append({
            'series_id': aid,
            'character_id': c.get('id') if c else None,
            'character_name': (c.get('original') or c.get('name') or char) if c else char,
            'content': content,
        })
        ja_matched_series += 1
    print('[JA] matched quotes:', ja_matched_series, '/', len(ja))

    # ---- EN 数据集 ----
    en = pd.read_csv(EN_Q)
    en_matched = 0
    for _, row in en.iterrows():
        content = clean_quote(row['Quote'])
        if not content:
            continue
        anime = re.sub(r'^\((.*)\)$', r'\1', str(row['Anime']).strip())
        char = str(row['Character']).strip()
        aid = match_anime(anime)
        if aid is None:
            continue
        c = match_char(aid, char) if char else None
        quotes.append({
            'series_id': aid,
            'character_id': c.get('id') if c else None,
            'character_name': (c.get('name') or c.get('original') or char) if c else char,
            'content': content,
        })
        en_matched += 1
    print('[EN] matched quotes:', en_matched, '/', len(en))

    # ---- SMALL 数据集 ----
    sm = pd.read_csv(SM_Q)
    sm_matched = 0
    for _, row in sm.iterrows():
        content = clean_quote(row['Quote'])
        if not content:
            continue
        anime = str(row['Anime']).strip()
        char = str(row['Character']).strip()
        aid = match_anime(anime)
        if aid is None:
            continue
        c = match_char(aid, char) if char else None
        quotes.append({
            'series_id': aid,
            'character_id': c.get('id') if c else None,
            'character_name': (c.get('name') or c.get('original') or char) if c else char,
            'content': content,
        })
        sm_matched += 1
    print('[SMALL] matched quotes:', sm_matched, '/', len(sm))

    # ---- 手工精选台词（知名名场面，覆盖无数据源的番剧） ----
    CURATED = [
        (105333, '石神千空', '我就是科学！'),
        (105333, '石神千空', '别笑！这也是科学的一部分。'),
        (105333, '石神千空', '100亿%没有问题。'),
        (151807, '成振宇', '只要不断变强，就不会再失去任何人。'),
        (108632, '雷姆', '我喜欢你，昴君。'),
        (99750, '山内樱良', '我想吃掉你的胰脏。'),
        (137822, '洁世一', '我要成为这个世界第一的前锋。'),
        (137822, '蜂乐回', '足球，就是要快乐地踢啊！'),
        (116589, '蕾娜', '他们和我们一样，都是人。'),
        (133965, '只野仁人', '古见同学，有交流障碍症。'),
        (116006, '陈毛利', '我是神！'),
        (151801, '马修·班迪德', '肌肉可以解决一切问题。'),
        (151801, '马修·班迪德', '只要锻炼肌肉，明天也会到来。'),
        (112301, '阿诺斯·伏尔迪哥德', '我是魔王。'),
        (112301, '阿诺斯·伏尔迪哥德', '抱歉，我太强了。'),
        (114236, '森罗日下部', '我是要成为英雄的男人。'),
        (32, '碇真嗣', '不能逃避！不能逃避！'),
        (32, '碇真嗣', '这就是我的真实。'),
        (112151, '炼狱杏寿郎', '无论衰老还是死亡，都是人类这种短暂生物的美。'),
        (110277, '艾伦·耶格尔', '自由！'),
        (130003, '后藤一里', '我的青春，是练习室的第100次重来。'),
    ]
    for aid, cname, content in CURATED:
        c = None
        clist = chars.get(str(aid)) or []
        for cand in clist:
            if norm_jp(cand.get('original')) == norm_jp(cname) or norm(cand.get('name')) == norm(cname):
                c = cand
                break
        quotes.append({
            'series_id': aid,
            'character_id': c.get('id') if c else None,
            'character_name': (c.get('original') or c.get('name') or cname) if c else cname,
            'content': content,
        })
    print('[CURATED] quotes added:', len(CURATED))

    # ---- 去重 ----
    seen = set()
    uniq = []
    for q in quotes:
        key = (q['series_id'], q['character_id'], q['content'])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(q)
    print('[quotes] total:', len(quotes), 'unique:', len(uniq))

    from collections import Counter
    per_series = Counter(q['series_id'] for q in uniq)
    cov = len(per_series)
    print('[quotes] series covered:', cov, '/', len(series))

    full['quotes'] = uniq
    with open(os.path.join(DATA_DIR, 'full_data.json'), 'w', encoding='utf-8') as f:
        json.dump(full, f, ensure_ascii=False, indent=1)
    print('[done] full_data.json updated with quotes')

if __name__ == '__main__':
    import urllib.parse
    main()
