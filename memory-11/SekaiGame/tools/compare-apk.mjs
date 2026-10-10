// 对比两个 APK 的 assets 内容，确认体积变化只来自本批次新增素材。
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const [a, b] = process.argv.slice(2);
function entries(apk) {
    const out = execFileSync("powershell", ["-NoProfile", "-Command",
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('${path.resolve(apk)}'); $z.Entries | ForEach-Object { "$($_.FullName)\`t$($_.Length)\`t$($_.CompressedLength)" }; $z.Dispose()`]);
    const map = new Map();
    for (const line of out.toString("utf8").split(/\r?\n/)) {
        if (!line.trim()) continue;
        const [name, size, comp] = line.split("\t");
        map.set(name, [Number(size), Number(comp)]);
    }
    return map;
}
const A = entries(a), B = entries(b);
const sum = (m, filter) => [...m].filter(([k]) => filter(k)).reduce((acc, [, v]) => acc + v[1], 0);
const group = new Map();
for (const [k, v] of B) {
    const top = k.split("/").slice(0, 3).join("/");
    group.set(top, (group.get(top) || 0) + v[1]);
}
const groupA = new Map();
for (const [k, v] of A) {
    const top = k.split("/").slice(0, 3).join("/");
    groupA.set(top, (groupA.get(top) || 0) + v[1]);
}
console.log("entries:", a, A.size, "|", b, B.size, "| delta", B.size - A.size);
console.log("\n按前缀统计压缩后体积差 (MB):");
const keys = new Set([...group.keys(), ...groupA.keys()]);
for (const k of [...keys].sort()) {
    const d = ((group.get(k) || 0) - (groupA.get(k) || 0)) / 1048576;
    if (Math.abs(d) > 0.05) console.log(`  ${(d >= 0 ? "+" : "") + d.toFixed(2)}  ${k}  (${(groupA.get(k) || 0) / 1048576}).toFixed(1) -> ${((group.get(k) || 0) / 1048576).toFixed(1)} MB`);
}
console.log("\n总压缩体积:", (sum(A, () => true) / 1048576).toFixed(1), "->", (sum(B, () => true) / 1048576).toFixed(1), "MB");
const extra = [...B.keys()].filter(k => !A.has(k));
const gone = [...A.keys()].filter(k => !B.has(k));
console.log("新增条目:", extra.length, extra.slice(0, 3).join(", "), extra.length > 3 ? "…" : "");
console.log("消失条目:", gone.length, gone.slice(0, 5).join(", "));
const leaked = [...B.keys()].filter(k => /images\/vfx\/(?!vfx-mobile)/.test(k) && k.endsWith(".png"));
console.log("误打包的源 PNG:", leaked.length);
void readFileSync;
