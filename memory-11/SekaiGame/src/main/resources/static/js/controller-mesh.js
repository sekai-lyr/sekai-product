/**
 * controller-mesh.js — 自研 2D 人物模型内核（网格 + 骨架 + 蒙皮 + 弹簧物理）
 *
 * 这是什么：
 *   把一张平涂的角色原画程序化地变成「可变形人物模型」——
 *   按 alpha 剪影生成三角网格，配一副骨架，自动计算蒙皮权重，
 *   每帧在 CPU 上做线性混合蒙皮（LBS）得到变形后的顶点位置，
 *   再交给 WebGL（或 Node 软渲染）按原图纹理绘制。
 *   头发/衣摆等末端额外挂弹簧链，产生滞后的次级运动。
 *
 * 这不是什么：
 *   原画只有一张合图，没有分层，所以做不到 Live2D 那种独立眨眼/张嘴/表情差分。
 *   头部转动是用「绕颈部枢轴的横向压缩 + 平移」做的伪 3D 近似，不是真 3D。
 *   网格只做形变，不改动原画的任何像素、比例与配色。
 *
 * 单位约定：
 *   骨架配置里用「归一化包围盒坐标」(0..1, y 向下)；内核内部统一换算成
 *   **原图像素坐标**（0..W / 0..H），因为 UV、弹簧物理、贴合剪影都按像素最直观。
 *
 * 本模块必须能在 Node 里直接 import（tools/render-controller-mesh.mjs 会用同一份代码
 * 做软渲染验证），因此不允许触碰 window / document / WebGL。
 */

/* ------------------------------------------------------------------ *
 * 1. 2D 仿射变换（与 canvas setTransform 同序：[a,b,c,d,e,f]）
 * ------------------------------------------------------------------ */
export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

export function affineMul(m, n) {
    // m ∘ n：先应用 n，再应用 m
    return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
    ];
}

export function affineTranslate(tx, ty) { return [1, 0, 0, 1, tx, ty]; }

export function affineRotate(radians) {
    const c = Math.cos(radians), s = Math.sin(radians);
    return [c, s, -s, c, 0, 0];
}

export function affineScale(sx, sy) { return [sx, 0, 0, sy, 0, 0]; }

/** 剪切：x' = x + k*y（伪 3D 倾斜用） */
export function affineShearX(k) { return [1, 0, k, 1, 0, 0]; }

export function affineApply(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** 求逆（奇异时退回单位阵，保证不产生 NaN） */
export function affineInvert(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(det) < 1e-12) return IDENTITY.slice();
    const inv = 1 / det;
    return [
        m[3] * inv,
        -m[1] * inv,
        -m[2] * inv,
        m[0] * inv,
        (m[2] * m[5] - m[3] * m[4]) * inv,
        (m[1] * m[4] - m[0] * m[5]) * inv,
    ];
}

/** 线性插值两条仿射（用于参数平滑） */
export function affineLerp(a, b, t) {
    return a.map((value, index) => value + (b[index] - value) * t);
}

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = value => clamp(value, 0, 1);
export const smoothstep = t => { const x = clamp01(t); return x * x * (3 - 2 * x); };
export { clamp, lerp };

/* ------------------------------------------------------------------ *
 * 2. 网格生成：按 alpha 剪影生成三角网格，并把边界顶点吸附到剪影边缘
 * ------------------------------------------------------------------ */

export const DEFAULT_MESH_OPTIONS = Object.freeze({
    /** 目标格边长（原图像素）。越小越贴合剪影，但顶点更多。 */
    cell: 9,
    /** alpha 高于此值视为实心 */
    alphaThreshold: 24,
    /** 顶点数上限（Uint16 索引要求 < 65536，留出余量） */
    maxVertices: 60000,
    /** 包围盒外扩像素，避免描边被裁掉 */
    pad: 2,
    /**
     * 判定「这一格要不要保留」时，格子内部额外采样的密度（k×k）。
     * 只影响剔除判定，不影响顶点位置 —— 顶点必须留在规则栅格上，
     * 否则相邻格点会被吸附到同一个像素，产生静止面积≈0 的退化三角形，
     * 形变时必然翻面（历史 bug，已被本项配置取代的旧 snapRadius 方案修复）。
     */
    cullSamples: 3,
});

/**
 * @param {{width:number,height:number,data:Uint8Array}} image RGBA 交错（浏览器里由 canvas.getImageData 提供）
 * @returns {{width,height,cols,rows,originX,originY,cell,positions:Float32Array,uvs:Float32Array,
 *            indices:Uint16Array,vertexAlpha:Float32Array,keep:Uint8Array,triangleCount,vertexCount}}
 */
