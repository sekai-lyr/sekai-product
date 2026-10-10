/**
 * render-controller-mesh.mjs — 自研 2D 人物模型的离线验证渲染器
 *
 * 为什么需要它：
 *   骨架标定和网格形变如果只能靠肉眼猜，就一定做不准。这个工具在 Node 里
 *   跑**和浏览器完全相同**的 controller-mesh.js 数学，把结果软渲染成 PNG，
 *   于是可以：
 *     1. 目视检查骨架枢轴/影响范围是否落在正确的人体部位上（rig 叠加图）
 *     2. 目视检查中性姿态下网格是否完整还原原画（不该有缺角/漏色）
 *     3. 目视检查各动作姿态的形变是否自然（呼吸/前倾/转头/受击/胜负）
 *
 * 用法：
 *   node SekaiGame/tools/render-controller-mesh.mjs [--id blue-01] [--width 460] [--poses all]
 * 产物：SekaiGame/tools/out/controller-rig/*.png
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, sampleBilinear } from "./lib/png.mjs";

const STATIC = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));
const OUT_DIR = fileURLToPath(new URL("./out/controller-rig/", import.meta.url));

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
};
const ONLY_ID = flag("--id", null);
const OUT_WIDTH = Number(flag("--width", 460));
const POSES = flag("--poses", "all");
const DEBUG_RIG = args.includes("--debug-rig");
const SKIN_MAP = args.includes("--skin-map");
/** --seq wind|<ambientName>：按时间均匀采样 8 帧渲染成接触表，用于目视检查风吹/专属动作 */
const SEQUENCE = flag("--seq", null);
const SEQ_FRAMES = Number(flag("--seq-frames", 8));
/**
 * --crop x0,y0,x1,y1（归一化到渲染画布）+ --zoom n：局部放大，
 * 用于目视检查发丝/外套这类小范围形变（整图缩到几百像素时看不出来）。
 */
const CROP = flag("--crop", null) ? flag("--crop", null).split(",").map(Number) : null;
const ZOOM = Math.max(1, Number(flag("--zoom", 3)));
/** --skin iterations,lambda：覆盖蒙皮平滑参数，用于 A/B 对比（不改 rig 源文件） */
const SKIN_OVERRIDE = flag("--skin", null);
const SKIN_ARGS = SKIN_OVERRIDE ? SKIN_OVERRIDE.split(",").map(Number) : null;

/** 给骨骼分配可区分颜色（HSV 均匀取样） */
function boneColor(index, total) {
    const hue = (index * 0.61803398875) % 1;
    const s = 0.72, v = 1;
    const i = Math.floor(hue * 6);
    const f = hue * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const table = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]];
    const [r, g, b] = table[i % 6];
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), total];
}

const { CONTROLLER_RIGS, buildControllerModel } = await import(
    new URL("../src/main/resources/static/js/controller-rigs.js", import.meta.url).href
);
const { evaluateModel, createWindField, sampleWind, resetPhysicsChain } = await import(
    new URL("../src/main/resources/static/js/controller-mesh.js", import.meta.url).href
);

/* ------------------------------------------------------------------ *
 * 软渲染：纹理三角形光栅化
 * ------------------------------------------------------------------ */
function createCanvas(width, height, background = [10, 14, 24, 255]) {
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        data[i * 4] = background[0]; data[i * 4 + 1] = background[1];
        data[i * 4 + 2] = background[2]; data[i * 4 + 3] = background[3];
    }
    return { width, height, data };
}

const texel = [0, 0, 0, 0];

function blendPixel(canvas, x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
    const alpha = a / 255;
    if (alpha <= 0) return;
    const p = (y * canvas.width + x) * 4;
    const d = canvas.data;
    const inv = 1 - alpha;
    d[p] = r * alpha + d[p] * inv;
    d[p + 1] = g * alpha + d[p + 1] * inv;
    d[p + 2] = b * alpha + d[p + 2] * inv;
    d[p + 3] = Math.min(255, a + d[p + 3] * inv);
}

