/**
 * analyze-controller-art.mjs — 角色原画轮廓分析（用于骨架标定，不靠肉眼猜像素）
 *
 * 输出：
 *   1. alpha 包围盒与归一化尺寸
 *   2. 逐行带宽剖面（minX / maxX / 宽度 / 质心），按 N 段采样
 *   3. 缩略 ASCII 剪影，便于直接对照原画
 *   4. 自动候选地标：头顶、颈部最窄处、肩线、胯线、左右极值
 *
 * 用法：node SekaiGame/tools/analyze-controller-art.mjs <png> [--rows 48] [--cols 64]
 */
import { readFileSync } from "node:fs";
import { decodePng } from "./lib/png.mjs";

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
    console.error("用法: node analyze-controller-art.mjs <png> [--rows N] [--cols N]");
    process.exit(2);
}
const readFlag = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? Number(args[index + 1]) : fallback;
};
const ROWS = readFlag("--rows", 48);
const COLS = readFlag("--cols", 64);
const ALPHA_THRESHOLD = 32;

const image = decodePng(readFileSync(file));
const { width, height, data } = image;

const alphaAt = (x, y) => data[(y * width + x) * 4 + 3];

// ---- 包围盒 ----
let minX = width, maxX = -1, minY = height, maxY = -1, opaque = 0;
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        if (alphaAt(x, y) > ALPHA_THRESHOLD) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            opaque++;
        }
    }
}
const boxW = maxX - minX + 1;
const boxH = maxY - minY + 1;

console.log(`\n### ${file}`);
console.log(`尺寸 ${width}×${height}   不透明像素 ${opaque} (${(opaque / (width * height) * 100).toFixed(1)}%)`);
console.log(`alpha 包围盒 x[${minX}..${maxX}] y[${minY}..${maxY}]   ${boxW}×${boxH}  比例 ${(boxW / boxH).toFixed(4)}`);
console.log(`归一化包围盒: x0=${(minX / width).toFixed(4)} x1=${((maxX + 1) / width).toFixed(4)} y0=${(minY / height).toFixed(4)} y1=${((maxY + 1) / height).toFixed(4)}`);

// ---- 逐行剖面（按包围盒高度均匀取 ROWS 条带）----
const profile = [];
for (let r = 0; r < ROWS; r++) {
    const y0 = minY + Math.floor((r * boxH) / ROWS);
    const y1 = minY + Math.max(y0 + 1, Math.floor(((r + 1) * boxH) / ROWS)) - 1;
    let rMinX = width, rMaxX = -1, count = 0, sumX = 0;
    for (let y = y0; y <= Math.min(y1, maxY); y++) {
        for (let x = minX; x <= maxX; x++) {
            if (alphaAt(x, y) > ALPHA_THRESHOLD) {
                if (x < rMinX) rMinX = x;
                if (x > rMaxX) rMaxX = x;
                count++; sumX += x;
            }
        }
    }
    profile.push({
        band: r,
        yNorm: (y0 + (y1 - y0) / 2 - minY) / boxH,
        yPx: Math.round((y0 + y1) / 2),
        minXNorm: count ? (rMinX - minX) / boxW : null,
        maxXNorm: count ? (rMaxX - minX) / boxW : null,
        widthNorm: count ? (rMaxX - rMinX + 1) / boxW : 0,
        centroidNorm: count ? (sumX / count - minX) / boxW : null,
        coverage: count / ((y1 - y0 + 1) * boxW),
    });
}

console.log(`\n行剖面（yNorm 从上到下，宽度/质心相对包围盒宽归一化）`);
console.log(`  band  yNorm   yPx   minX   maxX   width  centroid  cover`);
for (const row of profile) {
    const f = (v, n = 3) => (v === null ? "  -  " : v.toFixed(n).padStart(6));
    console.log(`  ${String(row.band).padStart(4)}  ${row.yNorm.toFixed(3)}  ${String(row.yPx).padStart(4)}  ${f(row.minXNorm)} ${f(row.maxXNorm)} ${f(row.widthNorm)}   ${f(row.centroidNorm)}   ${(row.coverage * 100).toFixed(0).padStart(3)}%`);
}

// ---- ASCII 剪影 ----
console.log(`\nASCII 剪影（${COLS}×${Math.round(COLS * boxH / boxW / 2)}，R=alpha>192, r=alpha>64, .=alpha>8）`);
const artRows = Math.max(8, Math.round((COLS * boxH) / boxW / 2));
for (let r = 0; r < artRows; r++) {
    let line = "";
    for (let c = 0; c < COLS; c++) {
        const x0 = minX + Math.floor((c * boxW) / COLS), x1 = minX + Math.floor(((c + 1) * boxW) / COLS);
        const y0 = minY + Math.floor((r * boxH) / artRows), y1 = minY + Math.floor(((r + 1) * boxH) / artRows);
        let peak = 0;
        for (let y = y0; y <= Math.max(y0, y1); y++) {
            for (let x = x0; x <= Math.max(x0, x1); x++) peak = Math.max(peak, alphaAt(x, y));
        }
        line += peak > 192 ? "R" : peak > 64 ? "r" : peak > 8 ? "." : " ";
    }
    console.log(`  |${line}|`);
}

// ---- 地标候选 ----
const upper = profile.filter(p => p.yNorm > 0.02 && p.yNorm < 0.40 && p.widthNorm > 0);
let neck = upper[0];
for (const row of upper) if (row.widthNorm < neck.widthNorm) neck = row;

// 肩线：颈部以下第一次宽度达到包围盒最大宽度 60% 的行
const maxWidth = Math.max(...profile.map(p => p.widthNorm));
const belowNeck = profile.filter(p => p.yNorm > (neck?.yNorm ?? 0.3));
const shoulder = belowNeck.find(p => p.widthNorm > maxWidth * 0.6) || null;
// 胯线：包围盒高度 55%~80% 区间内宽度回升的局部极大
const hipZone = profile.filter(p => p.yNorm > 0.5 && p.yNorm < 0.85);
let hip = hipZone[0] || null;
for (const row of hipZone) if (hip && row.widthNorm > hip.widthNorm) hip = row;

console.log(`\n候选地标（归一化到 alpha 包围盒）`);
const landmark = (name, row) => console.log(`  ${name.padEnd(12)} ${row ? `x=${row.centroidNorm.toFixed(3)} y=${row.yNorm.toFixed(3)} (band ${row.band}, yPx ${row.yPx})` : "未找到"}`);
landmark("颈部最窄", neck);
landmark("肩线", shoulder);
landmark("胯部最宽", hip);
console.log(`  最大行宽     ${maxWidth.toFixed(3)}`);
console.log(`\n建议 rig.json 片段（可直接抄进角色配置的 rig 里）`);
console.log(JSON.stringify({
    imageBox: {
        x0: +(minX / width).toFixed(4), y0: +(minY / height).toFixed(4),
        x1: +((maxX + 1) / width).toFixed(4), y1: +((maxY + 1) / height).toFixed(4),
    },
    suggest: {
        headTop: [neck ? +(neck.centroidNorm).toFixed(3) : 0.34, 0.02],
        neck: neck ? [+neck.centroidNorm.toFixed(3), +neck.yNorm.toFixed(3)] : null,
        shoulder: shoulder ? [+shoulder.centroidNorm.toFixed(3), +shoulder.yNorm.toFixed(3)] : null,
        hip: hip ? [+hip.centroidNorm.toFixed(3), +hip.yNorm.toFixed(3)] : null,
    },
}, null, 2));