export function buildMeshFromAlpha(image, options = {}) {
    const opts = { ...DEFAULT_MESH_OPTIONS, ...options };
    const { width: imgW, height: imgH, data } = image;
    const alphaAt = (x, y) => {
        const xi = clamp(Math.round(x), 0, imgW - 1);
        const yi = clamp(Math.round(y), 0, imgH - 1);
        return data[(yi * imgW + xi) * 4 + 3];
    };

    // ---- alpha 包围盒 ----
    let minX = imgW, minY = imgH, maxX = -1, maxY = -1;
    for (let y = 0; y < imgH; y++) {
        for (let x = 0; x < imgW; x++) {
            if (data[(y * imgW + x) * 4 + 3] > opts.alphaThreshold) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) throw new Error("buildMeshFromAlpha: 图像全透明");

    const originX = Math.max(0, minX - opts.pad);
    const originY = Math.max(0, minY - opts.pad);
    const boxW = Math.min(imgW, maxX + opts.pad + 1) - originX;
    const boxH = Math.min(imgH, maxY + opts.pad + 1) - originY;

    // ---- 网格密度：先按 cell 取，再按顶点上限收敛 ----
    let cell = Math.max(2, opts.cell);
    let cols = Math.max(1, Math.ceil(boxW / cell));
    let rows = Math.max(1, Math.ceil(boxH / cell));
    while ((cols + 1) * (rows + 1) > opts.maxVertices) {
        cell *= 1.25;
        cols = Math.max(1, Math.ceil(boxW / cell));
        rows = Math.max(1, Math.ceil(boxH / cell));
    }
    const stepX = boxW / cols;
    const stepY = boxH / rows;

    // ---- 顶点：严格留在规则栅格上，绝不为了贴合剪影而移动 ----
    const vertexCount = (cols + 1) * (rows + 1);
    const positions = new Float32Array(vertexCount * 2);
    const uvs = new Float32Array(vertexCount * 2);
    const vertexAlpha = new Float32Array(vertexCount);
    for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
            const index = r * (cols + 1) + c;
            const x = originX + c * stepX;
            const y = originY + r * stepY;
            positions[index * 2] = x;
            positions[index * 2 + 1] = y;
            uvs[index * 2] = (x + 0.5) / imgW;
            uvs[index * 2 + 1] = (y + 0.5) / imgH;
            vertexAlpha[index] = alphaAt(x, y);
        }
    }

    // ---- 三角形：四角任一在剪影内，或格子内部稠密采样命中，就保留该格。
    // 保留格永远略大于剪影，多出来的部分由纹理 alpha 裁掉；
    // 反过来（网格小于剪影）才是不可接受的，会真的切掉原画。 ----
    const samples = Math.max(1, Math.round(opts.cullSamples));
    const indices = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i00 = r * (cols + 1) + c;
            const i10 = i00 + 1;
            const i01 = i00 + (cols + 1);
            const i11 = i01 + 1;
            let keep = vertexAlpha[i00] > opts.alphaThreshold || vertexAlpha[i10] > opts.alphaThreshold
                || vertexAlpha[i01] > opts.alphaThreshold || vertexAlpha[i11] > opts.alphaThreshold;
            if (!keep && samples > 1) {
                const x0 = originX + c * stepX;
                const y0 = originY + r * stepY;
                for (let sy = 1; sy < samples && !keep; sy++) {
                    for (let sx = 1; sx < samples && !keep; sx++) {
                        if (alphaAt(x0 + (stepX * sx) / samples, y0 + (stepY * sy) / samples) > opts.alphaThreshold) keep = true;
                    }
                }
            }
            if (!keep) continue;
            indices.push(i00, i10, i11, i00, i11, i01);
        }
    }

    return {
        width: imgW, height: imgH, cols, rows, originX, originY,
        boxW: cols * stepX, boxH: rows * stepY, cell,
        positions, uvs, vertexAlpha, vertexCount,
        indices: new Uint16Array(indices),
        triangleCount: indices.length / 3,
    };
}

function snapToSilhouette() {
    // 已废弃：把透明格点吸附到剪影边缘会让相邻格点落到同一像素，
    // 产生退化三角形。现在改用 buildMeshFromAlpha 的 cullSamples 稠密剔除。
    throw new Error("snapToSilhouette 已移除，请使用 cullSamples 选项");
}

/* ------------------------------------------------------------------ *
 * 3. 骨架
 * ------------------------------------------------------------------ */

/**
 * rig 片段格式（写在角色配置里，坐标为 alpha 包围盒归一化值，y 向下）：
 *   bones: [{ name, parent, x, y, tip?: [x,y], radius?: number, kind?: "body"|"limb"|"chain"|"attach" }]
 *   chains: [{ name, parent, nodes: [[x,y], ...], stiffness, damping, gravity, spread }]
 *
 * radius 是「影响半径」，单位为包围盒宽度比例：该骨骼只影响距离骨架线段小于
 * radius*boxW 的顶点，越小越局部。
 */
export function createSkeleton(rig, box) {
    const toPx = ([nx, ny]) => [box.originX + nx * box.boxW, box.originY + ny * box.boxH];
    const bones = [];
    const byName = new Map();
    for (const spec of rig.bones || []) {
        const [px, py] = toPx([spec.x, spec.y]);
        const radius = (spec.radius ?? 0.16) * box.boxW;
        // rect 可选：把该骨骼的影响硬限制在一个矩形区域内（道具、头发束等
        // 大面积同动部位必须用它，否则会把周边躯干顶点一起拽走）。
        const rect = spec.rect
            ? [
                box.originX + spec.rect[0] * box.boxW,
                box.originY + spec.rect[1] * box.boxH,
                box.originX + spec.rect[2] * box.boxW,
                box.originY + spec.rect[3] * box.boxH,
            ]
            : null;
        const bone = {
            name: spec.name,
            parent: spec.parent ?? null,
            parentIndex: -1,
            x: px, y: py,
            tipX: px, tipY: py,
            tip: spec.tip ? toPx(spec.tip) : null,
            radius,
            rect,
            // rectSoft 是「包围盒宽度比例」的软边宽度（默认 1.5%），
            // 用比例而不是半径倍数，避免大半径骨骼的软边失控吞掉整块区域。
            rectSoft: (spec.rectSoft ?? 0.015) * box.boxW,
            kind: spec.kind || "body",
            depth: 0,
            order: bones.length,
        };
        byName.set(bone.name, bones.length);
        bones.push(bone);
    }
    for (const bone of bones) {
        if (bone.parent === null) continue;
        const index = byName.get(bone.parent);
        if (index === undefined) throw new Error(`createSkeleton: 找不到父骨骼 ${bone.parent}`);
        bone.parentIndex = index;
        bone.depth = bones[index].depth + 1;
    }
    if (!bones.some(bone => bone.parentIndex === -1)) throw new Error("createSkeleton: 缺少根骨骼");
    // tip 缺省 = 第一个子骨骼的枢轴（让影响线段顺着骨链走）
    for (const bone of bones) {
        if (bone.tip) continue;
        const child = bones.find(candidate => candidate.parentIndex === bone.order);
        if (child) { bone.tip = [child.x, child.y]; }
        else {
            const parent = bone.parentIndex >= 0 ? bones[bone.parentIndex] : null;
            const dx = parent ? bone.x - parent.x : 0;
            const dy = parent ? bone.y - parent.y : -1;
            const len = Math.hypot(dx, dy) || 1;
            const extend = Math.max(bone.radius * 0.6, 6);
            bone.tip = [bone.x + (dx / len) * extend, bone.y + (dy / len) * extend];
        }
        bone.tipX = bone.tip[0];
        bone.tipY = bone.tip[1];
    }
    // 按深度稳定排序，保证父骨骼永远先于子骨骼求解
    const order = bones.map((_, index) => index)
        .sort((a, b) => bones[a].depth - bones[b].depth || bones[a].order - bones[b].order);
    return { bones, byName, order, box };
}

