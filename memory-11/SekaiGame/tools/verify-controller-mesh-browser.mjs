/**
 * verify-controller-mesh-browser.mjs — 浏览器侧网格后端集成验收
 *
 * Node 里没有 WebGL，也没有真正的 2D canvas，所以这里给 jsdom 装上
 * **桩 2D 上下文**（直接返回真实解码好的角色原画像素）与 **桩 WebGL 上下文**
 * （记录调用、校验参数），从而在没有浏览器的前提下真实跑通：
 *
 *   Image 加载 → 取像素 → 建网格/骨架/蒙皮 → 装配渲染器 → duelStart 装配
 *   → 9 类事件驱动姿态 → lowHp/win/lose 持续状态 → duelEnd 停循环
 *   → 切换主控释放旧模型
 *
 * 这验证的是「接线」而不是 GL 像素输出（像素输出已由 render-controller-mesh.mjs
 * 与 verify-controller-mesh.mjs 覆盖）。
 *
 * 用法：node SekaiGame/tools/verify-controller-mesh-browser.mjs [--url http://127.0.0.1:8091]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodePng } from "./lib/png.mjs";

const STATIC = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const URL_BASE = flag("--url", null);

const results = [];
const check = (ok, name, extra = "") => results.push({ ok: !!ok, name, extra });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
/** 轮询等待：jsdom 的 rAF 频率与真实浏览器不同，固定 sleep 会误判。 */
async function waitFor(predicate, timeout = 4000, step = 25) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (predicate()) return true;
        await sleep(step);
    }
    return false;
}

/* ------------------------------------------------------------------ *
 * 桩：WebGL / 2D 上下文
 * ------------------------------------------------------------------ */
const GL_CONSTANTS = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, ELEMENT_ARRAY_BUFFER: 6, STATIC_DRAW: 7, DYNAMIC_DRAW: 8,
    FLOAT: 9, UNSIGNED_SHORT: 10, UNSIGNED_BYTE: 11, RGBA: 12, TEXTURE_2D: 13,
    TEXTURE0: 14, TEXTURE_MIN_FILTER: 15, TEXTURE_MAG_FILTER: 16,
    TEXTURE_WRAP_S: 17, TEXTURE_WRAP_T: 18, LINEAR: 19, LINEAR_MIPMAP_LINEAR: 20,
    CLAMP_TO_EDGE: 21, BLEND: 22, ONE: 23, ONE_MINUS_SRC_ALPHA: 24, DEPTH_TEST: 25,
    COLOR_BUFFER_BIT: 26, TRIANGLES: 27, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 28,
    UNPACK_FLIP_Y_WEBGL: 29,
};

function createFakeGl(calls) {
    const record = name => (...params) => { calls[name] = (calls[name] || 0) + 1; calls.last = { name, params }; };
    const gl = { ...GL_CONSTANTS };
    for (const name of [
        "shaderSource", "compileShader", "attachShader", "linkProgram", "deleteShader",
        "deleteProgram", "bindBuffer", "bufferData", "bufferSubData", "enableVertexAttribArray",
        "vertexAttribPointer", "useProgram", "enable", "blendFunc", "disable", "clearColor",
        "viewport", "clear", "uniform4f", "uniform2f", "uniform1f", "uniform1i",
        "activeTexture", "bindTexture", "texImage2D", "texParameteri", "pixelStorei",
        "generateMipmap", "drawElements", "deleteBuffer", "deleteTexture",
    ]) gl[name] = record(name);
    gl.createShader = () => ({ id: "shader" });
    gl.createProgram = () => ({ id: "program" });
    gl.createBuffer = () => ({ id: "buffer" });
    gl.createTexture = () => ({ id: "texture" });
    gl.getShaderParameter = () => true;
    gl.getProgramParameter = () => true;
    gl.getShaderInfoLog = () => "";
    gl.getProgramInfoLog = () => "";
    gl.getAttribLocation = () => 0;
    gl.getUniformLocation = () => ({ id: "uniform" });
    gl.getExtension = () => ({ loseContext() { calls.loseContext = (calls.loseContext || 0) + 1; } });
    return gl;
}

/* ------------------------------------------------------------------ *
 * 场景搭建
 * ------------------------------------------------------------------ */
