/**
 * controller-2d.js — 动态 2D 主控系统
 *
 * 设计边界（重要，避免误解）：
 *   素材只有一张透明 PNG，所以这里实现的是「单图程序化动态」——
 *   用 transform / opacity / filter 关键帧 + 少量特效层做呼吸、倾斜、位移、
 *   光影与扫描，而不是骨骼或 Live2D 网格变形。角色原画比例、五官、服装、
 *   画板与配色一律不改（CSS 只使用 object-fit:contain，不做拉伸或重绘）。
 *
 * 模块分层：
 *   1. 默认主题 / 动画参数 / 反应表 —— 纯数据，第二个主控只需覆盖其中几项。
 *   2. 主控注册表 —— registerController(config)，一条配置即可注册新主控。
 *   3. 动画状态机 —— 纯函数（可脱离 DOM 单测）：优先级、去重、胜负锁定。
 *   4. 浏览器运行时 —— DOM 绑定、特效导演、选择界面、清理。
 *
 * 本模块在 Node 环境下必须可以安全 import（controller.js / ui.js 会被
 * node --test 加载），因此顶层不允许触碰 window / document。
 */

const hasDom = typeof window !== "undefined" && typeof document !== "undefined";

import { getControllerRig } from "./controller-rigs.js";
import { createMeshControllerModel } from "./controller-mesh-model.js?v=1.0.0";
import { createLive2DControllerModel } from "./controller-live2d-model.js?v=1.0.0";

export const CONTROLLER_STORAGE_KEY = "sekai_selected_controller";
export const CONTROLLER_ACTION_EVENT = "sekai:controller-action";

/* ------------------------------------------------------------------ *
 * 1. 默认主题 / 动画参数 / 反应表
 * ------------------------------------------------------------------ */

/** 主题色板：新主控只需覆盖其中几项，未覆盖的沿用默认值。 */
export const DEFAULT_CONTROLLER_THEME = Object.freeze({
    /** 主光/状态色 */
    primary: "#69ddd8",
    /** 次光/结构色 */
    secondary: "#4a9ada",
    /** 魔法能量（蓝紫） */
    energy: "#9a7bff",
    /** 警戒色 */
    alert: "#ff5b6e",
    /** 胜利色 */
    victory: "#ffd977",
    /** 光晕内层 */
    aura: "rgba(86,196,255,.20)",
    /** 光晕外层 */
    auraOuter: "rgba(51,105,211,.07)",
    /** 描边/铭牌竖线 */
    rim: "rgba(89,224,226,.78)",
});

/**
 * 动画参数（毫秒 / px / 度）。全部是程序化关键帧的输入，不含骨骼动画。
 * idle.hold 是「停顿占比」：一个循环里后半段几乎不动，避免机械感。
 */
export const DEFAULT_CONTROLLER_ANIMATIONS = Object.freeze({
    idle: { cycle: 6800, float: 5, breath: 1.006, tilt: 0.4, hold: 0.46, holdMin: 9000, holdMax: 17000 },
    aura: { cycle: 3700, min: 0.5, max: 0.9 },
    draw: { duration: 820 },
    link: { duration: 520 },
    play: { duration: 700 },
    summon: { duration: 1080 },
    spell: { duration: 960 },
    trap: { duration: 860 },
    attack: { duration: 620, thrust: 18 },
    hit: { duration: 560 },
    critical: { duration: 900 },
    win: { duration: 0 },
    lose: { duration: 0 },
    drawGame: { duration: 0 },
});

/**
 * 反应表：事件 → 状态文字 + 状态类名 + 特效清单。
 * duration 为 0 表示「保持最终姿态，直到新决斗开始」。
 */
export const DEFAULT_CONTROLLER_REACTIONS = Object.freeze({
    link: { status: "LINK SYNC", className: "is-link", fx: [] },
    draw: { status: "DRAW LINK", className: "is-draw", fx: ["draw-beam"] },
    play: { status: "CARD LINK", className: "is-play", fx: ["card-link"] },
    summon: { status: "SUMMON LINK", className: "is-summon", fx: ["summon-ring"] },
    spell: { status: "SPELL LINK", className: "is-spell", fx: ["spell-energy"] },
    trap: { status: "TRAP ALERT", className: "is-trap", fx: ["trap-scan"] },
    attack: { status: "ATTACK LINK", className: "is-attack", fx: ["attack-thrust"] },
    hit: { status: "DAMAGE ALERT", className: "is-hit", fx: ["hit-flash"] },
    critical: { status: "LINK CRITICAL", className: "is-critical", fx: ["critical-pulse"] },
    win: { status: "VICTORY LINK", className: "is-win", fx: ["victory-burst"] },
    lose: { status: "LINK LOST", className: "is-lose", fx: [] },
    drawGame: { status: "DRAW GAME", className: "is-draw-game", fx: [] },
});

/** 优先级：win/lose > hit > attack/trap/spell/summon/play > draw > link > idle */
export const CONTROLLER_ACTION_PRIORITY = Object.freeze({
    idle: 0,
    link: 1,
    draw: 2,
    play: 3,
    summon: 3,
    spell: 3,
    trap: 3,
    attack: 3,
    hit: 4,
    // 低 LP 是持续状态：脉冲优先级刻意低于 draw，绝不覆盖任何一次性动作。
    critical: 1.5,
    win: 5,
    lose: 5,
    drawGame: 5,
});

/** 同类事件去重窗口（毫秒）。0 表示不去重（胜负由锁定保证唯一）。 */
export const CONTROLLER_DEDUPE_MS = Object.freeze({
    link: 400,
    draw: 260,
    play: 220,
    summon: 260,
    spell: 260,
    trap: 260,
    attack: 220,
    hit: 220,
    critical: 1500,
    win: 0,
    lose: 0,
    drawGame: 0,
});

/** 会锁定最终姿态、直到新决斗开始的状态。 */
const TERMINAL_TYPES = new Set(["win", "lose", "drawGame"]);