/** 点到线段的距离 */
function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq < 1e-9) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 点到轴对齐矩形的「软距离」：内部为 0，外部为到边界的距离 */
function distanceToRect(px, py, rect) {
    const dx = Math.max(rect[0] - px, 0, px - rect[2]);
    const dy = Math.max(rect[1] - py, 0, py - rect[3]);
    return Math.hypot(dx, dy);
}

export const MAX_INFLUENCES = 4;

/**
 * 自动蒙皮：每个顶点取最近的若干骨骼，权重用紧凑支撑核 max(0,1-d/R)^p。
 * 骨骼带 rect 时再乘一个区域门控，保证道具/发束不会牵连周边躯干。
 * 全部落在影响范围外时回退到最近骨骼权重 1（保证不出现零权重顶点）。
 */
export function computeSkinWeights(mesh, skeleton, options = {}) {
    const { falloff = 2.2, maxInfluences = MAX_INFLUENCES, normalizeRadius = 1 } = options;
    const count = mesh.vertexCount;
    const boneCount = skeleton.bones.length;
    const indices = new Uint8Array(count * maxInfluences);
    const weights = new Float32Array(count * maxInfluences);
    const candidates = [];
    // 第一遍：记录每个顶点的最近骨骼，作为「无候选」时的兜底
    const nearestBone = new Uint8Array(count);
    const nearestDistance = new Float32Array(count).fill(Infinity);
    for (let v = 0; v < count; v++) {
        const x = mesh.positions[v * 2];
        const y = mesh.positions[v * 2 + 1];
        for (let b = 0; b < boneCount; b++) {
            const bone = skeleton.bones[b];
            const d = distanceToSegment(x, y, bone.x, bone.y, bone.tipX, bone.tipY);
            if (d < nearestDistance[v]) { nearestDistance[v] = d; nearestBone[v] = b; }
        }
    }
    for (let v = 0; v < count; v++) {
        const x = mesh.positions[v * 2];
        const y = mesh.positions[v * 2 + 1];
        candidates.length = 0;
        for (let b = 0; b < boneCount; b++) {
            const bone = skeleton.bones[b];
            const radius = bone.radius * normalizeRadius;
            const d = distanceToSegment(x, y, bone.x, bone.y, bone.tipX, bone.tipY);
            if (d >= radius) continue;
            let weight = Math.pow(1 - d / radius, falloff);
            if (bone.rect) {
                const outside = distanceToRect(x, y, bone.rect);
                if (outside > bone.rectSoft) continue;
                weight *= 1 - outside / bone.rectSoft;
            }
            if (weight <= 0) continue;
            candidates.push({ bone: b, weight });
        }
        if (candidates.length === 0) {
            indices[v * maxInfluences] = nearestBone[v];
            weights[v * maxInfluences] = 1;
            continue;
        }
        candidates.sort((a, b) => b.weight - a.weight);
        const used = candidates.slice(0, maxInfluences);
        const total = used.reduce((sum, item) => sum + item.weight, 0) || 1;
        for (let k = 0; k < used.length; k++) {
            indices[v * maxInfluences + k] = used[k].bone;
            weights[v * maxInfluences + k] = used[k].weight / total;
        }
    }
    return { indices, weights, maxInfluences };
}

/**
 * 权重平滑（网格是规则栅格，邻接关系是平凡的）。
 *
 * 为什么必须做：紧凑支撑核会在骨骼影响边界产生权重跳变，两块相邻三角形
 * 的顶点被不同骨骼以相差很大的权重驱动，形变后就会互相穿插 —— 表现为
 * 三角形翻面（有向面积变号）。
 *
 * 为什么后来把迭代次数调高（8 → 48）：
 *   翻面只是「权重跳变」最刺眼的症状，还有一个更隐蔽的后果是**局部压扁**。
 *   物理链骨骼（发丝 / 外套摆）只做平移，而躯干骨骼（root / chest / legL）
 *   几乎不动，两者的位移差可以到上百像素。一个顶点被这两类骨骼按不同配比
 *   混合时，相邻顶点只要权重差 0.1，位置上就会被拉开十几像素，远大于 9px
 *   的网格间距 → 三角形被拉爆或压扁。玩家的观感就是「低头时头发被物理压缩了」。
 *   权重场越平滑，相邻顶点的配比越接近，这个现象就越轻（实测发丝中位各向异性
 *   1.096 → 1.000，外套摆 p95 2.30 → 1.38），而发梢的滞后与位移几乎不变
 *   （52.9px → 52.1px / 179.4px → 175.0px），也就是**没有把头发变呆**。
 *
 * 性能：纯 JS 下每轮就是 顶点数 × 骨骼数 × 9 次邻域读取，48 轮在
 * blue-01 上约 380ms / lucia 上约 900ms，而建模只在首次进入决斗或切换主控时
 * 发生一次（不会每局重建）。因此这里取 32 轮 / λ0.85 作为折中：
 * 拿到大部分收益，建模耗时从 133ms 涨到约 320ms。
 * （试过「预计算每个顶点的邻域骨骼表、只累加非零骨骼」的写法，快 6 倍，
 *   但它是错的——拉普拉斯扩散每轮都会把支撑集向外推一格，48 轮后
 *   原本 3×3 之外的骨骼也会有不可忽略的权重，实测权重差达 0.45，已放弃。
 *   也试过改成骨骼优先的内存布局，结果逐位相同但速度没有提升，故保持原样。）
 */
