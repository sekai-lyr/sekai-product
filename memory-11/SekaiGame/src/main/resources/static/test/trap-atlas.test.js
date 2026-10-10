// 陷阱卡 4×4 图集验收：
//   - 每张可玩陷阱卡恰好一个独立的图集实现（不与怪兽/魔法共用 sheet）
//   - 素材存在、是 1536×1536 RGBA、能被 4 整除成 4×4 网格
//   - 逐像素校验：四角与边中点全透明、中心（卡面位置）留空、每格都有内容且不是整块实心
//   - 登记完整（ranges/size/rotate/mask/glow/ward），矢量结界参数与图集环带一致
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { ALL_CARDS } from "../js/catalog.js";
import { VFX_CARD_PROFILES, AUTHORED_CARD_SCENES, getAuthoredScene } from "../js/authored-card-scenes.js";
import { TRAP_ATLAS_PROFILES, TRAP_WARDS, TRAP_ATLAS_MASK } from "../js/trap-atlas-profiles.js";

const vfxPath = name => fileURLToPath(new URL(`../images/vfx/${name}`, import.meta.url));
const traps = ALL_CARDS.filter(card => card.type === "trap");

/* ------------------------------------------------------------------ *
 * 最小 PNG 解码器：只支持 8bit、非隔行、灰度/RGB/RGBA，足够读取 alpha。
 * ------------------------------------------------------------------ */
function decodePng(buffer) {
    assert.equal(buffer.readUInt32BE(0), 0x89504e47, "不是 PNG");
    let offset = 8, header = null;
    const idat = [];
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        if (type === "IHDR") {
            header = {
                width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8],
                colorType: data[9], interlace: data[12],
            };
        } else if (type === "IDAT") idat.push(data);
        else if (type === "IEND") break;
        offset += 12 + length;
    }
    assert.ok(header, "缺少 IHDR");
    assert.equal(header.bitDepth, 8, "只支持 8bit");
    assert.equal(header.interlace, 0, "不支持隔行 PNG");
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.colorType];
    assert.ok(channels, `不支持的颜色类型 ${header.colorType}`);
    const raw = inflateSync(Buffer.concat(idat));
    const stride = header.width * channels;
    const out = Buffer.alloc(header.height * stride);
    const paeth = (a, b, c) => {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    let pos = 0;
    for (let y = 0; y < header.height; y++) {
        const filter = raw[pos++];
        const line = raw.subarray(pos, pos + stride); pos += stride;
        const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? cur[x - channels] : 0;
            const b = prev ? prev[x] : 0;
            const c = prev && x >= channels ? prev[x - channels] : 0;
            const v = line[x];
            cur[x] = filter === 0 ? v
                : filter === 1 ? (v + a) & 255
                    : filter === 2 ? (v + b) & 255
                        : filter === 3 ? (v + ((a + b) >> 1)) & 255
                            : (v + paeth(a, b, c)) & 255;
        }
    }
    const alphaAt = (x, y) => channels === 4 ? out[(y * header.width + x) * 4 + 3]
        : channels === 2 ? out[(y * header.width + x) * 2 + 1] : 255;
    return { ...header, channels, alphaAt, byteLength: buffer.length };
}

/* ------------------------------------------------------------------ *
 * 结构登记
 * ------------------------------------------------------------------ */
