/**
 * controller-mesh-model.js — 自研 2D 人物模型的运行时驱动
 *
 * 职责：
 *   · 取角色原画的 ImageData，装配网格模型（controller-rigs.js）
 *   · 用一条与旧版 CSS 关键帧同源的动画时间线，把主控事件翻译成语义姿态参数
 *   · 每帧：参数 → 骨架 → 弹簧链 → 蒙皮 → WebGL 绘制
 *   · 页面隐藏 / 离开决斗时停 rAF，不留后台循环
 *
 * 与旧版的关系：
 *   旧版的 CSS 关键帧 + <img> 保留为「static 后端」不动。网格后端只是把角色
 *   那一层换成 canvas；光晕、铭牌、状态文字、抽卡光线、召唤环等 DOM 特效层
 *   全部沿用，所以这次升级不会推翻已经验收过的表现层。
 */

import { buildControllerModel } from "./controller-rigs.js";
import { evaluateModel, createWindField, sampleWind } from "./controller-mesh.js";
import { createMeshRenderer } from "./controller-mesh-gl.js";

/* ------------------------------------------------------------------ *
 * 姿态参数（全部是「相对 idle 的加法偏移」，动作结束后自然回到 idle）
 * ------------------------------------------------------------------ */

/** 一次性动作的时间线。t 为 0..1，与旧版 CSS 关键帧的节奏一一对应。 */
export const ACTION_MOTIONS = {
    link: {
        duration: 520,
        keys: [
            { t: 0, p: {} },
            { t: 0.38, p: { breath: 0.9, headTurn: 0.12 } },
            { t: 1, p: {} },
        ],
    },
    draw: {
        duration: 820,
        keys: [
            { t: 0, p: {} },
            { t: 0.28, p: { headTurn: 0.85, lean: 0.35, bodyLift: 0.9, headNod: -0.15 } },
            { t: 0.62, p: { headTurn: 0.35, lean: 0.12, bodyLift: 0.3 } },
            { t: 1, p: {} },
        ],
    },
    play: {
        duration: 700,
        keys: [
            { t: 0, p: {} },
            { t: 0.4, p: { lean: 0.45, armSwing: 0.35, breath: 0.5 } },
            { t: 1, p: {} },
        ],
    },
    summon: {
        duration: 1080,
        keys: [
            { t: 0, p: {} },
            { t: 0.26, p: { bodyLift: 2.2, breath: 0.9, lean: -0.2 } },
            { t: 0.58, p: { bodyLift: 1.1, breath: 0.5 } },
            { t: 1, p: {} },
        ],
    },
    spell: {
        duration: 960,
        keys: [
            { t: 0, p: {} },
            { t: 0.34, p: { headTurn: 0.3, lean: 0.35, bodyLift: 0.7, breath: 0.8 } },
            { t: 0.7, p: { lean: 0.15, breath: 0.35 } },
            { t: 1, p: {} },
        ],
    },
    trap: {
        duration: 860,
        keys: [
            { t: 0, p: {} },
            { t: 0.2, p: { rootX: -0.012, rootY: 0.004, lean: -0.55, headTilt: -0.45 } },
            { t: 0.52, p: { rootX: -0.007, lean: -0.3, headTilt: -0.2 } },
            { t: 1, p: {} },
        ],
    },
    attack: {
        duration: 620,
        keys: [
            { t: 0, p: {} },
            { t: 0.22, p: { rootX: 0.018, lean: 0.7, headNod: 0.35, armSwing: -0.6 } },
            { t: 0.46, p: { rootX: 0.008, lean: 0.3, armSwing: -0.25 } },
            { t: 1, p: {} },
        ],
    },
    hit: {
        duration: 560,
        keys: [
            { t: 0, p: {} },
            { t: 0.14, p: { rootX: -0.013, lean: -0.55, headTilt: -0.4, squash: 0.8 } },
            { t: 0.34, p: { rootX: -0.004, lean: -0.15, squash: 0.3 } },
            { t: 0.56, p: { rootX: -0.009, lean: -0.35, headTilt: -0.22, squash: 0.5 } },
            { t: 0.8, p: { rootX: -0.002, lean: -0.05 } },
            { t: 1, p: {} },
        ],
    },
    critical: {
        duration: 900,
        keys: [
            { t: 0, p: {} },
            { t: 0.26, p: { squash: 0.9, rootY: 0.0016, dim: 0.18 } },
            { t: 0.6, p: { breath: 0.7 } },
            { t: 1, p: {} },
        ],
    },
};