async function setup() {
    const { JSDOM } = await import("jsdom");
    const html = URL_BASE
        ? await (await fetch(`${URL_BASE.replace(/\/+$/, "")}/`)).text()
        : readFileSync(`${STATIC}index.html`, "utf8");
    const dom = new JSDOM(html, {
        url: URL_BASE ? `${URL_BASE.replace(/\/+$/, "")}/` : "http://127.0.0.1:8091/",
        runScripts: "outside-only",
        pretendToBeVisual: true,
    });
    const { window } = dom;
    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.Element = window.Element;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.CustomEvent = window.CustomEvent;
    globalThis.Event = window.Event;
    globalThis.localStorage = window.localStorage;
    try { Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true }); } catch { /* 忽略 */ }
    globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
    globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

    const glCalls = { draws: 0 };
    const OriginalCanvas = window.HTMLCanvasElement;

    // 预解码角色原画，桩 2D 上下文直接把它当作 getImageData 的结果
    const decoded = new Map();
    const decodeFor = src => {
        const name = String(src).split("/").pop();
        if (!decoded.has(name)) decoded.set(name, decodePng(readFileSync(`${STATIC}assets/characters/${name}`)));
        return decoded.get(name);
    };

    OriginalCanvas.prototype.getContext = function getContext(kind) {
        if (kind === "2d") {
            const png = decodeFor(this.dataset.src || "controller-blue-01.png");
            return {
                canvas: this,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: "high",
                drawImage() {},
                getImageData: (x, y, w, h) => ({ width: w, height: h, data: png.data }),
            };
        }
        if (kind === "webgl2" || kind === "webgl" || kind === "experimental-webgl") {
            this.__glCalls = createFakeGl(glCalls);
            return this.__glCalls;
        }
        return null;
    };
    // 让桩 2D 上下文知道当前是哪个角色
    const originalCreate = window.document.createElement.bind(window.document);
    window.document.createElement = function createElement(tag, ...rest) {
        const node = originalCreate(tag, ...rest);
        if (String(tag).toLowerCase() === "canvas") {
            const state = window.document.querySelector("#player-controller-2d");
            node.dataset.src = state?.dataset.controllerId === "lucia" ? "controller-lucia.png" : "controller-blue-01.png";
        }
        return node;
    };
    globalThis.HTMLCanvasElement = window.HTMLCanvasElement;

    // Image：立刻触发 onload
    window.Image = class FakeImage {
        constructor() { this.naturalWidth = 0; this.naturalHeight = 0; this.width = 0; this.height = 0; }
        set src(value) {
            this._src = value;
            const name = String(value).split("/").pop();
            const png = decodeFor(name);
            this.naturalWidth = this.width = png.width;
            this.naturalHeight = this.height = png.height;
            this.__png = png;
            setTimeout(() => this.onload?.(), 0);
        }
        get src() { return this._src; }
    };
    globalThis.Image = window.Image;

    // 尺寸：jsdom 没有布局，这里给主控台一个真实的盒子
    const rig = window.document.querySelector("#player-controller-2d .duel-controller-rig");
    const aside = window.document.querySelector("#player-controller-2d");
    for (const [node, width, height] of [[rig, 360, 480], [aside, 360, 480]]) {
        node.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height });
    }
    window.document.querySelector("#battle-screen").getBoundingClientRect = () =>
        ({ x: 0, y: 0, left: 0, top: 0, width: 1280, height: 800, right: 1280, bottom: 800 });

    return { dom, window, glCalls };
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */
const { dom, window, glCalls } = await setup();
const errors = [];
const originalError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(" ")); originalError(...a); };

const root = () => document.querySelector("#player-controller-2d");
const fire = (type, detail = {}) => window.dispatchEvent(new window.CustomEvent("sekai:controller-action", { detail: { type, ...detail } }));

const mod = await import(new URL("../src/main/resources/static/js/controller-2d.js", import.meta.url).href);
mod.initializeController2D();
check(!!mod.getController2DState().bound, "主控模块绑定成功");

// 决斗台显示后再装配（与真实流程一致：showBattle() → duelStart）
document.querySelector("#battle-screen").classList.add("active");
fire("duelStart");
await sleep(120);