/** 带纹理的三角形填充（重心坐标 + 双线性采样） */
function drawTexturedTriangle(canvas, texture, p0, p1, p2, uv0, uv1, uv2) {
    const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
    if (Math.abs(area) < 1e-9) return;
    const sign = area > 0 ? 1 : -1;
    const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
    const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
    const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
    const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
    for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5;
        for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5;
            const w0 = sign * ((p1[0] - px) * (p2[1] - py) - (p2[0] - px) * (p1[1] - py));
            const w1 = sign * ((p2[0] - px) * (p0[1] - py) - (p0[0] - px) * (p2[1] - py));
            const w2 = sign * ((p0[0] - px) * (p1[1] - py) - (p1[0] - px) * (p0[1] - py));
            if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
            const total = w0 + w1 + w2 || 1;
            const b0 = w0 / total, b1 = w1 / total, b2 = w2 / total;
            const u = b0 * uv0[0] + b1 * uv1[0] + b2 * uv2[0];
            const v = b0 * uv0[1] + b1 * uv1[1] + b2 * uv2[1];
            sampleBilinear(texture, u * texture.width - 0.5, v * texture.height - 0.5, texel);
            if (texel[3] <= 0) continue;
            blendPixel(canvas, x, y, texel[0], texel[1], texel[2], texel[3]);
        }
    }
}

/** 把模型渲染到 canvas（positions 为原图像素坐标） */
function renderMesh(canvas, texture, mesh, positions, scale) {
    const { indices } = mesh;
    for (let t = 0; t < indices.length; t += 3) {
        const a = indices[t], b = indices[t + 1], c = indices[t + 2];
        drawTexturedTriangle(
            canvas, texture,
            [positions[a * 2] * scale, positions[a * 2 + 1] * scale],
            [positions[b * 2] * scale, positions[b * 2 + 1] * scale],
            [positions[c * 2] * scale, positions[c * 2 + 1] * scale],
            [mesh.uvs[a * 2], mesh.uvs[a * 2 + 1]],
            [mesh.uvs[b * 2], mesh.uvs[b * 2 + 1]],
            [mesh.uvs[c * 2], mesh.uvs[c * 2 + 1]],
        );
    }
}

/** 纯色三角形填充（蒙皮分区图用） */
function fillTriangleFlat(canvas, points, color, alpha) {
    const [p0, p1, p2] = points;
    const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
    if (Math.abs(area) < 1e-9) return;
    const sign = area > 0 ? 1 : -1;
    const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
    const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
    const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
    const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5, py = y + 0.5;
            const w0 = sign * ((p1[0] - px) * (p2[1] - py) - (p2[0] - px) * (p1[1] - py));
            const w1 = sign * ((p2[0] - px) * (p0[1] - py) - (p0[0] - px) * (p2[1] - py));
            const w2 = sign * ((p0[0] - px) * (p1[1] - py) - (p1[0] - px) * (p0[1] - py));
            if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
            blendPixel(canvas, x, y, color[0], color[1], color[2], alpha);
        }
    }
}

/* ---- 线绘制（骨架/网格叠加用） ---- */
function drawLine(canvas, x0, y0, x1, y1, color, thickness = 1, alpha = 255) {
    const [r, g, b] = color;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const radius = thickness / 2;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        const from = Math.floor(-radius), to = Math.ceil(radius);
        for (let dy = from; dy <= to; dy++) {
            for (let dx = from; dx <= to; dx++) {
                if (Math.hypot(dx + 0.5, dy + 0.5) > radius + 0.35) continue;
                blendPixel(canvas, Math.round(x) + dx, Math.round(y) + dy, r, g, b, alpha);
            }
        }
    }
}

function drawDisc(canvas, cx, cy, radius, color, alpha = 255) {
    const [r, g, b] = color;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
        for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
            if (Math.hypot(x - cx, y - cy) <= radius) blendPixel(canvas, x, y, r, g, b, alpha);
        }
    }
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */
mkdirSync(OUT_DIR, { recursive: true });

const POSE_PRESETS = {
    "00-neutral": {},
    "01-breath-peak": { breath: 1 },
    "02-lean-forward": { lean: 1, headNod: 0.6 },
    "03-head-turn-right": { headTurn: 0.9 },
    "04-head-turn-left": { headTurn: -0.9, headTilt: -0.5 },
    "05-draw": { headTurn: 0.75, lean: 0.35, bodyLift: 1.2, rootY: -0.004 },
    "06-summon": { bodyLift: 2.2, breath: 0.6, lean: -0.3 },
    "07-attack": { lean: 0.85, rootX: 0.018, headNod: 0.5, armSwing: -0.6 },
    "08-hit": { rootX: -0.014, lean: -0.9, headTilt: -0.8, squash: 1 },
    "09-lowhp": { breath: 1, squash: 0.8, lean: 0.3 },
    "10-win": { bodyLift: 2.4, scale: 1.03, breath: 0.4 },
    "11-lose": { rootY: 0.016, lean: 0.9, headNod: 1.2, scale: 0.985 },
};

