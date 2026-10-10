/**
 * diagnose-hair-compression.mjs — 定位「低头时头发被物理压缩」的区域与时刻。
 *
 * 思路：把逐三角形各向异性 σmax/σmin 按主导骨骼分区统计。
 *   · 1.0 = 局部形状完全保持（纯旋转 / 等比缩放）
 *   · >1  = 这块像素被压扁/斜切
 * 同时测每条发链的「锚点→末梢 直线距离 / 弧长」，
 * 这个比值掉下来就说明发丝在几何上缩短了（字面意义的压缩）。
 *
 * 用法：node SekaiGame/tools/diagnose-hair-compression.mjs [--id blue-01]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodePng } from "./lib/png.mjs";

const STATIC = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const ID = flag("--id", "blue-01");
const ART = { "blue-01": "controller-blue-01.png", "lucia": "controller-lucia.png" }[ID];

const { CONTROLLER_RIGS, buildControllerModel } = await import(
    new URL("../src/main/resources/static/js/controller-rigs.js", import.meta.url).href
);
const { evaluateModel } = await import(
    new URL("../src/main/resources/static/js/controller-mesh.js", import.meta.url).href
);
const { composePoseParams, ACTION_MOTIONS, HOLD_STATES } = await import(
    new URL("../src/main/resources/static/js/controller-mesh-model.js", import.meta.url).href
);

const image = decodePng(readFileSync(STATIC + `assets/characters/${ART}`));
const model = buildControllerModel(CONTROLLER_RIGS[ID], image);
const { indices, triangleCount } = model.mesh;
const skeleton = model.skeleton;

function dominantBone(v) {
    let best = 0, bestWeight = -1;
    for (let k = 0; k < model.skinning.maxInfluences; k++) {
        const w = model.skinning.weights[v * model.skinning.maxInfluences + k];
        if (w > bestWeight) { bestWeight = w; best = model.skinning.indices[v * model.skinning.maxInfluences + k]; }
    }
    return best;
}

/** 三角形局部形变：各向异性 + 面积比 */
function triangleDeform(rest, posed, a, b, c) {
    const e1x = rest[b * 2] - rest[a * 2], e1y = rest[b * 2 + 1] - rest[a * 2 + 1];
    const e2x = rest[c * 2] - rest[a * 2], e2y = rest[c * 2 + 1] - rest[a * 2 + 1];
    const det = e1x * e2y - e1y * e2x;
    if (Math.abs(det) < 1e-9) return null;
    const f1x = posed[b * 2] - posed[a * 2], f1y = posed[b * 2 + 1] - posed[a * 2 + 1];
    const f2x = posed[c * 2] - posed[a * 2], f2y = posed[c * 2 + 1] - posed[a * 2 + 1];
    const inv = 1 / det;
    const j00 = (f1x * e2y - f2x * e1y) * inv;
    const j01 = (f2x * e1x - f1x * e2x) * inv;
    const j10 = (f1y * e2y - f2y * e1y) * inv;
    const j11 = (f2y * e1x - f1y * e2x) * inv;
    const tr = j00 + j11, dt = j00 * j11 - j01 * j10;
    const disc = Math.sqrt(Math.max(0, tr * tr / 4 - dt));
    const s1 = Math.abs(tr / 2 + disc), s2 = Math.abs(tr / 2 - disc);
    const posedArea = Math.abs(f1x * f2y - f1y * f2x) / 2;
    const restArea = Math.abs(det) / 2;
    return {
        anisotropy: s2 < 1e-9 ? Infinity : Math.max(s1, s2) / Math.min(s1, s2),
        areaRatio: posedArea / Math.max(restArea, 1e-12),
        scale: Math.sqrt(Math.abs(det ? (j00 * j11 - j01 * j10) : 1)),
    };
}

/** 按主导骨骼把三角形分组 */
const groups = new Map();
for (let t = 0; t < triangleCount; t++) {
    const boneIndex = dominantBone(indices[t * 3]);
    const name = skeleton.bones[boneIndex].name;
    const key = /^hair/.test(name) ? "hair(全部发链)"
        : /^coat/.test(name) ? "coat(外套摆)"
            : name === "head" ? "head"
                : name === "neck" || name === "chest" || name === "spine" ? "torso"
                    : name === "board" || name === "card" ? "prop"
                        : "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
}

