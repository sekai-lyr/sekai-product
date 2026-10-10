/**
 * controller-rigs.js — 角色 2D 模型绑定（骨架 / 蒙皮 / 次级运动）
 *
 * 坐标系：归一化 **alpha 包围盒** 坐标 (0..1, y 向下)。
 *   这样同一份 rig 不受原画四周留白影响；换一张同构图的分辨率版本不用改 rig。
 *   标定方法见 SekaiGame/tools/analyze-controller-art.mjs（输出行剖面 + ASCII 剪影 + 候选地标），
 *   以及 SekaiGame/tools/render-controller-mesh.mjs（把骨架与网格叠在原画上输出 PNG 供目视校准）。
 *
 * 约束：本模块只描述形变，不改变原画本身。所有数值都可以单独调，
 *       调完直接跑 render-controller-mesh.mjs 看叠加图即可。
 */

import {
    buildMeshFromAlpha,
    computeSkinWeights,
    createPhysicsChain,
    createPoseState,
    createSkeleton,
    smoothSkinWeights,
    DEFAULT_MESH_OPTIONS,
} from "./controller-mesh.js";

/** 一条链会展开成若干骨骼：<name>0 挂在 parent 上，之后逐节相连。 */
export function expandRig(rig) {
    const bones = (rig.bones || []).map(bone => ({ ...bone }));
    const names = new Set(bones.map(bone => bone.name));
    const chains = [];
    for (const chain of rig.chains || []) {
        const nodes = chain.nodes || [];
        const nodeRadius = chain.nodeRadius ?? 0.06;
        const spec = { ...chain, radius: nodeRadius, nodeCount: nodes.length, generated: [] };
        let parent = chain.parent;
        for (let i = 0; i < nodes.length; i++) {
            const name = `${chain.name}${i}`;
            if (names.has(name)) throw new Error(`expandRig: 骨骼名冲突 ${name}`);
            names.add(name);
            const next = nodes[i + 1];
            bones.push({
                name,
                parent,
                x: nodes[i][0],
                y: nodes[i][1],
                tip: next ? [next[0], next[1]] : undefined,
                radius: nodeRadius * (chain.radiusScale?.[i] ?? 1),
                kind: "chain",
                rect: chain.rect,
                rectSoft: chain.rectSoft,
            });
            spec.generated.push(name);
            parent = name;
        }
        chains.push(spec);
    }
    return { bones, chains };
}

/**
 * 装配一个可渲染的角色模型。
 * @param {object} rig expandRig 之前的原始 rig
 * @param {{width:number,height:number,data:Uint8Array}} image RGBA
 */
export function buildControllerModel(rig, image, options = {}) {
    const meshOptions = { ...DEFAULT_MESH_OPTIONS, ...(rig.mesh || {}), ...(options.mesh || {}) };
    const mesh = buildMeshFromAlpha(image, meshOptions);
    const expanded = expandRig(rig);
    const skeleton = createSkeleton(expanded, mesh);
    const rawSkinning = computeSkinWeights(mesh, skeleton, { ...(rig.skin || {}), ...(options.skin || {}) });
    // 权重平滑：压掉骨骼影响边界上的权重跳变，避免形变时三角形互相穿插
    const skinning = smoothSkinWeights(mesh, rawSkinning, {
        iterations: rig.skin?.smoothIterations ?? 4,
        lambda: rig.skin?.smoothLambda ?? 0.6,
        ...(options.smoothing || {}),
    });
    const chains = expanded.chains.map(spec => createPhysicsChain(spec, skeleton, mesh));
    const pose = createPoseState(skeleton);
    return {
        rig,
        mesh,
        skeleton,
        skinning,
        chains,
        pose,
        /** 变形输出缓冲区（每帧复用，避免 GC） */
        positions: new Float32Array(mesh.vertexCount * 2),
        stats: {
            vertices: mesh.vertexCount,
            triangles: mesh.triangleCount,
            bones: skeleton.bones.length,
            chains: chains.length,
            cells: `${mesh.cols}×${mesh.rows}`,
        },
    };
}

/* ================================================================== *
 * 次级运动调参：串联耦合 + 沿链变刚度 + 迎风面积 + 独立相位
 *   coupling          父节点带动子节点的强度，做出鞭状跟随（0=各弹各的）
 *   stiffnessFalloff  沿链递减的刚度系数，根部稳、梢部软
 *   windArea          迎风面积，宽的衣摆比细发丝更吃风
 *   phase             每条链独立的相位偏移，避免所有发束整齐划一地摆
 * ================================================================== */
