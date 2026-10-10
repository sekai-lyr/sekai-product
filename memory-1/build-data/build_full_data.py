# -*- coding: utf-8 -*-
"""
Sekai Data Object - 全量数据构建（阶段A：番剧封面 + 全量角色抓取 + 图片补全）
数据源：AniList GraphQL API
"""
import json
import os
import re
import sys
import ssl
import time
import html as htmlmod
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
DATA_DIR = os.path.join(BASE, 'data')
IMG_DIR = os.path.join(ROOT, 'uploads', 'images')
os.makedirs(IMG_DIR, exist_ok=True)

ANILIST = 'https://graphql.anilist.co'
API_DELAY = 1.5

def anilist(query, variables, retries=12):
    body = json.dumps({'query': query, 'variables': variables}).encode('utf-8')
    for i in range(retries):
        try:
            req = urllib.request.Request(ANILIST, data=body, headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (SekaiDataObject BuildTool)',
            })
            resp = urllib.request.urlopen(req, timeout=60)
            data = json.loads(resp.read().decode('utf-8'))
            if 'errors' in data:
                raise RuntimeError(data['errors'])
            return data['data']
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = min(60, 5 + i * 7)
                print('    [429] wait %ds (i=%d)' % (wait, i))
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(API_DELAY * (i + 2))
    return None

def strip_html(text):
    if not text:
        return None
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.I)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = htmlmod.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:1500] or None

def download(url, path, timeout=45):
    if os.path.exists(path):
        return True
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r, open(path, 'wb') as f:
                f.write(r.read())
            return True
        except Exception:
            time.sleep(3 * (attempt + 1))
    return False

def media_characters_query():
    return '''
    query ($id: Int, $page: Int) {
      Media(id: $id, type: ANIME) {
        id
        characters(page: $page, perPage: 50) {
          pageInfo { hasNextPage }
          edges {
            role
            voiceActors(language: JAPANESE, sort: RELEVANCE) { name { full } }
            node {
              id
              name { full native }
              image { large }
              description
            }
          }
        }
      }
    }
    '''