function quantile(values, q) {
    if (!values.length) return NaN;
    const sorted = [...values].sort((x, y) => x - y);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

function measure(rest) {
    const out = new Map();
    for (const [key, tris] of groups) {
        const aniso = [], area = [];
        for (const t of tris) {
            const d = triangleDeform(rest, model.positions, indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]);
            if (!d) continue;
            aniso.push(d.anisotropy);
            area.push(d.areaRatio);
        }
        out.set(key, {
            n: tris.length,
            median: quantile(aniso, 0.5),
            p95: quantile(aniso, 0.95),
            max: aniso.length ? Math.max(...aniso) : NaN,
            p95Area: quantile(area, 0.95),
            minArea: area.length ? Math.min(...area) : NaN,
            maxArea: area.length ? Math.max(...area) : NaN,
        });
    }
    return out;
}

/** 发链的「直线距离 / 弧长」比值：掉下来就是发丝几何上缩短了 */
const restChainSpan = new Map();
function measureChains() {
    const out = new Map();
    for (const chain of model.chains) {
        let arc = 0;
        for (const len of chain.lengths) arc += len;
        const nodes = chain.nodes;
        const dx = nodes[nodes.length - 1].x - nodes[0].x;
        const dy = nodes[nodes.length - 1].y - nodes[0].y;
        // nodes[0] 是第一节的末端，锚点是 armature 上的起点，用静止角推第一段起点
        const ax = nodes[0].x - Math.cos(chain.angle[0]) * chain.lengths[0];
        const ay = nodes[0].y - Math.sin(chain.angle[0]) * chain.lengths[0];
        const span = Math.hypot(nodes[nodes.length - 1].x - ax, nodes[nodes.length - 1].y - ay);
        out.set(chain.name, span / Math.max(arc, 1e-9));
    }
    return out;
}

// 静止基线
for (let i = 0; i < 500; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions);
const rest = Float32Array.from(model.positions);
for (const [name, value] of measureChains()) restChainSpan.set(name, value);

console.log(`\n########## ${ID} ##########`);
console.log(`三角形分区：${[...groups].map(([k, v]) => `${k}=${v.length}`).join("  ")}`);

const base = measure(rest);
console.log("\n--- 静止基线 ---");
for (const [key, s] of base) {
    console.log(`  ${key.padEnd(16)} n=${String(s.n).padStart(5)}  中位 ${s.median.toFixed(4)}`
        + `  p95 ${s.p95.toFixed(4)}  面积比 p95 ${s.p95Area.toFixed(4)}`);
}

/* ------------------------------------------------------------------ *
 * 场景：静态极限姿态 + 真实过渡（60fps 逐帧，含物理）
 * ------------------------------------------------------------------ */
const scenarios = [];

for (const [name, p] of [
    ["静止", {}],
    ["低头 headNod=1.0", { headNod: 1 }],
    ["低头 headNod=1.2+lean0.9", { headNod: 1.2, lean: 0.9 }],
    ["前倾 lean=0.85", { lean: 0.85, headNod: 0.5 }],
    ["受击 hit峰", { rootX: -0.012, lean: -0.5, headTilt: -0.35, squash: 0.6 }],
    ["失败 lose终态", HOLD_STATES.lose.p],
    ["胜利 win终态", HOLD_STATES.win.p],
]) scenarios.push({ name, kind: "pose", params: p, frames: 300 });

// 真实动作过渡：从 idle 起播，逐帧推进
for (const [name, motion] of Object.entries(ACTION_MOTIONS)) {
    scenarios.push({ name: `动作 ${name}`, kind: "action", action: name, duration: motion.duration, frames: Math.round(motion.duration / 1000 * 60) + 90 });
}
for (const name of Object.keys(HOLD_STATES)) {
    scenarios.push({ name: `结算 ${name}`, kind: "hold", hold: name, frames: Math.round(HOLD_STATES[name].rise / 1000 * 60) + 120 });
}