/** 一次动作播完后必须彻底摘掉的类名（防止残留状态叠加）。 */
const STATE_CLASSES = Object.freeze([
    "is-link", "is-draw", "is-play", "is-summon", "is-spell", "is-trap",
    "is-attack", "is-hit", "is-critical", "is-win", "is-lose", "is-draw-game",
]);

/* ------------------------------------------------------------------ *
 * 2. 主控注册表
 * ------------------------------------------------------------------ */

const registry = [];
const registryById = new Map();

function normalizeTheme(theme) {
    return { ...DEFAULT_CONTROLLER_THEME, ...(theme || {}) };
}

function normalizeAnimations(animations) {
    const merged = {};
    for (const [key, value] of Object.entries(DEFAULT_CONTROLLER_ANIMATIONS)) {
        merged[key] = typeof value === "object" && value !== null ? { ...value, ...(animations?.[key] || {}) } : value;
    }
    for (const [key, value] of Object.entries(animations || {})) merged[key] ??= value;
    return merged;
}

function normalizeReactions(reactions) {
    const merged = {};
    for (const [key, value] of Object.entries(DEFAULT_CONTROLLER_REACTIONS)) {
        merged[key] = { ...value, ...(reactions?.[key] || {}) };
    }
    for (const [key, value] of Object.entries(reactions || {})) merged[key] ??= { fx: [], ...value };
    return merged;
}

/**
 * 注册一个主控。重复 id 会就地替换（便于热调参），返回规范化后的配置。
 * 这是「加一条配置即可注册第二个主控」的唯一入口。
 */
export function registerController(config) {
    if (!config || typeof config !== "object") throw new TypeError("controller config 必须是对象");
    const id = String(config.id || "").trim();
    if (!id) throw new TypeError("controller config 缺少 id");
    const entry = Object.freeze({
        id,
        name: String(config.name || id),
        title: String(config.title || "TACTICAL LINK"),
        description: String(config.description || ""),
        image: String(config.image || ""),
        /** 可选：选择界面里的补充标签 */
        tags: Array.isArray(config.tags) ? [...config.tags] : [],
        /** 后端类型：默认 mesh（自研网格模型），可选 live2d */
        backend: config.backend === "live2d" ? "live2d" : "mesh",
        /** live2d 后端的资源位置 */
        modelDir: String(config.modelDir || ""),
        modelJson: String(config.modelJson || ""),
        /** 实验性条目默认不出现在选择界面（?controllers=all 可显示） */
        experimental: config.experimental === true,
        theme: normalizeTheme(config.theme),
        animations: normalizeAnimations(config.animations),
        reactions: normalizeReactions(config.reactions),
    });
    const existing = registryById.get(id);
    if (existing) registry[registry.indexOf(existing)] = entry;
    else registry.push(entry);
    registryById.set(id, entry);
    return entry;
}

/** 只读列表（选择界面用）。 */
export function listControllers() { return registry.slice(); }

/** 按 id 取主控；取不到返回 null。 */
export function getRegisteredController(id) { return registryById.get(String(id || "")) || null; }

/** 默认主控（注册表第一项）。 */
export function getDefaultController() { return registry[0] || null; }

// ---- 内置主控 ----
// 第二个主控只用了项目里已有、此前未被引用的角色原画，没有重新生成任何形象。
registerController({
    id: "blue-01",
    name: "CONTROLLER 01",
    title: "TACTICAL LINK",
    description: "战况感知型主控 · 抽卡、出击与受击动态反馈",
    image: "assets/characters/controller-blue-01.png",
    tags: ["BLUE", "SENSE"],
    theme: {
        primary: "#69ddd8",
        secondary: "#4a9ada",
        energy: "#8f7bff",
        aura: "rgba(86,196,255,.20)",
        auraOuter: "rgba(51,105,211,.07)",
        rim: "rgba(89,224,226,.78)",
    },
});

registerController({
    id: "lucia",
    name: "CONTROLLER 02 · LUCIA",
    title: "ARCANA LINK",
    description: "牌序预演型主控 · 更慢的呼吸与更冷的青蓝光晕",
    image: "assets/characters/controller-lucia.png",
    tags: ["LUCIA", "ARCANA"],
    theme: {
        primary: "#7fe3d2",
        secondary: "#2f7fb5",
        energy: "#b07bff",
        alert: "#ff6b7d",
        victory: "#ffd977",
        aura: "rgba(96,214,224,.20)",
        auraOuter: "rgba(42,86,158,.08)",
        rim: "rgba(127,227,210,.78)",
    },
    animations: {
        idle: { cycle: 8200, float: 5, breath: 1.005, tilt: 0.34, hold: 0.52 },
        aura: { cycle: 4600, min: 0.46, max: 0.84 },
        attack: { duration: 660, thrust: 16 },
    },
});

/**
 * 第三个条目：Live2D Cubism 后端的**技术验证**模型。
 *   · backend: "live2d" 时走真 Live2D 运行时（moc3 + 动作 + 物理 + 眨眼）
 *   · experimental: true 让它默认不出现在选择界面（保留现有两个出场角色），
 *     需要时用 ?controllers=all 打开
 *   · 角色形象是 Live2D 官方示例 Hiyori，仅用于验证管线，
 *     许可要求见 assets/models/hiyori/LICENSE-ReadMe.txt
 */
registerController({
    id: "hiyori-ref",
    name: "LIVE2D · HIYORI",
    title: "CUBISM REFERENCE",
    description: "Live2D 官方示例模型 · 仅验证 Cubism 运行时接入，非出场角色",
    image: "assets/models/hiyori/hiyori_free_t08.2048/texture_00.png",
    tags: ["LIVE2D", "REFERENCE"],
    experimental: true,
    backend: "live2d",
    modelDir: "assets/models/hiyori/",
    modelJson: "hiyori_free_t08.model3.json",
    theme: {
        primary: "#ffb4c8",
        secondary: "#e07a9a",
        energy: "#b98cff",
        alert: "#ff5b6e",
        victory: "#ffd977",
        aura: "rgba(255,170,200,.20)",
        auraOuter: "rgba(150,60,100,.08)",
        rim: "rgba(255,180,200,.78)",
    },
    reactions: {
        // Live2D 模型自带动作，状态文字沿用同一套
        draw: { status: "DRAW LINK", className: "is-draw", fx: ["draw-beam"] },
    },
});

