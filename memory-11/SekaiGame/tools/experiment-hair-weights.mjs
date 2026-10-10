/**
 * experiment-hair-weights.mjs — 找出「发丝/外套在低头·前倾时被压扁」的最佳修法。
 *
 * 已确认的机制（见 diagnose-hair-compression.mjs）：
 *   物理链骨骼（发丝 / 外套摆）只做平移，而躯干骨骼（root/spine/chest/legL/
 *   forearmR/board）几乎不动。两者共同影响同一批顶点时，相邻顶点的权重配比不同
 *   → 相邻顶点的位移差很大 → 三角形被拉爆或压扁。
 *   「低头 / 前倾」之所以最明显：lean 旋转 chest 把发链锚点甩出很远，
 *   同时 legL（挂在 root 下）原地不动，两者的位移差被拉到最大。
 *
 * 这个脚本对若干候选权重方案跑同一批姿态，输出可比的形变指标。
 *
 * 用法：node SekaiGame/tools/experiment-hair-weights.mjs [--id blue-01]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodePng } from "./lib/png.mjs";

const STATIC = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const ID = flag("--id", "blue-01");
const ART = { "blue-01": "controller-blue-01.png", "lucia": "controller-lucia.png" }[ID];

const { CONTROLLER_RIGS, buildControllerModel, expandRig } = await import(
    new URL("../src/main/resources/static/js/controller-rigs.js", import.meta.url).href
);
const { evaluateModel, createSkeleton, computeSkinWeights, smoothSkinWeights, buildMeshFromAlpha, createPoseState, createPhysicsChain, DEFAULT_MESH_OPTIONS } = await import(
    new URL("../src/main/resources/static/js/controller-mesh.js", import.meta.url).href
);
const { HOLD_STATES } = await import(
    new URL("../src/main/resources/static/js/controller-mesh-model.js", import.meta.url).href
);

const image = decodePng(readFileSync(STATIC + `assets/characters/${ART}`));
const rig = CONTROLLER_RIGS[ID];

/** 用给定的蒙皮选项重建一个模型 */
function buildWith(skinOverride, rigOverride) {
    const meshOptions = { ...DEFAULT_MESH_OPTIONS, ...(rig.mesh || {}) };
    const mesh = buildMeshFromAlpha(image, meshOptions);
    const expanded = expandRig(rigOverride || rig);
    const skeleton = createSkeleton(expanded, mesh);
    const raw = computeSkinWeights(mesh, skeleton, { ...(rig.skin || {}), ...skinOverride });
    const skinning = smoothSkinWeights(mesh, raw, {
        iterations: skinOverride.smoothIterations ?? rig.skin?.smoothIterations ?? 4,
        lambda: skinOverride.smoothLambda ?? rig.skin?.smoothLambda ?? 0.6,
    });
    const chains = expanded.chains.map(spec => createPhysicsChain(spec, skeleton, mesh));
    const pose = createPoseState(skeleton);
    return {
        mesh, skeleton, skinning, chains, pose, rig,
        positions: new Float32Array(mesh.vertexCount * 2),
        stats: { vertices: mesh.vertexCount, triangles: mesh.triangleCount },
    };
}

function dominantBone(model, v) {
    let best = 0, bestWeight = -1;
    for (let k = 0; k < model.skinning.maxInfluences; k++) {
        const w = model.skinning.weights[v * model.skinning.maxInfluences + k];
        if (w > bestWeight) { bestWeight = w; best = model.skinning.indices[v * model.skinning.maxInfluences + k]; }
    }
    return best;
}