const CTX = { reducedMotion: false, ambientByName: new Map(), ambientInterval: () => 12000 };
const MOTION = { cycle: 6800, float: 5, boxH: model.mesh.boxH };

function runScenario(sc) {
    // 每个场景前复位并回到中性
    for (const chain of model.chains) {
        chain.bend.fill(0);
        chain.bendVelocity.fill(0);
        chain.prevAnchorX = null;
    }
    for (let i = 0; i < 240; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions);

    const state = {
        time: 0, action: null, actionStart: 0, actionDuration: 0,
        ambient: null, ambientStart: 0, ambientDuration: 0, ambientDelay: 12000,
        hold: null, holdStart: 0, lowHp: false, lowHpRamp: 0, dim: 0, override: null,
    };
    const worst = { aniso: 0, key: "", frame: 0, time: 0 };
    let chainWorst = { shrink: 0, name: "", frame: 0 };
    for (let f = 0; f < sc.frames; f++) {
        state.time = f * (1000 / 60);
        let params;
        if (sc.kind === "pose") params = { ...sc.params };
        else {
            if (sc.kind === "action") { state.action = sc.action; state.actionStart = 0; state.actionDuration = sc.duration; }
            if (sc.kind === "hold") { state.hold = sc.hold; state.holdStart = 0; }
            params = composePoseParams(state, MOTION, CTX, f * (1000 / 60));
        }
        evaluateModel(model, params, { dt: 1 / 60 }, model.positions);
        const now = measure(rest);
        for (const [key, s] of now) {
            if (key === "other") continue;
            if (s.p95 > worst.aniso) { worst.aniso = s.p95; worst.key = key; worst.frame = f; }
        }
        for (const [name, ratio] of measureChains()) {
            const shrink = restChainSpan.get(name) - ratio;
            if (shrink > chainWorst.shrink) { chainWorst = { shrink, name, frame: f }; }
        }
    }
    return { worst, chainWorst };
}

console.log("\n--- 过渡场景（逐帧扫描，报告最差区域）---");
const rows = [];
for (const sc of scenarios) {
    const { worst, chainWorst } = runScenario(sc);
    rows.push({ name: sc.name, ...worst, chain: chainWorst.name, shrink: chainWorst.shrink, chainFrame: chainWorst.frame });
    console.log(`  ${sc.name.padEnd(22)} 最差区域 ${String(worst.key).padEnd(16)}`
        + ` p95各向异性 ${worst.aniso.toFixed(4)}`
        + `   发链最大缩短 ${(chainWorst.shrink * 100).toFixed(2)}% (${chainWorst.name} @f${chainWorst.frame})`);
}

rows.sort((a, b) => b.aniso - a.aniso);
console.log("\n--- 按 p95 各向异性排序（前 6）---");
for (const r of rows.slice(0, 6)) {
    console.log(`  ${r.name.padEnd(22)} ${r.key.padEnd(16)} ${r.aniso.toFixed(4)}`);
}

/* ------------------------------------------------------------------ *
 * 深挖：最差场景里到底哪些三角形的哪几根骨骼在打架
 * ------------------------------------------------------------------ */
function influencesOf(v) {
    const list = [];
    for (let k = 0; k < model.skinning.maxInfluences; k++) {
        const w = model.skinning.weights[v * model.skinning.maxInfluences + k];
        if (w > 0.001) list.push({ name: skeleton.bones[model.skinning.indices[v * model.skinning.maxInfluences + k]].name, w });
    }
    return list.sort((a, b) => b.w - a.w);
}