/* ------------------------------------------------------------------ *
 * 3. 动画状态机（纯函数，可 node 单测）
 * ------------------------------------------------------------------ */

export function createControllerRuntimeState() {
    return {
        /** 当前正在播放的一次性状态 */
        active: null,
        activePriority: 0,
        /** 当前一次性状态的结束时刻（performance.now 口径） */
        activeUntil: 0,
        /** win/lose 等结算状态锁定 */
        locked: false,
        /** 持续状态：低 LP */
        lowHp: false,
        lastFiredAt: Object.create(null),
    };
}

export function controllerActionPriority(type) {
    return CONTROLLER_ACTION_PRIORITY[type] ?? CONTROLLER_ACTION_PRIORITY.play;
}

export function controllerActionDuration(type, animations = DEFAULT_CONTROLLER_ANIMATIONS) {
    const value = animations?.[type]?.duration;
    if (Number.isFinite(value)) return Math.max(0, value);
    return DEFAULT_CONTROLLER_ANIMATIONS[type]?.duration ?? 700;
}

export function controllerDedupeWindow(type) {
    return CONTROLLER_DEDUPE_MS[type] ?? 200;
}

/**
 * 决定这次事件是否应当播放。纯函数，不碰 DOM。
 * @returns {{play:boolean, reason:string, priority:number}}
 */
export function decideControllerAction(state, type, now = 0) {
    const priority = controllerActionPriority(type);
    if (!state) return { play: false, reason: "no-state", priority };
    if (TERMINAL_TYPES.has(type)) return { play: !state.locked, reason: state.locked ? "locked" : "ok", priority };
    if (state.locked) return { play: false, reason: "locked", priority };
    // 高优先级可以打断低优先级；低优先级不能打断正在播放的高优先级。
    if (priority < state.activePriority && now < state.activeUntil) {
        return { play: false, reason: "lower-priority", priority };
    }
    const window = controllerDedupeWindow(type);
    const last = state.lastFiredAt[type];
    if (window > 0 && Number.isFinite(last) && now - last < window) {
        return { play: false, reason: "duplicate", priority };
    }
    return { play: true, reason: "ok", priority };
}

/** 提交一次播放，写回状态机。 */
export function commitControllerAction(state, type, now = 0, duration = 0) {
    const priority = controllerActionPriority(type);
    state.active = type;
    state.activePriority = priority;
    state.activeUntil = duration > 0 ? now + duration : Infinity;
    state.lastFiredAt[type] = now;
    if (TERMINAL_TYPES.has(type)) state.locked = true;
    return state;
}

/** 一次性动作播完，回到 idle（但结算锁定不受影响）。 */
export function releaseControllerAction(state, type) {
    if (state.active !== type) return state;
    state.active = null;
    state.activePriority = CONTROLLER_ACTION_PRIORITY.idle;
    state.activeUntil = 0;
    return state;
}

/** 新决斗 / 离开决斗时的硬复位。 */
export function resetControllerRuntimeState(state) {
    if (!state) return state;
    state.active = null;
    state.activePriority = 0;
    state.activeUntil = 0;
    state.locked = false;
    state.lowHp = false;
    state.lastFiredAt = Object.create(null);
    return state;
}

/* ------------------------------------------------------------------ *
 * 4. 浏览器运行时
 * ------------------------------------------------------------------ */

const runtime = {
    state: createControllerRuntimeState(),
    dom: null,
    bound: false,
    currentId: null,
    config: null,
    /** 自研网格模型实例（null 表示使用静态图后端） */
    meshModel: null,
    /** 离开决斗后挂起网格模型的 rAF，直到下一次 duelStart */
    suspended: false,
    /** ?controllers=all 时在选择界面里显示实验性条目 */
    showExperimental: false,
    timers: new Set(),
    fxNodes: new Set(),
    holdTimer: null,
    holdOnTimer: null,
    hidden: false,
    reduced: false,
    paused: false,
    pointerRaf: 0,
    pointerX: 0,
    pointerY: 0,
    pickerLastFocus: null,
    motionQuery: null,
};

function now() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
}

function later(fn, ms) {
    const timer = window.setTimeout(() => { runtime.timers.delete(timer); fn(); }, ms);
    runtime.timers.add(timer);
    return timer;
}

