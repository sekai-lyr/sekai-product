# -*- coding: utf-8 -*-
"""
Sekai Data Object - 最终全量数据生成 + 导入
数据源：build-data/data/full_data.json（200 番剧 / 11278 角色 / 7957 台词）
修复：中文译名、台词-角色ID 映射
"""
import json
import os
import re
import sys
import pymysql
from rapidfuzz import fuzz

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
DATA_DIR = os.path.join(BASE, 'data')
IMG_DIR = os.path.join(ROOT, 'uploads', 'images')
OUT = os.path.join(BASE, 'init.sql')

DB = dict(host='127.0.0.1', user='root', password='123456520baba', database='sekai_friend',
          charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)

sys.path.insert(0, BASE)
from cn_titles import CN_ALL

TITLE_FIX = CN_ALL

def esc(v):
    if v is None:
        return 'NULL'
    s = str(v)
    s = s.replace('\\', '\\\\').replace("'", "''")
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', s)
    return "'" + s + "'"

def norm(s):
    if not s:
        return ''
    return re.sub(r"[\s・･、。，．.'`\"“”‘’()\[\]（）\-_!！?？:：;；/／~〜＊*#+「」]", '', str(s).lower())

def norm_ja(s):
    if not s:
        return ''
    s = re.sub(r'[\s・･、。，]', '', str(s))
    for a, b in [('條', '条'), ('髙', '高'), ('濱', '浜'), ('邊', '辺'), ('澤', '沢'),
                 ('廣', '広'), ('ヶ', 'ケ'), ('盡', '尽'), ('與', '与')]:
        s = s.replace(a, b)
    return s