function quantile(values, q) {
    if (!values.length) return NaN;
    const sorted = [...values].sort((x, y) => x - y);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

/** 对每个三角形算各向异性与面积比 */
function triangleStats(rest, posed, a, b, c) {
    const e1x = rest[b * 2] - rest[a * 2], e1y = rest[b * 2 + 1] - rest[a * 2 + 1];
    const e2x = rest[c * 2] - rest[a * 2], e2y = rest[c * 2 + 1] - rest[a * 2 + 1];
    const det = e1x * e2y - e1y * e2x;
    if (Math.abs(det) < 1e-9) return null;
    const f1x = posed[b * 2] - posed[a * 2], f1y = posed[b * 2 + 1] - posed[a * 2 + 1];
    const f2x = posed[c * 2] - posed[a * 2], f2y = posed[c * 2 + 1] - posed[a * 2 + 1];
    const inv = 1 / det;
    const j00 = (f1x * e2y - f2x * e1y) * inv, j01 = (f2x * e1x - f1x * e2x) * inv;
    const j10 = (f1y * e2y - f2y * e1y) * inv, j11 = (f2y * e1x - f1y * e2x) * inv;
    const tr = j00 + j11, dt = j00 * j11 - j01 * j10;
    const disc = Math.sqrt(Math.max(0, tr * tr / 4 - dt));
    const s1 = Math.abs(tr / 2 + disc), s2 = Math.abs(tr / 2 - disc);
    return {
        anisotropy: s2 < 1e-9 ? Infinity : Math.max(s1, s2) / Math.min(s1, s2),
        areaRatio: Math.abs(f1x * f2y - f1y * f2x) / Math.abs(det),
    };
}

/** 候选方案 */
const VARIANTS = [
    { key: "当前（基线 8/0.68）", skin: {} },
    { key: "平滑 12 / λ0.72", skin: { smoothIterations: 12, smoothLambda: 0.72 } },
    { key: "平滑 16 / λ0.75", skin: { smoothIterations: 16, smoothLambda: 0.75 } },
    { key: "平滑 24 / λ0.80", skin: { smoothIterations: 24, smoothLambda: 0.80 } },
    { key: "平滑 32 / λ0.85", skin: { smoothIterations: 32, smoothLambda: 0.85 } },
    { key: "平滑 48 / λ0.90", skin: { smoothIterations: 48, smoothLambda: 0.90 } },
    { key: "平滑 64 / λ0.92", skin: { smoothIterations: 64, smoothLambda: 0.92 } },
];

/** 给发链加 rect（限制发链影响范围，切断躯干骨骼的渗入） */
function rigWithHairRects(pad) {
    const clone = {
        ...rig,
        chains: rig.chains.map(chain => {
            if (!/^hair/.test(chain.name) || chain.rect) return chain;
            const xs = chain.nodes.map(n => n[0]);
            const ys = chain.nodes.map(n => n[1]);
            return {
                ...chain,
                rect: [
                    Math.max(0, Math.min(...xs) - pad),
                    Math.max(0, Math.min(...ys) - pad),
                    Math.min(1, Math.max(...xs) + pad),
                    Math.min(1, Math.max(...ys) + pad),
                ],
                rectSoft: 0.02,
            };
        }),
    };
    return clone;
}

const POSES = [
    ["低头 headNod1.2+lean0.9", { headNod: 1.2, lean: 0.9 }],
    ["前倾 lean0.85", { lean: 0.85, headNod: 0.5 }],
    ["失败 lose", { ...HOLD_STATES.lose.p }],
    ["受击 hit", { rootX: -0.012, lean: -0.5, headTilt: -0.35, squash: 0.6 }],
];

function evaluateVariant(label, skinOverride, rigOverride) {
    const model = buildWith(skinOverride, rigOverride);
    const { indices, triangleCount } = model.mesh;
    const skeleton = model.skeleton;

    // 分区
    const regionOf = new Map();
    for (let t = 0; t < triangleCount; t++) {
        const name = skeleton.bones[dominantBone(model, indices[t * 3])].name;
        regionOf.set(t, /^hair/.test(name) ? "hair" : /^coat/.test(name) ? "coat" : "body");
    }

    for (const chain of model.chains) { chain.bend.fill(0); chain.bendVelocity.fill(0); chain.prevAnchorX = null; }
    for (let i = 0; i < 400; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions);
    const rest = Float32Array.from(model.positions);

    const rows = [];
    for (const [poseName, params] of POSES) {
        for (const chain of model.chains) { chain.bend.fill(0); chain.bendVelocity.fill(0); chain.prevAnchorX = null; }
        for (let i = 0; i < 300; i++) evaluateModel(model, params, { dt: 1 / 60 }, model.positions);
        const acc = { hair: [], coat: [] };
        for (let t = 0; t < triangleCount; t++) {
            const region = regionOf.get(t);
            if (region === "body") continue;
            const d = triangleStats(rest, model.positions, indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]);
            if (d) acc[region].push(d);
        }
        const summarise = list => ({
            median: quantile(list.map(d => d.anisotropy), 0.5),
            p95: quantile(list.map(d => d.anisotropy), 0.95),
            over15: list.filter(d => d.anisotropy > 1.5).length / Math.max(list.length, 1),
            areaOut: list.filter(d => d.areaRatio < 0.5 || d.areaRatio > 2).length / Math.max(list.length, 1),
        });
        rows.push({ pose: poseName, hair: summarise(acc.hair), coat: summarise(acc.coat) });
    }
    // 汇总：跨姿态平均
    const avg = key => ({
        median: rows.reduce((s, r) => s + r.hair.median, 0) / rows.length,
        p95: rows.reduce((s, r) => s + r.hair.p95, 0) / rows.length,
        over15: rows.reduce((s, r) => s + r.hair.over15, 0) / rows.length,
        areaOut: rows.reduce((s, r) => s + r.hair.areaOut, 0) / rows.length,
        coatMedian: rows.reduce((s, r) => s + r.coat.median, 0) / rows.length,
        coatP95: rows.reduce((s, r) => s + r.coat.p95, 0) / rows.length,
    });

    // 动画质量：过度平滑会让发丝跟着躯干走、不再单独摆动
    //  · lag    —— 快速摆头时发梢相对「刚性跟随」的滞后峰值（越大越有鞭状感）
    //  · react  —— 肩部发丝顶点对单独一帧 chain 位移的响应幅度
    const chain = model.chains[0];
    const tipBone = skeleton.byName.get(`${chain.name}${chain.nodes.length - 1}`);
    let tipVertex = -1, bestWeight = 0;
    for (let v = 0; v < model.mesh.vertexCount; v++) {
        for (let k = 0; k < model.skinning.maxInfluences; k++) {
            if (model.skinning.indices[v * model.skinning.maxInfluences + k] === tipBone
                && model.skinning.weights[v * model.skinning.maxInfluences + k] > bestWeight) {
                bestWeight = model.skinning.weights[v * model.skinning.maxInfluences + k];
                tipVertex = v;
            }
        }
    }
    for (const c of model.chains) { c.bend.fill(0); c.bendVelocity.fill(0); c.prevAnchorX = null; }
    const RAMP = 8;
    const ramp = [];
    for (let i = 1; i <= RAMP; i++) ramp.push({ headTurn: 0.9 * (i / RAMP), lean: 0.4 * (i / RAMP) });
    const record = () => {
        const tips = [];
        for (const params of ramp) {
            evaluateModel(model, params, { dt: 1 / 60 }, model.positions);
            tips.push(tipVertex >= 0 ? [model.positions[tipVertex * 2], model.positions[tipVertex * 2 + 1]] : [0, 0]);
        }
        return tips;
    };
    const savedInertia = chain.inertia, savedGravity = chain.gravityStrength;
    chain.inertia = 0; chain.gravityStrength = 0;
    chain.bend.fill(0); chain.bendVelocity.fill(0); chain.prevAnchorX = null;
    const rigidTips = record();
    chain.inertia = savedInertia; chain.gravityStrength = savedGravity;
    for (let i = 0; i < 120; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions);
    chain.bend.fill(0); chain.bendVelocity.fill(0); chain.prevAnchorX = null;
    const physicsTips = record();
    let peakLag = 0;
    for (let i = 0; i < RAMP; i++) {
        peakLag = Math.max(peakLag, Math.hypot(physicsTips[i][0] - rigidTips[i][0], physicsTips[i][1] - rigidTips[i][1]));
    }
    // 发梢顶点实际位移幅度（平滑过度会让它变小 → 头发"变呆了"）
    for (const c of model.chains) { c.bend.fill(0); c.bendVelocity.fill(0); c.prevAnchorX = null; }
    for (let i = 0; i < 400; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions);
    const restTip = tipVertex >= 0 ? [model.positions[tipVertex * 2], model.positions[tipVertex * 2 + 1]] : [0, 0];
    for (const c of model.chains) { c.bend.fill(0); c.bendVelocity.fill(0); c.prevAnchorX = null; }
    for (let i = 0; i < 300; i++) evaluateModel(model, { headTurn: 1.0 }, { dt: 1 / 60 }, model.positions);
    const posedTip = tipVertex >= 0 ? [model.positions[tipVertex * 2], model.positions[tipVertex * 2 + 1]] : [0, 0];
    const tipTravel = Math.hypot(posedTip[0] - restTip[0], posedTip[1] - restTip[1]);

    return { label, rows, avg: avg(), peakLag, tipTravel };
}