function prefersReducedMotion() {
    if (!hasDom) return false;
    if (document.body?.classList.contains("reduce-motion")) return true;
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function randomBetween(min, max) {
    if (!(max > min)) return min;
    return min + Math.random() * (max - min);
}

function readStoredControllerId() {
    if (!hasDom) return null;
    try { return window.localStorage.getItem(CONTROLLER_STORAGE_KEY); } catch { return null; }
}

function storeControllerId(id) {
    if (!hasDom) return;
    try { window.localStorage.setItem(CONTROLLER_STORAGE_KEY, id); } catch { /* 隐私模式：忽略 */ }
}

/* ---- DOM 解析 ---- */

function resolveDom() {
    if (!hasDom) return null;
    const root = document.querySelector("#player-controller-2d");
    if (!root) return null;
    return {
        root,
        battle: document.querySelector("#battle-screen"),
        rig: root.querySelector(".duel-controller-rig"),
        img: root.querySelector(".duel-controller-rig img"),
        fxBack: root.querySelector(".duel-controller-fx-back"),
        fxFront: root.querySelector(".duel-controller-fx-front"),
        status: root.querySelector("#controller-status"),
        name: root.querySelector(".duel-controller-name strong"),
        picker: document.querySelector("#controller-picker"),
        pickerGrid: document.querySelector("#controller-picker-grid"),
    };
}

/* ---- 网格模型后端（自研 2D 人物模型） ---- */

let meshGeneration = 0;

function loadImage(src) {
    // 必须走 window.Image（而不是裸 Image）：在测试/嵌入式环境里全局可能没有，
    // 而这里任何失败都不允许逃逸成未处理拒绝。
    const ImageCtor = hasDom ? window.Image : undefined;
    if (typeof ImageCtor !== "function") return Promise.resolve(null);
    return new Promise(resolve => {
        let image;
        try {
            image = new ImageCtor();
        } catch {
            resolve(null);
            return;
        }
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        try { image.src = src; } catch { resolve(null); }
    });
}

function ensureStageCanvas(dom) {
    let canvas = dom.rig?.querySelector("canvas.duel-controller-canvas");
    if (canvas || !dom.rig) return canvas;
    canvas = document.createElement("canvas");
    canvas.className = "duel-controller-canvas";
    canvas.setAttribute("aria-hidden", "true");
    dom.rig.appendChild(canvas);
    return canvas;
}

function measureRig(dom) {
    const rect = dom.rig?.getBoundingClientRect?.();
    if (!rect || rect.width < 2 || rect.height < 2) return null;
    return { width: rect.width, height: rect.height, dpr: Math.min(window.devicePixelRatio || 1, 2) };
}

function syncMeshRunning() {
    const model = runtime.meshModel;
    if (!model) return;
    // suspended：离开决斗后不能因为「决斗台还挂着 active 类」就把 rAF 又拉起来。
    // showMenu() 是先派发 duelEnd、后移除 active，所以这里必须自己记住挂起状态。
    if (runtime.suspended) { model.stop(); return; }
    const battle = runtime.dom?.battle;
    const active = !!battle?.classList.contains("active") && !document.hidden;
    if (active) {
        const size = measureRig(runtime.dom);
        if (size) model.resize(size.width, size.height, size.dpr);
        model.start();
    } else {
        model.stop();
    }
}

function deactivateMeshModel() {
    const dom = runtime.dom;
    if (runtime.meshModel) {
        runtime.meshModel.dispose();
        runtime.meshModel = null;
    }
    dom?.root?.classList.remove("is-mesh-model");
    dom?.rig?.querySelector("canvas.duel-controller-canvas")?.remove();
}

/** 尝试把当前主控升级成网格模型；任何一步失败都静默回退到静态图，不影响决斗。 */
async function activateMeshModel(config) {
    try {
        const dom = runtime.dom;
        if (!dom || !config) return;
        const generation = ++meshGeneration;
        const isLive2D = config.backend === "live2d";
        // Live2D 后端不需要 rig/原画取像素；网格后端两者都要
        const rig = isLive2D ? { live2d: true } : getControllerRig(config.id);
        if (!rig) { deactivateMeshModel(); return; }
        const image = isLive2D ? { live2d: true } : await loadImage(config.image);
        if (generation !== meshGeneration) return;
        if (!image) { deactivateMeshModel(); return; }
        const canvas = ensureStageCanvas(dom);
        const size = measureRig(dom);
        if (!canvas || !size) { deactivateMeshModel(); return; }
        let model = null;
        try {
            model = isLive2D
                ? await createLive2DControllerModel({
                    modelDir: config.modelDir,
                    modelJson: config.modelJson,
                    canvas,
                    id: config.id,
                    baseUrl: "",
                })
                : createMeshControllerModel({
                    rig,
                    image,
                    canvas,
                    id: config.id,
                    reducedMotion: prefersReducedMotion(),
                });
        } catch (error) {
            console.warn("[主控] 网格模型装配失败，回退静态图", error);
            model = null;
        }
        if (generation !== meshGeneration) { model?.dispose(); return; }
        if (!model) { deactivateMeshModel(); return; }
        if (runtime.meshModel) runtime.meshModel.dispose();
        runtime.meshModel = model;
        dom.root.dataset.controllerBackend = model.kind;
        dom.root.classList.add("is-mesh-model");
        model.resize(size.width, size.height, size.dpr);
        syncMeshRunning();
    } catch (error) {
        // 兜底：升级失败绝不能影响决斗，静默退回静态图后端。
        console.warn("[主控] 网格模型升级失败，回退静态图", error);
        try { deactivateMeshModel(); } catch { /* 忽略 */ }
    }
}

/* ---- 应用主控 ---- */

function applyTheme(root, theme) {
    root.style.setProperty("--ctl-primary", theme.primary);
    root.style.setProperty("--ctl-secondary", theme.secondary);
    root.style.setProperty("--ctl-energy", theme.energy);
    root.style.setProperty("--ctl-alert", theme.alert);
    root.style.setProperty("--ctl-victory", theme.victory);
    root.style.setProperty("--ctl-aura", theme.aura);
    root.style.setProperty("--ctl-aura-outer", theme.auraOuter);
    root.style.setProperty("--ctl-rim", theme.rim);
}

function applyIdleTuning(root, animations) {
    root.style.setProperty("--ctl-idle-cycle", `${Math.round(animations.idle.cycle)}ms`);
    root.style.setProperty("--ctl-idle-float", `${animations.idle.float}px`);
    root.style.setProperty("--ctl-idle-breath", String(animations.idle.breath));
    root.style.setProperty("--ctl-idle-tilt", `${animations.idle.tilt}deg`);
    root.style.setProperty("--ctl-idle-hold", String(animations.idle.hold));
    root.style.setProperty("--ctl-aura-cycle", `${Math.round(animations.aura.cycle)}ms`);
    root.style.setProperty("--ctl-aura-min", String(animations.aura.min));
    root.style.setProperty("--ctl-aura-max", String(animations.aura.max));
    root.style.setProperty("--ctl-attack-thrust", `${animations.attack.thrust}px`);
    // 每个动作的 CSS 时长由配置驱动，新主控改动画参数不需要动 CSS。
    for (const type of ["link", "draw", "play", "summon", "spell", "trap", "attack", "hit", "critical"]) {
        const duration = animations?.[type]?.duration;
        if (Number.isFinite(duration)) root.style.setProperty(`--ctl-dur-${type}`, `${Math.max(0, duration)}ms`);
    }
}

function bindImageFallback(dom) {
    const { root, img } = dom;
    if (!img || img.dataset.ctlFallbackBound === "1") return;
    img.dataset.ctlFallbackBound = "1";
    img.addEventListener("error", () => root.classList.add("is-link-broken"));
    img.addEventListener("load", () => root.classList.remove("is-link-broken"));
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) root.classList.add("is-link-broken");
}

