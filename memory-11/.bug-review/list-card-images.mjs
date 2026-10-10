/** 导出"实际被卡牌引用"的图片清单，供转码脚本使用。 */
import { ALL_CARDS } from "../SekaiGame/src/main/resources/static/js/catalog.js";
import { writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = "SekaiGame/src/main/resources/static";
const unique = new Map(); // 相对路径 -> 引用它的卡数
const missing = [];

for (const card of ALL_CARDS) {
    for (const field of ["image", "thumbnail"]) {
        const raw = card[field];
        if (!raw || typeof raw !== "string") continue;
        const rel = raw.replace(/^\.\//, "").split("?")[0];
        if (!rel.startsWith("assets/")) continue;
        if (!existsSync(path.join(ROOT, rel))) { missing.push(`${card.id}:${rel}`); continue; }
        unique.set(rel, (unique.get(rel) || 0) + 1);
    }
}

const list = [...unique.keys()].sort();
const out = { root: ROOT, images: list };
writeFileSync(".bug-review/image-worklist.json", JSON.stringify(out, null, 1));
console.log(`被引用的唯一图片文件: ${list.length}`);
console.log(`缺失: ${missing.length}`);
if (missing.length) console.log(missing.slice(0, 10).join("\n"));
const byDir = {};
for (const rel of list) {
    const dir = rel.replace(/^assets\/cards\//, "").replace(/\/[^/]*$/, "") || "(root)";
    byDir[dir] = (byDir[dir] || 0) + 1;
}
console.log("按目录:", JSON.stringify(byDir));
