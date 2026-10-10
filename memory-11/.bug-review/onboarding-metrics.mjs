/** 首屏重量 + 开包重复率曲线，用来判断还能往哪里优化。 */
const BASE = "http://127.0.0.1:8080";
const seen = new Map(); // path -> bytes

function resolve(spec, fromPath) {
    if (/^https?:/.test(spec)) return spec;
    const baseDir = fromPath.replace(/[^/]*$/, "");
    const path = spec.split("?")[0];
    return new URL(path.startsWith("/") ? path : baseDir + path, BASE).pathname;
}

async function walk(path) {
    if (seen.has(path)) return;
    let text;
    try {
        const r = await fetch(BASE + path);
        text = await r.text();
        seen.set(path, Buffer.byteLength(text));
    } catch { seen.set(path, 0); return; }
    if (!path.endsWith(".js")) return;
    const specs = [
        ...text.matchAll(/^\s*(?:import|export)\b[^;"']*?from\s*["']([^"']+)["']/gm),
        ...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ].map(m => m[1]);
    const queue = specs.filter(s => !s.startsWith("node:")).map(s => resolve(s, path));
    await Promise.all(queue.map(walk));
}

const html = await (await fetch(BASE + "/")).text();
const entry = [...html.matchAll(/\.src\s*=\s*["']([^"']+\.js[^"']*)["']/g)].map(m => resolve(m[1], "/"));
await Promise.all(entry.map(walk));

const css = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m => m[1]);
let cssBytes = 0;
for (const c of css) {
    const r = await fetch(new URL(c, BASE + "/").href);
    cssBytes += Buffer.byteLength(await r.text());
}

const js = [...seen.entries()].sort((a, b) => b[1] - a[1]);
const jsTotal = js.reduce((s, [, b]) => s + b, 0);
console.log("=== 首屏（登录页）传输量 ===");
console.log(`JS 模块数: ${js.length} | JS 合计: ${(jsTotal / 1024).toFixed(0)} KB`);
console.log(`CSS 合计: ${(cssBytes / 1024).toFixed(0)} KB（未压缩、未拆分）`);
console.log(`HTML: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
console.log(`登录页合计 ≈ ${((jsTotal + cssBytes) / 1024).toFixed(0)} KB / ${js.length + css.length + 1} 个请求`);
console.log("\n最大的 10 个模块:");
for (const [p, b] of js.slice(0, 10)) console.log(`  ${(b / 1024).toFixed(0).padStart(6)} KB  ${p}`);

// ---- 开包重复率曲线 ----
const { ALL_CARDS } = await import("../SekaiGame/src/main/resources/static/js/catalog.js");
const { getPackPool, openPack, NIGHTCORD_PACK } = await import("../SekaiGame/src/main/resources/static/js/packs.js");
const pool = getPackPool(NIGHTCORD_PACK, ALL_CARDS);
const owned = new Set();
let opens = 0;
const marks = [];
const rng = { next: Math.random, integer: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a, pick(list) { return list[this.integer(0, list.length - 1)]; }, weightedPick(entries) { let t = entries.reduce((s, e) => s + e.weight, 0), r = this.next() * t; for (const e of entries) { r -= e.weight; if (r <= 0) return e.value; } return entries[entries.length - 1].value; } };
for (let i = 0; i < 100; i++) {
    const res = openPack(NIGHTCORD_PACK, pool, rng, 0);
    opens++;
    let fresh = 0;
    for (const c of res.cards) { if (!owned.has(c.id)) { owned.add(c.id); fresh++; } }
    if ([1, 5, 10, 20, 30, 50, 80, 100].includes(opens)) marks.push([opens, fresh, owned.size]);
}
console.log("\n=== 开包重复率（每包 8 张，单次模拟） ===");
console.log("包数  本包新卡  累计收集  收集率");
for (const [n, fresh, total] of marks) {
    console.log(`${String(n).padStart(4)}  ${String(fresh).padStart(6)}  ${String(total).padStart(6)}  ${(total / pool.length * 100).toFixed(1)}%`);
}
console.log(`\n集齐 ${pool.length} 张所需期望包数（粗略）: 约 ${Math.ceil(pool.length * Math.log(pool.length) / 8)} 包 = ${(Math.ceil(pool.length * Math.log(pool.length) / 8) * 1000).toLocaleString()} 决斗币`);