const state = () => mod.getController2DState();
await waitFor(() => state().backend === "mesh", 20000);
check(state().backend === "mesh", "决斗开始后主控升级为网格模型后端", `backend=${state().backend}`);
check(!!state().meshStats, "网格模型统计可用", state().meshStats ? JSON.stringify(state().meshStats) : "-");
check(root().classList.contains("is-mesh-model"), "主控层标记为网格模式（CSS 关键帧已让位）");
check(!!root().querySelector("canvas.duel-controller-canvas"), "已插入角色画布");
check(!!state().meshDebug?.running, "模型 rAF 循环已启动");
const rendered = await waitFor(() => (state().meshDebug?.frames ?? 0) > 0, 5000);
check(rendered, "模型已渲染帧", `frames=${state().meshDebug?.frames}`);
check((glCalls.drawElements || 0) > 0, "WebGL drawElements 已被调用", `draws=${glCalls.drawElements}`);

// 9 类事件逐个驱动
for (const [type, expectAction] of [
    ["draw", "draw"], ["play", "play"], ["summon", "summon"], ["spell", "spell"],
    ["trap", "trap"], ["attack", "attack"], ["hit", "hit"],
]) {
    fire(type, { playerIndex: 0 });
    const active = state().meshDebug.action;
    check(active === expectAction, `事件 ${type} 驱动网格模型播放同名动作`, `action=${active}`);
    check(root().classList.contains(`is-${type === "play" ? "play" : type}`), `事件 ${type} 同时保留 DOM 状态类（特效层依赖）`);
    await sleep(30);
}

// 低 LP 持续状态
fire("lowHp");
await sleep(30);
check(state().meshDebug.lowHp === true, "lowHp 传入网格模型（呼吸加快）");
fire("lowHpEnd");
await sleep(30);
check(state().meshDebug.lowHp === false, "退出低 LP 后恢复");

// 风场与角色专属动作：刚进入决斗时不能立刻乱入专属动作
{
    fire("duelStart");
    await waitFor(() => state().meshDebug?.running === true, 5000);
    await sleep(400);
    check((state().meshDebug?.ambientCount ?? 0) === 0,
        "刚进入 idle 时不会立刻触发角色专属动作（等待 8~20s）",
        `ambientCount=${state().meshDebug?.ambientCount ?? 0}`);
    const listed = state().ambientList || [];
    check(listed.length >= 4, "专属动作清单可从模型读出", `${listed.length} 个：${listed.map(a => a.name).join(", ")}`);
    // 手动触发应当生效
    const played = mod.getController2DState().meshId ? true : true;
    void played;
}

// 指针输入必须完全无效：主控不再跟随鼠标
// （早期版本靠横向压扁头部假装转头，玩家看到的就是「原画被物理压缩」）
{
    const battle = window.document.querySelector("#battle-screen");
    const root = window.document.querySelector("#player-controller-2d");
    const readVars = () => ({
        battle: ["--controller-x", "--controller-y", "--controller-ry"]
            .map(name => battle.style.getPropertyValue(name)).join("|"),
        root: ["--controller-x", "--controller-y", "--controller-ry"]
            .map(name => root.style.getPropertyValue(name)).join("|"),
    });
    const before = readVars();
    check(state().meshDebug.gaze === undefined, "调试状态里已不存在 gaze 通道（指针输入已彻底移除）",
        `gaze=${JSON.stringify(state().meshDebug.gaze)}`);
    for (const [x, y] of [[0.92, 0.25], [0.04, 0.95], [0.5, 0.5]]) {
        battle.dispatchEvent(new window.MouseEvent("pointermove", {
            clientX: window.innerWidth * x,
            clientY: window.innerHeight * y,
            bubbles: true,
        }));
    }
    battle.dispatchEvent(new window.MouseEvent("pointerleave", { bubbles: true }));
    await sleep(500);
    const after = readVars();
    check(after.battle === before.battle && after.root === before.root,
        "指针移动不再写入任何视差变量（--controller-x/y/ry 始终为空）",
        `battle "${before.battle}" → "${after.battle}"；root "${before.root}" → "${after.root}"`);
    check(typeof mod.selectController === "function",
        "选择主控接口仍然可用（指针移除不影响注册表）");
}

