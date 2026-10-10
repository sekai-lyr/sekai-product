/**
 * verify-duel-layout-invariants.mjs — 决斗台布局与 4×4 图集的不变性守卫
 *
 * 为什么需要它：
 *   本项目的硬约束是「主控的改动不得影响决斗台尺寸、卡槽间距、双方卡牌布局，
 *   也不得动 4×4 图集」。这条约束靠人看是守不住的 —— 主控样式一旦泄漏到
 *   全局选择器（例如写了个 .field-slot 的覆盖），界面会悄悄变形而没人发现。
 *   这个脚本把它变成可执行的断言。
 *
 * 五类检查：
 *   1. 作用域隔离：controller-2d.css 里每个选择器都必须限定在主控作用域内
 *   2. 无重复定义：其它样式表里不能出现任何主控选择器（唯一来源原则）
 *   3. 几何快照：决斗台/手牌/卡槽/日志等关键声明必须与基线逐字一致
 *   4. 样式表指纹：style.css / game-shell.css 自基线以来未被改动
 *   5. 图集完整：vfx 目录的 4×4 图集数量与总体积未变
 *
 * 首次运行会生成基线；之后每次运行都是比对。确需变更基线时用 --update，
 * 并且应当在 code review 里说明为什么允许改决斗台几何。
 *
 * 用法：
 *   node SekaiGame/tools/verify-duel-layout-invariants.mjs            # 校验
 *   node SekaiGame/tools/verify-duel-layout-invariants.mjs --update   # 重建基线
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const STATIC = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));
const CSS_DIR = `${STATIC}css/`;
const BASELINE_PATH = fileURLToPath(new URL("./duel-layout-baseline.json", import.meta.url));
const UPDATE = process.argv.includes("--update");

const results = [];
const check = (ok, name, extra = "") => results.push({ ok: !!ok, name, extra });

/* ------------------------------------------------------------------ *
 * 极简 CSS 解析：去注释后按「选择器 { 声明 }」切块，at-rule 递归并带上条件前缀
 * ------------------------------------------------------------------ */
function parseRules(text) {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [];
    let index = 0;
    while (index < clean.length) {
        const open = clean.indexOf("{", index);
        if (open < 0) break;
        const selector = clean.slice(index, open).trim();
        let depth = 0, close = open;
        for (; close < clean.length; close++) {
            if (clean[close] === "{") depth++;
            else if (clean[close] === "}") { depth--; if (depth === 0) break; }
        }
        const body = clean.slice(open + 1, close);
        if (selector.startsWith("@")) {
            // @keyframes 内部是 0%/100% 这样的关键帧，不是选择器，跳过
            if (/^@(-\w+-)?keyframes/.test(selector)) { index = close + 1; continue; }
            for (const inner of parseRules(body)) rules.push({ ...inner, at: selector });
        } else if (selector) {
            rules.push({ selector, body: body.trim(), at: null });
        }
        index = close + 1;
    }
    return rules;
}

function declarationsOf(body) {
    const out = {};
    for (const piece of body.split(";")) {
        const colon = piece.indexOf(":");
        if (colon < 0) continue;
        const key = piece.slice(0, colon).trim();
        const value = piece.slice(colon + 1).trim().replace(/\s+/g, " ");
        // 跳过自定义属性与 url() 里的分号噪声
        if (key && value && !key.startsWith("--")) out[key] = value;
    }
    return out;
}

const readCss = file => readFileSync(`${CSS_DIR}${file}`, "utf8");
const sha256 = text => createHash("sha256").update(text).digest("hex").slice(0, 16);

/* ------------------------------------------------------------------ *
 * 1. 作用域隔离：controller-2d.css 不能出现越界选择器
 * ------------------------------------------------------------------ */
