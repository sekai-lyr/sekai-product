# -*- coding: utf-8 -*-
"""
Sekai Data Object - 全站中文本地化流水线
1) 番剧简介 英文->中文
2) 角色简介 英文->中文
3) 台词 日文->中文
4) 角色名/声优名 中文化（主角人工表 + 汉字转换 + 机翻兜底）
5) 标签 英文->中文
输出：build-data/data/full_data_zh.json
"""
import json
import os
import re
import sys
import time
import threading
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, 'data')
OUT = os.path.join(DATA_DIR, 'full_data_zh.json')
CACHE = os.path.join(DATA_DIR, 'gt_cache.json')

sys.path.insert(0, BASE)
from cn_titles import CN_ALL
from cn_chars import MAIN_ZH

try:
    from opencc import OpenCC
    CC = OpenCC('t2s')
except Exception:
    CC = None

GT_URL = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=%s&tl=zh-CN&dt=t&q=%s'

_cache = {}
if os.path.exists(CACHE):
    with open(CACHE, encoding='utf-8') as f:
        _cache = json.load(f)
_cache_lock = threading.Lock()


def save_cache():
    with _cache_lock:
        tmp = CACHE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(_cache, f, ensure_ascii=False)
        os.replace(tmp, CACHE)


def gt(text, sl='en', retries=6):
    text = (text or '').strip()
    if not text:
        return ''
    key = sl + '|' + text
    with _cache_lock:
        if key in _cache:
            return _cache[key]
    for i in range(retries):
        try:
            url = GT_URL % (sl, urllib.parse.quote(text))
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            resp = urllib.request.urlopen(req, timeout=30)
            data = json.loads(resp.read().decode('utf-8'))
            out = ''.join(seg[0] for seg in data[0])
            with _cache_lock:
                _cache[key] = out
            return out
        except Exception:
            time.sleep(1.5 * (i + 1))
    return text


def gt_worker(args):
    text, sl = args
    return gt(text, sl)


def translate_batch(items, sl, workers=6, label=''):
    """items: list of (id, text); returns {id: zh}"""
    results = {}
    todo = [(k, t, sl) for k, t in items if (t or '').strip()]
    print('[%s] batch size: %d (cached: %d)' % (label, len(todo), len(items) - len(todo)))
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(gt_worker, (t, sl)): k for k, t, sl in todo}
        for fut in as_completed(futs):
            k = futs[fut]
            try:
                results[k] = fut.result()
            except Exception as e:
                print('[%s] FAIL %s: %s' % (label, k, e))
            done += 1
            if done % 200 == 0:
                save_cache()
                print('[%s] %d/%d' % (label, done, len(todo)))
    save_cache()
    return results


# ---------------- 名字转换 ----------------

