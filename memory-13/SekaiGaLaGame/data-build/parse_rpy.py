# -*- coding: utf-8 -*-
"""
parse_rpy.py — 将 Ren'Py 脚本 script.rpy 解析为剧情图数据
输出：
  story-meta.sql   章节/角色/结局/图片清单
  story-nodes.sql  剧情节点 + 选项
  story.json       完整剧情图 JSON（调试用）
"""
import re
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = r"D:\Sekai_two\memory-13\lies ten years ago\game\scripts\script.rpy"
OUT_META = os.path.join(BASE, "database", "story-meta.sql")
OUT_NODES = os.path.join(BASE, "database", "story-nodes.sql")
OUT_JSON = os.path.join(BASE, "database", "story.json")

with open(SRC, encoding="utf-8-sig") as f:
    raw_lines = f.read().split("\n")


def strip_comment(line):
    in_q = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_q = not in_q
        elif ch == '#' and not in_q:
            return line[:i]
    return line


# ---------------------------------------------------------------- 第一阶段：收集 define / image / tokens
characters = {}   # key -> {"name","color","role"}
images = {}       # key -> {"type","path"}

CHAR_RE = re.compile(r'^define\s+(\w+)\s*=\s*Character\(\s*["\']([^"\']+)["\']\s*(?:,\s*color\s*=\s*["\']([^"\']+)["\'])?')
IMG_RE = re.compile(r'^image\s+(.+?)\s*=\s*(?:At\(|Crop\([^)]*\)\s*,\s*)?["\'](images/[^"\']+)["\']')

tokens = []  # (indent, content)
i = 0
n = len(raw_lines)
while i < n:
    line = raw_lines[i].rstrip()
    if not line.strip():
        i += 1
        continue
    indent = len(line) - len(line.lstrip(" "))
    content = strip_comment(line).strip()
    if not content:
        i += 1
        continue

    if content.startswith("init python"):
        i += 1
        while i < n:
            l2 = raw_lines[i]
            if l2.strip() and len(l2) - len(l2.lstrip(" ")) == 0:
                break
            i += 1
        continue

    m = CHAR_RE.match(content)
    if m:
        characters[m.group(1)] = {"name": m.group(2), "color": m.group(3) or "#ffffff", "role": "character"}
        i += 1
        continue

    m = IMG_RE.match(content)
    if m:
        key = m.group(1).strip()
        path = m.group(2)
        img_type = "bg" if key.startswith("bg ") else ("cg" if key.startswith("cg ") else "sprite")
        images[key] = {"type": img_type, "path": path}
        i += 1
        continue

    if content.startswith("transform "):
        i += 1
        while i < n:
            l2 = raw_lines[i]
            if l2.strip() and len(l2) - len(l2.lstrip(" ")) <= indent:
                break
            i += 1
        continue

    if content.startswith(("define ", "default ")):
        i += 1
        continue

    tokens.append((indent, content))
    i += 1

# ---------------------------------------------------------------- 第二阶段：解析剧情结构
class Node:
    _counter = 0

    def __init__(self, node_type, seq, **kw):
        self.key = "s%d" % Node._counter
        Node._counter += 1
        self.type = node_type
        self.seq = seq
        self.label = kw.get("label", "")
        self.chapter = kw.get("chapter", 0)
        self.speaker_key = kw.get("speaker_key", "")
        self.speaker_name = kw.get("speaker_name", "")
        self.text = kw.get("text", "")
        self.bg_image = kw.get("bg_image", "")
        self.sprites = kw.get("sprites", None)   # list of {"image":..,"pos":..} or {"hide":..}
        self.set_var = kw.get("set_var", "")
        self.set_value = kw.get("set_value", "")
        self.next_ref = kw.get("next_ref", None)  # Node / "FALLTHROUGH" / label名 / None
        self.ending_key = kw.get("ending_key", "")