test("45 张陷阱卡每张都有独立的 4×4 图集实现", async () => {
    assert.equal(traps.length, 45, "陷阱卡数量");
    const sheets = new Map();
    for (const card of traps) {
        const profile = VFX_CARD_PROFILES[card.id];
        assert.ok(profile, `${card.id} 缺少图集登记`);
        assert.ok(profile.ranges && profile.size && profile.rotate && profile.mask, `${card.id} 登记不完整`);
        assert.equal(profile.rotate, "static", `${card.id} 陷阱图集不参与位移旋转`);
        assert.equal(profile.mask, TRAP_ATLAS_MASK, `${card.id} 遮罩与其他陷阱不一致`);
        assert.deepEqual(profile.ranges.trap, [0, 15], `${card.id} 需要完整播放 16 帧`);
        assert.match(profile.glow, /^#[0-9a-f]{6}$/i, `${card.id} glow 无效`);
        assert.ok(profile.size.other >= 3.4 && profile.size.other <= 4.6, `${card.id} 尺寸超出可用范围`);
        assert.ok(profile.ward, `${card.id} 缺少矢量结界参数`);
        assert.equal(profile.ward.color, profile.glow, `${card.id} 矢量结界与图集主色不一致`);
        assert.ok(profile.ward.r.every(r => r > 20 && r < 220), `${card.id} 结界半径异常`);
        // 内印半径必须大于卡牌半宽（陷阱格 100×130），否则矢量结界会压到卡面上。
        assert.ok(profile.ward.r[2] >= 52, `${card.id} 内印半径 ${profile.ward.r[2]} 会盖住卡面`);
        assert.ok(profile.ward.r[0] <= 130, `${card.id} 外环半径 ${profile.ward.r[0]} 超出卡位可视范围`);
        assert.ok(profile.ward.spokes >= 4 && profile.ward.spokes <= 10, `${card.id} 放射数量异常`);
        assert.ok(!sheets.has(profile.sheet), `${card.id} 与 ${sheets.get(profile.sheet)} 共用 ${profile.sheet}`);
        sheets.set(profile.sheet, card.id);
    }
    assert.equal(sheets.size, 45);
    await Promise.all([...sheets.keys()].map(sheet => import("node:fs/promises").then(fs => fs.access(vfxPath(sheet)))));
});

test("陷阱图集不与怪兽/魔法卡共用素材，未登记卡不会误用其他角色素材", () => {
    // 同角色的多张怪兽卡可以复用同一份演出素材（既有设计），但陷阱卡必须一对一：
    // 既不互相共用，也不借用任何怪兽/魔法卡的 sheet。
    const owners = new Map();
    for (const card of ALL_CARDS) {
        if (card.type === "trap") continue;
        const profile = VFX_CARD_PROFILES[card.id];
        if (!profile) continue;
        if (!owners.has(profile.sheet)) owners.set(profile.sheet, card.id);
    }
    const trapSheets = new Map();
    for (const card of traps) {
        const profile = VFX_CARD_PROFILES[card.id];
        assert.ok(!owners.has(profile.sheet), `${card.id} 借用了 ${owners.get(profile.sheet)} 的 ${profile.sheet}`);
        assert.ok(!trapSheets.has(profile.sheet), `${card.id} 与 ${trapSheets.get(profile.sheet)} 共用 ${profile.sheet}`);
        trapSheets.set(profile.sheet, card.id);
    }
    assert.equal(TRAP_ATLAS_PROFILES.length, 45);
    assert.deepEqual(Object.keys(TRAP_WARDS).sort(), traps.map(c => c.id).sort());
});

/* ------------------------------------------------------------------ *
 * 像素级 alpha / 几何
 * ------------------------------------------------------------------ */
test("每张陷阱图集是 1536×1536 RGBA，四角与边中点透明、中心留空、16 格都有内容", async () => {
    const failures = [];
    for (const card of traps) {
        const profile = VFX_CARD_PROFILES[card.id];
        const png = decodePng(readFileSync(vfxPath(profile.sheet)));
        if (png.colorType !== 6) { failures.push(`${card.id}: colorType ${png.colorType} 缺少 alpha`); continue; }
        const cell = png.width / 4;
        if (png.width !== 1536 || png.height !== 1536 || !Number.isInteger(cell)) {
            failures.push(`${card.id}: 不是 1536×1536 的 4×4 网格`); continue;
        }
        const last = png.width - 1;
        const corners = [png.alphaAt(0, 0), png.alphaAt(last, 0), png.alphaAt(0, last), png.alphaAt(last, last)];
        if (corners.some(a => a > 3)) failures.push(`${card.id}: 四角 alpha ${corners.join("/")}`);
        const edges = [png.alphaAt(png.width >> 1, 0), png.alphaAt(png.width >> 1, last), png.alphaAt(0, png.height >> 1), png.alphaAt(last, png.height >> 1)];
        if (edges.some(a => a > 24)) failures.push(`${card.id}: 边中点 alpha ${edges.join("/")}`);
        let clear = 0, total = 0;
        const cellCover = new Array(16).fill(0);
        for (let y = 0; y < png.height; y += 2) {
            for (let x = 0; x < png.width; x += 2) {
                const a = png.alphaAt(x, y);
                total++;
                if (a === 0) clear++; else if (a > 12) cellCover[Math.floor(y / cell) * 4 + Math.floor(x / cell)]++;
            }
        }
        const clearRatio = clear / total;
        if (clearRatio < 0.27) failures.push(`${card.id}: 透明占比只有 ${clearRatio.toFixed(3)}`);
        // 卡面位置（每格中心 18% 半径）必须是真透明，而不是靠运行时遮罩擦掉。
        let centerMax = 0;
        for (let f = 0; f < 16; f++) {
            const cx = (f % 4) * cell + cell / 2, cy = Math.floor(f / 4) * cell + cell / 2;
            const r = cell * .18;
            for (let dy = -r; dy <= r; dy += 4) for (let dx = -r; dx <= r; dx += 4) {
                if (dx * dx + dy * dy > r * r) continue;
                centerMax = Math.max(centerMax, png.alphaAt(Math.round(cx + dx), Math.round(cy + dy)));
            }
        }
        if (centerMax > 4) failures.push(`${card.id}: 中心未留空 (${centerMax})`);
        const sampled = cellCover.map(v => v / ((cell / 2) * (cell / 2)));
        const min = Math.min(...sampled), max = Math.max(...sampled);
        if (min < 0.02) failures.push(`${card.id}: 第 ${sampled.indexOf(min)} 帧几乎为空 (${min.toFixed(3)})`);
        if (max > 0.985) failures.push(`${card.id}: 第 ${sampled.indexOf(max)} 帧整块不透明 (${max.toFixed(3)})`);
    }
    assert.deepEqual(failures, []);
});

/* ------------------------------------------------------------------ *
 * 分镜
 * ------------------------------------------------------------------ */
test("每张陷阱卡都有独立的 activate 分镜与击发节奏", () => {
    const fingerprints = new Set();
    for (const card of traps) {
        const spec = getAuthoredScene(card.id, "trap");
        assert.ok(spec, `${card.id} 缺少陷阱发动分镜`);
        assert.equal(spec, AUTHORED_CARD_SCENES[card.id].activate);
        assert.ok(spec.beats.length >= 3, `${card.id} 节拍不足三段`);
        assert.equal(typeof spec.draw, "function");
        const trace = [];
        const f = { from: { x: 100, y: 500 }, to: { x: 650, y: 100 }, offset: (p, x, y) => ({ x: p.x + x, y: p.y + y }) };
        for (const method of ["path", "ring", "orb", "line", "projectile", "sigil", "burst", "disc", "wash", "title", "trail", "blackHole", "spellCinematic", "artCinematic", "worldLineCinematic", "storyboardStage", "fireDance"]) {
            f[method] = (...args) => { trace.push([method, ...args]); assert.ok(!JSON.stringify(args).includes("null"), `${card.id}: 坐标无效`); };
        }
        spec.draw(f);
        const key = JSON.stringify(trace, (_, v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? "COLOR" : v);
        assert.ok(!fingerprints.has(key), `${card.id} 与其他陷阱卡分镜重复`);
        fingerprints.add(key);
    }
    assert.equal(fingerprints.size, 45);
});