def main():
    with open(os.path.join(DATA_DIR, 'anilist_top200.json'), encoding='utf-8') as f:
        top = json.load(f)
    with open(os.path.join(DATA_DIR, 'expanded_data.json'), encoding='utf-8') as f:
        expanded = json.load(f)

    series_by_aid = {s['aid']: s for s in expanded['series']}
    top_by_id = {t['id']: t for t in top}

    # ---------- 1. 封面补全（44 张缺失） ----------
    files = set(os.listdir(IMG_DIR))
    disk_aids = set()
    for f in files:
        m = re.match(r's_(\d+)\.', f)
        if m:
            disk_aids.add(m.group(1))
    cover_need = [aid for aid in series_by_aid if str(aid) not in disk_aids]
    print('[cover] need download:', len(cover_need))
    downloaded_covers = []
    for aid in cover_need:
        t = top_by_id.get(aid) or {}
        url = (t.get('coverImage') or {}).get('extraLarge')
        if not url:
            print('[cover] no url for', aid)
            continue
        ext = os.path.splitext(url)[1].split('?')[0] or '.jpg'
        if download(url, os.path.join(IMG_DIR, 's_%d%s' % (aid, ext))):
            downloaded_covers.append((aid, ext))
        else:
            print('[cover] FAIL', aid, url)
    print('[cover] downloaded:', len(downloaded_covers))

    # ---------- 2. 全量角色抓取 ----------
    CACHE = os.path.join(DATA_DIR, 'characters_full.json')
    all_chars = {}
    if os.path.exists(CACHE):
        with open(CACHE, encoding='utf-8') as f:
            all_chars = json.load(f)
    todo = [aid for aid in series_by_aid if str(aid) not in all_chars]
    print('[char] to fetch:', len(todo), '(cached:', len(all_chars), ')')

    role_map = {'MAIN': '主角', 'SUPPORTING': '配角', 'BACKGROUND': '配角', 'COMEDIC': '配角'}
    for idx, aid in enumerate(todo):
        if aid not in top_by_id:
            continue
        page = 1
        char_list = []
        while True:
            data = anilist(media_characters_query(), {'id': aid, 'page': page})
            media = (data or {}).get('Media') or {}
            chars = media.get('characters') or {}
            edges = chars.get('edges') or []
            for e in edges:
                node = e.get('node') or {}
                names = node.get('name') or {}
                img = (node.get('image') or {}).get('large')
                va = ''
                vas = e.get('voiceActors') or []
                if vas:
                    va = (vas[0].get('name') or {}).get('full') or ''
                char_list.append({
                    'id': node.get('id'),
                    'name': names.get('full') or '',
                    'original': names.get('native') or '',
                    'role': role_map.get(e.get('role'), e.get('role') or '配角'),
                    'va': va,
                    'desc': strip_html(node.get('description')),
                    'img_url': img,
                })
            if not (chars.get('pageInfo') or {}).get('hasNextPage'):
                break
            page += 1
            time.sleep(API_DELAY)
        all_chars[str(aid)] = char_list
        if (idx + 1) % 10 == 0:
            with open(CACHE, 'w', encoding='utf-8') as f:
                json.dump(all_chars, f, ensure_ascii=False)
            print('[char] %d/%d aid=%d chars=%d' % (idx + 1, len(todo), aid, len(char_list)))
        time.sleep(API_DELAY)

    with open(CACHE, 'w', encoding='utf-8') as f:
        json.dump(all_chars, f, ensure_ascii=False)
    total = sum(len(v) for v in all_chars.values())
    print('[char] total:', total, 'media covered:', len(all_chars))

    # ---------- 3. 角色图片复用 + 补全 ----------
    old_by_name = {}  # (aid, normalized_en_name) -> img path
    for c in expanded['characters']:
        if c.get('img'):
            old_by_name[(c.get('aid'), re.sub(r'[\s・\-]', '', (c.get('name') or '').lower()))] = c['img']

    def norm(s):
        return re.sub(r'[\s・\-_]', '', (s or '').lower())

    to_dl = []
    char_rows = {}
    for aid, chars in all_chars.items():
        rows = []
        for c in chars:
            img_path = old_by_name.get((int(aid), norm(c['name']))) or old_by_name.get((int(aid), norm(c['original'])))
            if not img_path:
                to_dl.append(c)
            rows.append({
                'id': c['id'],
                'name': c['name'],
                'original': c['original'],
                'role': c['role'],
                'va': c['va'],
                'desc': c['desc'],
                'img': img_path,
                'img_url': c['img_url'],
            })
        char_rows[aid] = rows

    print('[img] to download:', len(to_dl))
    dl_ok = [0]

    def dl_one(c):
        url = c.get('img_url')
        if not url:
            return c, None
        ext = os.path.splitext(url)[1].split('?')[0] or '.jpg'
        path = os.path.join(IMG_DIR, 'c_%s%s' % (c['id'], ext))
        if download(url, path):
            return c, '/uploads/images/c_%s%s' % (c['id'], ext)
        return c, None

    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(dl_one, c): c for c in to_dl}
        for fut in as_completed(futs):
            c, path = fut.result()
            if path:
                dl_ok[0] += 1
                for aid in all_chars:
                    for r in char_rows[aid]:
                        if r['id'] == c['id']:
                            r['img'] = path
    print('[img] downloaded ok:', dl_ok[0], '/', len(to_dl))
    missing_img = sum(1 for aid in char_rows for r in char_rows[aid] if not r.get('img'))
    print('[img] characters without image:', missing_img)

    out = {
        'series': [{
            'aid': s['aid'],
            'title': s['title'],
            'original': s['original'],
            'type': s['type'],
            'studio': s['studio'],
            'year': s['year'],
            'eps': s['eps'],
            'score': s['score'],
            'desc': s['desc'],
            'tags': s.get('tags') or '',
            'site': s.get('site') or '',
        } for s in expanded['series']],
        'characters': char_rows,
    }
    with open(os.path.join(DATA_DIR, 'full_data.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('[done] full_data.json written')

if __name__ == '__main__':
    main()