function validate(model) {
    const issues = [];
    const { mesh, skinning, skeleton } = model;
    // 1) 每个顶点都必须有非零权重
    let zeroWeight = 0;
    for (let v = 0; v < mesh.vertexCount; v++) {
        let total = 0;
        for (let k = 0; k < skinning.maxInfluences; k++) total += skinning.weights[v * skinning.maxInfluences + k];
        if (total < 0.999 || total > 1.001) zeroWeight++;
    }
    if (zeroWeight) issues.push(`${zeroWeight} 个顶点权重和不为 1`);
    // 2) 骨骼枢轴应落在剪影内部（否则该骨骼只影响透明区）
    const inside = (x, y) => {
        const xi = Math.round(x), yi = Math.round(y);
        if (xi < 0 || yi < 0 || xi >= mesh.width || yi >= mesh.height) return false;
        return true;
    };
    const orphans = [];
    for (const bone of skeleton.bones) {
        const reach = skinning.indices;
        let touched = 0;
        for (let v = 0; v < mesh.vertexCount && touched < 3; v++) {
            for (let k = 0; k < skinning.maxInfluences; k++) {
                if (skinning.weights[v * skinning.maxInfluences + k] > 0.15 && reach[v * skinning.maxInfluences + k] === bone.order) { touched++; break; }
            }
        }
        if (touched === 0) orphans.push(bone.name);
        if (!inside(bone.x, bone.y)) issues.push(`骨骼 ${bone.name} 枢轴在图像外`);
    }
    if (orphans.length) issues.push(`无顶点受影响的骨骼: ${orphans.join(", ")}`);
    return issues;
}

