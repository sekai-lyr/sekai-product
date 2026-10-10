/** 校验：每一张被引用的原始卡图，是否都有对应的 thumb / card 两档 WebP。 */
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { cardImageSrc } from "../SekaiGame/src/main/resources/static/js/card-images.js";

const ROOT = "SekaiGame/src/main/resources/static";
const work = JSON.parse(readFileSync(".bug-review/image-worklist.json", "utf8"));

let ok = 0;
const missingThumb = [];
const missingCard = [];
let beforeBytes = 0;
let thumbBytes = 0;
let cardBytes = 0;
const oversized = [];

for (const rel of work.images) {
    const original = "./" + rel;
    beforeBytes += statSync(path.join(ROOT, rel)).size;
    for (const [tier, missing, bucket] of [["thumb", missingThumb, "thumb"], ["card", missingCard, "card"]]) {
        const src = cardImageSrc(original, tier);
        const file = path.join(ROOT, src.replace(/^\.\//, ""));
        if (!existsSync(file)) { missing.push(`${rel} -> ${src}`); continue; }
        const size = statSync(file).size;
        if (bucket === "thumb") thumbBytes += size; else cardBytes += size;
        if (bucket === "thumb" && size > 60 * 1024) oversized.push(`${src} ${(size / 1024).toFixed(0)} KB`);
        if (bucket === "card" && size > 200 * 1024) oversized.push(`${src} ${(size / 1024).toFixed(0)} KB`);
    }
    if (missingThumb.length === 0 && missingCard.length === 0) ok++;
}

const mb = n => (n / 1024 / 1024).toFixed(1);
console.log(`被引用卡图: ${work.images.length} 张`);
console.log(`两档 WebP 都存在的: ${ok} 张`);
console.log(`thumb 缺失: ${missingThumb.length} | card 缺失: ${missingCard.length}`);
for (const item of missingThumb.slice(0, 5)) console.log("  thumb: " + item);
for (const item of missingCard.slice(0, 5)) console.log("  card: " + item);
console.log(`\n单张平均: 原始 ${(beforeBytes / work.images.length / 1024).toFixed(0)} KB → thumb ${(thumbBytes / work.images.length / 1024).toFixed(1)} KB / card ${(cardBytes / work.images.length / 1024).toFixed(1)} KB`);
console.log(`合计: 原始 ${mb(beforeBytes)} MB → thumb ${mb(thumbBytes)} MB / card ${mb(cardBytes)} MB`);
console.log(`超大文件（>60KB thumb 或 >200KB card）: ${oversized.length}`);
for (const item of oversized.slice(0, 6)) console.log("  " + item);
console.log(`\n典型页面估算（收藏网格 30 张）: ${(thumbBytes / work.images.length * 30 / 1024).toFixed(0)} KB（改造前 ${(beforeBytes / work.images.length * 30 / 1024 / 1024).toFixed(1)} MB）`);
