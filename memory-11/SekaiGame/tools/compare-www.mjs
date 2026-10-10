// 对比桌面 Web 源 (static/) 与 APK 内置副本 (android-app/app/src/main/assets/www/)。
// 用来判断 www 里哪些是"移动端专属改动"，哪些只是版本落后。
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const A = "D:/Sekai_two/memory-11/SekaiGame/src/main/resources/static";
const B = "D:/Sekai_two/memory-11/SekaiGame/android-app/app/src/main/assets/www";
const SKIP = new Set(["node_modules", "test", "scripts", "pvp-server"]);
const hash = p => createHash("sha1").update(readFileSync(p)).digest("hex").slice(0, 12);

function walk(root, rel = "") {
    const out = [];
    for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
        if (SKIP.has(entry.name)) continue;
        const r = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) out.push(...walk(root, r));
        else out.push(r);
    }
    return out;
}

const a = new Set(walk(A)), b = new Set(walk(B));
const onlyA = [...a].filter(f => !b.has(f));
const onlyB = [...b].filter(f => !a.has(f));
const both = [...a].filter(f => b.has(f));
const differ = [], same = [];
for (const f of both) {
    try {
        (hash(path.join(A, f)) === hash(path.join(B, f)) ? same : differ).push(f);
    } catch { differ.push(f + " (read error)"); }
}
const group = list => {
    const m = new Map();
    for (const f of list) {
        const top = f.includes("/") ? f.split("/").slice(0, 2).join("/") : f;
        m.set(top, (m.get(top) || 0) + 1);
    }
    return [...m].sort((x, y) => y[1] - x[1]).slice(0, 14);
};
console.log("static files:", a.size, " www files:", b.size, " identical:", same.length, " differ:", differ.length);
console.log("只在 static :", onlyA.length, JSON.stringify(group(onlyA)));
console.log("只在 www    :", onlyB.length, JSON.stringify(group(onlyB)));
console.log("内容不同    :", differ.length, JSON.stringify(group(differ)));
console.log("\n--- 只在 www 的文件（可能是移动端专属） ---");
console.log(onlyB.filter(f => !f.startsWith("images/")).slice(0, 40).join("\n"));
console.log("\n--- 内容不同的非图片文件 ---");
console.log(differ.filter(f => !/\.(png|webp|jpg|jpeg|gif)$/i.test(f)).slice(0, 60).join("\n"));
void statSync; void existsSync;