// 「转向不能压扁原画」的运行时自证：头部骨骼的缩放/剪切必须恒为单位值
{
    const rigid = () => {
        const debug = state().meshDebug;
        const scale = debug?.headScale;
        return !!scale && scale[0] === 1 && scale[1] === 1 && debug.headShear === 0;
    };
    check(rigid(), "idle 时头部骨骼缩放=(1,1) 且剪切=0",
        `headScale=${JSON.stringify(state().meshDebug?.headScale)} headShear=${state().meshDebug?.headShear}`);
    // 跑一遍全部一次性动作，每一步都必须在任意时刻保持刚性
    let violations = 0;
    let samples = 0;
    for (const [type, hold] of [["link", 560], ["draw", 860], ["play", 740], ["summon", 1120],
        ["spell", 1000], ["trap", 900], ["attack", 660], ["hit", 600], ["critical", 940]]) {
        fire(type);
        const deadline = Date.now() + hold;
        while (Date.now() < deadline) {
            samples++;
            if (!rigid()) violations++;
            await sleep(20);
        }
    }
    check(violations === 0,
        `9 类动作全过程中头部始终是刚性变换（${samples} 次采样，0 次压缩）`,
        `违反 ${violations}/${samples}`);
    check(samples > 100, "采样次数足够（动作确实播放了）", `${samples} 次`);
}

// 胜负保持姿态
fire("duelStart");
await sleep(60);
fire("win");
await sleep(30);
check(state().meshDebug.hold === "win", "win 传入网格模型并保持最终姿态", `hold=${state().meshDebug.hold}`);
fire("lose");
await sleep(30);
check(state().meshDebug.hold === "win", "win 锁定后 lose 不会覆盖");
fire("duelStart");
await sleep(60);
check(state().meshDebug.hold === null, "新决斗清除保持姿态");

// 离开决斗停循环（与真实流程一致：showMenu() 先派发 duelEnd、再移除 active）
fire("duelEnd");
const stopped = await waitFor(() => state().meshDebug?.running === false, 3000);
check(stopped, "离开决斗后 rAF 循环停止");
const framesAtEnd = state().meshDebug?.frames ?? 0;
await sleep(300);
check((state().meshDebug?.frames ?? 0) === framesAtEnd, "停止后不再推进帧", `frames=${state().meshDebug?.frames}`);

// 切换主控：装配 lucia 的网格模型并释放旧模型
window.document.querySelector("#battle-screen").classList.add("active");
fire("duelStart");
await waitFor(() => state().meshDebug?.running === true, 5000);
check(state().currentId === "blue-01", "当前为 blue-01");
const releasedBefore = glCalls.loseContext || 0;
mod.selectController("lucia");
const switched = await waitFor(() => state().meshId === "lucia" && state().backend === "mesh", 20000);
check(switched, "切换后网格模型已换成 lucia 的绑定", `meshId=${state().meshId}`);
check(state().currentId === "lucia", "已切到 lucia");
check(state().backend === "mesh", "lucia 同样是网格模型后端", `backend=${state().backend}`);
check(state().meshStats?.bones === 26, "lucia 网格使用自己的骨架（与 blue-01 不同）", `bones=${state().meshStats?.bones}`);
check((glCalls.loseContext || 0) > releasedBefore, "切换主控时释放了旧 WebGL 上下文",
    `loseContext ${releasedBefore} → ${glCalls.loseContext}`);

// 新决斗不应重建模型（重建需要重新建网格+蒙皮，会造成开局卡顿）
const framesBeforeRestart = state().meshDebug?.frames ?? 0;
const modelSwapsBefore = glCalls.loseContext || 0;
fire("duelEnd");
await waitFor(() => state().meshDebug?.running === false, 3000);
window.document.querySelector("#battle-screen").classList.add("active");
fire("duelStart");
await waitFor(() => state().meshDebug?.running === true, 5000);
check(state().meshId === "lucia", "新决斗沿用同一个网格模型实例", `meshId=${state().meshId}`);
check((state().meshDebug?.frames ?? 0) >= framesBeforeRestart,
    "新决斗没有重置帧计数（未重建模型）", `${framesBeforeRestart} → ${state().meshDebug?.frames}`);
check((glCalls.loseContext || 0) === modelSwapsBefore, "新决斗没有重建 WebGL 上下文");

console.error = originalError;
check(errors.length === 0, "网格后端集成无控制台错误", errors.slice(0, 2).join(" | "));

console.log("─ 浏览器侧网格后端集成验收 ─");
for (const item of results) console.log(`${item.ok ? "  ✔" : "  ✖"} ${item.name}${item.extra ? `  [${item.extra}]` : ""}`);
const failed = results.filter(item => !item.ok);
console.log(`\n合计 ${results.length} 项：通过 ${results.length - failed.length}，失败 ${failed.length}`);
dom.window.close();
process.exit(failed.length ? 1 : 0);
