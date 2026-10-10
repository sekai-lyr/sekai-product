# -*- coding: utf-8 -*-
"""
Sekai Data Object - 全量数据构建（阶段B：台词匹配 + 生成全量 init_full.sql）
数据源：HuggingFace 台词数据集（日文 10388 条 + 英文 8612 条 + 小集 121 条）
"""
import json
import os
import re
import urllib.parse
import pandas as pd
import pymysql
from rapidfuzz import fuzz

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
DATA_DIR = os.path.join(BASE, 'data')
IMG_DIR = os.path.join(ROOT, 'uploads', 'images')
TMP = r'C:\Users\ADMINI~1\AppData\Local\Temp\opencode'

DB = dict(host='127.0.0.1', user='root', password='123456520baba', db='sekai_friend',
          charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)

CN_TITLES = {
    20755: '暗杀教室', 20464: '排球少年！！', 101921: '辉夜大小姐想让我告白',
    4224: '龙与虎', 20613: '斩·赤红之瞳！', 21202: '为美好的世界献上祝福！',
    112151: '鬼灭之刃 无限列车篇', 20623: '寄生兽 生命的准则', 99423: 'DARLING in the FRANXX',
    142329: '鬼灭之刃 游郭篇', 101338: '灵能百分百 II', 6547: '天使的心跳',
    112641: '辉夜大小姐想让我告白？', 10620: '未来日记', 20832: '不死者之王',
    20992: '排球少年！！ 第二季', 15809: '打工吧！魔王大人', 11111: '替身（Another）',
    21699: '为美好的世界献上祝福！ 第二季', 21170: '暗杀教室 第二季',
    21698: '排球少年！！ 乌野高中 VS 白鸟泽学园高中', 129874: '鬼灭之刃 无限列车篇（TV）',
    14741: '中二病也要谈恋爱！', 10087: 'Fate/Zero 命运前夜', 100240: '东京喰种：re',
    119661: 'Re：从零开始的异世界生活 第二季 Part 2',
    176496: '我独自升级 第二季 - 从暗影崛起', 116006: '高校之神', 2167: 'CLANNAD',
    6746: '无头骑士异闻录', 106625: '排球少年！！ TO THE TOP',
    125367: '辉夜大小姐想让我告白 -超浪漫-', 7054: '会长是女仆大人',
    11771: '黑子的篮球', 18153: '境界的彼方', 5680: '轻音少女',
    20698: '我的青春恋爱物语果然有问题。续', 21613: '幼女战记',
    139630: '我的英雄学院 第六季', 18897: '伪恋', 98437: '不死者之王 II',
    19603: 'Fate/stay night 无限剑制', 130003: '孤独摇滚！', 140439: '灵能百分百 III',
    14227: '邻座的怪同学', 21518: '食戟之灵 贰之皿', 113538: '排球少年！！ TO THE TOP 2',
    32: '新世纪福音战士剧场版 Air/真心为你', 172463: '咒术回战 死灭回游 前篇',
    339: '玲音（Serial Experiments Lain）',
    101922: '鬼灭之刃',
    9253: '命运石之门',
}

def norm(s):
    if not s:
        return ''
    s = str(s).lower()
    return re.sub(r"[\s・･、。，．.'`\"“”‘’()\[\]（）\-_!！?？:：;；/／~〜＊*#+「」]", '', s)

def norm_ja(s):
    if not s:
        return ''
    s = re.sub(r'[\s・･、。，]', '', str(s))
    for a, b in [('條', '条'), ('髙', '高'), ('濱', '浜'), ('邊', '辺'), ('澤', '沢'),
                 ('廣', '広'), ('ヶ', 'ケ'), ('盡', '尽'), ('與', '与')]:
        s = s.replace(a, b)
    return s

def sql_str(v):
    if v is None:
        return 'NULL'
    v = str(v)
    return "'" + v.replace('\\', '\\\\').replace("'", "''") + "'"