const CONTROLLER_SCOPE = /^(\.duel-controller|\.controller-picker|\.controller-choice|#duel-controller-fx-layer|\.ctl-)/;
/** 允许的全局选择器（都是与主控强相关、且不可能命决斗台结构的） */
const ALLOWED_GLOBAL = new Set([
    "body.reduce-motion .duel-controller-2d .duel-controller-rig",
    "body.reduce-motion .duel-controller-2d .duel-controller-aura",
    "body.reduce-motion .duel-controller-2d [class^=\"ctl-\"]",
]);
const controllerCss = readCss("controller-2d.css");
const controllerRules = parseRules(controllerCss);
const leaked = [];
for (const rule of controllerRules) {
    for (const part of rule.selector.split(",")) {
        const sel = part.trim();
        if (!sel) continue;
        if (ALLOWED_GLOBAL.has(sel)) continue;
        // 判定原则：**最左侧的复合选择器**必须落在主控作用域里。
        // 后面的后代/子元素（img、canvas、.ctl-xxx、伪类）由祖先限定，天然安全。
        const leftmost = sel.split(/\s+|>/)[0].trim();
        const ok = CONTROLLER_SCOPE.test(leftmost)
            || leftmost.startsWith(":root")
            || leftmost.startsWith("body."); // 仅用于 reduce-motion 降级，见 ALLOWED_GLOBAL
        if (!ok) leaked.push(sel);
    }
}
check(leaked.length === 0, "controller-2d.css 的所有选择器都限定在主控作用域内",
    leaked.length ? `越界：${leaked.slice(0, 4).join(" | ")}` : `${controllerRules.length} 条规则`);

/* ------------------------------------------------------------------ *
 * 2. 无重复定义：主控样式只有一个来源
 * ------------------------------------------------------------------ */
const otherSheets = ["anime-theme.css", "style.css", "game-shell.css"];
const duplicated = [];
for (const file of otherSheets) {
    for (const rule of parseRules(readCss(file))) {
        if (/\.duel-controller|\.controller-picker|\.controller-choice|\.ctl-draw-beam/.test(rule.selector)) {
            duplicated.push(`${file}: ${rule.selector}`);
        }
    }
}
check(duplicated.length === 0, "主控样式未在其它样式表里重复定义（唯一来源）",
    duplicated.length ? duplicated.slice(0, 3).join(" | ") : "anime-theme/style/game-shell 均无主控规则");

/* ------------------------------------------------------------------ *
 * 3 + 4. 几何快照 + 样式表指纹
 * ------------------------------------------------------------------ */
const GEOMETRY_TARGETS = [
    { file: "style.css", selector: ".battlefield" },
    { file: "style.css", selector: ".hand" },
    { file: "style.css", selector: ".player-area" },
    { file: "style.css", selector: ".log-panel" },
    { file: "style.css", selector: ".battle-screen" },
    { file: "anime-theme.css", selector: ".battle-screen .monster-row" },
    { file: "anime-theme.css", selector: ".battle-screen .spell-trap-row" },
    { file: "anime-theme.css", selector: ".battle-screen .field-slot" },
    { file: "anime-theme.css", selector: ".battle-screen .spell-trap-row .field-slot" },
    // 主控自身也纳入快照：它的舞台几何是"不许改"的一部分
    { file: "controller-2d.css", selector: ".duel-controller-2d" },
    { file: "controller-2d.css", selector: ".duel-controller-name" },
];

function collectSnapshot() {
    const geometry = [];
    for (const target of GEOMETRY_TARGETS) {
        for (const rule of parseRules(readCss(target.file))) {
            if (rule.selector !== target.selector) continue;
            geometry.push({
                file: target.file,
                at: rule.at,
                selector: target.selector,
                declarations: declarationsOf(rule.body),
            });
        }
    }
    // 只对"决定布局"的声明做快照，避免把颜色之类的无关改动也算成回归
    const LAYOUT_KEYS = new Set([
        "position", "z-index", "left", "right", "top", "bottom", "width", "height", "max-width", "min-width",
        "transform", "display", "grid-template-rows", "grid-template-columns", "gap", "row-gap", "column-gap",
        "align-items", "justify-content", "padding", "padding-top", "margin", "pointer-events", "perspective",
        "object-fit", "object-position",
    ]);
    for (const item of geometry) {
        for (const key of Object.keys(item.declarations)) {
            if (!LAYOUT_KEYS.has(key)) delete item.declarations[key];
        }
    }
    const sheets = {};
    for (const file of ["style.css", "game-shell.css"]) sheets[file] = sha256(readCss(file));
    const atlasDir = `${STATIC}images/vfx`;
    const sheetsFiles = existsSync(atlasDir)
        ? readdirSync(atlasDir).filter(name => /-sheet-v\d+\.png$/.test(name))
        : [];
    const atlas = {
        count: sheetsFiles.length,
        bytes: sheetsFiles.reduce((sum, name) => sum + statSync(`${atlasDir}/${name}`).size, 0),
    };
    const html = readFileSync(`${STATIC}index.html`, "utf8");
    const stylesheets = [...html.matchAll(/<link[^>]+href="([^"]+\.css)[^"]*"/g)].map(m => m[1]);
    return { geometry, sheets, atlas, stylesheets };
}