function applyController(config) {
    const dom = runtime.dom;
    if (!dom || !config) return;
    const changed = runtime.currentId !== config.id;
    runtime.config = config;
    runtime.currentId = config.id;
    dom.root.dataset.controllerId = config.id;
    applyTheme(dom.root, config.theme);
    applyIdleTuning(dom.root, config.animations);
    if (dom.name) dom.name.textContent = config.name;
    if (dom.img && config.image) {
        const absolute = new URL(config.image, document.baseURI).href;
        if (dom.img.src !== absolute) {
            dom.root.classList.remove("is-link-broken");
            dom.img.src = config.image;
        }
        dom.img.alt = config.name;
    }
    syncStatus();
    // 有绑定 rig 的角色升级成真正的 2D 人物模型；没有 rig 或 WebGL 不可用时
    // 保留静态图 + CSS 关键帧后端（功能完全等价，只是形变精度较低）。
    // 只有换角色或还没有模型时才重建：网格+蒙皮装配需要数百毫秒，
    // 每次新决斗都重来会造成明显的开局卡顿。
    if (changed || !runtime.meshModel) void activateMeshModel(config);
}

/* ---- 状态文字 ---- */

function syncStatus() {
    const dom = runtime.dom;
    if (!dom?.status) return;
    const state = runtime.state;
    const config = runtime.config || getDefaultController();
    if (state.locked) {
        dom.status.textContent = runtime.lockedStatus || "LINK LOST";
        return;
    }
    if (state.active) {
        dom.status.textContent = runtime.activeStatus || config?.title || "TACTICAL LINK";
        return;
    }
    if (state.lowHp) {
        dom.status.textContent = "LINK CRITICAL";
        return;
    }
    dom.status.textContent = config?.title || "TACTICAL LINK";
}

/* ---- 特效层 ---- */

function trackFx(node, lifetime) {
    if (!node) return node;
    runtime.fxNodes.add(node);
    later(() => {
        runtime.fxNodes.delete(node);
        node.remove();
    }, lifetime);
    return node;
}

function makeFx(layer, className, lifetime) {
    if (!layer) return null;
    const node = document.createElement("div");
    node.className = className;
    node.setAttribute("aria-hidden", "true");
    layer.appendChild(node);
    return trackFx(node, lifetime);
}

