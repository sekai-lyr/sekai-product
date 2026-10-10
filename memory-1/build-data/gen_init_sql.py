# -*- coding: utf-8 -*-
"""
Sekai Data Object - 生成全量 init.sql（200 番剧 + 全部角色 + 全部台词）
"""
import json
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
DATA_DIR = os.path.join(BASE, 'data')
IMG_DIR = os.path.join(ROOT, 'uploads', 'images')
OUT = os.path.join(BASE, 'init.sql')

def esc(v):
    if v is None:
        return 'NULL'
    s = str(v)
    s = s.replace('\\', '\\\\').replace("'", "''")
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', s)
    return "'" + s + "'"

def cover_for(aid):
    for f in os.listdir(IMG_DIR):
        if f.startswith('s_%s.' % aid):
            return '/uploads/images/' + f
    return None

def main():
    with open(os.path.join(DATA_DIR, 'full_data.json'), encoding='utf-8') as f:
        full = json.load(f)

    series = sorted(full['series'], key=lambda s: s['aid'])
    chars = full['characters']
    quotes = full['quotes']

    aid2id = {s['aid']: i + 1 for i, s in enumerate(series)}
    char_by_id = {}
    for aid, clist in chars.items():
        for c in clist:
            char_by_id[c['id']] = c

    lines = []
    A = lines.append
    A('-- ============================================================')
    A('-- Sekai Data Object 二次元数据总览')
    A('-- 全量数据：%d 部番剧 / %d 位角色 / %d 条台词' % (len(series), sum(len(v) for v in chars.values()), len(quotes)))
    A('-- 表前缀：sekai_dataobject_anime_')
    A('-- ============================================================')
    A('')
    A('CREATE DATABASE IF NOT EXISTS sekai_friend')
    A('DEFAULT CHARACTER SET utf8mb4')
    A('COLLATE utf8mb4_general_ci;')
    A('')
    A('USE sekai_friend;')
    A('')
    A('-- 清理旧数据（可重跑）')
    A('DELETE FROM sekai_dataobject_anime_quote;')
    A('DELETE FROM sekai_dataobject_anime_character;')
    A('DELETE FROM sekai_dataobject_anime_series;')
    A('DELETE FROM sekai_dataobject_anime_user;')
    A('ALTER TABLE sekai_dataobject_anime_quote AUTO_INCREMENT = 1;')
    A('ALTER TABLE sekai_dataobject_anime_character AUTO_INCREMENT = 1;')
    A('ALTER TABLE sekai_dataobject_anime_series AUTO_INCREMENT = 1;')
    A('ALTER TABLE sekai_dataobject_anime_user AUTO_INCREMENT = 1;')
    A('')
    A('-- 用户表')
    A('CREATE TABLE IF NOT EXISTS sekai_dataobject_anime_user (')
    A('    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT \'用户ID\',')
    A('    username VARCHAR(50) NOT NULL UNIQUE COMMENT \'用户名，用于登录\',')
    A('    password VARCHAR(100) NOT NULL COMMENT \'密码\',')
    A('    nickname VARCHAR(50) DEFAULT NULL COMMENT \'昵称\',')
    A('    avatar VARCHAR(500) DEFAULT NULL COMMENT \'头像地址\',')
    A('    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT \'创建时间\'')
    A(') COMMENT=\'用户表\';')
    A('')
    A('-- 番剧表（官方信息）')
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
    A('-- 人物表（官方信息）')
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
    A('-- 台词表（含原音频地址）')
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
    A('-- 默认演示账号（密码：sekai123）')
    A('INSERT INTO sekai_dataobject_anime_user (username, password, nickname) VALUES')
    A("('admin', 'sha256$bbiuDBPMhws8LGQFMQuvnw==$jha2kYc5w2L9ZYkcHVn/MsxD0DfBTPb9ZE28tcnqf8E=', '数据管理员');")
    A('')

    # ---------- 番剧 ----------
    A('-- ============================================================')
    A('-- 番剧（%d 部，AniList TOP200 官方数据）' % len(series))
    A('-- ============================================================')
    header = ('INSERT INTO sekai_dataobject_anime_series\n'
              '(title, original_title, type, studio, release_date, total_episodes, score, synopsis, cover_url, tags, official_url) VALUES')
    chunk = []
    for s in series:
        cover = cover_for(s['aid']) or s.get('cover') or None
        desc = re.sub(r'\s+', ' ', s.get('desc') or '')[:1500] or None
        chunk.append('(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' % (
            esc(s['title'][:100]),
            esc((s.get('original') or '')[:100]),
            esc((s.get('type') or 'TV')[:50]),
            esc((s.get('studio') or '')[:100]),
            esc('%04d-01-01' % (s.get('year') or 2000)),
            esc(s.get('eps')),
            esc(round(float(s.get('score') or 0), 1)),
            esc(desc),
            esc(cover),
            esc((s.get('tags') or '')[:250]),
            esc((s.get('site') or '')[:1000]),
        ))
    for i in range(0, len(chunk), 500):
        A(header)
        A(',\n'.join(chunk[i:i + 500]) + ';')
    A('')

    # ---------- 角色 ----------
    total_chars = sum(len(v) for v in chars.values())
    A('-- ============================================================')
    A('-- 角色（%d 位，AniList 官方角色数据）' % total_chars)
    A('-- ============================================================')
    header = ('INSERT INTO sekai_dataobject_anime_character\n'
              '(series_id, name, original_name, role, voice_actor, description, image_url) VALUES')
    chunk = []
    for aid in sorted(chars.keys(), key=lambda x: int(x)):
        sid = aid2id[int(aid)]
        for c in sorted(chars[aid], key=lambda x: x['id']):
            chunk.append('(%s, %s, %s, %s, %s, %s, %s)' % (
                sid,
                esc((c.get('name') or '')[:100]),
                esc((c.get('original') or '')[:100]),
                esc((c.get('role') or '配角')[:50]),
                esc((c.get('va') or '')[:100]),
                esc(c.get('desc')),
                esc(c.get('img')),
            ))
    for i in range(0, len(chunk), 500):
        A(header)
        A(',\n'.join(chunk[i:i + 500]) + ';')
    A('')

    # ---------- 台词 ----------
    A('-- ============================================================')
    A('-- 台词（%d 条，公开台词数据集 + 精选）' % len(quotes))
    A('-- ============================================================')
    header = ('INSERT INTO sekai_dataobject_anime_quote\n'
              '(series_id, character_id, character_name, content, episode, time_point, audio_url) VALUES')
    chunk = []
    for q in quotes:
        cid = q.get('character_id')
        if cid is not None and cid not in char_by_id:
            cid = None
        chunk.append('(%s, %s, %s, %s, NULL, NULL, NULL)' % (
            aid2id.get(q['series_id'], 'NULL'),
            'NULL' if cid is None else cid,
            esc((q.get('character_name') or '')[:100]),
            esc(q['content'][:990]),
        ))
    for i in range(0, len(chunk), 500):
        A(header)
        A(',\n'.join(chunk[i:i + 500]) + ';')
    A('')

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print('[done] %s  (%d bytes)' % (OUT, os.path.getsize(OUT)))

if __name__ == '__main__':
    main()