/** 保持最终姿态、直到新决斗开始的状态。 */
export const HOLD_STATES = {
    win: { rise: 1250, p: { bodyLift: 2.4, scale: 1.025, breath: 0.35, headNod: -0.25 } },
    lose: { rise: 1400, p: { rootY: 0.016, lean: 0.7, headNod: 0.9, scale: 0.985, dim: 0.42 } },
    drawGame: { rise: 1300, p: { dim: 0.3, lean: 0.3 } },
};

const PARAM_KEYS = [
    "breath", "lean", "sway", "headTurn", "headTilt", "headNod",
    "bodyLift", "squash", "armSwing", "rootX", "rootY", "dim",
    // 角色专属动作用的独立通道
    "armLiftL", "armLiftR", "armSwingL", "armSwingR",
    "bodyTwist", "hipShift", "chestLift", "propTurn", "hairBurst",
];

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

/** 在关键帧曲线上取值（线性插值 + 缓入缓出）。 */
function sampleKeys(keys, t) {
    if (!keys.length) return {};
    if (t <= keys[0].t) return keys[0].p;
    for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        if (t <= b.t) {
            const span = b.t - a.t || 1;
            const local = easeInOutSine(Math.min(1, Math.max(0, (t - a.t) / span)));
            const out = {};
            for (const key of PARAM_KEYS) {
                const av = a.p[key] ?? 0, bv = b.p[key] ?? 0;
                if (av || bv) out[key] = lerp(av, bv, local);
            }
            return out;
        }
    }
    return keys[keys.length - 1].p;
}

/**
 * idle：与旧版 CSS 关键帧同源的呼吸 + 浮动(≤6px) + 极轻旋转 + 长停顿。
 * cycle 的前 44% 完成一次呼吸，之后保持静止 —— 这就是「随机停顿」的来源，
 * 再叠两条周期不可通约的慢速曲线（身体重心游移 / 头部微动），
 * 三者永远不同步，所以看不出机械循环。
 */
function idleParams(time, motion) {
    const cycle = motion.cycle;
    const phase = ((time % cycle) + cycle) % cycle / cycle;
    const active = 0.44;
    const u = Math.min(1, phase / active);
    const raw = u < 1 ? 0.5 - 0.5 * Math.cos(u * Math.PI * 2) : 0;
    // 三个不可通约的周期：既能各自平滑，又不会长期重复
    const slow = Math.sin((time / (cycle * 1.7)) * Math.PI * 2);
    const drift = Math.sin((time / (cycle * 2.63)) * Math.PI * 2 + 1.3);
    const micro = Math.sin((time / 3170) * Math.PI * 2 + 0.7) * Math.sin((time / 8110) * Math.PI * 2);
    return {
        breath: raw,
        rootY: (-raw * motion.float) / motion.boxH,
        sway: slow * 0.32 + raw * 0.12 + drift * 0.10,
        headTilt: slow * 0.10 + micro * 0.06,
        hipShift: drift * 0.16,
        bodyTwist: drift * 0.07 + micro * 0.03,
    };
}

/* ------------------------------------------------------------------ *
 * 运行时
 * ------------------------------------------------------------------ */

/**
 * 纯函数：把模型内部状态合成为一帧的姿态参数。
 *
 * 抽出来是为了**可单测**：jsdom 的 rAF 只有个位数帧率，高频颤抖（2~4Hz）
 * 在里面会严重混叠，测不出真伪；把它做成纯函数就能在 Node 里按 60fps
 * 确定性推进，直接断言颤抖幅度、优先级叠加。
 *
 * 叠加顺序（后写的优先级更高，但都是**相加**而不是替换，所以持续状态不会被抹掉）：
 *   idle → 低 LP（呼吸加快 + 颤抖）→ 一次性动作 / 专属动作 → 结算保持 → 预览覆盖
 */