def chapter_of(label):
    m = re.match(r'^chapter_(\d+)$', label)
    if m:
        return int(m.group(1))
    m = re.match(r'^(?:side_)?ch(\d+)(?:_|$)', label)
    if m:
        return int(m.group(1))
    if label == "start":
        return 0
    if label == "main_ryokan_morning":
        return 4
    if label in ("route_main_search", "route_side_memory"):
        return 16
    return 0


nodes = []          # 全部节点
choices = []        # {menu_key, text, next, order}
label_first = {}    # label -> 首节点
unknown = []

DIALOGUE_RE = re.compile(r'^([\w_]+)\s+"(.*)"$', re.S)
SCENE_RE = re.compile(r'^scene\s+([\w\s]+?)(?:\s+with\s+\w+(?:\([^)]*\))?)?$')
SHOW_RE = re.compile(r'^show\s+([\w\s]+?)(?:\s+at\s+([\w_]+))?$')
HIDE_RE = re.compile(r'^hide\s+([\w\s]+)$')
SET_RE = re.compile(r'^\$\s+([\w_]+)\s*=\s*(.+)$')
JUMP_RE = re.compile(r'^jump\s+(\w+)$')
OPTION_RE = re.compile(r'^"(.+)"\s*:\s*$')
LABEL_RE = re.compile(r'^label\s+(\w+)\s*:?')
SKIP_RE = re.compile(r'^(with |window |play |stop |queue |pause |voice |if |elif |else|for |while |pass|call )')

seq_counter = [0]


def make_simple_node(node_type, seq, current_label, chapter, **kw):
    return Node(node_type, seq, label=current_label, chapter=chapter, **kw)


def parse_statement(idx, level, current_label, chapter):
    """解析 level 层的一个语句，返回 (首节点, 尾部节点列表, 新索引)"""
    indent, content = tokens[idx]

    m = LABEL_RE.match(content)
    if m:
        return None, [], idx

    if content == "pass" or SKIP_RE.match(content):
        return None, [], idx + 1
    if OPTION_RE.match(content):
        return None, [], idx + 1

    seq = seq_counter[0]
    seq_counter[0] += 1

    if content == "menu:":
        menu_node = Node("menu", seq, label=current_label, chapter=chapter)
        idx += 1
        order = 0
        tails = [menu_node]
        while idx < len(tokens) and tokens[idx][0] > level:
            m = OPTION_RE.match(tokens[idx][1])
            if not m:
                idx += 1
                continue
            opt_text = m.group(1)
            opt_indent = tokens[idx][0]
            next_idx = idx + 1
            body_indent = tokens[next_idx][0] if (next_idx < len(tokens) and tokens[next_idx][0] > opt_indent) else opt_indent
            idx = next_idx
            body_nodes, body_tails, idx = parse_block(idx, body_indent, current_label, chapter)
            first_node = body_nodes[0] if body_nodes else None
            choices.append({"menu_key": menu_node.key, "text": opt_text,
                            "next": first_node.key if first_node else None,
                            "order": order})
            order += 1
            tails.extend(body_tails)
        nodes.append(menu_node)
        return menu_node, tails, idx

    if content == "return":
        nd = Node("end", seq, label=current_label, chapter=chapter, ending_key=current_label)
        nd.next_ref = None
        nodes.append(nd)
        return nd, [], idx + 1

    m = JUMP_RE.match(content)
    if m:
        nd = Node("jump", seq, label=current_label, chapter=chapter)
        nd.next_ref = m.group(1)
        nodes.append(nd)
        return nd, [], idx + 1

    if SCENE_RE.match(content):
        nd = make_simple_node("scene", seq, current_label, chapter, bg_image=SCENE_RE.match(content).group(1).strip())
    elif SHOW_RE.match(content):
        sm = SHOW_RE.match(content)
        nd = make_simple_node("sprite", seq, current_label, chapter,
                              sprites=[{"image": sm.group(1).strip(), "pos": sm.group(2) or "center"}])
    elif HIDE_RE.match(content):
        hm = HIDE_RE.match(content)
        nd = make_simple_node("sprite", seq, current_label, chapter,
                              sprites=[{"hide": hm.group(1).strip()}])
    elif SET_RE.match(content):
        sm = SET_RE.match(content)
        val = sm.group(2).strip()
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        elif val == "True":
            val = "true"
        elif val == "False":
            val = "false"
        nd = make_simple_node("set", seq, current_label, chapter,
                              set_var=sm.group(1), set_value=val)
    elif DIALOGUE_RE.match(content):
        dm = DIALOGUE_RE.match(content)
        spk = dm.group(1)
        txt = dm.group(2).strip()
        if spk == "narrator":
            nd = make_simple_node("narration", seq, current_label, chapter, text=txt)
        else:
            ch = characters.get(spk, {})
            nd = make_simple_node("dialogue", seq, current_label, chapter,
                                  speaker_key=spk, speaker_name=ch.get("name", spk), text=txt)
    else:
        seq_counter[0] -= 1
        unknown.append((idx, content))
        return None, [], idx + 1

    nd.next_ref = "FALLTHROUGH"
    nodes.append(nd)
    return nd, [nd], idx + 1