export function smoothSkinWeights(mesh, skinning, options = {}) {
    const { iterations = 3, lambda = 0.55 } = options;
    if (iterations <= 0) return skinning;
    const { cols, rows } = mesh;
    const count = mesh.vertexCount;
    const boneCount = skeletonBoneCount(skinning);
    const dense = new Float32Array(count * boneCount);
    for (let v = 0; v < count; v++) {
        for (let k = 0; k < skinning.maxInfluences; k++) {
            const bone = skinning.indices[v * skinning.maxInfluences + k];
            dense[v * boneCount + bone] += skinning.weights[v * skinning.maxInfluences + k];
        }
    }
    const temp = new Float32Array(dense.length);
    for (let pass = 0; pass < iterations; pass++) {
        for (let r = 0; r <= rows; r++) {
            for (let c = 0; c <= cols; c++) {
                const v = r * (cols + 1) + c;
                const base = v * boneCount;
                let neighbours = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (!dr && !dc) continue;
                        const nr = r + dr, nc = c + dc;
                        if (nr < 0 || nc < 0 || nr > rows || nc > cols) continue;
                        neighbours++;
                    }
                }
                const weight = lambda / Math.max(neighbours, 1);
                for (let b = 0; b < boneCount; b++) {
                    let sum = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (!dr && !dc) continue;
                            const nr = r + dr, nc = c + dc;
                            if (nr < 0 || nc < 0 || nr > rows || nc > cols) continue;
                            sum += dense[(nr * (cols + 1) + nc) * boneCount + b];
                        }
                    }
                    temp[base + b] = dense[base + b] * (1 - lambda) + sum * weight;
                }
            }
        }
        dense.set(temp);
    }
    // 回到 top-N 稀疏表示并重新归一
    const indices = new Uint8Array(count * skinning.maxInfluences);
    const weights = new Float32Array(count * skinning.maxInfluences);
    for (let v = 0; v < count; v++) {
        const base = v * boneCount;
        let best = [];
        for (let b = 0; b < boneCount; b++) {
            const w = dense[base + b];
            if (w > 1e-5) best.push({ bone: b, weight: w });
        }
        if (!best.length) {
            indices[v * skinning.maxInfluences] = skinning.indices[v * skinning.maxInfluences];
            weights[v * skinning.maxInfluences] = 1;
            continue;
        }
        best.sort((a, b) => b.weight - a.weight);
        best = best.slice(0, skinning.maxInfluences);
        const total = best.reduce((sum, item) => sum + item.weight, 0) || 1;
        for (let k = 0; k < best.length; k++) {
            indices[v * skinning.maxInfluences + k] = best[k].bone;
            weights[v * skinning.maxInfluences + k] = best[k].weight / total;
        }
    }
    return { indices, weights, maxInfluences: skinning.maxInfluences };
}

function skeletonBoneCount(skinning) {
    let max = 0;
    for (let i = 0; i < skinning.indices.length; i++) if (skinning.indices[i] > max) max = skinning.indices[i];
    return max + 1;
}

/* ------------------------------------------------------------------ *
 * 4. 姿态求解
 * ------------------------------------------------------------------ */

export function createPoseState(skeleton) {
    const boneCount = skeleton.bones.length;
    const restPivot = new Float32Array(boneCount * 2);
    for (let i = 0; i < boneCount; i++) {
        restPivot[i * 2] = skeleton.bones[i].x;
        restPivot[i * 2 + 1] = skeleton.bones[i].y;
    }
    return {
        /** 每骨骼的局部姿态增量 */
        rotate: new Float32Array(boneCount),
        translateX: new Float32Array(boneCount),
        translateY: new Float32Array(boneCount),
        scaleX: new Float32Array(boneCount).fill(1),
        scaleY: new Float32Array(boneCount).fill(1),
        shearX: new Float32Array(boneCount),
        opacity: new Float32Array(boneCount).fill(1),
        /** 静止枢轴：蒙皮的局部原点必须用它，不能用当前世界枢轴（见 deformMesh 注释） */
        restPivot,
        /** 求解结果：世界矩阵 + 世界枢轴 */
        matrices: new Array(boneCount).fill(null).map(() => IDENTITY.slice()),
        worldPivot: new Float32Array(boneCount * 2),
    };
}

export function resetPoseState(pose) {
    pose.rotate.fill(0);
    pose.translateX.fill(0);
    pose.translateY.fill(0);
    pose.scaleX.fill(1);
    pose.scaleY.fill(1);
    pose.shearX.fill(0);
    pose.opacity.fill(1);
}

/**
 * 由局部姿态求解世界矩阵。
 * 局部变换顺序：T(dt) ← S ← H ← R，都作用在骨骼枢轴上；
 * 世界矩阵 M_i = M_parent · T(o_i) · R(θ_i) · H · S · T(dt_i)，
 * 其中 o_i 是静止状态下相对父骨骼枢轴的偏移。
 * 静止时 M_i 恒等于 T(p_i)，因此蒙皮公式可以写成
 *   x' = Σ w_i · (M_i · (x − p_i))
 */