const snapshot = collectSnapshot();
if (UPDATE || !existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2), "utf8");
    check(true, UPDATE ? "已重建布局基线" : "已生成布局基线（首次运行）", BASELINE_PATH);
} else {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));

    // 3. 几何逐项比对。
    // 注意：同一个 (file, at, selector) 可能在样式表里出现多次（分层覆盖），
    // 所以 key 必须带出现序号，否则 Map 会互相覆盖、把差异误报成"全部丢失"。
    const geometryDiffs = [];
    const keyed = list => {
        const counters = new Map();
        return list.map(item => {
            const base = `${item.file}@${item.at ?? "root"}::${item.selector}`;
            const n = counters.get(base) ?? 0;
            counters.set(base, n + 1);
            return { key: `${base}#${n}`, item };
        });
    };
    const baseEntries = keyed(baseline.geometry);
    const nowEntries = keyed(snapshot.geometry);
    const baseMap = new Map(baseEntries.map(entry => [entry.key, entry.item]));
    for (const entry of nowEntries) {
        const base = baseMap.get(entry.key);
        if (!base) { geometryDiffs.push(`新增规则 ${entry.key}`); continue; }
        for (const [prop, value] of Object.entries(entry.item.declarations)) {
            if (base.declarations[prop] !== value) {
                geometryDiffs.push(`${entry.key} 的 ${prop}: ${base.declarations[prop]} → ${value}`);
            }
        }
        for (const prop of Object.keys(base.declarations)) {
            if (!(prop in entry.item.declarations)) geometryDiffs.push(`${entry.key} 丢失声明 ${prop}`);
        }
        baseMap.delete(entry.key);
    }
    for (const key of baseMap.keys()) geometryDiffs.push(`规则消失 ${key}`);
    check(geometryDiffs.length === 0, "决斗台/手牌/卡槽/日志/主控舞台的布局声明与基线逐字一致",
        geometryDiffs.length ? geometryDiffs.slice(0, 4).join("；") : `${snapshot.geometry.length} 条规则`);

    // 4. 样式表指纹
    const sheetDiffs = Object.entries(snapshot.sheets)
        .filter(([file, hash]) => baseline.sheets[file] !== hash)
        .map(([file]) => file);
    check(sheetDiffs.length === 0, "style.css / game-shell.css 自基线以来未被改动",
        sheetDiffs.length ? `已改动：${sheetDiffs.join(", ")}` : Object.values(snapshot.sheets).join(" / "));

    // 5. 图集完整
    check(snapshot.atlas.count === baseline.atlas.count, "4×4 图集数量未变",
        `${baseline.atlas.count} → ${snapshot.atlas.count}`);
    check(snapshot.atlas.bytes === baseline.atlas.bytes, "4×4 图集总体积未变（没有图被替换）",
        `${(baseline.atlas.bytes / 1048576).toFixed(1)}MB → ${(snapshot.atlas.bytes / 1048576).toFixed(1)}MB`);

    // 附加：样式表引入清单
    check(JSON.stringify(snapshot.stylesheets) === JSON.stringify(baseline.stylesheets),
        "index.html 的样式表引入清单未变", snapshot.stylesheets.join(", "));
}

console.log("─ 决斗台布局与图集不变性 ─");
for (const item of results) console.log(`${item.ok ? "  ✔" : "  ✖"} ${item.name}${item.extra ? `  [${item.extra}]` : ""}`);
const failed = results.filter(item => !item.ok);
console.log(`\n合计 ${results.length} 项：通过 ${results.length - failed.length}，失败 ${failed.length}`);
if (failed.length) console.log(`基线文件：${BASELINE_PATH}\n（确需变更请用 --update，并在 review 里说明）`);
process.exit(failed.length ? 1 : 0);
