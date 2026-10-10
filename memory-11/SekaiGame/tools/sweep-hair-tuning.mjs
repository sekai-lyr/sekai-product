/**
 * sweep-hair-tuning.mjs — 为每个角色挑蒙皮平滑参数：既压掉压扁，又不让头发变呆。
 *
 * 两个目标互相拉扯：
 *   · 权重越平滑 → 发丝/外套被拉扯压扁的三角形越少（各向异性↓）
 *   · 权重越平滑 → 发梢顶点分到的链权重越少，风吹/摆头的响应越小（摆幅↓）
 * 所以每个角色单独扫，找出「压扁明显改善、摆幅仍达标」的拐点。
 *
 * 合格线（与 verify-controller-mesh.mjs 一致）：
 *   风吹摆幅 > 8px、发梢相对刚性跟随的滞后 > 3px、动作后残留 < 0.6px
 *
 * 用法：node SekaiGame/tools/sweep-hair-tuning.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodePng } from "./lib/png.mjs";

const STATIC = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));
const { CONTROLLER_RIGS, buildControllerModel } = await import(
    new URL("../src/main/resources/static/js/controller-rigs.js", import.meta.url).href
);
const { evaluateModel, createWindField, sampleWind, resetPhysicsChain } = await import(
    new URL("../src/main/resources/static/js/controller-mesh.js", import.meta.url).href
);
const { HOLD_STATES } = await import(
    new URL("../src/main/resources/static/js/controller-mesh-model.js", import.meta.url).href
);

function quantile(values, q) {
    if (!values.length) return NaN;
    const sorted = [...values].sort((x, y) => x - y);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

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

const POSES = [
    ["低头", { headNod: 1.2, lean: 0.9 }],
    ["前倾", { lean: 0.85, headNod: 0.5 }],
    ["失败", { ...HOLD_STATES.lose.p }],
    ["受击", { rootX: -0.012, lean: -0.5, headTilt: -0.35, squash: 0.6 }],
];

const SETTINGS = [[8, 0.68], [12, 0.72], [16, 0.75], [20, 0.78], [24, 0.80], [32, 0.85]];

for (const [id, rig] of Object.entries(CONTROLLER_RIGS)) {
    const file = `controller-${id}.png`;
    const image = decodePng(readFileSync(`${STATIC}assets/characters/${file}`));
    console.log(`\n########## ${id} ##########`);
    console.log("平滑".padEnd(12) + "发丝中位  发丝p95  >1.5     外套p95  面积>2x   风吹摆幅   发梢滞后   残留");

    for (const [iters, lambda] of SETTINGS) {
        const model = buildControllerModel({ ...rig, skin: { ...rig.skin, smoothIterations: iters, smoothLambda: lambda } }, image);
        const { indices, triangleCount } = model.mesh;
        const skeleton = model.skeleton;

        const regionOf = new Map();
        for (let t = 0; t < triangleCount; t++) {
            let best = 0, bw = -1;
            for (let k = 0; k < model.skinning.maxInfluences; k++) {
                const w = model.skinning.weights[indices[t * 3] * model.skinning.maxInfluences + k];
                if (w > bw) { bw = w; best = model.skinning.indices[indices[t * 3] * model.skinning.maxInfluences + k]; }
            }
            const n = skeleton.bones[best].name;
            regionOf.set(t, /^hair/.test(n) ? "hair" : /^coat|^sleeve|^skirt/.test(n) ? "coat" : "body");
        }

        const reset = () => { for (const c of model.chains) { c.bend.fill(0); c.bendVelocity.fill(0); c.prevAnchorX = null; } };
        reset();
        for (let i = 0; i < 400; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions);
        const rest = Float32Array.from(model.positions);

        const hairAniso = [], coatAniso = [];
        let outCount = 0, total = 0;
        for (const [, params] of POSES) {
            reset();
            for (let i = 0; i < 300; i++) evaluateModel(model, params, { dt: 1 / 60 }, model.positions);
            for (let t = 0; t < triangleCount; t++) {
                const region = regionOf.get(t);
                if (region === "body") continue;
                const d = triangleStats(rest, model.positions, indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]);
                if (!d) continue;
                (region === "hair" ? hairAniso : coatAniso).push(d.anisotropy);
                total++;
                if (d.areaRatio < 0.5 || d.areaRatio > 2) outCount++;
            }
        }

        // 风吹摆幅（与验收脚本同口径）
        reset();
        for (let i = 0; i < 200; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions);
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
        reset();
        const field = createWindField(rig.wind);
        field.scale = rig.wind?.scale ?? 1;
        const samples = [];
        for (let i = 0; i < 480; i++) {
            const time = i * (1000 / 60);
            const gust = sampleWind(field, time);
            evaluateModel(model, {}, { dt: 1 / 60, wind: { x: gust.x, y: gust.y }, time }, model.positions);
            if (i > 120 && tipVertex >= 0) samples.push([model.positions[tipVertex * 2], model.positions[tipVertex * 2 + 1]]);
        }
        let swing = 0;
        if (samples.length) {
            const xs = samples.map(p => p[0]), ys = samples.map(p => p[1]);
            swing = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
        }

        // 发梢滞后（鞭状感）
        const RAMP = 8, ramp = [];
        for (let i = 1; i <= RAMP; i++) ramp.push({ headTurn: 0.9 * (i / RAMP), lean: 0.4 * (i / RAMP) });
        const record = () => {
            const tips = [];
            for (const p of ramp) { evaluateModel(model, p, { dt: 1 / 60 }, model.positions); tips.push([model.positions[tipVertex * 2], model.positions[tipVertex * 2 + 1]]); }
            return tips;
        };
        const si = chain.inertia, sg = chain.gravityStrength;
        chain.inertia = 0; chain.gravityStrength = 0; reset();
        const rigid = record();
        chain.inertia = si; chain.gravityStrength = sg;
        reset(); for (let i = 0; i < 120; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions); reset();
        const physics = record();
        let lag = 0;
        for (let i = 0; i < RAMP; i++) lag = Math.max(lag, Math.hypot(physics[i][0] - rigid[i][0], physics[i][1] - rigid[i][1]));

        // 动作结束后残留
        reset();
        for (let i = 0; i < 600; i++) evaluateModel(model, {}, { dt: 1 / 60 }, model.positions);
        let residual = 0;
        for (let v = 0; v < model.mesh.vertexCount; v++) {
            residual = Math.max(residual, Math.hypot(model.positions[v * 2] - rest[v * 2], model.positions[v * 2 + 1] - rest[v * 2 + 1]));
        }

        const ok = swing > 8 && lag > 3 && residual < 0.6;
        console.log(`${(iters + "/" + lambda).padEnd(12)}`
            + `${quantile(hairAniso, 0.5).toFixed(4)}`.padEnd(11)
            + `${quantile(hairAniso, 0.95).toFixed(4)}`.padEnd(9)
            + `${(hairAniso.filter(a => a > 1.5).length / hairAniso.length * 100).toFixed(1)}%`.padEnd(10)
            + `${quantile(coatAniso, 0.95).toFixed(4)}`.padEnd(9)
            + `${(outCount / total * 100).toFixed(1)}%`.padEnd(10)
            + `${swing.toFixed(1)}px`.padEnd(11)
            + `${lag.toFixed(1)}px`.padEnd(11)
            + `${residual.toFixed(2)}px`.padEnd(9)
            + (ok ? "✅" : "❌"));
    }
}