export function composePoseParams(state, motion, context, now) {
    const reducedMotion = !!context?.reducedMotion;
    const ambientByName = context?.ambientByName || new Map();
    const params = idleParams(state.time, motion);
    if (reducedMotion) {
        params.breath = 0;
        params.sway = 0;
        params.headTilt = 0;
        params.rootY = 0;
    }
    // 低 LP：呼吸加快（周期缩短），这里用二次谐波近似，避免改 cycle 造成跳变
    if (state.lowHp && !reducedMotion) {
        params.breath = Math.min(1, params.breath + 0.35 * (0.5 - 0.5 * Math.cos((state.time / (motion.cycle * 0.5)) * Math.PI * 2)));
        // 持续颤抖：2~4Hz 的细碎抖动。是**持续状态**，与一次性动作相加而不抢占，
        // 所以受击时会在受击姿态上再叠一层抖。
        const t = state.time / 1000;
        const amount = state.lowHpRamp ?? 1;
        params.headTilt = (params.headTilt ?? 0) + Math.sin(t * 21.3) * 0.055 * amount;
        params.headNod = (params.headNod ?? 0) + Math.sin(t * 25.9 + 2.2) * 0.022 * amount;
        params.sway = (params.sway ?? 0) + Math.sin(t * 17.7 + 1.1) * 0.10 * amount;
        params.rootX = (params.rootX ?? 0) + Math.sin(t * 13.1 + 0.4) * 0.0016 * amount;
    }
    // 视线跟随指针已移除：它对一张平涂插画只能靠压扁头部来假装 3D 转头，
    // 玩家会看到原画被物理压缩，比例失真。主控现在只响应真实游戏事件。
    // 一次性动作（游戏事件）。开始播放游戏动作时立即取消正在进行的专属动作，
    // 避免两套姿态叠加成鬼畜。
    if (state.action) {
        const t = Math.min(1, (now - state.actionStart) / Math.max(1, state.actionDuration));
        const offset = sampleKeys(ACTION_MOTIONS[state.action]?.keys || [], t);
        const scale = reducedMotion ? 0.5 : 1;
        for (const key of PARAM_KEYS) {
            if (offset[key]) params[key] = (params[key] ?? 0) + offset[key] * scale;
        }
        if (offset.dim) params.dim = (params.dim ?? 0) + offset.dim * scale;
        if (t >= 1) state.action = null;
    } else if (state.ambient) {
        const spec = ambientByName.get(state.ambient);
        const t = Math.min(1, (now - state.ambientStart) / Math.max(1, state.ambientDuration));
        const offset = sampleKeys(spec?.keys || [], t);
        for (const key of PARAM_KEYS) {
            if (offset[key]) params[key] = (params[key] ?? 0) + offset[key];
        }
        if (t >= 1) {
            state.ambient = null;
            state.ambientDelay = typeof context?.ambientInterval === "function" ? context.ambientInterval() : 12000;
        }
    }
    // 结算保持姿态
    if (state.hold) {
        const spec = HOLD_STATES[state.hold];
        const t = spec ? Math.min(1, (now - state.holdStart) / spec.rise) : 1;
        const eased = easeOutCubic(t);
        for (const [key, target] of Object.entries(spec?.p || {})) {
            if (key === "scale") continue;
            params[key] = (params[key] ?? 0) + target * eased;
        }
        if (spec?.p?.scale) params.scale = 1 + (spec.p.scale - 1) * eased;
    }
    params.dim = Math.min(0.65, params.dim ?? 0);
    // 预览/标定页用：外部强制覆盖参数，优先级最高
    if (state.override) Object.assign(params, state.override);
    return params;
}

function createIdleMotion(rig, mesh) {
    const idle = rig?.animations?.idle || {};
    return {
        cycle: idle.cycle ?? 6800,
        float: idle.float ?? 5,
        boxH: mesh.boxH,
    };
}

/**
 * @param {object} options
 * @param {object} options.rig controller-rigs.js 里的 rig 定义
 * @param {HTMLImageElement} options.image 已解码完成的角色原画
 * @param {HTMLCanvasElement} options.canvas 目标画布
 * @param {boolean} [options.reducedMotion]
 */
