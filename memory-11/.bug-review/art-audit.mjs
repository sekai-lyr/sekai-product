/** How many card images actually exist on disk? */
import { ALL_CARDS } from "../SekaiGame/src/main/resources/static/js/catalog.js";
import { NIGHTCORD_ART, getArtById } from "../SekaiGame/src/main/resources/static/js/nightcord-art.js";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = "SekaiGame/src/main/resources/static";
const missing = [];
const present = new Set();
let checked = 0;

for (const card of ALL_CARDS) {
    const image = card.image;
    if (!image) { missing.push({ id: card.id, name: card.name, image: "(空)", reason: "无 image 字段" }); continue; }
    const rel = image.replace(/^\.\//, "").split("?")[0];
    const file = path.join(ROOT, rel);
    checked++;
    if (existsSync(file)) present.add(rel);
    else missing.push({ id: card.id, name: card.name, image: rel, reason: "文件不存在" });
}

console.log("检查卡图:", checked, "张");
console.log("唯一存在的图片文件:", present.size);
console.log("缺失卡图:", missing.length, `(${(missing.length / checked * 100).toFixed(1)}%)`);
const byDir = {};
for (const m of missing) {
    const dir = m.image.includes("/") ? m.image.replace(/[^/]*$/, "").replace(/\/$/, "") : "(根)";
    byDir[dir] = (byDir[dir] || 0) + 1;
}
console.log("\n缺失按目录:");
for (const [dir, count] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(4)}  ${dir}`);
console.log("\n示例:");
for (const m of missing.slice(0, 8)) console.log(`  ${m.id} ${m.name} -> ${m.image} (${m.reason})`);

// nightcord art registry
const artIds = Object.keys(NIGHTCORD_ART);
let artMissing = 0;
for (const [cardId, arts] of Object.entries(NIGHTCORD_ART)) {
    for (const art of arts) {
        const rel = String(art.image || "").replace(/^\.\//, "").split("?")[0];
        if (rel && !existsSync(path.join(ROOT, rel))) artMissing++;
    }
}
console.log(`\n插画美术表 (NIGHTCORD_ART): ${artIds.length} 张卡有条目，缺失美术文件 ${artMissing} 个`);
console.log("默认美术 getDefaultArt('nc_sp_ur_001'):", getDefaultArt());
function getDefaultArt() { try { return JSON.stringify(getArtById("nc_sp_ur_001"))?.slice(0, 120); } catch (e) { return "抛错: " + e.message; } }