export function solveSkeleton(skeleton, pose) {
    const { bones, order } = skeleton;
    for (const index of order) {
        const bone = bones[index];
        const parentIndex = bone.parentIndex;
        const ox = parentIndex >= 0 ? bone.x - bones[parentIndex].x : bone.x;
        const oy = parentIndex >= 0 ? bone.y - bones[parentIndex].y : bone.y;
        let local = affineTranslate(ox, oy);
        if (pose.rotate[index]) local = affineMul(local, affineRotate(pose.rotate[index]));
        if (pose.shearX[index]) local = affineMul(local, affineShearX(pose.shearX[index]));
        const sx = pose.scaleX[index], sy = pose.scaleY[index];
        if (sx !== 1 || sy !== 1) local = affineMul(local, affineScale(sx, sy));
        if (pose.translateX[index] || pose.translateY[index]) {
            local = affineMul(local, affineTranslate(pose.translateX[index], pose.translateY[index]));
        }
        pose.matrices[index] = parentIndex >= 0 ? affineMul(pose.matrices[parentIndex], local) : local;
        const pivot = affineApply(pose.matrices[index], 0, 0);
        pose.worldPivot[index * 2] = pivot[0];
        pose.worldPivot[index * 2 + 1] = pivot[1];
    }
    return pose;
}

/**
 * 线性混合蒙皮：把网格顶点变形到目标缓冲区。
 *
 * 局部原点必须是**静止枢轴**，因为 M_i 把「骨骼局部坐标」映射到世界；
 * 而局部坐标的原点定义就是静止枢轴。
 *   x' = Σ w_i · (M_i · (x − restPivot_i))
 * 若误用当前世界枢轴（M_i·(0,0)），纯平移骨骼会出现
 *   M·(x − p_new) + p_new = x
 * 也就是位移被完全抵消——四元数/旋转看不出来，平移全部失效。
 * @param {Float32Array} out 长度 >= vertexCount*2
 */
export function deformMesh(mesh, skinning, pose, out) {
    const count = mesh.vertexCount;
    const maxInfluences = skinning.maxInfluences;
    const target = out || new Float32Array(count * 2);
    for (let v = 0; v < count; v++) {
        const x = mesh.positions[v * 2];
        const y = mesh.positions[v * 2 + 1];
        let rx = 0, ry = 0, total = 0;
        for (let k = 0; k < maxInfluences; k++) {
            const weight = skinning.weights[v * maxInfluences + k];
            if (weight <= 0) continue;
            const bone = skinning.indices[v * maxInfluences + k];
            const m = pose.matrices[bone];
            const lx = x - pose.restPivot[bone * 2];
            const ly = y - pose.restPivot[bone * 2 + 1];
            rx += (m[0] * lx + m[2] * ly + m[4]) * weight;
            ry += (m[1] * lx + m[3] * ly + m[5]) * weight;
            total += weight;
        }
        if (total <= 0) { rx = x; ry = y; }
        else if (Math.abs(total - 1) > 1e-4) { rx /= total; ry /= total; }
        target[v * 2] = rx;
        target[v * 2 + 1] = ry;
    }
    return target;
}

/* ------------------------------------------------------------------ *
 * 5. 次级运动：头发 / 衣摆弹簧链
 * ------------------------------------------------------------------ */

/**
 * 每条链是一串节点，节点静止位置由 rig 给出。物理量是每个节点相对
 * 「父级传递角」的偏移角，用弹簧-阻尼积分，产生滞后摆动。
 */
export function createPhysicsChain(spec, skeleton, box) {
    const anchorIndex = skeleton.byName.get(spec.parent);
    if (anchorIndex === undefined) throw new Error(`createPhysicsChain: 找不到锚点骨骼 ${spec.parent}`);
    const nodes = (spec.nodes || []).map(([nx, ny]) => ({
        x: box.originX + nx * box.boxW,
        y: box.originY + ny * box.boxH,
        restX: box.originX + nx * box.boxW,
        restY: box.originY + ny * box.boxH,
    }));
    const restAngles = [];
    let prevX = skeleton.bones[anchorIndex].x;
    let prevY = skeleton.bones[anchorIndex].y;
    for (const node of nodes) {
        restAngles.push(Math.atan2(node.y - prevY, node.x - prevX));
        prevX = node.x;
        prevY = node.y;
    }
    const lengths = [];
    prevX = skeleton.bones[anchorIndex].x;
    prevY = skeleton.bones[anchorIndex].y;
    for (const node of nodes) {
        lengths.push(Math.hypot(node.x - prevX, node.y - prevY));
        prevX = node.x;
        prevY = node.y;
    }
    return {
        name: spec.name,
        anchor: anchorIndex,
        nodes,
        restAngles,
        lengths,
        /**
         * 积分状态是**相对上一节的弯曲量 bend**，不是绝对角。
         * 绝对角 = restAngle[i] + Σ_{j<i} bend[j]·transmission + bend[i]
         * 这样父节一弯，下游所有节都被几何带动 —— 鞭状跟随是涌现出来的，
         * 不需要额外加一个"耦合力矩"（那样做在物理上是错的，而且量级永远对不上弹簧）。
         */
        bend: restAngles.map(() => 0),
        bendVelocity: restAngles.map(() => 0),
        /** 兼容旧字段名：等于 bendVelocity */
        angularVelocity: null,
        /** 绝对角，由 resolvePhysicsChain 填充（外部只读） */
        angle: restAngles.slice(),
        stiffness: spec.stiffness ?? 46,
        damping: spec.damping ?? 7.5,
        gravityStrength: (spec.gravity ?? 300) * 0.04,
        inertia: spec.inertia ?? 1,
        bendLimit: spec.bendLimit ?? 0.5,
        /** 弯曲传递率：1 = 完全带动下游，越小越像各自独立摆动 */
        coupling: clamp(spec.coupling ?? 0.85, 0, 1),
        /** 沿链变刚度：根部硬、梢部软，摆动才有层次 */
        stiffnessFalloff: spec.stiffnessFalloff ?? 0.86,
        /** 迎风面积：发束宽的链受风更明显 */
        windArea: spec.windArea ?? 1,
        /** 每链独立的相位，避免所有发束同步摆动 */
        phase: spec.phase ?? 0,
        /** 锚点运动学状态（用于惯性拖尾） */
        prevAnchorX: null,
        prevAnchorY: null,
        anchorVX: 0,
        anchorVY: 0,
    };
}