function deepDive(label, params, frames = 300) {
    for (const chain of model.chains) { chain.bend.fill(0); chain.bendVelocity.fill(0); chain.prevAnchorX = null; }
    for (let i = 0; i < 400; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions);
    const restSnap = Float32Array.from(model.positions);
    for (let i = 0; i < frames; i++) evaluateModel(model, params, { dt: 1 / 60 }, model.positions);

    const restAreaOf = t => {
        const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
        return Math.abs((restSnap[b * 2] - restSnap[a * 2]) * (restSnap[c * 2 + 1] - restSnap[a * 2 + 1])
            - (restSnap[b * 2 + 1] - restSnap[a * 2 + 1]) * (restSnap[c * 2] - restSnap[a * 2])) / 2;
    };

    const per = [];
    for (let t = 0; t < triangleCount; t++) {
        const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
        const d = triangleDeform(restSnap, model.positions, a, b, c);
        if (!d) continue;
        per.push({ t, a, b, c, ...d, restArea: restAreaOf(t), region: skeleton.bones[dominantBone(a)].name });
    }
    // 只保留「在屏幕上真的占面积」的三角形：
    // 退化细丝的面积接近 0，J = F·E⁻¹ 里的 E⁻¹ 会把浮点噪声放大成任意大的
    // 各向异性/面积比，那是度量伪影而不是视觉缺陷。cell=9 的网格上，
    // 一个 9×9 的整格面积是 81px²，取 25px² 作为「肉眼可见」的门槛。
    const MIN_REST_AREA = 25;
    const visible = per.filter(p => p.restArea >= MIN_REST_AREA);
    const slivers = per.filter(p => p.restArea < MIN_REST_AREA);

    const report = (set, name) => {
        const hair = set.filter(p => /^hair/.test(p.region));
        const coat = set.filter(p => /^coat/.test(p.region));
        const line = (arr, label) => {
            if (!arr.length) { console.log(`    ${label}: 无`); return; }
            const aniso = arr.map(p => p.anisotropy);
            const area = arr.map(p => p.areaRatio);
            const over = arr.filter(p => p.anisotropy > 1.5).length;
            const shrunk = arr.filter(p => p.areaRatio < 0.5 || p.areaRatio > 2).length;
            console.log(`    ${label.padEnd(18)} n=${String(arr.length).padStart(5)}`
                + `  各向异性 中位 ${quantile(aniso, 0.5).toFixed(4)} p95 ${quantile(aniso, 0.95).toFixed(4)}`
                + `  面积比 中位 ${quantile(area, 0.5).toFixed(4)} p05 ${quantile(area, 0.05).toFixed(4)}`
                + `  >1.5: ${(over / arr.length * 100).toFixed(2)}%  面积差>2x: ${(shrunk / arr.length * 100).toFixed(2)}%`);
        };
        console.log(`  [${name}]`);
        line(hair, "发丝");
        line(coat, "外套摆");
    };

    console.log(`\n--- 深挖：${label} ---`);
    console.log(`  全部三角形 ${per.length}（可见 ${visible.length}，退化细丝 ${slivers.length}）`);
    report(visible, "可见三角形（面积 ≥ 25px²）");
    report(slivers, "退化细丝（面积 < 25px²，度量不可信）");

    // 可见三角形里最差的几个
    const worstVisible = [...visible].sort((x, y) => y.anisotropy - x.anisotropy).slice(0, 4);
    console.log("  可见三角形中最差的 4 个：");
    for (const p of worstVisible) {
        console.log(`    各向异性 ${p.anisotropy.toFixed(3)}  面积比 ${p.areaRatio.toFixed(4)}`
            + `  静止面积 ${p.restArea.toFixed(1)}px²  区域 ${p.region}`);
        for (const v of [p.a, p.b, p.c]) {
            console.log(`      顶点 ${String(v).padStart(5)}: `
                + influencesOf(v).map(i => `${i.name}:${i.w.toFixed(2)}`).join("  "));
        }
    }
    return { visible, slivers };
}

deepDive("低头 headNod=1.2 + lean=0.9", { headNod: 1.2, lean: 0.9 });
deepDive("前倾 lean=0.85", { lean: 0.85, headNod: 0.5 });
deepDive("失败 lose 终态", { ...HOLD_STATES.lose.p });
deepDive("受击 hit 峰值", { rootX: -0.012, lean: -0.5, headTilt: -0.35, squash: 0.6 });
deepDive("胜利 win 终态", { ...HOLD_STATES.win.p });