/** 抽卡光线：从主控扫向手牌区域。挂在 battle-screen 上，z-index 低于卡牌。 */
function spawnDrawBeam() {
    const dom = runtime.dom;
    const battle = dom?.battle;
    if (!battle) return;
    const handTray = document.querySelector("#hand-tray") || document.querySelector("#hand");
    const battleRect = battle.getBoundingClientRect();
    const fromRect = dom.root.getBoundingClientRect();
    const toRect = handTray?.getBoundingClientRect?.() || {
        left: battleRect.left + battleRect.width * 0.5,
        top: battleRect.top + battleRect.height * 0.8,
        width: 0,
        height: 0,
    };
    const layer = document.querySelector("#duel-controller-fx-layer");
    if (!layer) return;
    const x1 = fromRect.left + fromRect.width * 0.62 - battleRect.left;
    const y1 = fromRect.top + fromRect.height * 0.42 - battleRect.top;
    const x2 = toRect.left + (toRect.width || 0) * 0.5 - battleRect.left;
    const y2 = toRect.top + (toRect.height || 0) * 0.35 - battleRect.top;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(80, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const beam = makeFx(layer, "ctl-draw-beam", 900);
    if (!beam) return;
    beam.style.setProperty("--ctl-beam-x", `${x1.toFixed(1)}px`);
    beam.style.setProperty("--ctl-beam-y", `${y1.toFixed(1)}px`);
    beam.style.setProperty("--ctl-beam-length", `${length.toFixed(1)}px`);
    beam.style.setProperty("--ctl-beam-angle", `${angle.toFixed(2)}deg`);
}

function spawnSummonRing() {
    const ring = makeFx(runtime.dom?.fxBack, "ctl-summon-ring", 1200);
    if (!ring) return;
    const ring2 = makeFx(runtime.dom?.fxBack, "ctl-summon-ring is-echo", 1400);
    ring2?.style.setProperty("--ctl-ring-delay", "140ms");
}

function spawnSpellEnergy() {
    const layer = runtime.dom?.fxFront;
    if (!layer) return;
    for (let i = 0; i < 6; i++) {
        const orb = makeFx(layer, "ctl-spell-orb", 1300);
        if (!orb) continue;
        orb.style.setProperty("--ctl-orb-i", String(i));
        orb.style.setProperty("--ctl-orb-angle", `${(i / 6) * 360}deg`);
        orb.style.setProperty("--ctl-orb-delay", `${i * 55}ms`);
    }
    makeFx(runtime.dom?.fxBack, "ctl-spell-halo", 1200);
}

function spawnTrapScan() {
    const layer = runtime.dom?.fxFront;
    if (!layer) return;
    makeFx(layer, "ctl-trap-scanlines", 900);
    makeFx(layer, "ctl-trap-frame", 900);
}

function spawnAttackThrust() {
    const layer = runtime.dom?.fxBack;
    if (!layer) return;
    for (let i = 0; i < 5; i++) {
        const line = makeFx(layer, "ctl-thrust-line", 700);
        if (!line) continue;
        line.style.setProperty("--ctl-line-i", String(i));
        line.style.setProperty("--ctl-line-y", `${18 + i * 15}%`);
        line.style.setProperty("--ctl-line-delay", `${i * 32}ms`);
    }
}

function spawnHitFlash() {
    makeFx(runtime.dom?.fxFront, "ctl-hit-flash", 700);
}

function spawnCriticalPulse() {
    makeFx(runtime.dom?.fxFront, "ctl-critical-ring", 1000);
}

function spawnVictoryBurst() {
    makeFx(runtime.dom?.fxBack, "ctl-victory-halo", 2600);
}

function spawnCardLink() {
    makeFx(runtime.dom?.fxBack, "ctl-card-link", 900);
}

const FX_BUILDERS = {
    "draw-beam": spawnDrawBeam,
    "card-link": spawnCardLink,
    "summon-ring": spawnSummonRing,
    "spell-energy": spawnSpellEnergy,
    "trap-scan": spawnTrapScan,
    "attack-thrust": spawnAttackThrust,
    "hit-flash": spawnHitFlash,
    "critical-pulse": spawnCriticalPulse,
    "victory-burst": spawnVictoryBurst,
};

function runFx(list) {
    if (!Array.isArray(list)) return;
    if (runtime.reduced || runtime.hidden) return;
    for (const name of list) FX_BUILDERS[name]?.();
}

/* ---- 一次性动作播放 ---- */

function reactionFor(type) {
    const config = runtime.config;
    const custom = config?.reactions?.[type];
    if (custom) return custom;
    return DEFAULT_CONTROLLER_REACTIONS[type] || null;
}

function animationDuration(config, type) {
    return controllerActionDuration(type, config?.animations || DEFAULT_CONTROLLER_ANIMATIONS);
}

function clearStateClasses() {
    const root = runtime.dom?.root;
    if (!root) return;
    for (const className of STATE_CLASSES) root.classList.remove(className);
}

function finishOneShot(type) {
    const root = runtime.dom?.root;
    const reaction = reactionFor(type);
    if (root && reaction) root.classList.remove(reaction.className);
    releaseControllerAction(runtime.state, type);
    runtime.activeStatus = null;
    runtime.lockedStatus = null;
    syncStatus();
    scheduleIdleHold();
}

/** 播放一次动作。调用方已经过 decideControllerAction 同意。 */
function playOneShot(type, detail = {}) {
    const dom = runtime.dom;
    if (!dom) return;
    const reaction = reactionFor(type);
    if (!reaction) return;
    const previous = runtime.state.active;
    if (previous && previous !== type) {
        const previousReaction = reactionFor(previous);
        if (previousReaction) dom.root.classList.remove(previousReaction.className);
    }
    const duration = animationDuration(runtime.config, type);
    commitControllerAction(runtime.state, type, now(), duration);
    runtime.activeStatus = reaction.status;
    if (TERMINAL_TYPES.has(type)) runtime.lockedStatus = reaction.status;
    dom.root.dataset.controllerAction = type;
    if (Number.isFinite(detail.damage) && detail.damage > 0) {
        dom.root.style.setProperty("--ctl-last-damage", String(Math.round(detail.damage)));
    }
    // 同类动画在去重窗口内不会重入，因此这里不需要强制回流重启关键帧。
    dom.root.classList.remove(reaction.className);
    dom.root.classList.add(reaction.className);
    syncStatus();
    runFx(reaction.fx);
    // 网格模型后端：同一份动作时间线，走真实顶点形变而不是 CSS 关键帧
    runtime.meshModel?.playAction(type);
    if (TERMINAL_TYPES.has(type)) runtime.meshModel?.setPersistent(type, true);
    if (duration <= 0) return; // win/lose：保持最终姿态直到新决斗
    later(() => {
        if (runtime.state.active !== type) return;
        finishOneShot(type);
    }, duration);
}

function setLowHp(active) {
    const dom = runtime.dom;
    if (!dom) return;
    if (runtime.state.lowHp === active) return; // 不反复触发同一动画
    runtime.state.lowHp = active;
    dom.root.classList.toggle("is-low-hp", active);
    runtime.meshModel?.setPersistent("lowHp", active);
    if (active) {
        // 低 LP 是持续状态，只在没有更高优先级动作时补一次脉冲。
        const decision = decideControllerAction(runtime.state, "critical", now());
        if (decision.play && !runtime.reduced) playOneShot("critical", {});
        else syncStatus();
    } else {
        syncStatus();
    }
}

/** 随机停顿：打断 idle 的机械循环。 */
function scheduleIdleHold() {
    if (!hasDom || runtime.reduced || runtime.hidden) return;
    clearTimeout(runtime.holdOnTimer);
    clearTimeout(runtime.holdTimer);
    const animations = runtime.config?.animations || DEFAULT_CONTROLLER_ANIMATIONS;
    const delay = randomBetween(animations.idle.holdMin, animations.idle.holdMax);
    runtime.holdTimer = later(() => {
        const root = runtime.dom?.root;
        if (!root || runtime.state.active || runtime.state.locked) return scheduleIdleHold();
        root.classList.add("is-holding");
        runtime.holdOnTimer = later(() => {
            root.classList.remove("is-holding");
            scheduleIdleHold();
        }, randomBetween(1400, 3200));
    }, delay);
}

/* ---- 事件入口 ---- */

function normalizeDetail(detail) {
    if (typeof detail === "string") return { type: detail };
    if (!detail || typeof detail !== "object") return { type: "" };
    return detail;
}

/** 处理一个主控事件（供事件监听与单测复用）。 */
export function handleControllerAction(detail) {
    const payload = normalizeDetail(detail);
    const type = String(payload.type || "");
    if (!type) return false;
    if (!runtime.dom) return false;
    // 系统级 reduced-motion 可能在会话中被改变，每次事件都重新取一次。
    runtime.reduced = prefersReducedMotion();
    runtime.dom.root.classList.toggle("is-reduced-motion", runtime.reduced);
    if (type === "duelStart") {
        runtime.suspended = false;
        resetController2D();
        // 决斗台在 showBattle() 之前是 display:none，画布拿不到尺寸，
        // 因此网格模型只能在决斗开始、布局生效之后再装配。
        if (!runtime.meshModel && runtime.config) void activateMeshModel(runtime.config);
        syncMeshRunning();
        return true;
    }
    if (type === "duelEnd") {
        runtime.suspended = true;
        teardownControllerActivity();
        syncMeshRunning();
        return true;
    }
    if (type === "lowHp") { setLowHp(true); return true; }
    if (type === "lowHpEnd") { setLowHp(false); return true; }
    if (!reactionFor(type)) return false;
    const decision = decideControllerAction(runtime.state, type, now());
    runtime.lastDecision = decision.reason;
    if (!decision.play) return false;
    playOneShot(type, payload);
    return true;
}

/* ---- 指针输入：仅做极轻的整体平移视差 ----
 * 不做 rotateY、scaleX 或视线伪变形，确保单张原画的比例与五官始终不变。
 * 每帧最多写一次 CSS 变量，位移上限为 2px / 1.5px。
 */

function resetPointerParallax() {
    const root = runtime.dom?.root;
    if (!root) return;
    root.style.setProperty("--controller-x", "0px");
    root.style.setProperty("--controller-y", "0px");
}

function flushPointerParallax() {
    runtime.pointerRaf = 0;
    const dom = runtime.dom;
    if (!dom?.root || !dom.battle?.classList.contains("active") || runtime.reduced || runtime.hidden) {
        resetPointerParallax();
        return;
    }
    const rect = dom.battle.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const x = Math.max(-1, Math.min(1, ((runtime.pointerX - rect.left) / rect.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((runtime.pointerY - rect.top) / rect.height) * 2 - 1));
    dom.root.style.setProperty("--controller-x", `${(x * 2).toFixed(2)}px`);
    dom.root.style.setProperty("--controller-y", `${(y * 1.5).toFixed(2)}px`);
}

function onBattlePointerMove(event) {
    runtime.pointerX = event.clientX;
    runtime.pointerY = event.clientY;
    if (!runtime.pointerRaf) runtime.pointerRaf = window.requestAnimationFrame(flushPointerParallax);
}

function onBattlePointerLeave() {
    if (runtime.pointerRaf) window.cancelAnimationFrame(runtime.pointerRaf);
    runtime.pointerRaf = 0;
    resetPointerParallax();
}

/* ---- 选择界面 ---- */

function controllerCardHtml(config, selectedId) {
    const active = config.id === selectedId;
    const theme = config.theme;
    const tags = (config.tags || []).map(tag => `<em>${tag}</em>`).join("");
    return `<button class="controller-choice${active ? " selected" : ""}" type="button" role="option" aria-selected="${active}" data-controller-id="${config.id}" style="--ctl-primary:${theme.primary};--ctl-secondary:${theme.secondary};--ctl-rim:${theme.rim}">`
        + `<span class="controller-choice-badge">${active ? "使用中" : "选择"}</span>`
        + `<span class="controller-choice-stage"><img src="${config.image}" alt="${config.name}" loading="lazy" decoding="async"></span>`
        + `<span class="controller-choice-info"><strong>${config.name}</strong><span>${config.title}</span><small>${config.description}</small>`
        + (tags ? `<span class="controller-choice-tags">${tags}</span>` : "")
        + `</span></button>`;
}

function renderPicker() {
    const dom = runtime.dom;
    if (!dom?.pickerGrid) return;
    const selectedId = runtime.currentId || getDefaultController()?.id;
    // 实验性条目（Live2D 技术验证模型）默认不出现在选择界面，
    // 用 ?controllers=all 打开，保证"保留现有出场角色"不被改变。
    const visible = listControllers().filter(item => runtime.showExperimental || !item.experimental);
    dom.pickerGrid.innerHTML = visible.map(config => controllerCardHtml(config, selectedId)).join("");
    dom.pickerGrid.querySelectorAll("[data-controller-id]").forEach(button => {
        const config = getRegisteredController(button.dataset.controllerId);
        button.querySelector("img")?.addEventListener("error", () => button.classList.add("is-link-broken"));
        if (!config) return;
        button.addEventListener("click", () => selectController(config.id, { closePicker: true }));
    });
}

function openPicker() {
    const dom = runtime.dom;
    if (!dom?.picker) return;
    renderPicker();
    runtime.pickerLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dom.picker.classList.add("active");
    dom.picker.setAttribute("aria-hidden", "false");
    document.body.classList.add("controller-picker-open");
    dom.pickerGrid?.querySelector(".controller-choice.selected")?.focus();
}

function closePicker() {
    const dom = runtime.dom;
    if (!dom?.picker) return;
    dom.picker.classList.remove("active");
    dom.picker.setAttribute("aria-hidden", "true");
    document.body.classList.remove("controller-picker-open");
    runtime.pickerLastFocus?.focus?.();
    runtime.pickerLastFocus = null;
}

/** 切换主控：写 localStorage、应用主题、刷新选择界面，并给一次 LINK SYNC 反馈。 */
export function selectController(id, { closePicker: shouldClose = false, persist = true } = {}) {
    const config = getRegisteredController(id);
    if (!config) return false;
    if (persist) storeControllerId(config.id);
    applyController(config);
    runtime.state = resetControllerRuntimeState(runtime.state);
    clearStateClasses();
    runtime.dom?.root.classList.remove("is-low-hp");
    renderPicker();
    handleControllerAction({ type: "link" });
    if (shouldClose) later(() => closePicker(), 320);
    return true;
}

/* ---- 清理 ---- */

/** 只清理「一次动作」的痕迹，保留主控选择与监听器。 */
function teardownControllerActivity() {
    for (const timer of runtime.timers) clearTimeout(timer);
    runtime.timers.clear();
    runtime.holdTimer = null;
    runtime.holdOnTimer = null;
    if (runtime.pointerRaf) window.cancelAnimationFrame(runtime.pointerRaf);
    runtime.pointerRaf = 0;
    resetPointerParallax();
    for (const node of runtime.fxNodes) node.remove();
    runtime.fxNodes.clear();
    clearStateClasses();
    const root = runtime.dom?.root;
    root?.classList.remove("is-low-hp", "is-holding", "is-page-hidden");
    if (root) delete root.dataset.controllerAction;
    resetControllerRuntimeState(runtime.state);
    runtime.activeStatus = null;
    runtime.lockedStatus = null;
    runtime.meshModel?.reset();
    syncStatus();
}

/** 新决斗开始：解锁胜负姿态、清空计时器与动画类名。不重建模型。 */
export function resetController2D() {
    teardownControllerActivity();
    scheduleIdleHold();
}

/** 完全销毁：解绑监听器（离开游戏页面时调用）。 */
export function destroyController2D() {
    teardownControllerActivity();
    deactivateMeshModel();
    meshGeneration++;
    if (!runtime.bound) return;
    runtime.bound = false;
    document.querySelector("#btn-controller-select")?.removeEventListener("click", openPicker);
    document.querySelector("#controller-picker-close")?.removeEventListener("click", closePicker);
    runtime.dom?.picker?.removeEventListener("pointerdown", onPickerPointerDown);
    runtime.dom?.battle?.removeEventListener("pointermove", onBattlePointerMove);
    runtime.dom?.battle?.removeEventListener("pointerleave", onBattlePointerLeave);
    document.removeEventListener("keydown", onDocumentKeyDown);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener(CONTROLLER_ACTION_EVENT, onControllerActionEvent);
    window.removeEventListener("resize", onResize);
    runtime.motionQuery?.removeEventListener?.("change", onMotionPreferenceChange);
    runtime.motionQuery = null;
    closePicker();
    runtime.dom = null;
    runtime.config = null;
    runtime.currentId = null;
}

function onControllerActionEvent(event) {
    handleControllerAction(event?.detail);
}

function onVisibilityChange() {
    runtime.hidden = document.hidden;
    const root = runtime.dom?.root;
    if (!root) return;
    root.classList.toggle("is-page-hidden", runtime.hidden);
    if (!runtime.hidden) scheduleIdleHold();
    // 页面不可见时彻底停掉网格模型的 rAF，不只是暂停渲染
    syncMeshRunning();
}

function onMotionPreferenceChange() {
    runtime.reduced = prefersReducedMotion();
    runtime.dom?.root?.classList.toggle("is-reduced-motion", runtime.reduced);
    runtime.meshModel?.setReducedMotion?.(runtime.reduced);
    if (runtime.reduced) onBattlePointerLeave();
    else scheduleIdleHold();
}

function onResize() {
    // 只清理跨屏特效（抽卡光线按旧坐标计算），避免残留错位。
    for (const node of runtime.fxNodes) {
        if (node.classList.contains("ctl-draw-beam")) { runtime.fxNodes.delete(node); node.remove(); }
    }
    const model = runtime.meshModel;
    const size = runtime.dom ? measureRig(runtime.dom) : null;
    if (model && size) model.resize(size.width, size.height, size.dpr);
    else if (!model && runtime.config && runtime.dom?.battle?.classList.contains("active")) {
        // 窗口尺寸从 0 恢复（例如决斗台刚显示）时补一次装配
        void activateMeshModel(runtime.config);
    }
}

/* ---- 初始化 ---- */

function onPickerPointerDown(event) {
    if (event.target === runtime.dom?.picker) closePicker();
}

function onDocumentKeyDown(event) {
    const picker = runtime.dom?.picker;
    if (!picker?.classList.contains("active")) return;
    if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...picker.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.disabled && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function bindEvents(dom) {
    document.querySelector("#btn-controller-select")?.addEventListener("click", openPicker);
    document.querySelector("#controller-picker-close")?.addEventListener("click", closePicker);
    dom.picker?.addEventListener("pointerdown", onPickerPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    dom.battle?.addEventListener("pointermove", onBattlePointerMove, { passive: true });
    dom.battle?.addEventListener("pointerleave", onBattlePointerLeave, { passive: true });
    window.addEventListener(CONTROLLER_ACTION_EVENT, onControllerActionEvent);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize, { passive: true });
    runtime.motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    runtime.motionQuery?.addEventListener?.("change", onMotionPreferenceChange);
}

export function initializeController2D() {
    if (!hasDom) return null;
    if (runtime.bound) return runtime.dom?.root || null;
    const dom = resolveDom();
    if (!dom) return null;
    runtime.dom = dom;
    runtime.bound = true;
    runtime.reduced = prefersReducedMotion();
    try {
        runtime.showExperimental = new URLSearchParams(window.location.search).get("controllers") === "all";
    } catch { runtime.showExperimental = false; }
    dom.root.classList.toggle("is-reduced-motion", runtime.reduced);
    bindImageFallback(dom);
    const stored = readStoredControllerId();
    applyController(getRegisteredController(stored) || getDefaultController());
    bindEvents(dom);
    scheduleIdleHold();
    if (typeof window !== "undefined") {
        window.__sekaiController2D = {
            list: () => listControllers().map(item => ({ id: item.id, name: item.name, title: item.title })),
            select: id => selectController(id, { persist: true }),
            state: () => ({ ...runtime.state, currentId: runtime.currentId, locked: runtime.state.locked }),
            reset: () => resetController2D(),
        };
    }
    return dom.root;
}

/* ---- 调试与集成辅助 ---- */

export function getController2DState() {
    return {
        currentId: runtime.currentId,
        bound: runtime.bound,
        backend: runtime.meshModel ? "mesh" : "static",
        meshStats: runtime.meshModel?.stats || null,
        meshId: runtime.meshModel?.id || null,
        meshDebug: runtime.meshModel?.getDebugState?.() || null,
        ambientList: runtime.meshModel?.listAmbient?.() || [],
        active: runtime.state.active,
        locked: runtime.state.locked,
        lowHp: runtime.state.lowHp,
        lastDecision: runtime.lastDecision || null,
        timers: runtime.timers.size,
        fxNodes: runtime.fxNodes.size,
    };
}

/**
 * 统一事件派发。保留旧的单参数调用方式，同时支持完整 detail。
 * 只应在真实游戏逻辑的成功节点调用。
 * 在 jsdom / Node 环境下 CustomEvent 可能不在全局上，这里取 `window.CustomEvent` 兜底。
 */
export function emitControllerAction(type, detail = {}) {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
    const EventCtor = typeof window.CustomEvent === "function"
        ? window.CustomEvent
        : (typeof CustomEvent === "function" ? CustomEvent : null);
    if (!EventCtor) return;
    window.dispatchEvent(new EventCtor(CONTROLLER_ACTION_EVENT, {
        detail: { ...normalizeDetail(detail), type },
    }));
}
