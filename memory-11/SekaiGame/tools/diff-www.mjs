// 逐行对比 static 与 www 的差异文件，确认 www 的差异只来自"移动端路径替换 + 版本落后"。
import { readFileSync } from "node:fs";
import path from "node:path";

const A = "D:/Sekai_two/memory-11/SekaiGame/src/main/resources/static";
const B = "D:/Sekai_two/memory-11/SekaiGame/android-app/app/src/main/assets/www";
const files = process.argv.slice(2);
for (const f of files) {
    const a = readFileSync(path.join(A, f), "utf8").split(/\r?\n/);
    const b = readFileSync(path.join(B, f), "utf8").split(/\r?\n/);
    const setB = new Set(b);
    const onlyA = a.filter(l => !setB.has(l) && l.trim());
    const setA = new Set(a);
    const onlyB = b.filter(l => !setA.has(l) && l.trim());
    console.log(`\n### ${f}  (static ${a.length} 行 / www ${b.length} 行)`);
    console.log(`  static 独有 ${onlyA.length} 行：`);
    for (const l of onlyA.slice(0, 8)) console.log("   + " + l.trim().slice(0, 170));
    console.log(`  www 独有 ${onlyB.length} 行：`);
    for (const l of onlyB.slice(0, 8)) console.log("   - " + l.trim().slice(0, 170));
}