def parse_block(idx, level, current_label, chapter):
    """解析 level 缩进层的连续语句块。返回 (首节点列表, 需要外部回落的尾部, 新索引)"""
    block_nodes = []
    pending_tails = []

    while idx < len(tokens):
        indent, content = tokens[idx]
        if indent < level:
            break
        if indent > level:
            idx += 1
            continue

        # label 标记：解析其正文块（正文缩进取下一 token 的实际缩进）
        m = LABEL_RE.match(content)
        if m:
            current_label = m.group(1)
            chapter = chapter_of(current_label)
            body_indent = tokens[idx + 1][0] if idx + 1 < len(tokens) else level
            body_nodes, body_tails, idx = parse_block(idx + 1, body_indent, current_label, chapter)
            body_first = body_nodes[0] if body_nodes else None
            if body_first and current_label not in label_first:
                label_first[current_label] = body_first
            # 上一语句的回落 -> 新 label 正文首节点
            for t in pending_tails:
                t.next_ref = body_first
            pending_tails = list(body_tails)
            if body_first:
                block_nodes.append(body_first)
            continue

        first_node, tails, idx = parse_statement(idx, level, current_label, chapter)
        if first_node is None and not tails:
            continue
        for t in pending_tails:
            t.next_ref = first_node
        if first_node:
            block_nodes.append(first_node)
        pending_tails = list(tails)

    return block_nodes, pending_tails, idx


root_nodes, root_tails, _ = parse_block(0, 0, "", 0)

# 解析 next 链
unresolved_jumps = []
next_map = {}
for nd in nodes:
    r = nd.next_ref
    if r is None:
        next_map[nd.key] = None
    elif r == "FALLTHROUGH":
        next_map[nd.key] = None
    elif isinstance(r, Node):
        next_map[nd.key] = r.key
    elif isinstance(r, str):
        target = label_first.get(r)
        next_map[nd.key] = target.key if target else None
        if target is None:
            unresolved_jumps.append((nd.key, r))
    else:
        next_map[nd.key] = None