export function createMeshControllerModel({ rig, image, canvas, reducedMotion = false, id = "" }) {
    // ---- 取像素：网格只需要 alpha 通道，建完即可释放 ----
    const source = document.createElement("canvas");
    source.width = image.naturalWidth || image.width;
    source.height = image.naturalHeight || image.height;
    const sourceCtx = source.getContext("2d", { willReadFrequently: true });
    sourceCtx.drawImage(image, 0, 0);
    const imageData = sourceCtx.getImageData(0, 0, source.width, source.height);
    const pixels = { width: imageData.width, height: imageData.height, data: imageData.data };

    const model = buildControllerModel(rig, pixels);
    const renderer = createMeshRenderer(canvas, image, model, {});
    if (!renderer) return null;

    const motion = createIdleMotion(rig, model.mesh);
    /** 风场：阵风均值≈0，所以静风时依旧精确还原原画；起风时发梢持续飘动 */
    const windField = createWindField(rig.wind || {});
    /** 角色专属动作（定义在 controller-rigs.js 的 rig.ambient 里，每个角色各不相同） */
    const ambientList = Array.isArray(rig.ambient) ? rig.ambient : [];
    const ambientByName = new Map(ambientList.map(item => [item.name, item]));

    const state = {
        time: 0,
        lastFrame: 0,
        action: null,
        actionStart: 0,
        actionDuration: 0,
        /** 角色专属动作（idle 随机穿插），优先级低于游戏动作 */
        ambient: null,
        ambientStart: 0,
        ambientDuration: 0,
        ambientDelay: 9000,
        ambientEnabled: true,
        hold: null,
        holdStart: 0,
        lowHp: false,
        dim: 0,
        /** 低 LP 颤抖的渐入系数（0→1），避免状态切换时突然抖起来 */
        lowHpRamp: 0,
        /** 仅预览/标定页使用 */
        override: null,
    };

    let running = false;
    let frame = 0;
    let frameCount = 0;
    let lastRenderedAlpha = -1;

    function currentParams(now) {
        return composePoseParams(state, motion, { reducedMotion, ambientByName, ambientInterval }, now);
    }

    /** 下一次随机专属动作的等待时间（8~20 秒，带一点抖动） */
    function ambientInterval() {
        return 8000 + Math.random() * 12000;
    }

    function pickAmbient() {
        const pool = ambientList.filter(item => (item.weight ?? 0) > 0);
        if (!pool.length) return null;
        const total = pool.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * total;
        for (const item of pool) {
            roll -= item.weight;
            if (roll <= 0) return item;
        }
        return pool[pool.length - 1];
    }

    /** 空闲够久就随机播一个角色专属动作 */
    function updateAmbientScheduler(now) {
        if (!state.ambientEnabled || reducedMotion) return;
        if (state.hold || state.action || state.ambient) return;
        // 首次调用只建立计时基线：否则 lastAmbientAt 为 0 时
        // now-0 远大于间隔，专属动作会在决斗刚开始的瞬间就乱入。
        if (!state.lastAmbientAt) { state.lastAmbientAt = now; return; }
        if (now - state.lastAmbientAt < state.ambientDelay) return;
        const picked = pickAmbient();
        if (!picked) return;
        state.ambient = picked.name;
        state.ambientStart = now;
        state.ambientDuration = picked.duration ?? 2200;
        state.lastAmbientAt = now;
        state.ambientCount = (state.ambientCount ?? 0) + 1;
    }

    function tick(now) {
        if (!running) return;
        frame = requestAnimationFrame(tick);
        const dt = state.lastFrame ? Math.min(0.05, (now - state.lastFrame) / 1000) : 1 / 60;
        state.lastFrame = now;
        state.time += dt * 1000;
        frameCount++;
        updateAmbientScheduler(now);
        // 低 LP 颤抖做指数平滑，避免状态切换时姿态瞬间跳变
        {
            const targetRamp = state.lowHp ? 1 : 0;
            state.lowHpRamp += (targetRamp - state.lowHpRamp) * Math.min(1, dt * 1.6);
        }
        const params = currentParams(now);
        // 风：基础风 + 阵风（均值≈0）。hairBurst 是「甩发」这类动作的瞬时风爆。
        const gustSample = sampleWind(windField, state.time);
        const burst = 1 + Math.max(0, params.hairBurst ?? 0);
        const wind = { x: gustSample.x * burst, y: gustSample.y * burst };
        evaluateModel(model, params, { dt, wind, time: state.time }, model.positions);
        const alpha = 1 - params.dim;
        renderer.render(model.positions, alpha);
        if (alpha !== lastRenderedAlpha) {
            lastRenderedAlpha = alpha;
            canvas.style.filter = params.dim > 0.001
                ? `brightness(${(1 - params.dim * 0.55).toFixed(3)}) saturate(${(1 - params.dim * 0.5).toFixed(3)})`
                : "";
        }
    }

    return {
        kind: "mesh",
        id,
        stats: model.stats,
        webgl2: renderer.isWebGL2,
        get model() { return model; },
        /** 供验收脚本读取的内部状态（正常运行时不使用） */
        getDebugState() {
            // 运行时自证：头部骨骼的局部缩放与剪切必须恒为 (1,1)/0，
            // 说明「转向」只用旋转 + 平移实现，原画比例没有被改变。
            // 这是「主控不许把图压扁」这条硬约束在运行时的可观测证据。
            const headIndex = model.skeleton.byName.get("head") ?? -1;
            return {
                running,
                frames: frameCount,
                action: state.action,
                ambient: state.ambient,
                ambientCount: state.ambientCount ?? 0,
                hold: state.hold,
                lowHp: state.lowHp,
                lowHpRamp: state.lowHpRamp,
                dim: state.dim,
                windScale: windField.scale,
                headScale: headIndex >= 0
                    ? [model.pose.scaleX[headIndex], model.pose.scaleY[headIndex]]
                    : null,
                headShear: headIndex >= 0 ? model.pose.shearX[headIndex] : null,
            };
        },
        /** 角色专属动作清单（预览页/配置界面用） */
        listAmbient() {
            return ambientList.map(item => ({ name: item.name, label: item.label, duration: item.duration, weight: item.weight }));
        },
        /** 手动触发一个专属动作（预览页用）；游戏内由 idle 调度器随机触发 */
        playAmbient(name) {
            const spec = ambientByName.get(name);
            if (!spec) return false;
            state.ambient = name;
            state.ambientStart = performance.now();
            state.ambientDuration = spec.duration ?? 2200;
            state.lastAmbientAt = state.ambientStart;
            state.ambientCount = (state.ambientCount ?? 0) + 1;
            return true;
        },
        setAmbientEnabled(enabled) { state.ambientEnabled = !!enabled; },
        /** 风向风力总开关（0 = 静风，1 = 默认，可在预览页调） */
        setWindScale(scale) { windField.scale = Math.max(0, Math.min(3, Number(scale) || 0)); },
        start() {
            if (running) return;
            running = true;
            state.lastFrame = 0;
            // 进入 idle 时重新起算专属动作的等待时间
            state.lastAmbientAt = 0;
            state.ambientDelay = ambientInterval();
            frame = requestAnimationFrame(tick);
        },
        stop() {
            running = false;
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
        },
        resize(width, height, dpr) { renderer.resize(width, height, dpr); },
        /** 播放一次性动作；同名动作重复触发由上层状态机去重。 */
        playAction(name) {
            const spec = ACTION_MOTIONS[name];
            if (!spec) return false;
            state.action = name;
            state.actionStart = performance.now();
            state.actionDuration = spec.duration;
            return true;
        },
        /** 持续状态：lowHp / win / lose / drawGame */
        setPersistent(name, active) {
            if (name === "lowHp") { state.lowHp = !!active; return; }
            if (!(name in HOLD_STATES)) return;
            if (active) {
                if (state.hold === name) return;
                state.hold = name;
                state.holdStart = performance.now();
            } else if (state.hold === name) {
                state.hold = null;
            }
        },
        /** 新决斗 / 离开决斗：清掉动作与保持姿态，回到 idle。 */
        reset() {
            state.action = null;
            state.ambient = null;
            state.hold = null;
            state.lowHp = false;
            state.dim = 0;
            state.lastAmbientAt = performance.now();
            state.ambientDelay = ambientInterval();
            canvas.style.filter = "";
        },
        /**
         * 仅预览/标定页使用：强制覆盖姿态参数（传 null 恢复由 idle + 时间线驱动）。
         * 游戏运行时不会调用。
         */
        setOverride(params) {
            state.override = params || null;
        },
        dispose() {
            this.stop();
            renderer.dispose();
        },
    };
}