def kanji_convert(s):
    """汉字（日文汉字）-> 简体中文，附加日本特有汉字映射"""
    if not s:
        return ''
    s = re.sub(r'[\u30a0-\u30ff\u3040-\u309f]', '', s)  # 去掉假名
    if CC:
        s = CC.convert(s)
    fixes = {
        '冨': '富', '髙': '高', '黒': '黑', '恵': '惠', '嶋': '岛', '峯': '峰',
        '濱': '滨', '邊': '边', '澤': '泽', '瀬': '濑', '灣': '湾', '郷': '乡',
        '義': '义', '龍': '龙', '竜': '龙', '桜': '樱', '実': '实', '楽': '乐',
        '学': '学', '條': '条', '藤': '藤', '頼': '赖', '願': '愿', '薬': '药',
        '伝': '传', '練': '练', '鉄': '铁', '録': '录', '銀': '银', '鈴': '铃',
        '門': '门', '間': '间', '聞': '闻', '問': '问', '開': '开', '関': '关',
        '団': '团', '園': '园', '国': '国', '囲': '围', '図': '图', '円': '圆',
        '歳': '岁', '権': '权', '権': '权', '応': '应', '圧': '压', '塁': '垒',
        '島': '岛', '鳥': '鸟', '鳴': '鸣', '絵': '绘', '経': '经', '級': '级',
        '続': '续', '総': '总', '統': '统', '結': '结', '絶': '绝', '給': '给',
        '網': '网', '緑': '绿', '線': '线', '編': '编', '縁': '缘', '県': '县',
        '繁': '繁', '繰': '绕', '織': '织', '繋': '系', '美': '美', '群': '群',
        '羽': '羽', '翔': '翔', '聖': '圣', '聡': '聪', '職': '职', '聴': '听',
        '育': '育', '脈': '脉', '脳': '脑', '腰': '腰', '腸': '肠', '腹': '腹',
        '膳': '膳', '興': '兴', '舎': '舍', '舟': '舟', '良': '良', '色': '色',
        '菅': '菅', '菜': '菜', '華': '华', '葉': '叶', '著': '著', '薔': '蔷',
        '薇': '薇', '薩': '萨', '藤': '藤', '薬': '药', '藁': '藁', '蘭': '兰',
        '虎': '虎', '虚': '虚', '蟲': '虫', '蟻': '蚁', '術': '术', '衛': '卫',
        '襲': '袭', '裏': '里', '西': '西', '見': '见', '覚': '觉', '親': '亲',
        '観': '观', '計': '计', '討': '讨', '訓': '训', '設': '设', '訟': '讼',
        '話': '话', '詰': '诘', '詢': '询', '該': '该', '詳': '详', '語': '语',
        '読': '读', '誰': '谁', '調': '调', '談': '谈', '論': '论', '謁': '谒',
        '警': '警', '議': '议', '護': '护', '豊': '丰', '貯': '贮', '貝': '贝',
        '貴': '贵', '買': '买', '資': '资', '賄': '贿', '賞': '赏', '賢': '贤',
        '賣': '卖', '質': '质', '赤': '赤', '走': '走', '起': '起', '超': '超',
        '足': '足', '跳': '跳', '跡': '迹', '践': '践', '車': '车', '軌': '轨',
        '軍': '军', '軟': '软', '軽': '轻', '輪': '轮', '輸': '输', '轟': '轰',
        '辞': '辞', '辰': '辰', '迎': '迎', '近': '近', '迯': '逃', '追': '追',
        '送': '送', '逆': '逆', '透': '透', '逐': '逐', '逓': '递', '通': '通',
        '連': '连', '進': '进', '運': '运', '遊': '游', '過': '过', '道': '道',
        '達': '达', '違': '违', '遠': '远', '遺': '遗', '適': '适', '選': '选',
        '還': '还', '邊': '边', '郎': '郎', '都': '都', '酉': '酉', '配': '配',
        '醒': '醒', '重': '重', '野': '野', '釣': '钓', '鉄': '铁', '銀': '银',
        '長': '长', '門': '门', '閉': '闭', '開': '开', '間': '间', '閻': '阎',
        '関': '关', '阪': '坂', '陽': '阳', '陰': '阴', '隣': '邻', '雄': '雄',
        '雅': '雅', '集': '集', '雑': '杂', '雲': '云', '電': '电', '霊': '灵',
        '青': '青', '靖': '靖', '静': '静', '非': '非', '面': '面', '響': '响',
        '項': '项', '順': '顺', '預': '预', '頑': '顽', '頒': '颁', '頭': '头',
        '顔': '颜', '類': '类', '顧': '顾', '風': '风', '飛': '飞', '飯': '饭',
        '飲': '饮', '飾': '饰', '養': '养', '騎士': '骑士', '高': '高', '髪': '发',
        '鬼': '鬼', '魔': '魔', '魚': '鱼', '鳥': '鸟', '鶏': '鸡', '鹿': '鹿',
        '麻': '麻', '黄': '黄', '黒': '黑', '黙': '默', '齋': '斋', '齊': '齐',
    }
    out = []
    for ch in s:
        out.append(fixes.get(ch, ch))
    return ''.join(out)