/** 把 bend 积分状态清零（重置物理用） */
export function resetPhysicsChain(chain) {
    chain.bend.fill(0);
    chain.bendVelocity.fill(0);
    chain.angle = chain.restAngles.slice();
    chain.prevAnchorX = null;
    chain.prevAnchorY = null;
    chain.anchorVX = 0;
    chain.anchorVY = 0;
    return chain;
}

/* ---- 风场：基础风 + 多频阵风，均值≈0 保证静风时仍精确还原原画 ---- */
export function createWindField(config = {}) {
    return {
        /** 基础风速（会永久把头发吹偏一点，默认很小） */
        base: config.base ?? 0.12,
        /** 阵风振幅 */
        gust: config.gust ?? 1,
        /** 风向（屏幕坐标系，y 向下）。默认从画面左侧吹向右侧，顺着长发方向 */
        dirX: config.dirX ?? 0.94,
        dirY: config.dirY ?? -0.34,
        /** 阵风频率（Hz 量级）与湍流 */
        speed: config.speed ?? 1,
        turbulence: config.turbulence ?? 0.45,
        /** 风的总强度，用于滑杆/状态调节 */
        scale: config.scale ?? 1,
    };
}

/**
 * 采样当前风。三个不可通约的周期叠加 → 平滑但不重复的阵风。
 * @returns {{x:number,y:number,strength:number}} 世界空间风力（无量纲，单位与重力项一致）
 */
export function sampleWind(field, time) {
    if (!field || field.scale === 0) return { x: 0, y: 0, strength: 0 };
    const t = (time / 1000) * field.speed;
    // 主阵风 + 次级抖动 + 高频湍流；三个周期的比值接近无理数 → 长期不重复
    const gust = 0.62 * Math.sin(t * 0.62)
        + 0.26 * Math.sin(t * 1.37 + 1.1)
        + (field.turbulence * 0.18) * Math.sin(t * 3.11 + 2.3);
    const strength = (field.base + field.gust * gust) * field.scale;
    return { x: field.dirX * strength, y: field.dirY * strength, strength };
}

/**
 * 推进一条链的物理。
 *
 * 四个关键设计：
 *  1. 重力项写成 G·(cosθ − cosθ_rest)，在静止角处净力矩恒为 0，
 *     因此**中性姿态会精确还原原画**；偏离静止角后重力才把链往垂坠方向拉。
 *  2. 惯性由锚点的**加速度**驱动：a 在链法向上的分量产生角加速度，
 *     所以只有快速转身/受击这类动作才会甩动头发，缓慢呼吸不会。
 *  3. 串联耦合 coupling：子节点被父节点的偏离量带动，形成鞭状跟随。
 *  4. 风：切向分量 (cosθ·wy − sinθ·wx)/L 产生力矩；阵风均值≈0，
 *     所以静风时仍是原画姿态，起风时发梢才持续飘动。
 *
 * @param {number} anchorX 锚点当前世界位置（像素）
 * @param {{x:number,y:number}|null} wind 当前世界空间风力
 */
export function stepPhysicsChain(chain, dt, anchorX, anchorY, wind = null) {
    const step = Math.min(dt, 1 / 30);
    if (!(step > 0)) return chain;

    // 锚点速度/加速度（世界空间，像素）
    if (chain.prevAnchorX === null) {
        chain.prevAnchorX = anchorX; chain.prevAnchorY = anchorY;
        chain.anchorVX = 0; chain.anchorVY = 0;
    }
    const vx = (anchorX - chain.prevAnchorX) / step;
    const vy = (anchorY - chain.prevAnchorY) / step;
    let ax = (vx - chain.anchorVX) / step;
    let ay = (vy - chain.anchorVY) / step;
    chain.prevAnchorX = anchorX; chain.prevAnchorY = anchorY;
    chain.anchorVX = vx; chain.anchorVY = vy;
    // 限幅：极端帧间隔下不能把链甩飞
    const ACCEL_CAP = 4000;
    ax = clamp(ax, -ACCEL_CAP, ACCEL_CAP);
    ay = clamp(ay, -ACCEL_CAP, ACCEL_CAP);

    const nodeCount = chain.nodes.length;
    chain.angularVelocity = chain.bendVelocity;
    // 逐节积分相对弯曲量；prefix 是上游弯曲的累计传递量
    let prefix = 0;
    for (let i = 0; i < nodeCount; i++) {
        const rest = chain.restAngles[i];
        const bend = chain.bend[i];
        const absolute = rest + prefix + bend;
        const tx = Math.cos(absolute), ty = Math.sin(absolute);
        const length = Math.max(chain.lengths[i], 1);
        // 沿链递减的刚度：根部稳住，梢部柔顺
        const stiffness = chain.stiffness * Math.pow(chain.stiffnessFalloff, i);
        const spring = -stiffness * bend;
        const damping = -chain.damping * chain.bendVelocity[i];
        const gravity = chain.gravityStrength * (Math.cos(absolute) - Math.cos(rest));
        // 伪力 -a 的切向分量 / 力臂
        const inertia = ((-ax * ty + ay * tx) / length) * chain.inertia;
        // 风：切向分量。迎风面积越大越明显
        const windTorque = wind
            ? ((tx * wind.y - ty * wind.x) / length) * chain.windArea * WIND_TORQUE_SCALE
            : 0;
        chain.bendVelocity[i] += (spring + damping + gravity + inertia + windTorque) * step;
        chain.bend[i] += chain.bendVelocity[i] * step;
        const limit = chain.bendLimit;
        const clamped = clamp(chain.bend[i], -limit, limit);
        if (clamped !== chain.bend[i]) { chain.bend[i] = clamped; chain.bendVelocity[i] *= 0.4; }
        prefix += chain.bend[i] * chain.coupling;
    }
    return chain;
}