def main():
    with open(os.path.join(DATA_DIR, 'full_data.json'), encoding='utf-8') as f:
        full = json.load(f)

    series = sorted(full['series'], key=lambda s: s['aid'])
    chars_by_aid = full['characters']
    quotes = full['quotes']

    # ---------- 系列 ID（按 aid 排序，与现有 DB 一致） ----------
    aid2id = {s['aid']: i + 1 for i, s in enumerate(series)}

    # ---------- 角色 ID 映射：AniList char id -> 顺序 id ----------
    char_id_map = {}
    next_cid = 1
    new_chars = []
    for s in series:
        aid = s['aid']
        clist = chars_by_aid.get(str(aid)) or []
        clist = sorted(clist, key=lambda c: c['id'])
        for c in clist:
            char_id_map[c['id']] = next_cid
            new_chars.append((aid2id[aid], c))
            next_cid += 1
    print('[chars] total:', len(new_chars))

    # ---------- 台词：重映射 ----------
    name_index = {}
    for sid, c in new_chars:
        name_index.setdefault(sid, []).append((c, char_id_map[c['id']]))

    def char_lookup(sid, name, hint_cid):
        if hint_cid and hint_cid in char_id_map:
            return char_id_map[hint_cid]
        nn, nen = norm_ja(name), norm(name)
        best = None
        for c, cid in name_index.get(sid, []):
            if norm_ja(c.get('original') or '') == nn:
                return cid
            if norm(c.get('name') or '') == nen:
                return cid
            if nn and fuzz.ratio(nn, norm_ja(c.get('original') or '')) >= 88:
                best = cid
                continue
            if best is None and nen and fuzz.token_set_ratio(nen, norm(c.get('name') or '')) >= 85:
                best = cid
        return best

    new_quotes = []
    n_hint = n_name = n_null = 0
    seen = set()
    for q in quotes:
        aid = q.get('series_id')
        if aid not in aid2id:
            continue
        content = (q.get('content') or '').strip()
        if not content:
            continue
        content = content[:990]
        key = (aid2id[aid], norm(content))
        if key in seen:
            continue
        seen.add(key)
        cid = char_lookup(aid2id[aid], q.get('character_name'), q.get('character_id'))
        if cid:
            if q.get('character_id') and q['character_id'] in char_id_map:
                n_hint += 1
            else:
                n_name += 1
        else:
            n_null += 1
        new_quotes.append({
            'series_id': aid2id[aid],
            'character_id': cid,
            'character_name': (q.get('character_name') or '')[:100],
            'content': content,
        })
    print('[quotes] total:', len(new_quotes),
          '| matched by hint:', n_hint, '| by name:', n_name, '| no char:', n_null)

    # ---------- 生成 SQL ----------
    lines = []
    A = lines.append
    A('-- ============================================================')
    A('-- Sekai Data Object 二次元数据中心 - 全量数据')
    A('-- %d 部番剧 / %d 位角色 / %d 条台词' % (len(series), len(new_chars), len(new_quotes)))
    A('-- ============================================================')
    A('CREATE DATABASE IF NOT EXISTS sekai_friend')
    A('DEFAULT CHARACTER SET utf8mb4')
    A('COLLATE utf8mb4_general_ci;')
    A('')
    A('USE sekai_friend;')
    A('')
    A('DELETE FROM sekai_dataobject_anime_quote;')
    A('DELETE FROM sekai_dataobject_anime_character;')
    A('DELETE FROM sekai_dataobject_anime_series;')
    A('DELETE FROM sekai_dataobject_anime_user WHERE username <> \'admin\';')
    A('ALTER TABLE sekai_dataobject_anime_quote AUTO_INCREMENT = 1;')
    A('ALTER TABLE sekai_dataobject_anime_character AUTO_INCREMENT = 1;')
    A('ALTER TABLE sekai_dataobject_anime_series AUTO_INCREMENT = 1;')
    A('')
    A('CREATE TABLE IF NOT EXISTS sekai_dataobject_anime_user (')
    A('    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT \'用户ID\',')
    A('    username VARCHAR(50) NOT NULL UNIQUE COMMENT \'用户名，用于登录\',')
    A('    password VARCHAR(100) NOT NULL COMMENT \'密码\',')
    A('    nickname VARCHAR(50) DEFAULT NULL COMMENT \'昵称\',')
    A('    avatar VARCHAR(500) DEFAULT NULL COMMENT \'头像地址\',')
    A('    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT \'创建时间\'')
    A(') COMMENT=\'用户表\';')
    A('')
    A('CREATE TABLE IF NOT EXISTS sekai_dataobject_anime_series (')
    A('    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT \'番剧ID\',')
    A('    title VARCHAR(100) NOT NULL COMMENT \'番剧官方中文名称\',')
    A('    original_title VARCHAR(100) DEFAULT NULL COMMENT \'番剧原名（日文/英文）\',')
    A('    type VARCHAR(50) DEFAULT NULL COMMENT \'类型：TV/剧场版/OVA/网络动画\',')
    A('    studio VARCHAR(100) DEFAULT NULL COMMENT \'制作公司\',')
    A('    release_date DATE DEFAULT NULL COMMENT \'首播日期\',')
    A('    total_episodes INT DEFAULT NULL COMMENT \'总集数\',')
    A('    score DECIMAL(3,1) DEFAULT NULL COMMENT \'官方评分\',')
    A('    synopsis TEXT DEFAULT NULL COMMENT \'剧情简介（官方）\',')
    A('    cover_url VARCHAR(1000) DEFAULT NULL COMMENT \'封面图片地址\',')
    A('    tags VARCHAR(255) DEFAULT NULL COMMENT \'标签，用逗号分隔\',')
    A('    official_url VARCHAR(1000) DEFAULT NULL COMMENT \'官网链接\',')
    A('    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT \'创建时间\',')
    A('    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT \'修改时间\'')
    A(') COMMENT=\'番剧表\';')
    A('')
    A('CREATE TABLE IF NOT EXISTS sekai_dataobject_anime_character (')
    A('    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT \'人物ID\',')
    A('    series_id BIGINT DEFAULT NULL COMMENT \'所属番剧ID\',')
    A('    name VARCHAR(100) NOT NULL COMMENT \'人物官方中文名\',')
    A('    original_name VARCHAR(100) DEFAULT NULL COMMENT \'人物原名（日文名）\',')
    A('    role VARCHAR(50) DEFAULT NULL COMMENT \'人物定位（主角/配角/反派）\',')
    A('    voice_actor VARCHAR(100) DEFAULT NULL COMMENT \'声优（CV）\',')
    A('    description TEXT DEFAULT NULL COMMENT \'人物官方简介\',')
    A('    image_url VARCHAR(1000) DEFAULT NULL COMMENT \'人物立绘/图片地址\',')
    A('    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT \'创建时间\'')
    A(') COMMENT=\'人物表\';')
    A('')
    A('CREATE TABLE IF NOT EXISTS sekai_dataobject_anime_quote (')
    A('    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT \'台词ID\',')
    A('    series_id BIGINT DEFAULT NULL COMMENT \'所属番剧ID\',')
    A('    character_id BIGINT DEFAULT NULL COMMENT \'人物ID\',')
    A('    character_name VARCHAR(100) DEFAULT NULL COMMENT \'说出台词的角色名\',')
    A('    content VARCHAR(1000) NOT NULL COMMENT \'台词原文（官方台词）\',')
    A('    episode INT DEFAULT NULL COMMENT \'台词所在集数\',')
    A('    time_point DECIMAL(8,1) DEFAULT NULL COMMENT \'台词出现时间点（秒）\',')
    A('    audio_url VARCHAR(1000) DEFAULT NULL COMMENT \'台词原音频地址（上传的原音频）\',')
    A('    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT \'创建时间\'')
    A(') COMMENT=\'台词表\';')
    A('')
    A("INSERT IGNORE INTO sekai_dataobject_anime_user (username, password, nickname) VALUES ('admin', 'sha256$bbiuDBPMhws8LGQFMQuvnw==$jha2kYc5w2L9ZYkcHVn/MsxD0DfBTPb9ZE28tcnqf8E=', '数据管理员');")
    A('')

    def batched(header, rows, size=400):
        A(header)
        for i in range(0, len(rows), size):
            A(',\n'.join(rows[i:i + size]) + ';')

    def cover_for(aid):
        for f in os.listdir(IMG_DIR):
            if f.startswith('s_%s.' % aid):
                return '/uploads/images/' + f
        return None

    srows = []
    for s in series:
        aid = s['aid']
        title = TITLE_FIX.get(aid) or s['title']
        desc = re.sub(r'\s+', ' ', s.get('desc') or '')[:1500] or None
        score = s.get('score')
        try:
            score = round(float(score), 1) if score else None
        except Exception:
            score = None
        srows.append('(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' % (
            esc(title[:100]), esc((s.get('original') or '')[:100]),
            esc((s.get('type') or 'TV')[:50]), esc((s.get('studio') or '')[:100]),
            esc('%04d-01-01' % (s.get('year') or 2000)), esc(s.get('eps')),
            esc(score), esc(desc), esc(cover_for(aid) or (s.get('cover') or '')),
            esc((s.get('tags') or '')[:250]), esc((s.get('site') or '')[:1000])))
    batched('INSERT INTO sekai_dataobject_anime_series (title, original_title, type, studio, release_date, total_episodes, score, synopsis, cover_url, tags, official_url) VALUES', srows)
    A('')

    crows = []
    for sid, c in new_chars:
        crows.append('(%s, %s, %s, %s, %s, %s, %s)' % (
            sid, esc((c.get('name') or '')[:100]), esc((c.get('original') or '')[:100]),
            esc((c.get('role') or '配角')[:50]), esc((c.get('va') or '')[:100]),
            esc(c.get('desc')), esc(c.get('img'))))
    batched('INSERT INTO sekai_dataobject_anime_character (series_id, name, original_name, role, voice_actor, description, image_url) VALUES', crows)
    A('')

    qrows = []
    for q in new_quotes:
        qrows.append('(%s, %s, %s, %s, NULL, NULL, NULL)' % (
            q['series_id'], 'NULL' if q['character_id'] is None else q['character_id'],
            esc(q['character_name']), esc(q['content'])))
    batched('INSERT INTO sekai_dataobject_anime_quote (series_id, character_id, character_name, content, episode, time_point, audio_url) VALUES', qrows)
    A('')

    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))
    print('[sql] written:', OUT, '(%d bytes)' % os.path.getsize(OUT))

    # ---------- 导入（直接从内存数据执行，不依赖 SQL 文件） ----------
    if '--no-import' not in sys.argv:
        import pymysql as _pymysql
        conn = _pymysql.connect(host='127.0.0.1', user='root', password='123456520baba',
                                database='sekai_friend', charset='utf8mb4',
                                cursorclass=_pymysql.cursors.DictCursor)
        cur = conn.cursor()
        cur.execute('DELETE FROM sekai_dataobject_anime_quote')
        cur.execute('DELETE FROM sekai_dataobject_anime_character')
        cur.execute('DELETE FROM sekai_dataobject_anime_series')
        cur.execute("DELETE FROM sekai_dataobject_anime_user WHERE username <> 'admin'")
        for t in ('quote', 'character', 'series'):
            cur.execute('ALTER TABLE sekai_dataobject_anime_%s AUTO_INCREMENT = 1' % t)
        cur.execute("INSERT IGNORE INTO sekai_dataobject_anime_user (username, password, nickname) VALUES ('admin', 'sha256$bbiuDBPMhws8LGQFMQuvnw==$jha2kYc5w2L9ZYkcHVn/MsxD0DfBTPb9ZE28tcnqf8E=', '数据管理员')")

        def chunked_insert(table, cols, rows, size):
            for i in range(0, len(rows), size):
                stmt = 'INSERT INTO %s (%s) VALUES %s' % (table, ', '.join(cols), ',\n'.join(rows[i:i + size]))
                cur.execute(stmt)

        chunked_insert('sekai_dataobject_anime_series',
                       ('title', 'original_title', 'type', 'studio', 'release_date', 'total_episodes',
                        'score', 'synopsis', 'cover_url', 'tags', 'official_url'), srows, 200)
        chunked_insert('sekai_dataobject_anime_character',
                       ('series_id', 'name', 'original_name', 'role', 'voice_actor', 'description', 'image_url'),
                       crows, 1000)
        chunked_insert('sekai_dataobject_anime_quote',
                       ('series_id', 'character_id', 'character_name', 'content', 'episode', 'time_point', 'audio_url'),
                       qrows, 1000)
        conn.commit()
        for t in ('series', 'character', 'quote'):
            cur.execute('SELECT COUNT(*) c FROM sekai_dataobject_anime_%s' % t)
            print('[db] %s rows: %s' % (t, cur.fetchone()['c']))
        cur.execute("SELECT COUNT(*) c FROM sekai_dataobject_anime_quote WHERE character_id IS NOT NULL")
        print('[db] quotes with character:', cur.fetchone()['c'])
        cur.execute("SELECT COUNT(*) c FROM sekai_dataobject_anime_series WHERE cover_url IS NOT NULL AND cover_url <> ''")
        print('[db] series with cover:', cur.fetchone()['c'])
        cur.execute("SELECT COUNT(*) c FROM sekai_dataobject_anime_character WHERE image_url IS NOT NULL AND image_url <> ''")
        print('[db] chars with image:', cur.fetchone()['c'])
        conn.close()

if __name__ == '__main__':
    main()