const results = [];
for (const v of VARIANTS) results.push(evaluateVariant(v.key, v.skin, null));

console.log(`\n########## ${ID} · 蒙皮权重方案对比 ##########`);
console.log("（形变指标只统计发丝 / 外套摆三角形；越低越好。动画质量要同时看，过度平滑会让头发变呆。）\n");
console.log("方案".padEnd(22) + "发丝中位  发丝p95  >1.5占比  面积>2x   外套中位  外套p95  发梢滞后  发梢位移");
for (const r of results) {
    const a = r.avg;
    console.log(r.label.padEnd(22)
        + `${a.median.toFixed(4)}`.padEnd(11)
        + `${a.p95.toFixed(4)}`.padEnd(9)
        + `${(a.over15 * 100).toFixed(1)}%`.padEnd(11)
        + `${(a.areaOut * 100).toFixed(1)}%`.padEnd(10)
        + `${a.coatMedian.toFixed(4)}`.padEnd(10)
        + `${a.coatP95.toFixed(4)}`.padEnd(9)
        + `${r.peakLag.toFixed(1)}px`.padEnd(10)
        + `${r.tipTravel.toFixed(1)}px`);
}

console.log("\n--- 逐姿态细看（发丝各向异性中位数）---");
console.log("姿态".padEnd(24) + results.map(r => r.label.replace(/[^0-9λ.]/g, "").slice(0, 8).padStart(10)).join(""));
for (let i = 0; i < POSES.length; i++) {
    console.log(POSES[i][0].padEnd(24) + results.map(r => r.rows[i].hair.median.toFixed(3).padStart(10)).join(""));
}
