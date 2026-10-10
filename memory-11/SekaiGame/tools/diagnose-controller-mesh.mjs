/**
 * diagnose-controller-mesh.mjs — 弹簧链数值诊断
 * 打印每条链的静止节点位置、收敛后节点位置、偏移量，定位次级运动异常。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodePng } from "./lib/png.mjs";

const STATIC = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));
const { CONTROLLER_RIGS, buildControllerModel } = await import(
    new URL("../src/main/resources/static/js/controller-rigs.js", import.meta.url).href
);
const { evaluateModel } = await import(
    new URL("../src/main/resources/static/js/controller-mesh.js", import.meta.url).href
);

const id = process.argv[2] || "blue-01";
const image = decodePng(readFileSync(`${STATIC}assets/characters/controller-${id}.png`));
const model = buildControllerModel(CONTROLLER_RIGS[id], image);
const box = model.mesh;

for (let step = 0; step < 120; step++) {
    evaluateModel(model, {}, { dt: 1 / 60, anchorMotion: { x: 0, y: 0 } }, model.positions);
}

console.log(`\n### ${id} 弹簧链静止收敛诊断（120 步后）`);
for (const chain of model.chains) {
    const anchor = model.skeleton.bones[chain.anchor];
    console.log(`\n  ${chain.name}  锚点=${anchor.name}(${anchor.x.toFixed(0)},${anchor.y.toFixed(0)})  k=${chain.stiffness} c=${chain.damping} g=${chain.gravity}`);
    let accumulated = 0;
    for (let i = 0; i < chain.nodes.length; i++) {
        const node = chain.nodes[i];
        const rest = chain.restAngles[i];
        const now = chain.angle[i];
        const dx = node.x - node.restX, dy = node.y - node.restY;
        accumulated += now - rest;
        console.log(`    node${i}  rest=(${node.restX.toFixed(0)},${node.restY.toFixed(0)}) now=(${node.x.toFixed(0)},${node.y.toFixed(0)})`
            + `  位移=${Math.hypot(dx, dy).toFixed(1)}px  角度 rest=${(rest * 57.3).toFixed(1)}° now=${(now * 57.3).toFixed(1)}°`
            + `  Δ=${((now - rest) * 57.3).toFixed(1)}°  累计=${(accumulated * 57.3).toFixed(1)}°`);
    }
}

// 中性姿态下蒙皮结果与原图的偏差（应当接近 0）
const maxDelta = { value: 0, vertex: -1 };
for (let v = 0; v < model.mesh.vertexCount; v++) {
    const dx = model.positions[v * 2] - model.mesh.positions[v * 2];
    const dy = model.positions[v * 2 + 1] - model.mesh.positions[v * 2 + 1];
    const d = Math.hypot(dx, dy);
    if (d > maxDelta.value) { maxDelta.value = d; maxDelta.vertex = v; }
}
let moved = 0;
for (let v = 0; v < model.mesh.vertexCount; v++) {
    const dx = model.positions[v * 2] - model.mesh.positions[v * 2];
    const dy = model.positions[v * 2 + 1] - model.mesh.positions[v * 2 + 1];
    if (Math.hypot(dx, dy) > 2) moved++;
}
console.log(`\n中性姿态顶点位移：最大 ${maxDelta.value.toFixed(1)}px（顶点 ${maxDelta.vertex}），位移>2px 的顶点 ${moved}/${model.mesh.vertexCount} (${(moved / model.mesh.vertexCount * 100).toFixed(1)}%)`);
console.log("（中性姿态应该几乎不位移；位移过大说明弹簧链把静止形状带偏了）");