def main():
    conn = pymysql.connect(**DB)
    cur = conn.cursor()
    cur.execute("SELECT * FROM sekai_dataobject_anime_series ORDER BY id")
    old_series = cur.fetchall()
    cur.execute("SELECT * FROM sekai_dataobject_anime_character ORDER BY id")
    old_chars = cur.fetchall()
    cur.execute("SELECT * FROM sekai_dataobject_anime_quote ORDER BY id")
    old_quotes = cur.fetchall()
    print('[db] old series:', len(old_series), 'chars:', len(old_chars), 'quotes:', len(old_quotes))

    with open(os.path.join(DATA_DIR, 'full_data.json'), encoding='utf-8') as f:
        full = json.load(f)
    with open(os.path.join(DATA_DIR, 'anilist_top200.json'), encoding='utf-8') as f:
        top = json.load(f)
    series = full['series']
    top_by_id = {t['id']: t for t in top}

    old_titles = {os_['title'] for os_ in old_series}
    old_orig = {os_['original_title'] for os_ in old_series}
    new_series = [s for s in series
                  if CN_TITLES.get(s['aid'], s['title']) not in old_titles and s['original'] not in old_orig]
    print('[series] keep old:', len(old_series), 'new:', len(new_series))

    # ---------- 番剧标题索引 ----------
    title_index = []
    for s in series:
        aid = s['aid']
        t = top_by_id.get(aid) or {}
        variants = {norm(s.get('title')), norm(s.get('original'))}
        for k in ('romaji', 'english', 'native'):
            v = (t.get('title') or {}).get(k) or ''
            if v:
                variants.add(norm(v))
        for v in variants:
            if v:
                title_index.append((v, aid))

    def match_anime(name):
        nn = norm(name)
        if not nn:
            return None
        for v, aid in title_index:
            if v == nn:
                return aid
        best, best_score = None, 0
        for v, aid in title_index:
            sc = fuzz.token_set_ratio(nn, v)
            if sc > best_score:
                best, best_score = aid, sc
        return best if best_score >= 82 else None

    # ---------- 角色索引（dump + 现有中文名角色） ----------
    char_index = {int(aid): list(chars) for aid, chars in full['characters'].items()}
    old_series_aid = {}
    for os_ in old_series:
        for s in series:
            if s['title'] == os_['title'] or s['original'] == os_['original_title']:
                old_series_aid[os_['id']] = s['aid']
                break
    for oc in old_chars:
        aid = old_series_aid.get(oc['series_id'])
        if aid is None:
            continue
        char_index.setdefault(aid, []).insert(0, {
            'id': 'old_%d' % oc['id'], 'name': oc['name'],
            'original': oc['original_name'] or '', 'role': oc['role'] or '',
            'va': oc['voice_actor'] or '', 'desc': oc['description'], 'img': oc['image_url'],
        })

    def match_char(aid, name):
        chars = char_index.get(aid) or []
        if not name:
            return None
        nn, nen = norm_ja(name), norm(name)
        for c in chars:
            if norm_ja(c.get('original') or '') == nn:
                return c['id']
        for c in chars:
            if norm(c.get('name') or '') == nen:
                return c['id']
        for c in chars:
            if nn and fuzz.ratio(nn, norm_ja(c.get('original') or '')) >= 88:
                return c['id']
        for c in chars:
            if nen and fuzz.token_set_ratio(nen, norm(c.get('name') or '')) >= 85:
                return c['id']
        return None

    # ---------- 加载台词数据集 ----------
    ja = pd.read_parquet(os.path.join(TMP, 'anime_quotes_ja.parquet'))
    en = pd.read_csv(os.path.join(TMP, 'anime_quotes_en.csv'))
    small = pd.read_csv(os.path.join(TMP, 'anime_quotes_small.csv'))

    def clean_ja_quote(q, char):
        if not q:
            return None
        q = re.sub(r'\s*[-–—]\s*' + re.escape(char) + r'\s*$', '', str(q).strip())
        if re.search(r'XNUMX|{{|}}|http', q):
            return None
        return q.strip()

    quotes = []
    seen = set()

    def add_quote(aid, char_name, content, src=''):
        content = (content or '').strip()
        if not content or not aid:
            return
        if len(content) > 990:
            content = content[:990]
        key = (aid, norm(content))
        if key in seen:
            return
        seen.add(key)
        cid = match_char(aid, char_name)
        quotes.append({'series_id': aid, 'character_id': cid,
                       'character_name': (char_name or '')[:100], 'content': content, 'src': src})

    JA_SUFFIXES = ['の名言集', 'の名言', 'の引用集', 'の引用', 'のクォート', '名言集', '名言', '引用']
    n_ja_slug = n_ja_char = 0
    for _, row in ja.iterrows():
        char_raw = str(row['Character']).strip()
        quote = clean_ja_quote(row['Quote'], char_raw)
        if not quote:
            continue
        slug = None
        m = re.search(r'animemotivation\.com/([^/]+?)/?$', str(row['URL']))
        if m:
            slug = urllib.parse.unquote(m.group(1)).strip()
        aid = match_anime(strip_suffix(slug, JA_SUFFIXES)) if slug else None
        if aid is None and slug:
            for a2, chars in char_index.items():
                for c in chars:
                    if norm_ja(c.get('original') or '') == norm_ja(slug) or \
                            norm(c.get('name') or '') == norm(slug):
                        aid = a2
                        break
                if aid:
                    break
        if aid:
            add_quote(aid, char_raw, quote, src='ja')
            n_ja_slug += 1

    for _, row in en.iterrows():
        anime = re.sub(r'^\(|\)$', '', str(row['Anime']).strip())
        aid = match_anime(anime)
        if aid:
            add_quote(aid, str(row['Character']).strip(), str(row['Quote']).strip(), src='en')

    for _, row in small.iterrows():
        aid = match_anime(str(row['Anime']).strip())
        if aid:
            add_quote(aid, str(row['Character']).strip(), str(row['Quote']).strip(), src='small')

    by_series = {}
    for q in quotes:
        by_series.setdefault(q['series_id'], []).append(q)
    cov = len(by_series)
    print('[quotes] total:', len(quotes), '| series covered:', cov, '/', len(series))

    with open(os.path.join(DATA_DIR, 'quotes_matched.json'), 'w', encoding='utf-8') as f:
        json.dump(quotes, f, ensure_ascii=False, indent=1)

    # ---------- SQL 生成 ----------
    aid_to_db = {}
    for i, os_ in enumerate(old_series):
        aid_to_db[old_series_aid.get(os_['id'])] = i + 1
    for j, s in enumerate(new_series):
        aid_to_db[s['aid']] = len(old_series) + j + 1

    sql = []
    sql.append('-- ============================================================')
    sql.append('-- Sekai Data Object 全量数据初始化（自动构建 %s）' % '2026-08-10')
    sql.append('-- 番剧 %d 部 / 台词 %d 条 / 覆盖 %d 部番剧' % (len(series), len(quotes), cov))
    sql.append('-- ============================================================')
    sql.append('CREATE DATABASE IF NOT EXISTS sekai_friend DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;')
    sql.append('USE sekai_friend;')
    sql.append('DELETE FROM sekai_dataobject_anime_quote;')
    sql.append('DELETE FROM sekai_dataobject_anime_character;')
    sql.append('DELETE FROM sekai_dataobject_anime_series;')
    sql.append('DELETE FROM sekai_dataobject_anime_user WHERE username <> \'admin\';')
    for t in ('quote', 'character', 'series'):
        sql.append('ALTER TABLE sekai_dataobject_anime_%s AUTO_INCREMENT = 1;' % t)

    with open(os.path.join(BASE, 'init.sql'), encoding='utf-8') as f:
        old_init = f.read()
    m = re.search(r'(CREATE TABLE IF NOT EXISTS sekai_dataobject_anime_user.*?;\n)', old_init, re.S)
    for t in ('series', 'character', 'quote'):
        m2 = re.search(r'(CREATE TABLE IF NOT EXISTS sekai_dataobject_anime_%s.*?;\n)' % t, old_init, re.S)
        sql.append(m2.group(1))

    def series_row(s):
        aid = s['aid']
        title = CN_TITLES.get(aid) or s['title']
        cover = None
        for ext in ('.jpg', '.png'):
            if os.path.exists(os.path.join(IMG_DIR, 's_%d%s' % (aid, ext))):
                cover = '/uploads/images/s_%d%s' % (aid, ext)
                break
        score = s.get('score')
        try:
            score = round(float(score), 1) if score else None
        except Exception:
            score = None
        return '(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' % (
            sql_str(title), sql_str(s['original']), sql_str(s['type']),
            sql_str(s.get('studio')), sql_str('%d-01-01' % s['year']),
            sql_str(s.get('eps')), sql_str(score), sql_str(s.get('desc')),
            sql_str(cover), sql_str((s.get('tags') or '')[:255]), sql_str(s.get('site')))

    series_rows = []
    for os_ in old_series:
        series_rows.append('(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' % (
            sql_str(os_['title']), sql_str(os_['original_title']), sql_str(os_['type']),
            sql_str(os_['studio']), sql_str(os_['release_date']), sql_str(os_['total_episodes']),
            sql_str(os_['score']), sql_str(os_['synopsis']), sql_str(os_['cover_url']),
            sql_str(os_['tags']), sql_str(os_['official_url'])))
    for s in new_series:
        series_rows.append(series_row(s))
    sql.append('INSERT INTO sekai_dataobject_anime_series (title, original_title, type, studio, release_date, total_episodes, score, synopsis, cover_url, tags, official_url) VALUES')
    sql.append(',\n'.join(series_rows))
    sql.append(';')

    # ---------- 人物 ----------
    char_rows = []
    for oc in old_chars:
        char_rows.append({
            'db_series': oc['series_id'], 'name': oc['name'],
            'original': oc['original_name'], 'role': oc['role'],
            'va': oc['voice_actor'], 'desc': oc['description'],
            'img': oc['image_url'], 'old': True, 'id': oc['id'],
        })
    cur_char_orig = {norm_ja(oc['original_name'] or '') for oc in old_chars}
    seen_chars = {(r['db_series'], norm_ja(r['original'] or '')) for r in char_rows}

    def add_dump_chars(series_db_id, aid):
        added = 0
        for c in full['characters'].get(str(aid), []):
            orig = norm_ja(c.get('original') or '')
            key = (series_db_id, orig)
            if key in seen_chars:
                continue
            if series_db_id in old_series_aid_map and orig in cur_char_orig:
                continue
            seen_chars.add(key)
            char_rows.append({
                'db_series': series_db_id, 'name': c['name'],
                'original': c.get('original'), 'role': c['role'],
                'va': c.get('va'), 'desc': c.get('desc'),
                'img': c.get('img'), 'old': False,
            })
            added += 1
        return added

    old_series_aid_map = set(old_series_aid.keys())
    for s in new_series:
        add_dump_chars(aid_to_db[s['aid']], s['aid'])
    for os_ in old_series:
        add_dump_chars(os_['id'], old_series_aid.get(os_['id']))

    # 分配角色ID
    char_id_by = {}  # (db_series, norm_ja(original)) -> id, (db_series, norm(name)) -> id
    next_cid = len(old_chars) + 1
    for r in char_rows:
        if r['old']:
            cid = r['id']
        else:
            cid = next_cid
            next_cid += 1
        r['cid'] = cid
        if r['original']:
            char_id_by[(r['db_series'], norm_ja(r['original']))] = cid
        if r['name']:
            char_id_by[(r['db_series'], norm(r['name']))] = cid

    sql.append('INSERT INTO sekai_dataobject_anime_character (series_id, name, original_name, role, voice_actor, description, image_url) VALUES')
    char_ins = ['(%d, %s, %s, %s, %s, %s, %s)' % (
        r['db_series'], sql_str(r['name']), sql_str(r['original']), sql_str(r['role']),
        sql_str(r['va']), sql_str(r['desc']), sql_str(r['img'])) for r in char_rows]
    sql.append(',\n'.join(char_ins))
    sql.append(';')
    print('[chars] total:', len(char_rows), '(kept %d, new %d)' % (len(old_chars), len(char_rows) - len(old_chars)))

    # ---------- 台词 ----------
    def char_lookup(db_series, name):
        nn, nen = norm_ja(name), norm(name)
        if (db_series, nn) in char_id_by:
            return char_id_by[(db_series, nn)]
        if (db_series, nen) in char_id_by:
            return char_id_by[(db_series, nen)]
        for (ds, k), cid in char_id_by.items():
            if ds == db_series and k and nn and fuzz.ratio(nn, k) >= 88:
                return cid
        return None

    quote_ins = []
    for oq in old_quotes:
        cid = 'NULL' if oq['character_id'] is None else str(oq['character_id'])
        ep = 'NULL' if oq['episode'] is None else str(oq['episode'])
        tp = 'NULL' if oq['time_point'] is None else str(oq['time_point'])
        quote_ins.append('(%d, %s, %s, %s, %s, %s, NULL)' % (
            oq['series_id'], cid, sql_str(oq['character_name']), sql_str(oq['content']), ep, tp))
    n_quote_char = 0
    for q in quotes:
        db_sid = aid_to_db.get(q['series_id'])
        if db_sid is None:
            continue
        cid = char_lookup(db_sid, q['character_name'])
        if cid:
            n_quote_char += 1
        quote_ins.append('(%d, %s, %s, %s, NULL, NULL, NULL)' % (
            db_sid, 'NULL' if cid is None else str(cid),
            sql_str(q['character_name']), sql_str(q['content'])))
    sql.append('INSERT INTO sekai_dataobject_anime_quote (series_id, character_id, character_name, content, episode, time_point, audio_url) VALUES')
    sql.append(',\n'.join(quote_ins))
    sql.append(';')
    print('[quotes] with matched character:', n_quote_char, '/', len(quotes))

    sql.append("INSERT INTO sekai_dataobject_anime_user (username, password, nickname) VALUES ('admin', 'sha256$bbiuDBPMhws8LGQFMQuvnw==$jha2kYc5w2L9ZYkcHVn/MsxD0DfBTPb9ZE28tcnqf8E=', '数据管理员');")

    out_path = os.path.join(BASE, 'init_full.sql')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql))
    print('[sql] written:', out_path)
    conn.close()

def strip_suffix(s, suffixes):
    for suf in sorted(suffixes, key=len, reverse=True):
        if s.endswith(suf) and len(s) > len(suf):
            return s[:-len(suf)]
    return s

if __name__ == '__main__':
    main()