# ---------------------------------------------------------------- 第三阶段：生成 SQL
def esc(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"


lines_meta = []
lines_nodes = []
lines_choices = []

chapter_titles = {
    0: "序章 · 开往雪国的列车",
    1: "第一章 · 雨停之前",
    2: "第二章 · 夜行的列车",
    3: "第三章 · 说谎游戏",
    4: "第四章 · 温泉旅馆的清晨",
    5: "第五章 · 雪之告白",
    6: "第六章 · 雪村的夜晚",
    7: "第七章 · 乐队之夜",
    8: "第八章 · 放风筝的日子",
    9: "第九章 · 秋天的轻井泽",
    10: "第十章 · 旧街道与约定",
    11: "第十一章 · 向日葵的花语",
    12: "第十二章 · 云场池",
    13: "第十三章 · 见晴台",
    14: "第十四章 · 离别",
    15: "第十五章 · 空房间与信",
    16: "第十六章 · 追与留",
    17: "第十七章 · 宠物店",
    18: "第十八章 · 雨天",
    19: "第十九章 · 电影院",
    20: "第二十章 · 樱花重逢",
    21: "第二十一章 · 照片",
    22: "第二十二章 · 涩谷之春",
    23: "第二十三章 · 东京咖啡店",
    24: "第二十四章 · 咖啡店的日常",
    25: "第二十五章 · 图书馆的黄昏",
    26: "第二十六章 · 谎言",
    27: "第二十七章 · 东京的夜晚",
    28: "第二十八章 · 御茶之水",
    29: "第二十九章 · B小町",
    30: "第三十章 · 秘密训练",
}
start_label_by_chapter = {}
for nd in nodes:
    if nd.label and nd.chapter not in start_label_by_chapter:
        start_label_by_chapter[nd.chapter] = nd.label

lines_meta.append("-- 章节")
for ch in sorted(start_label_by_chapter.keys()):
    title = chapter_titles.get(ch, "第 %d 章" % ch)
    lines_meta.append("INSERT INTO sekai_GaLaGame_lies_chapters (chapter_no, title, start_label, summary, sort_no) VALUES (%d, %s, %s, %s, %d);"
                      % (ch, esc(title), esc(start_label_by_chapter[ch]), esc(""), ch))

lines_meta.append("-- 角色")
roles = {"taku": "男主角", "ai": "女主角", "narrator": "旁白",
         "yuki": "配角", "koizumi": "配角", "maki": "配角", "nishida": "配角",
         "sanae": "配角", "ritsuko": "配角", "mai": "配角",
         "ai_letter": "书信", "conductor": "配角", "waitress": "配角",
         "flower_child": "配角", "shop_owner": "配角", "snow_staff": "配角",
         "performer": "配角", "band_drummer_girl": "配角", "band_bassist_girl": "配角",
         "audience": "配角"}
sort_i = 0
for k, v in characters.items():
    lines_meta.append("INSERT INTO sekai_GaLaGame_lies_characters (char_key, name, color, role, sort_no) VALUES (%s, %s, %s, %s, %d);"
                      % (esc(k), esc(v["name"]), esc(v["color"]), esc(roles.get(k, "配角")), sort_i))
    sort_i += 1

ending_titles = {
    "ending_karuizawa_fade": "轻井泽的淡季",
    "ending_spring_no_line": "没有回信的春天",
    "ending_overclear_relationship": "过于明确的答案",
    "ending_unvisited_training": "未曾赴约的训练",
    "ending_summer_promise": "夏日的约定",
    "ending_leaf_bookmark": "落叶书签",
    "ending_missed_companion": "错过的旅伴",
    "ending_empty_encouragement": "空洞的鼓励",
    "ending_light_answer": "轻易的答案",
    "ending_too_close": "太近的距离",
    "ending_white_church": "白色教堂",
    "ending_silver_chain": "银链",
    "ending_sunflower_between": "向日葵之间",
    "ending_bench_dawn": "长椅上的黎明",
    "ending_quiet_parting": "安静的告别",
    "route_main_search": "追迹之旅",
    "route_side_memory": "记忆之旅",
    "chapter_30": "主线结局 · 十年之后",
}
ending_nodes = [nd for nd in nodes if nd.type == "end"]
endings = {}
for nd in ending_nodes:
    ek = nd.ending_key
    if ek not in endings:
        endings[ek] = {"title": ending_titles.get(ek, ek), "desc": "", "bg": ""}
    if not endings[ek]["desc"] and nd.text:
        endings[ek]["desc"] = nd.text[:200]

label_desc = {}
for nd in nodes:
    if nd.type in ("narration", "dialogue") and nd.text and nd.label not in label_desc:
        label_desc[nd.label] = nd.text[:200]
for ek, v in endings.items():
    if not v["desc"]:
        v["desc"] = label_desc.get(ek, "")
    for nd in nodes:
        if nd.label == ek and nd.type == "scene":
            v["bg"] = nd.bg_image
            break

lines_meta.append("-- 结局")
sort_i = 0
for ek, v in endings.items():
    lines_meta.append("INSERT INTO sekai_GaLaGame_lies_endings (ending_key, title, description, bg_image, sort_no) VALUES (%s, %s, %s, %s, %d);"
                      % (esc(ek), esc(v["title"]), esc(v["desc"]), esc(v["bg"]), sort_i))
    sort_i += 1

lines_meta.append("-- 图片清单")
for k, v in sorted(images.items()):
    lines_meta.append("INSERT INTO sekai_GaLaGame_lies_images (image_key, image_type, file_path, file_name) VALUES (%s, %s, %s, %s);"
                      % (esc(k), esc(v["type"]), esc(v["path"]), esc(os.path.basename(v["path"]))))

lines_nodes.append("-- 剧情节点")
seen = set()
for nd in nodes:
    if nd.key in seen:
        continue
    seen.add(nd.key)
    sprites = json.dumps(nd.sprites, ensure_ascii=False) if nd.sprites else ""
    lines_nodes.append(
        "INSERT INTO sekai_GaLaGame_lies_story_nodes (node_key, label_name, chapter_no, node_type, seq_no, speaker_key, speaker_name, text, bg_image, sprites, set_var, set_value, next_key, ending_key) VALUES (%s, %s, %d, %s, %d, %s, %s, %s, %s, %s, %s, %s, %s, %s);"
        % (esc(nd.key), esc(nd.label), nd.chapter, esc(nd.type), nd.seq,
           esc(nd.speaker_key), esc(nd.speaker_name), esc(nd.text), esc(nd.bg_image),
           esc(sprites), esc(nd.set_var), esc(nd.set_value),
           esc(next_map.get(nd.key)), esc(nd.ending_key)))

lines_choices.append("-- 选项")
for c in choices:
    lines_choices.append("INSERT INTO sekai_GaLaGame_lies_choices (node_key, option_text, next_key, order_no) VALUES (%s, %s, %s, %d);"
                         % (esc(c["menu_key"]), esc(c["text"]), esc(c["next"]), c["order"]))

with open(OUT_META, "w", encoding="utf-8") as f:
    f.write("USE sekai_friend;\n\n")
    f.write("\n".join(lines_meta))
with open(OUT_NODES, "w", encoding="utf-8") as f:
    f.write("USE sekai_friend;\n\n")
    f.write("\n".join(lines_nodes))
    f.write("\n\n")
    f.write("\n".join(lines_choices))

json_out = {
    "characters": characters,
    "images": images,
    "labels": {k: (v.key if v else None) for k, v in label_first.items()},
    "nodes": [{"key": nd.key, "type": nd.type, "label": nd.label, "chapter": nd.chapter,
               "speaker": nd.speaker_key, "name": nd.speaker_name, "text": nd.text,
               "bg": nd.bg_image, "sprites": nd.sprites, "var": nd.set_var, "val": nd.set_value,
               "next": next_map.get(nd.key), "ending": nd.ending_key} for nd in nodes],
    "choices": choices,
    "endings": endings,
}
with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(json_out, f, ensure_ascii=False, indent=1)

print("=== parse_rpy.py 完成 ===")
print("节点总数: %d" % len(seen))
print("菜单节点: %d" % len([nd for nd in nodes if nd.type == "menu"]))
print("选项数: %d" % len(choices))
print("结局数: %d" % len(endings))
print("label 数: %d" % len(label_first))
print("未知语句: %d" % len(unknown))
for u in unknown[:40]:
    print("  未知行[%d]: %s" % (u[0], u[1][:90]))
print("未解析跳转: %d" % len(unresolved_jumps))
for u in unresolved_jumps[:10]:
    print("  未解析跳转 %s -> %s" % (u[0], u[1]))