const summary = [];
for (const [id, rig] of Object.entries(CONTROLLER_RIGS)) {
    if (ONLY_ID && id !== ONLY_ID) continue;
    const pngPath = `${STATIC}assets/characters/controller-${id === "blue-01" ? "blue-01" : id}.png`;
    const texture = decodePng(readFileSync(pngPath));
    const effectiveRig = SKIN_ARGS
        ? { ...rig, skin: { ...rig.skin, smoothIterations: SKIN_ARGS[0], smoothLambda: SKIN_ARGS[1] } }
        : rig;
    const model = buildControllerModel(effectiveRig, texture);
    const scale = OUT_WIDTH / texture.width;
    const outW = Math.round(texture.width * scale);
    const outH = Math.round(texture.height * scale);

    const issues = validate(model);
    console.log(`\n### ${id}  ${model.stats.cells} 网格  顶点 ${model.stats.vertices}  三角 ${model.stats.triangles}  骨骼 ${model.stats.bones}  链 ${model.stats.chains}`);
    if (issues.length) for (const issue of issues) console.log(`  ⚠ ${issue}`);
    else console.log("  ✔ 蒙皮与骨骼校验通过");

    // ---- 蒙皮分区统计（数值化，比看图更可靠）----
    {
        const counts = new Array(model.skeleton.bones.length).fill(0);
        const boxes = new Array(model.skeleton.bones.length).fill(null);
        for (let v = 0; v < model.mesh.vertexCount; v++) {
            let best = 0, bestWeight = -1;
            for (let k = 0; k < model.skinning.maxInfluences; k++) {
                const w = model.skinning.weights[v * model.skinning.maxInfluences + k];
                if (w > bestWeight) { bestWeight = w; best = model.skinning.indices[v * model.skinning.maxInfluences + k]; }
            }
            counts[best]++;
            const x = model.mesh.positions[v * 2], y = model.mesh.positions[v * 2 + 1];
            const box = boxes[best] || (boxes[best] = [x, y, x, y]);
            if (x < box[0]) box[0] = x; if (y < box[1]) box[1] = y;
            if (x > box[2]) box[2] = x; if (y > box[3]) box[3] = y;
        }
        const total = model.mesh.vertexCount;
        console.log("  骨骼主导顶点分布（box 归一化区域）：");
        model.skeleton.bones.forEach((bone, index) => {
            const box = boxes[index];
            const norm = box
                ? `x[${((box[0] - model.mesh.originX) / model.mesh.boxW).toFixed(2)}..${((box[2] - model.mesh.originX) / model.mesh.boxW).toFixed(2)}] y[${((box[1] - model.mesh.originY) / model.mesh.boxH).toFixed(2)}..${((box[3] - model.mesh.originY) / model.mesh.boxH).toFixed(2)}]`
                : "-";
            const share = ((counts[index] / total) * 100).toFixed(1).padStart(5);
            console.log(`    ${bone.name.padEnd(12)} ${share}%  ${norm}`);
        });
    }

    if (SKIN_MAP) {
        const canvas = createCanvas(outW, outH, [0, 0, 0, 0]);
        const colors = model.skeleton.bones.map((_, index) => boneColor(index, model.skeleton.bones.length));
        const { indices } = model.mesh;
        for (let t = 0; t < indices.length; t += 3) {
            const a = indices[t], b = indices[t + 1], c = indices[t + 2];
            // 三角形按三个顶点的主导骨骼投票
            const votes = new Map();
            for (const vi of [a, b, c]) {
                let best = 0, bestWeight = -1;
                for (let k = 0; k < model.skinning.maxInfluences; k++) {
                    const w = model.skinning.weights[vi * model.skinning.maxInfluences + k];
                    if (w > bestWeight) { bestWeight = w; best = model.skinning.indices[vi * model.skinning.maxInfluences + k]; }
                }
                votes.set(best, (votes.get(best) || 0) + 1);
            }
            let dominant = 0, dominantVotes = -1;
            for (const [bone, v] of votes) if (v > dominantVotes) { dominantVotes = v; dominant = bone; }
            const color = colors[dominant];
            fillTriangleFlat(canvas, [
                [model.mesh.positions[a * 2] * scale, model.mesh.positions[a * 2 + 1] * scale],
                [model.mesh.positions[b * 2] * scale, model.mesh.positions[b * 2 + 1] * scale],
                [model.mesh.positions[c * 2] * scale, model.mesh.positions[c * 2 + 1] * scale],
            ], color, 185);
        }
        for (const bone of model.skeleton.bones) {
            drawLine(canvas, bone.x * scale, bone.y * scale, bone.tipX * scale, bone.tipY * scale, [0, 0, 0], 2, 200);
            drawDisc(canvas, bone.x * scale, bone.y * scale, 2, [255, 255, 255], 255);
        }
        writeFileSync(`${OUT_DIR}${id}-skin-map.png`, encodePng(canvas));
        summary.push(`${id}-skin-map.png`);
    }

    // ---- 时间序列：风 / 角色专属动作 ----
    if (SEQUENCE) {
        const ambientSpec = (rig.ambient || []).find(item => item.name === SEQUENCE);
        const isWind = SEQUENCE === "wind";
        if (!isWind && !ambientSpec) {
            console.log(`  ⚠ 找不到专属动作 ${SEQUENCE}（可用：wind, ${(rig.ambient || []).map(a => a.name).join(", ")}）`);
        } else {
            const total = isWind ? 6000 : (ambientSpec.duration ?? 2200);
            const windField = createWindField(rig.wind || {});
            resetPhysicsChain(model.chains[0]);
            for (const chain of model.chains) resetPhysicsChain(chain);
            // 先静置到稳定
            for (let i = 0; i < 180; i++) evaluateModel(model, {}, { dt: 1 / 60, wind: null }, model.positions);

            const cols = Math.min(4, SEQ_FRAMES);
            const rows = Math.ceil(SEQ_FRAMES / cols);
            const gap = 6;
            const sheetW = cols * outW + (cols + 1) * gap;
            const sheetH = rows * outH + (rows + 1) * gap;
            const sheet = createCanvas(sheetW, sheetH, [8, 11, 20, 255]);
            const stepMs = total / SEQ_FRAMES;
            const stepsPerFrame = Math.max(1, Math.round(stepMs / (1000 / 60)));
            for (let index = 0; index < SEQ_FRAMES; index++) {
                for (let s = 0; s < stepsPerFrame; s++) {
                    const time = (index * stepsPerFrame + s) * (1000 / 60);
                    let params = {};
                    if (!isWind) {
                        const t = Math.min(1, (index * stepsPerFrame + s) * (1000 / 60) / total);
                        const keys = ambientSpec.keys;
                        for (let k = 0; k < keys.length - 1; k++) {
                            const a = keys[k], b = keys[k + 1];
                            if (t >= a.t && t <= b.t) {
                                const local = (t - a.t) / Math.max(1e-6, b.t - a.t);
                                for (const [key, value] of Object.entries(a.p || {})) {
                                    const target = (b.p || {})[key] ?? 0;
                                    params[key] = value + (target - value) * local;
                                }
                                for (const [key, value] of Object.entries(b.p || {})) {
                                    if (!(key in params)) params[key] = value * local;
                                }
                                break;
                            }
                        }
                    }
                    const gust = isWind ? sampleWind(windField, time) : null;
                    const burst = 1 + Math.max(0, params.hairBurst ?? 0);
                    const wind = gust ? { x: gust.x * burst, y: gust.y * burst } : null;
                    evaluateModel(model, params, { dt: 1 / 60, wind, time }, model.positions);
                }
                const canvas = createCanvas(outW, outH);
                renderMesh(canvas, texture, model.mesh, model.positions, scale);
                const ox = gap + (index % cols) * (outW + gap);
                const oy = gap + Math.floor(index / cols) * (outH + gap);
                for (let y = 0; y < outH; y++) {
                    for (let x = 0; x < outW; x++) {
                        const src = (y * outW + x) * 4;
                        const dst = ((oy + y) * sheetW + (ox + x)) * 4;
                        const a = canvas.data[src + 3] / 255;
                        sheet.data[dst] = canvas.data[src] * a + sheet.data[dst] * (1 - a);
                        sheet.data[dst + 1] = canvas.data[src + 1] * a + sheet.data[dst + 1] * (1 - a);
                        sheet.data[dst + 2] = canvas.data[src + 2] * a + sheet.data[dst + 2] * (1 - a);
                        sheet.data[dst + 3] = 255;
                    }
                }
            }
            writeFileSync(`${OUT_DIR}${id}-seq-${SEQUENCE}.png`, encodePng(sheet));
            summary.push(`${id}-seq-${SEQUENCE}.png`);
        }
    }

    // ---- rig 叠加图：原画 + 网格线 + 骨骼 + 影响范围 ----
    {
        const canvas = createCanvas(outW, outH);
        if (DEBUG_RIG) {
            // 调试模式：原画压到 30% 不透明度，骨架画粗，专用于校准枢轴位置
            const dimmed = { width: texture.width, height: texture.height, data: new Uint8Array(texture.data) };
            for (let i = 0; i < dimmed.data.length; i += 4) dimmed.data[i + 3] = Math.round(dimmed.data[i + 3] * 0.3);
            renderMesh(canvas, dimmed, model.mesh, model.mesh.positions, scale);
        } else {
            renderMesh(canvas, texture, model.mesh, model.mesh.positions, scale);
        }
        // 网格线（每 6 格画一条，避免糊成一片）
        const { cols, rows } = model.mesh;
        const meshAlpha = DEBUG_RIG ? 12 : 34;
        for (let r = 0; r <= rows; r += 6) {
            for (let c = 0; c < cols; c++) {
                const i0 = r * (cols + 1) + c, i1 = i0 + 1;
                drawLine(canvas,
                    model.mesh.positions[i0 * 2] * scale, model.mesh.positions[i0 * 2 + 1] * scale,
                    model.mesh.positions[i1 * 2] * scale, model.mesh.positions[i1 * 2 + 1] * scale,
                    [120, 200, 255], 1, meshAlpha);
            }
        }
        for (let c = 0; c <= cols; c += 6) {
            for (let r = 0; r < rows; r++) {
                const i0 = r * (cols + 1) + c, i1 = i0 + (cols + 1);
                drawLine(canvas,
                    model.mesh.positions[i0 * 2] * scale, model.mesh.positions[i0 * 2 + 1] * scale,
                    model.mesh.positions[i1 * 2] * scale, model.mesh.positions[i1 * 2 + 1] * scale,
                    [120, 200, 255], 1, meshAlpha);
            }
        }
        // 骨骼：枢轴 → tip
        for (const bone of model.skeleton.bones) {
            const color = bone.kind === "chain" ? [255, 170, 60] : [255, 60, 90];
            drawLine(canvas, bone.x * scale, bone.y * scale, bone.tipX * scale, bone.tipY * scale,
                color, DEBUG_RIG ? 3 : 2, 235);
            // 影响半径圈
            const ringAlpha = DEBUG_RIG ? 200 : 140;
            for (let angle = 0; angle < Math.PI * 2; angle += 0.09) {
                const r = bone.radius * scale;
                blendPixel(canvas, Math.round(bone.x * scale + Math.cos(angle) * r), Math.round(bone.y * scale + Math.sin(angle) * r),
                    bone.kind === "chain" ? 255 : 90, 255, bone.kind === "chain" ? 90 : 140, ringAlpha);
            }
            if (bone.rect) {
                const rect = bone.rect;
                const corners = [
                    [rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]],
                ];
                for (let i = 0; i < 4; i++) {
                    const a = corners[i], b = corners[(i + 1) % 4];
                    drawLine(canvas, a[0] * scale, a[1] * scale, b[0] * scale, b[1] * scale, [0, 255, 255], 2, 220);
                }
            }
            drawDisc(canvas, bone.x * scale, bone.y * scale, DEBUG_RIG ? 4.5 : 3.2, [255, 255, 255], 245);
        }
        writeFileSync(`${OUT_DIR}${id}-rig-overlay.png`, encodePng(canvas));
        summary.push(`${id}-rig-overlay.png`);
    }

    // ---- 姿态渲染 ----
    const poseNames = POSES === "all" ? Object.keys(POSE_PRESETS) : POSES.split(",");
    if (poseNames.length === 1 && poseNames[0] === "none") {
        // 只出叠加图
    } else {
        // 拼图：所有姿态并排，方便一次看清
        const cols = Math.min(4, Math.ceil(Math.sqrt(poseNames.length)));
        const rows = Math.ceil(poseNames.length / cols);
        const gap = 6;
        // 裁剪窗口（归一化 → 像素），不裁剪时就是整张画布
        const cropX0 = CROP ? Math.round(CROP[0] * outW) : 0;
        const cropY0 = CROP ? Math.round(CROP[1] * outH) : 0;
        const cropX1 = CROP ? Math.round(CROP[2] * outW) : outW;
        const cropY1 = CROP ? Math.round(CROP[3] * outH) : outH;
        const cellW = (cropX1 - cropX0) * (CROP ? ZOOM : 1);
        const cellH = (cropY1 - cropY0) * (CROP ? ZOOM : 1);
        const sheetW = cols * cellW + (cols + 1) * gap;
        const sheetH = rows * cellH + (rows + 1) * gap;
        const sheet = createCanvas(sheetW, sheetH, [8, 11, 20, 255]);
        for (let index = 0; index < poseNames.length; index++) {
            const name = poseNames[index];
            const preset = POSE_PRESETS[name] ?? {};
            // 走真实运行时路径：evaluateModel = 参数 → 骨架 → 弹簧链 → 蒙皮
            // 静止姿态渲染时多步迭代让弹簧收敛，避免把瞬态抖动当成最终形状。
            for (let step = 0; step < 40; step++) {
                evaluateModel(model, preset, { dt: 1 / 60, anchorMotion: { x: 0, y: 0 } }, model.positions);
            }
            const canvas = createCanvas(outW, outH);
            renderMesh(canvas, texture, model.mesh, model.positions, scale);
            const ox = gap + (index % cols) * (cellW + gap);
            const oy = gap + Math.floor(index / cols) * (cellH + gap);
            for (let y = 0; y < cellH; y++) {
                for (let x = 0; x < cellW; x++) {
                    // 最近邻放大：目视检查形变时不要引入插值造成的假象
                    const sx = cropX0 + Math.floor(x / (CROP ? ZOOM : 1));
                    const sy = cropY0 + Math.floor(y / (CROP ? ZOOM : 1));
                    if (sx < 0 || sy < 0 || sx >= outW || sy >= outH) continue;
                    const src = (sy * outW + sx) * 4;
                    const dst = ((oy + y) * sheetW + (ox + x)) * 4;
                    const a = canvas.data[src + 3] / 255;
                    sheet.data[dst] = canvas.data[src] * a + sheet.data[dst] * (1 - a);
                    sheet.data[dst + 1] = canvas.data[src + 1] * a + sheet.data[dst + 1] * (1 - a);
                    sheet.data[dst + 2] = canvas.data[src + 2] * a + sheet.data[dst + 2] * (1 - a);
                    sheet.data[dst + 3] = 255;
                }
            }
        }
        writeFileSync(`${OUT_DIR}${id}-poses.png`, encodePng(sheet));
        summary.push(`${id}-poses.png${CROP ? `（裁剪 ${CROP.join(",")} ×${ZOOM}）` : ""}`);
    }
}

console.log(`\n产物目录：${OUT_DIR}`);
for (const name of summary) console.log(`  · ${name}`);