# 日文假名 -> 中文音译（用于混合名中的假名部分）
KANA_ZH = {
    'ア': '阿', 'イ': '伊', 'ウ': '乌', 'エ': '埃', 'オ': '奥',
    'カ': '卡', 'キ': '基', 'ク': '库', 'ケ': '凯', 'コ': '科',
    'サ': '萨', 'シ': '希', 'ス': '斯', 'セ': '塞', 'ソ': '索',
    'タ': '塔', 'チ': '奇', 'ツ': '茨', 'テ': '特', 'ト': '托',
    'ナ': '纳', 'ニ': '尼', 'ヌ': '努', 'ネ': '内', 'ノ': '诺',
    'ハ': '哈', 'ヒ': '希', 'フ': '夫', 'ヘ': '赫', 'ホ': '霍',
    'マ': '马', 'ミ': '米', 'ム': '姆', 'メ': '梅', 'モ': '莫',
    'ヤ': '亚', 'ユ': '尤', 'ヨ': '约',
    'ラ': '拉', 'リ': '里', 'ル': '鲁', 'レ': '雷', 'ロ': '罗',
    'ワ': '瓦', 'ヲ': '沃', 'ン': '恩',
    'ガ': '加', 'ギ': '吉', 'グ': '古', 'ゲ': '格', 'ゴ': '戈',
    'ザ': '扎', 'ジ': '吉', 'ズ': '兹', 'ゼ': '泽', 'ゾ': '佐',
    'ダ': '达', 'ヂ': '吉', 'ヅ': '兹', 'デ': '德', 'ド': '多',
    'バ': '巴', 'ビ': '比', 'ブ': '布', 'ベ': '贝', 'ボ': '博',
    'パ': '帕', 'ピ': '皮', 'プ': '普', 'ペ': '佩', 'ポ': '波',
    'ァ': '阿', 'ィ': '伊', 'ゥ': '乌', 'ェ': '埃', 'ォ': '奥',
    'ャ': '亚', 'ュ': '尤', 'ョ': '约', 'ッ': '',
    'ー': '', '・': '·', '＝': '=', '=': '=',
    # 假名组合
    'キャ': '恰', 'キュ': '丘', 'キョ': '乔',
    'シャ': '夏', 'シュ': '修', 'ショ': '晓',
    'チャ': '查', 'チュ': '丘', 'チョ': '乔',
    'ニャ': '尼亚', 'ニュ': '纽', 'ニョ': '纽',
    'ヒャ': '希亚', 'ヒュ': '休', 'ヒョ': '希奥',
    'ミャ': '米亚', 'ミュ': '缪', 'ミョ': '苗',
    'リャ': '里亚', 'リュ': '琉', 'リョ': '辽',
    'ギャ': '加', 'ギュ': '久', 'ギョ': '居',
    'ジャ': '贾', 'ジュ': '朱', 'ジョ': '乔',
    'ビャ': '比亚', 'ビュ': '比优', 'ビョ': '比约',
    'ピャ': '皮亚', 'ピュ': '皮优', 'ピョ': '皮约',
    'ティ': '蒂', 'ディ': '迪', 'ヴァ': '瓦', 'ヴィ': '维',
    'ヴ': '维', 'ファ': '法', 'フィ': '菲', 'フェ': '菲', 'フォ': '福',
    'シェ': '谢', 'ジェ': '杰', 'チェ': '切', 'ツェ': '策',
}


def kana_to_zh(s):
    """假名序列 -> 中文音译（最长匹配优先，平假名先转片假名）"""
    s = ''.join(chr(ord(ch) + 0x60) if '\u3040' <= ch <= '\u309f' else ch for ch in s)
    out = []
    i = 0
    while i < len(s):
        matched = False
        for ln in (3, 2, 1):
            if s[i:i + ln] in KANA_ZH:
                out.append(KANA_ZH[s[i:i + ln]])
                i += ln
                matched = True
                break
        if not matched:
            i += 1
    return ''.join(out)


def name_to_zh(native, en_name=''):
    """把角色/声优日文名转中文：汉字直接简化，混合名假名音译，纯假名机翻"""
    if not native:
        return en_name
    has_kanji = bool(re.search(r'[\u4e00-\u9fff]', native))
    has_kana = bool(re.search(r'[\u30a0-\u30ff\u3040-\u309f]', native))
    if has_kanji:
        converted = kanji_convert(native)
        if has_kana:
            kana_part = re.findall(r'[\u30a0-\u30ff\u3040-\u309fー・]+', native)
            return converted + kana_to_zh(''.join(kana_part))
        return converted
    return gt(native, 'ja')  # 纯假名 -> 机翻