const HAIR_TUNING = { coupling: 0.78, stiffnessFalloff: 0.88, windArea: 1.15 };
const FINE_HAIR_TUNING = { coupling: 0.74, stiffnessFalloff: 0.90, windArea: 1.0 };
const CLOTH_TUNING = { coupling: 0.58, stiffnessFalloff: 0.84, windArea: 0.62 };

/** 角色专属动作的公共片段：甩发用的风爆 + 头部快摆 */
const windBurstKeys = (amount = 2.6) => ({
    headTilt: 0, hairBurst: amount,
});

/* ================================================================== *
 * CONTROLLER 01 · blue-01（1086×1448，alpha 包围盒 1010×1429）
 * 蓝发少年：高领灰毛衣 + 深灰大衣披肩 + 十字架项链 + 右手插兜 + 左手拿画板
 * ================================================================== */
const BLUE_01 = {
    mesh: { cell: 9, cullSamples: 3 },
    // 平滑轮数从 8 提到 32：紧凑支撑核的权重跳变会让「发丝/外套摆（只做平移）
    // 与躯干骨骼（几乎不动）」的混合顶点被拉扯，表现为低头/前倾时头发被压扁。
    // 32 轮把发丝各向异性中位数从 1.096 压到 1.000、外套摆 p95 从 2.30 压到 1.50，
    // 而发梢滞后与位移几乎不变（52.9→52.8px / 179.4→176.3px）。建模耗时约 +190ms。
    skin: { falloff: 2.0, smoothIterations: 32, smoothLambda: 0.85 },
    /** 风：从左下方吹来，顺着长发方向；长发是主要受力件 */
    wind: { base: 0.16, gust: 1.0, dirX: 0.93, dirY: -0.30, speed: 0.9, turbulence: 0.5, scale: 1 },
    bones: [
        // 躯干链（半径刻意放大：这些骨骼必须铺满整个人体，否则顶点会回退到
        // 距离最近的链骨骼上，出现“腿被大衣下摆拽走”这类穿帮）
        { name: "root", parent: null, x: 0.435, y: 0.660, radius: 0.32 },
        { name: "spine", parent: "root", x: 0.415, y: 0.545, radius: 0.26 },
        { name: "chest", parent: "spine", x: 0.400, y: 0.400, radius: 0.30 },
        { name: "neck", parent: "chest", x: 0.378, y: 0.295, radius: 0.095 },
        { name: "head", parent: "neck", x: 0.375, y: 0.238, tip: [0.345, 0.045], radius: 0.20 },
        // 下肢：原画到膝盖附近，没有这两根骨骼时大腿会被大衣下摆抢走
        { name: "legL", parent: "root", x: 0.372, y: 0.790, tip: [0.358, 0.985], radius: 0.20 },
        { name: "legR", parent: "root", x: 0.556, y: 0.782, tip: [0.566, 0.985], radius: 0.20 },
        // 手臂：armL = 画面左侧（角色右手，插兜），armR = 画面右侧（角色左手，托画板）
        { name: "armL", parent: "chest", x: 0.280, y: 0.335, tip: [0.302, 0.470], radius: 0.100 },
        { name: "forearmL", parent: "armL", x: 0.302, y: 0.470, tip: [0.345, 0.620], radius: 0.090 },
        { name: "armR", parent: "chest", x: 0.500, y: 0.335, tip: [0.600, 0.465], radius: 0.100 },
        { name: "forearmR", parent: "armR", x: 0.600, y: 0.465, tip: [0.745, 0.620], radius: 0.090 },
        // 画板（硬质道具）：整块刚性，随托举它的左手一起动
        { name: "board", parent: "forearmR", x: 0.800, y: 0.720, radius: 0.30, rect: [0.655, 0.565, 1.00, 0.955], rectSoft: 0.05 },
    ],
    chains: [
        // 右侧飘散的长发（画面上方那束）
        { name: "hairA", parent: "head", nodeRadius: 0.055, stiffness: 56, damping: 8.4, gravity: 300, phase: 0.0, ...HAIR_TUNING,
          nodes: [[0.440, 0.145], [0.570, 0.175], [0.700, 0.235], [0.820, 0.315], [0.910, 0.420]] },
        // 右侧长发（中束）
        { name: "hairB", parent: "head", nodeRadius: 0.055, stiffness: 60, damping: 8.8, gravity: 300, phase: 1.7, ...HAIR_TUNING,
          nodes: [[0.430, 0.215], [0.550, 0.270], [0.660, 0.345], [0.760, 0.430], [0.850, 0.505]] },
        // 画面左侧垂到胸前的发丝
        { name: "hairC", parent: "head", nodeRadius: 0.050, stiffness: 62, damping: 9.2, gravity: 260, phase: 3.1, ...FINE_HAIR_TUNING,
          nodes: [[0.300, 0.235], [0.276, 0.355], [0.262, 0.470], [0.270, 0.572]] },
        // 脸侧前发
        { name: "hairD", parent: "head", nodeRadius: 0.046, stiffness: 66, damping: 9.6, gravity: 260, phase: 4.6, ...FINE_HAIR_TUNING,
          nodes: [[0.378, 0.250], [0.358, 0.372], [0.348, 0.492], [0.354, 0.606]] },
        // 左肩披着的大衣下摆（只覆盖画面左侧那块布料，用 rect 防止拽到腿）
        { name: "coatA", parent: "chest", nodeRadius: 0.062, stiffness: 38, damping: 6.6, gravity: 340, phase: 2.4, ...CLOTH_TUNING,
          rect: [0.00, 0.33, 0.33, 0.92], rectSoft: 0.02,
          nodes: [[0.205, 0.395], [0.148, 0.520], [0.136, 0.650], [0.186, 0.780]] },
    ],
    /**
     * 角色专属动作：idle 时会随机穿插播放，也可以在标定预览页手动触发。
     * weight 是随机抽取权重（0 = 不随机播放，只手动触发）。
     */
    ambient: [
        {
            name: "wave", label: "抬手致意", duration: 2300, weight: 1.0,
            keys: [
                { t: 0, p: {} },
                { t: 0.18, p: { armLiftL: 0.55, armSwingL: 0.4, chestLift: 0.25, headNod: 0.25 } },
                { t: 0.34, p: { armLiftL: 1.0, armSwingL: 0.7, chestLift: 0.4, headNod: 0.1, bodyTwist: 0.2 } },
                { t: 0.52, p: { armLiftL: 0.9, armSwingL: -0.35, chestLift: 0.35, headTilt: 0.2 } },
                { t: 0.68, p: { armLiftL: 1.0, armSwingL: 0.5, chestLift: 0.4, headTilt: 0.1 } },
                { t: 0.84, p: { armLiftL: 0.4, armSwingL: 0.1, chestLift: 0.15 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "boardCheck", label: "查看画板", duration: 2600, weight: 1.0,
            keys: [
                { t: 0, p: {} },
                { t: 0.22, p: { headNod: 0.85, headTurn: 0.45, lean: 0.3, propTurn: -0.5, armLiftR: 0.2, chestLift: -0.2 } },
                { t: 0.6, p: { headNod: 0.95, headTurn: 0.55, lean: 0.35, propTurn: -0.35, armLiftR: 0.25, headTilt: 0.15 } },
                { t: 0.82, p: { headNod: 0.4, headTurn: 0.2, lean: 0.15, propTurn: -0.1 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "think", label: "抱臂沉思", duration: 3000, weight: 0.85,
            keys: [
                { t: 0, p: {} },
                { t: 0.25, p: { lean: -0.25, headTilt: 0.45, headNod: -0.2, hipShift: 0.55, chestLift: 0.2, armSwingL: -0.3, armSwingR: 0.25 } },
                { t: 0.7, p: { lean: -0.3, headTilt: 0.55, headNod: -0.15, hipShift: 0.5, chestLift: 0.25, headTurn: -0.2 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "lookAround", label: "侧望扫视", duration: 3200, weight: 0.9,
            keys: [
                { t: 0, p: {} },
                { t: 0.2, p: { headTurn: 0.85, bodyTwist: 0.35, headTilt: 0.15 } },
                { t: 0.45, p: { headTurn: 0.6, bodyTwist: 0.25, headNod: -0.1 } },
                { t: 0.7, p: { headTurn: -0.8, bodyTwist: -0.4, headTilt: -0.2 } },
                { t: 0.88, p: { headTurn: -0.2, bodyTwist: -0.1 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "hairFlip", label: "甩发", duration: 1500, weight: 0.7,
            keys: [
                { t: 0, p: {} },
                { t: 0.14, p: { headTilt: -0.8, headTurn: -0.35, bodyTwist: -0.3, hairBurst: 2.8 } },
                { t: 0.34, p: { headTilt: 0.85, headTurn: 0.45, bodyTwist: 0.35, hairBurst: 3.4 } },
                { t: 0.55, p: { headTilt: -0.35, headTurn: -0.15, hairBurst: 1.6 } },
                { t: 0.75, p: { headTilt: 0.18, hairBurst: 0.5 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "nod", label: "点头确认", duration: 1200, weight: 0.8,
            keys: [
                { t: 0, p: {} },
                { t: 0.2, p: { headNod: 0.55, chestLift: 0.1 } },
                { t: 0.42, p: { headNod: -0.18 } },
                { t: 0.62, p: { headNod: 0.32 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "shiftWeight", label: "换重心", duration: 2400, weight: 0.6,
            keys: [
                { t: 0, p: {} },
                { t: 0.3, p: { hipShift: 0.85, sway: 0.3, headTilt: 0.12 } },
                { t: 0.62, p: { hipShift: -0.6, sway: -0.25, headTilt: -0.1 } },
                { t: 1, p: {} },
            ],
        },
    ],
};

/* ================================================================== *
 * CONTROLLER 02 · lucia（1024×1536，alpha 包围盒 1024×1525）
 * 深蓝短发（含青色挑染）+ 黑色金饰军装外套 + 青色纱袖 + 右手持卡上举
 * ================================================================== */
const LUCIA = {
    mesh: { cell: 9, cullSamples: 3 },
    // 同一类问题的另一个极端：lucia 的发束短、离躯干近，紧凑支撑核的权重跳变
    // 本来就比她 blue-01 轻（发丝各向异性中位数一开始就是 1.000），
    // 但她的发梢分到的链权重也少得多 —— 平滑越重、风吹摆幅掉得越快
    // （32/λ0.85 时摆幅从 21.8px 掉到 8.8px，就快"头发变呆"了）。
    // 所以这里只取 16/λ0.75：压扁指标仍有明显改善（p95 3.89→3.12，
    // >1.5 的比例 27.1%→15.4%），摆幅保住 15.1px。
    skin: { falloff: 2.0, smoothIterations: 16, smoothLambda: 0.75 },
    /** 风：同样从左向右，但她的纱袖与外套更吃风，发束短所以发丝受力小 */
    wind: { base: 0.18, gust: 1.05, dirX: 0.90, dirY: -0.42, speed: 1.05, turbulence: 0.55, scale: 1 },
    bones: [
        { name: "root", parent: null, x: 0.575, y: 0.635, radius: 0.32 },
        { name: "spine", parent: "root", x: 0.592, y: 0.510, radius: 0.26 },
        { name: "chest", parent: "spine", x: 0.600, y: 0.390, radius: 0.30 },
        { name: "neck", parent: "chest", x: 0.592, y: 0.258, radius: 0.090 },
        { name: "head", parent: "neck", x: 0.596, y: 0.200, tip: [0.598, 0.030], radius: 0.19 },
        { name: "legL", parent: "root", x: 0.510, y: 0.760, tip: [0.480, 0.985], radius: 0.20 },
        { name: "legR", parent: "root", x: 0.660, y: 0.760, tip: [0.690, 0.985], radius: 0.20 },
        // armL = 画面左侧（自然下垂），armR = 画面右侧（屈肘上举持卡）
        { name: "armL", parent: "chest", x: 0.472, y: 0.312, tip: [0.392, 0.480], radius: 0.095 },
        { name: "forearmL", parent: "armL", x: 0.392, y: 0.480, tip: [0.205, 0.726], radius: 0.090 },
        { name: "handL", parent: "forearmL", x: 0.205, y: 0.726, tip: [0.165, 0.800], radius: 0.070 },
        { name: "armR", parent: "chest", x: 0.720, y: 0.305, tip: [0.772, 0.402], radius: 0.095 },
        { name: "forearmR", parent: "armR", x: 0.772, y: 0.402, tip: [0.845, 0.295], radius: 0.085 },
        // 手持的卡牌（小道具，硬质）
        { name: "card", parent: "forearmR", x: 0.855, y: 0.245, radius: 0.11, rect: [0.780, 0.150, 0.940, 0.320], rectSoft: 0.015 },
    ],
    chains: [
        { name: "hairA", parent: "head", nodeRadius: 0.045, stiffness: 50, damping: 8.0, gravity: 280, phase: 0.0, ...FINE_HAIR_TUNING,
          nodes: [[0.462, 0.200], [0.418, 0.310], [0.398, 0.420], [0.408, 0.520]] },
        { name: "hairB", parent: "head", nodeRadius: 0.045, stiffness: 54, damping: 8.4, gravity: 280, phase: 2.2, ...FINE_HAIR_TUNING,
          nodes: [[0.736, 0.165], [0.788, 0.245], [0.806, 0.336]] },
        // 青色纱袖：轻、面积大，风一吹就很明显
        { name: "coatA", parent: "forearmL", nodeRadius: 0.058, stiffness: 34, damping: 6.2, gravity: 300, phase: 1.1,
          coupling: 0.66, stiffnessFalloff: 0.86, windArea: 1.35,
          rect: [0.05, 0.45, 0.45, 0.88], rectSoft: 0.02,
          nodes: [[0.300, 0.560], [0.222, 0.668], [0.186, 0.762]] },
        { name: "frillA", parent: "forearmR", nodeRadius: 0.050, stiffness: 40, damping: 6.8, gravity: 320, phase: 3.4,
          coupling: 0.66, stiffnessFalloff: 0.86, windArea: 1.25,
          rect: [0.75, 0.33, 1.00, 0.65], rectSoft: 0.02,
          nodes: [[0.840, 0.400], [0.884, 0.470], [0.892, 0.548]] },
    ],
    ambient: [
        {
            name: "cardShow", label: "展示卡牌", duration: 2400, weight: 1.0,
            keys: [
                { t: 0, p: {} },
                { t: 0.24, p: { armLiftR: 0.7, propTurn: 0.9, headTurn: 0.35, headNod: -0.3, chestLift: 0.25 } },
                { t: 0.55, p: { armLiftR: 0.85, propTurn: 1.0, headTurn: 0.45, headNod: -0.35, headTilt: 0.2, bodyTwist: 0.25 } },
                { t: 0.8, p: { armLiftR: 0.35, propTurn: 0.3, headNod: -0.1 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "think", label: "侧首沉思", duration: 2900, weight: 0.9,
            keys: [
                { t: 0, p: {} },
                { t: 0.26, p: { headTilt: -0.6, headTurn: -0.3, lean: 0.22, hipShift: -0.5, armSwingL: -0.25 } },
                { t: 0.68, p: { headTilt: -0.7, headTurn: -0.4, lean: 0.28, hipShift: -0.55, chestLift: 0.15 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "lookAround", label: "侧望扫视", duration: 3200, weight: 0.9,
            keys: [
                { t: 0, p: {} },
                { t: 0.22, p: { headTurn: -0.85, bodyTwist: -0.4, headTilt: -0.15 } },
                { t: 0.48, p: { headTurn: -0.5, bodyTwist: -0.2, headNod: 0.1 } },
                { t: 0.72, p: { headTurn: 0.8, bodyTwist: 0.35, headTilt: 0.18 } },
                { t: 0.9, p: { headTurn: 0.2, bodyTwist: 0.1 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "hairFlip", label: "甩发", duration: 1500, weight: 0.75,
            keys: [
                { t: 0, p: {} },
                { t: 0.14, p: { headTilt: 0.8, headTurn: 0.3, bodyTwist: 0.3, hairBurst: 2.6 } },
                { t: 0.34, p: { headTilt: -0.9, headTurn: -0.4, bodyTwist: -0.35, hairBurst: 3.2 } },
                { t: 0.56, p: { headTilt: 0.35, headTurn: 0.15, hairBurst: 1.4 } },
                { t: 0.76, p: { headTilt: -0.18, hairBurst: 0.4 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "nod", label: "点头确认", duration: 1200, weight: 0.8,
            keys: [
                { t: 0, p: {} },
                { t: 0.2, p: { headNod: 0.55, chestLift: 0.1 } },
                { t: 0.42, p: { headNod: -0.18 } },
                { t: 0.62, p: { headNod: 0.32 } },
                { t: 1, p: {} },
            ],
        },
        {
            name: "shiftWeight", label: "换重心", duration: 2400, weight: 0.6,
            keys: [
                { t: 0, p: {} },
                { t: 0.3, p: { hipShift: -0.8, sway: -0.3, headTilt: -0.12 } },
                { t: 0.62, p: { hipShift: 0.7, sway: 0.28, headTilt: 0.1 } },
                { t: 1, p: {} },
            ],
        },
    ],
};

export const CONTROLLER_RIGS = Object.freeze({
    "blue-01": BLUE_01,
    "lucia": LUCIA,
});

/** 取 rig；没有绑定的角色返回 null（调用方回退到静态图后端）。 */
export function getControllerRig(id) {
    return CONTROLLER_RIGS[id] || null;
}