/** 风力的力矩换算系数：把无量纲风力换算到与重力项同一量级 */
const WIND_TORQUE_SCALE = 240;

/**
 * 由 bend 积分状态重算节点世界位置。
 * 绝对角 = restAngle[i] + Σ_{j<i} bend[j]·coupling + bend[i]
 * —— 上游弯曲通过这个求和自动带动下游，形成鞭状跟随。
 */
export function resolvePhysicsChain(chain, anchorX, anchorY) {
    let x = anchorX, y = anchorY;
    let prefix = 0;
    for (let i = 0; i < chain.nodes.length; i++) {
        const absolute = chain.restAngles[i] + prefix + chain.bend[i];
        chain.angle[i] = absolute;
        x += Math.cos(absolute) * chain.lengths[i];
        y += Math.sin(absolute) * chain.lengths[i];
        chain.nodes[i].x = x;
        chain.nodes[i].y = y;
        prefix += chain.bend[i] * chain.coupling;
    }
    chain.tipX = x;
    chain.tipY = y;
    return chain;
}

/* ------------------------------------------------------------------ *
 * 6. 组合：一次完整的模型求值
 * ------------------------------------------------------------------ */

/**
 * @param {object} model { mesh, skeleton, skinning, chains }
 * @param {object} params 姿态参数（见 controller-mesh-model.js 的 PARAM_NAMES）
 * @param {object} ctx { dt, anchorMotion:{x,y} }
 * @returns {{positions:Float32Array, pose:object, chains:Array}}
 */
export function evaluateModel(model, params, ctx, out) {
    const { skeleton, mesh, skinning, chains } = model;
    const pose = model.pose;
    resetPoseState(pose);
    applyPoseParameters(skeleton, pose, params);

    // 1) 先解算不带物理的骨架，拿到锚点位置
    solveSkeleton(skeleton, pose);

    // 2) 推进弹簧链，并把链节点位置精确写回链骨骼
    const dt = ctx?.dt ?? 1 / 60;
    for (const chain of chains) {
        const anchorIndex = chain.anchor;
        const anchorPivotX = pose.worldPivot[anchorIndex * 2];
        const anchorPivotY = pose.worldPivot[anchorIndex * 2 + 1];
        // 每条链按自己的相位采样风，避免所有发束整齐划一地摆（那是最像"假"的地方）
        const chainWind = ctx?.wind
            ? {
                x: ctx.wind.x * (1 + 0.35 * Math.sin((ctx.time ?? 0) / 740 + chain.phase)),
                y: ctx.wind.y * (1 + 0.35 * Math.cos((ctx.time ?? 0) / 910 + chain.phase)),
            }
            : null;
        stepPhysicsChain(chain, dt, anchorPivotX, anchorPivotY, chainWind);
        resolvePhysicsChain(chain, anchorPivotX, anchorPivotY);
        for (let i = 0; i < chain.nodes.length; i++) {
            const boneIndex = skeleton.byName.get(`${chain.name}${i}`);
            if (boneIndex === undefined) continue;
            const bone = skeleton.bones[boneIndex];
            const parentIndex = bone.parentIndex;
            // 链骨骼只有平移（无旋转/缩放），世界枢轴 = M_parent · (o + dt)
            // ⇒ dt = M_parent⁻¹(target) − o
            if (parentIndex < 0) continue;
            const parentMatrix = pose.matrices[parentIndex];
            const inverse = affineInvert(parentMatrix);
            const target = affineApply(inverse, chain.nodes[i].x, chain.nodes[i].y);
            const parentBone = skeleton.bones[parentIndex];
            pose.translateX[boneIndex] = target[0] - (bone.x - parentBone.x);
            pose.translateY[boneIndex] = target[1] - (bone.y - parentBone.y);
        }
    }
    if (chains.length) solveSkeleton(skeleton, pose);

    // 3) 蒙皮
    const positions = deformMesh(mesh, skinning, pose, out);
    return { positions, pose, chains };
}

/** 由参数名取骨骼索引的缓存（每个骨架一份） */
const boneIndexCache = new WeakMap();
function boneIndex(skeleton, name) {
    let cache = boneIndexCache.get(skeleton);
    if (!cache) { cache = new Map(); boneIndexCache.set(skeleton, cache); }
    if (cache.has(name)) return cache.get(name);
    const index = skeleton.byName.has(name) ? skeleton.byName.get(name) : -1;
    cache.set(name, index);
    return index;
}

/**
 * 把一组语义参数写进姿态状态。参数含义见 controller-mesh-model.js。
 * 所有参数都归一化到大致 [-1,1] 或 [0,1]，便于动画曲线复用。
 */
