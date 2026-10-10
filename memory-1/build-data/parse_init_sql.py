# -*- coding: utf-8 -*-
"""从 init.sql / init_full.sql 中解析种子数据，输出 JSON，供构建脚本使用"""
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, 'data', 'curated')
os.makedirs(DATA_DIR, exist_ok=True)

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'init.sql')

with open(SRC, encoding='utf-8') as f:
    text = f.read()

def parse_inserts(sql, table):
    """解析 INSERT INTO <table> (cols) VALUES (...), (...); 返回 rows 列表"""
    pattern = re.compile(
        r"INSERT INTO %s\s*\((.*?)\)\s*VALUES\s*((?:\(.*?\);|\s*))" % re.escape(table),
        re.S | re.I)
    rows = []
    for m in pattern.finditer(sql):
        cols = [c.strip() for c in m.group(1).split(',')]
        body = m.group(2)
        body = body.rstrip().rstrip(';').strip()
        tuples = split_tuples(body)
        for tup in tuples:
            if len(tup) != len(cols):
                continue
            rows.append(dict(zip(cols, tup)))
    return rows

def split_tuples(body):
    """把 '(...),(...)' 按顶层逗号切分成元组，并解引号"""
    out = []
    buf = []
    depth = 0
    i = 0
    n = len(body)
    while i < n:
        c = body[i]
        if c == "'":
            j = i + 1
            while j < n:
                if body[j] == "'":
                    if j + 1 < n and body[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            buf.append(body[i:j + 1])
            i = j + 1
            continue
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        if c == ',' and depth == 0:
            out.append(buf)
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    if buf:
        out.append(buf)
    rows = []
    for t in out:
        s = ''.join(t).strip()
        if not s:
            continue
        if s.startswith('(') and s.endswith(')'):
            s = s[1:-1]
        rows.append([unq(v.strip()) for v in split_values(s)])
    return rows

def split_values(s):
    vals = []
    buf = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == "'":
            j = i + 1
            while j < n:
                if s[j] == "'":
                    if j + 1 < n and s[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            buf.append(s[i:j + 1])
            i = j + 1
            continue
        if c == ',':
            vals.append(''.join(buf).strip())
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    if buf:
        vals.append(''.join(buf).strip())
    return vals

def unq(v):
    v = v.strip()
    if v.upper() == 'NULL':
        return None
    if v.startswith("'") and v.endswith("'"):
        return v[1:-1].replace("''", "'")
    return v

series = parse_inserts(text, 'sekai_dataobject_anime_series')
chars = parse_inserts(text, 'sekai_dataobject_anime_character')
quotes = parse_inserts(text, 'sekai_dataobject_anime_quote')
print('[parse] series:', len(series), 'chars:', len(chars), 'quotes:', len(quotes))
print('sample series:', json.dumps(series[0], ensure_ascii=False)[:200])
print('sample char:', json.dumps(chars[0], ensure_ascii=False)[:200])
print('sample quote:', json.dumps(quotes[0], ensure_ascii=False)[:200])

for name, data in (('series', series), ('chars', chars), ('quotes', quotes)):
    with open(os.path.join(DATA_DIR, name + '.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
print('[done] curated data written to', DATA_DIR)
