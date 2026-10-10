# -*- coding: utf-8 -*-
"""
Sekai Data Object - 声优日文原名抓取（增量，可断点续跑）
输出：build-data/data/va_native.json  { anilist_char_id: va_native_name }
"""
import json
import os
import sys
import time
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, 'data')
OUT = os.path.join(DATA_DIR, 'va_native.json')

ANILIST = 'https://graphql.anilist.co'
QUERY = """
query ($id: Int, $page: Int) {
  Media(id: $id, type: ANIME) {
    characters(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      edges {
        voiceActors(language: JAPANESE, sort: RELEVANCE) { name { full native } }
        node { id }
      }
    }
  }
}
"""


def anilist(variables, retries=10):
    body = json.dumps({'query': QUERY, 'variables': variables}).encode('utf-8')
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
                time.sleep(min(60, 5 + i * 7))
                continue
            if i == retries - 1:
                raise
            time.sleep(2 + i * 3)
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(2 + i * 3)
    return None


def main():
    with open(os.path.join(DATA_DIR, 'full_data.json'), encoding='utf-8') as f:
        full = json.load(f)
    aids = [s['aid'] for s in full['series']]

    va_native = {}
    if os.path.exists(OUT):
        with open(OUT, encoding='utf-8') as f:
            va_native = json.load(f)

    # 已有数据的 aid 可跳过（一个 aid 抓完后记录）
    done_file = os.path.join(DATA_DIR, 'va_native_done.txt')
    done = set()
    if os.path.exists(done_file):
        with open(done_file, encoding='utf-8') as f:
            done = set(line.strip() for line in f)

    for idx, aid in enumerate(aids):
        if str(aid) in done:
            continue
        page = 1
        count = 0
        while True:
            data = anilist({'id': aid, 'page': page})
            media = (data or {}).get('Media') or {}
            chars = media.get('characters') or {}
            edges = chars.get('edges') or []
            for e in edges:
                node = e.get('node') or {}
                cid = node.get('id')
                vas = e.get('voiceActors') or []
                if cid and vas:
                    va_native[str(cid)] = (vas[0].get('name') or {}).get('native') or \
                                          (vas[0].get('name') or {}).get('full') or ''
                count += 1
            if not (chars.get('pageInfo') or {}).get('hasNextPage'):
                break
            page += 1
            time.sleep(1.2)
        done.add(str(aid))
        with open(done_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(sorted(done)))
        if (idx + 1) % 10 == 0 or idx == len(aids) - 1:
            with open(OUT, 'w', encoding='utf-8') as f:
                json.dump(va_native, f, ensure_ascii=False)
            print('[va] %d/%d aid=%d chars=%d total=%d' % (idx + 1, len(aids), aid, count, len(va_native)))
        time.sleep(1.2)

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(va_native, f, ensure_ascii=False)
    print('[va] done total:', len(va_native))


if __name__ == '__main__':
    main()