def main():
    with open(os.path.join(DATA_DIR, 'full_data.json'), encoding='utf-8') as f:
        full = json.load(f)
    va_native = {}
    if os.path.exists(os.path.join(DATA_DIR, 'va_native.json')):
        with open(os.path.join(DATA_DIR, 'va_native.json'), encoding='utf-8') as f:
            va_native = json.load(f)

    # ---------- 1. 番剧简介 ----------
    s_items = [(s['aid'], s.get('desc') or '') for s in full['series']]
    s_zh = translate_batch(s_items, 'en', label='series')

    # ---------- 2. 角色简介 ----------
    c_items = []
    for aid in full['characters']:
        for c in full['characters'][aid]:
            c_items.append((c['id'], c.get('desc') or ''))
    c_zh = translate_batch(c_items, 'en', label='chars')

    # ---------- 3. 台词 ----------
    q_items = [(i, q.get('content') or '') for i, q in enumerate(full['quotes'])]
    q_zh = translate_batch(q_items, 'ja', label='quotes')

    # ---------- 4. 标签 ----------
    tags = set()
    for s in full['series']:
        for t in (s.get('tags') or '').split(','):
            if t.strip():
                tags.add(t.strip())
    t_items = list(enumerate(sorted(tags)))
    t_zh = translate_batch(t_items, 'en', label='tags')

    print('[names] 主角人工表:', len(MAIN_ZH))

    # ---------- 5. 角色名 / 声优名 ----------
    char_name_zh = {}
    va_name_zh = {}
    for aid in full['characters']:
        for c in full['characters'][aid]:
            cid = c['id']
            if cid in MAIN_ZH:
                char_name_zh[cid] = MAIN_ZH[cid]
            else:
                char_name_zh[cid] = name_to_zh(c.get('original') or '', c.get('name') or '')
            va = c.get('va') or ''
            if va:
                native = va_native.get(str(cid)) or ''
                if native:
                    va_name_zh.setdefault(va, name_to_zh(native, va))
                else:
                    va_name_zh.setdefault(va, gt(va, 'en'))

    # ---------- 组装输出 ----------
    series_zh = []
    for s in full['series']:
        aid = s['aid']
        tags_zh = []
        for t in (s.get('tags') or '').split(','):
            tt = t.strip()
            if not tt:
                continue
            idx = sorted(tags).index(tt)
            tags_zh.append(t_zh.get(idx) or tt)
        series_zh.append({
            'aid': aid,
            'title': CN_ALL.get(aid) or s['title'],
            'original': s.get('original') or '',
            'type': s.get('type') or 'TV',
            'studio': s.get('studio') or '',
            'year': s.get('year'),
            'eps': s.get('eps'),
            'score': s.get('score'),
            'desc': s_zh.get(aid) or '',
            'tags': ','.join(tags_zh),
            'site': s.get('site') or '',
        })

    chars_zh = {}
    for aid in full['characters']:
        rows = []
        for c in full['characters'][aid]:
            rows.append({
                'id': c['id'],
                'name': char_name_zh.get(c['id'], c.get('name') or ''),
                'original': c.get('original') or '',
                'role': c.get('role') or '配角',
                'va': va_name_zh.get(c.get('va') or '') or (c.get('va') or ''),
                'va_en': c.get('va') or '',
                'desc': c_zh.get(c['id']) or '',
                'img': c.get('img') or '',
            })
        chars_zh[aid] = rows

    # 角色名速查（台词角色名转换用）
    name_by_cid = {c['id']: c['name'] for k in chars_zh for c in chars_zh[k]}
    q_name_items = []
    for i, q in enumerate(full['quotes']):
        cid = q.get('character_id')
        if not (cid and cid in name_by_cid):
            q_name_items.append((i, q.get('character_name') or ''))
    q_name_zh = translate_batch(q_name_items, 'ja', label='quote-names')
    quotes_zh = []
    for i, q in enumerate(full['quotes']):
        cid = q.get('character_id')
        cname = ''
        if cid and cid in name_by_cid:
            cname = name_by_cid[cid]
        else:
            cname = q_name_zh.get(i) or ''
        quotes_zh.append({
            'series_id': q.get('series_id'),
            'character_id': cid,
            'character_name': cname,
            'content': q_zh.get(i) or (q.get('content') or ''),
        })

    out = {'series': series_zh, 'characters': chars_zh, 'quotes': quotes_zh}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('[done] written:', OUT, '(%d bytes)' % os.path.getsize(OUT))


if __name__ == '__main__':
    main()