export function applyPoseParameters(skeleton, pose, p = {}) {
    const box = skeleton.box;
    const setRotate = (name, value) => { const i = boneIndex(skeleton, name); if (i >= 0) pose.rotate[i] += value; };
    const setTranslate = (name, x, y) => {
        const i = boneIndex(skeleton, name);
        if (i < 0) return;
        pose.translateX[i] += x; pose.translateY[i] += y;
    };
    const setScale = (name, sx, sy) => {
        const i = boneIndex(skeleton, name);
        if (i < 0) return;
        pose.scaleX[i] *= sx; pose.scaleY[i] *= sy;
    };
    const setShear = (name, k) => { const i = boneIndex(skeleton, name); if (i >= 0) pose.shearX[i] += k; };

    const rootY = (p.rootY ?? 0) * box.boxH;
    const rootX = (p.rootX ?? 0) * box.boxW;
    const breath = p.breath ?? 0;
    const lean = p.lean ?? 0;
    const sway = p.sway ?? 0;
    const headTurn = p.headTurn ?? 0;
    const headTilt = p.headTilt ?? 0;
    const headNod = p.headNod ?? 0;
    const bodyLift = p.bodyLift ?? 0;
    const squash = p.squash ?? 0;
    const armSwing = p.armSwing ?? 0;
    const scale = p.scale ?? 1;
    // 角色专属动作用的独立通道（左右臂分开、身体扭转、重心偏移）
    const armLiftL = p.armLiftL ?? 0;
    const armLiftR = p.armLiftR ?? 0;
    const armSwingL = p.armSwingL ?? 0;
    const armSwingR = p.armSwingR ?? 0;
    const bodyTwist = p.bodyTwist ?? 0;
    const hipShift = p.hipShift ?? 0;
    const chestLift = p.chestLift ?? 0;
    const propTurn = p.propTurn ?? 0;

    // 根：整体位移 / 轻微摇摆 / 低 LP 下沉
    setTranslate("root", rootX + sway * box.boxW * 0.012, rootY - bodyLift * box.boxH * 0.006);
    setRotate("root", sway * 0.012);
    if (scale !== 1) setScale("root", scale, scale);

    // 脊柱：呼吸 + 前倾 + 身体扭转。
    // 呼吸用**等比**缩放：非等比缩放会沿骨骼链传给头部，让脸跟着变形。
    // 改成等比之后，整个骨架在任何姿态下都只做刚性变换
    // （平移 / 旋转 / 等比缩放），原画比例在数学上不可能被改变。
    setScale("spine", 1 + breath * 0.005, 1 + breath * 0.005);
    setTranslate("spine", 0, -breath * box.boxH * 0.0022);
    setRotate("spine", lean * 0.05);
    setRotate("chest", lean * 0.045 + squash * 0.03);
    setScale("chest", 1 + breath * 0.009, 1 + breath * 0.009);
    if (bodyTwist) {
        // 不再用剪切（skew）假装绕身体纵轴扭转：剪切和横向压缩一样会改变
        // 原画比例。扭转只由旋转 + 位移表达，幅度调大一点补回可读性。
        setRotate("chest", bodyTwist * 0.055);
        setTranslate("chest", bodyTwist * box.boxW * 0.010, 0);
    }
    if (chestLift) setTranslate("chest", 0, -chestLift * box.boxH * 0.008);
    // 重心偏移：胯部左右移动 + 反向的根节点微移，看起来像换腿承重
    if (hipShift) {
        setTranslate("root", hipShift * box.boxW * 0.016, 0);
        setRotate("legL", hipShift * 0.03);
        setRotate("legR", hipShift * 0.03);
    }

    // 头：转向 = 绕颈部枢轴旋转 + 整体平移（颈/胸小幅跟随）。
    // 早期版本用 scaleX 横向压扁来假装 3D 转头，对一张平涂插画来说那就是把图
    // 物理压扁：turn=0.85 时头部宽度只剩 0.81，比例失真一眼可见，已移除。
    // 现在只有刚性变换（旋转 + 平移），任何姿态下原画比例都严格保持 1:1。
    const turn = clamp(headTurn, -1.2, 1.2);
    if (turn !== 0) {
        setRotate("head", turn * 0.155);
        setTranslate("head", turn * box.boxW * 0.024, 0);
        // 颈部/胸腔跟随一点点，让转向像躯干带动的，而不是头单独平移
        setRotate("chest", turn * 0.030);
        setTranslate("chest", turn * box.boxW * 0.007, 0);
    }
    setRotate("head", headTilt * 0.10 + lean * 0.02 + headNod * 0.05 - bodyTwist * 0.03);
    setTranslate("head", 0, headNod * box.boxH * 0.012);

    // 手臂（只有参考图上确实分得开的角色才配 arm 骨骼）
    // 手臂抬起用「缩短 + 上移」近似：合图没有肩关节分层，抬起只能这样表达
    setRotate("armL", -armSwing * 0.09 - armSwingL * 0.10 - armLiftL * 0.30);
    setRotate("armR", armSwing * 0.09 + armSwingR * 0.10 + armLiftR * 0.30);
    setRotate("forearmL", -armSwing * 0.05 - armSwingL * 0.06 - armLiftL * 0.22);
    setRotate("forearmR", armSwing * 0.05 + armSwingR * 0.06 + armLiftR * 0.22);
    if (armLiftL) {
        setTranslate("armL", -armLiftL * box.boxW * 0.014, -armLiftL * box.boxH * 0.020);
        setTranslate("forearmL", -armLiftL * box.boxW * 0.012, -armLiftL * box.boxH * 0.026);
    }
    if (armLiftR) {
        setTranslate("armR", armLiftR * box.boxW * 0.014, -armLiftR * box.boxH * 0.020);
        setTranslate("forearmR", armLiftR * box.boxW * 0.012, -armLiftR * box.boxH * 0.026);
    }
    // 手持道具（画板 / 卡牌）单独微调，做「查看」「展示」这类动作
    if (propTurn) {
        setRotate("board", propTurn * 0.05);
        setTranslate("board", propTurn * box.boxW * 0.012, -propTurn * box.boxH * 0.010);
        setRotate("card", propTurn * 0.06);
        setTranslate("card", propTurn * box.boxW * 0.010, -propTurn * box.boxH * 0.012);
    }
}
