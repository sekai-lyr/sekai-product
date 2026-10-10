/**
 * verify-live2d-runtime.mjs — Live2D Cubism 接入验收（Node / 无 WebGL）
 *
 * 这版是**真正跑起来**的验收，不再是"文件存在 + JSON 能解析"：
 *   · 用 jsdom + 真实 <script> 把官方 Core 跑起来（见 tools/lib/cubism-core.mjs），
 *     由它真解析 hiyori 的 .moc3（29 个参数 / 83 个绘制对象）
 *   · 装上物理、自动眨眼、呼吸、8 段动作
 *   · 以 60fps 推进求值循环，断言参数值**确实随时间变化** —— 这一条才能真正证明
 *     "运行时在动"，而不是"能 import 而已"
 *   · 断言动作组可切换、优先级可抢占、循环动作不会立刻结束
 *   · 断言 MVP 矩阵可计算（渲染层唯一依赖的数学）
 *
 * 唯一不在 Node 覆盖的是 renderer.drawModel()（需要真实 WebGL 上下文），
 * 由浏览器侧的 controller-live2d-model.js 负责；本脚本会如实标注。
 *
 * 用法：node SekaiGame/tools/verify-live2d-runtime.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadCubismCoreInNode, readArrayBuffer } from "./lib/cubism-core.mjs";

const STATIC = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));
const VENDOR = `${STATIC}js/vendor/live2d/`;
const MODEL_DIR = `${STATIC}assets/models/hiyori/`;
const MODEL_JSON = "hiyori_free_t08.model3.json";
const MOC_FILE = "hiyori_free_t08.moc3";

const results = [];
const check = (ok, name, extra = "") => results.push({ ok: !!ok, name, extra });
const skip = (name, extra = "") => results.push({ ok: true, skipped: true, name, extra });

const noop = () => {};

/* ------------------------------------------------------------------ *
 * 1. Core：jsdom + 真实 <script> + 真实 WebAssembly
 * ------------------------------------------------------------------ */
const corePath = `${VENDOR}live2dcubismcore.min.js`;
check(existsSync(corePath), "Cubism Core 已 vendor",
    existsSync(corePath) ? `${(readFileSync(corePath).length / 1024).toFixed(0)} KB` : "缺失");
const mocPath = `${MODEL_DIR}${MOC_FILE}`;
check(existsSync(mocPath), "hiyori .moc3 已就位",
    existsSync(mocPath) ? `${(readFileSync(mocPath).length / 1024).toFixed(0)} KB` : "缺失");

let core = null;
if (existsSync(corePath) && existsSync(mocPath)) {
    try {
        const loaded = await loadCubismCoreInNode(corePath, { probeBuffer: readArrayBuffer(mocPath) });
        core = loaded.core;
        check(true, "Cubism Core 在真实 DOM 环境下完成实例化（wasm2js runtime 就绪）");
    } catch (error) {
        check(false, "Cubism Core 实例化", String(error?.message || error));
    }
}

if (core) {
    try {
        const model = core.Model.fromMoc(core.Moc.fromArrayBuffer(readArrayBuffer(mocPath)));
        check(model.parameters.count === 29, "Core 真解析 .moc3：参数数量", String(model.parameters.count));
        check(model.drawables.count === 83, "Core 真解析 .moc3：绘制对象数量", String(model.drawables.count));
        const ids = [];
        for (let i = 0; i < Math.min(6, model.parameters.count); i++) ids.push(model.parameters.ids[i]);
        check(ids.includes("ParamAngleX") && ids.includes("ParamEyeLOpen"), "可读取标准参数 id", ids.join(", "));
    } catch (error) {
        check(false, "Core 解析 .moc3", String(error?.message || error));
    }
}

/* ------------------------------------------------------------------ *
 * 2. 让被测模块能在 Node 里跑：window / document / fetch / Image
 * ------------------------------------------------------------------ */
if (core) globalThis.Live2DCubismCore = core;
globalThis.window = globalThis;
globalThis.document = {
    createElement: () => ({ setAttribute: noop, addEventListener: noop, remove: noop, style: {} }),
    head: { appendChild: noop },
};
globalThis.Image = class { set src(_value) {} };

const localFetch = async url => {
    const relative = String(url).replace(/^https?:\/\/[^/]+\//, "").replace(/^\.?\//, "");
    const file = `${STATIC}${relative}`;
    if (!existsSync(file)) {
        return { ok: false, status: 404, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) };
    }
    const buffer = readFileSync(file);
    return {
        ok: true,
        status: 200,
        text: async () => buffer.toString("utf8"),
        arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
};
globalThis.fetch = localFetch;

/* ------------------------------------------------------------------ *
 * 3. 框架 ESM + JSON 层
 * ------------------------------------------------------------------ */
const frameworkPath = `${VENDOR}cubism-framework.esm.js`;
check(existsSync(frameworkPath), "框架 ESM 已 vendor",
    existsSync(frameworkPath) ? `${(readFileSync(frameworkPath).length / 1024).toFixed(0)} KB` : "缺失");

const live2d = await import(pathToFileURL(`${STATIC}js/controller-live2d-model.js`).href);
const F = await live2d.loadCubismFramework("");
check(Object.keys(F).length > 50, "框架导出可用", `${Object.keys(F).length} 个导出`);

let setting = null;
if (existsSync(`${MODEL_DIR}${MODEL_JSON}`)) {
    const bytes = new TextEncoder().encode(readFileSync(`${MODEL_DIR}${MODEL_JSON}`, "utf8")).buffer;
    setting = new F.CubismModelSettingJson(bytes, bytes.byteLength);
    check(setting.getModelFileName() === MOC_FILE, "model3.json 解析出 moc 文件名", setting.getModelFileName());
    check(setting.getTextureCount() === 1, "贴图数量", String(setting.getTextureCount()));
    check(!!setting.getPhysicsFileName(), "解析出物理文件名", setting.getPhysicsFileName());
    const groups = [];
    for (let i = 0; i < setting.getMotionGroupCount(); i++) groups.push(setting.getMotionGroupName(i));
    check(groups.length >= 5, "动作分组已解析", groups.join(" / "));
}

/* ------------------------------------------------------------------ *
 * 4. 完整运行时：装配 → 推进求值循环 → 断言真的在动
 * ------------------------------------------------------------------ */
let runtime = null;
try {
    runtime = await live2d.createLive2DCubismRuntime({
        modelDir: "assets/models/hiyori/",
        modelJson: MODEL_JSON,
        baseUrl: "",
        loadTextures: false,
        log: { log: noop, warn: noop, error: noop },
    });
} catch (error) {
    check(false, "createLive2DCubismRuntime 装配", String(error?.stack || error));
}

if (runtime) {
    const stats = runtime.stats;
    check(stats.parameters === 29, "运行时模型参数数量", String(stats.parameters));
    check(stats.drawables === 83, "运行时模型绘制对象数量", String(stats.drawables));
    check(stats.hasPhysics, "物理设定已装入 CubismPhysics");
    check(stats.motions === 8, "8 段动作全部装入", stats.groups.join(" / "));
    check(runtime.motionGroups.get("Idle")?.length === 3, "Idle 组含 3 段循环动作");

    // 推进 1.5 秒，断言参数确实变化
    const snapshot = () => {
        const map = new Map();
        for (let i = 0; i < runtime.model.getParameterCount(); i++) {
            map.set(i, runtime.model.getParameterValueByIndex(i));
        }
        return map;
    };
    const before = snapshot();
    for (let i = 0; i < 90; i++) runtime.update(1 / 60);
    const after = snapshot();
    let changed = 0, maxDelta = 0, hottest = -1;
    for (const [index, value] of after) {
        const delta = Math.abs(value - (before.get(index) ?? value));
        if (delta > 0.001) changed++;
        if (delta > maxDelta) { maxDelta = delta; hottest = index; }
    }
    const hottestName = hottest >= 0 ? runtime.model.getParameterId(hottest)?.getString?.() ?? `#${hottest}` : "-";
    check(changed >= 3, "推进 1.5 秒后模型参数确实变化（运行时在驱动，不是静止加载）",
        `${changed} 个参数变化，最大 Δ${maxDelta.toFixed(3)} @ ${hottestName}`);

    // 再推进一段，继续变化 → 说明呼吸/眨眼/动作循环是持续的
    const mid = snapshot();
    for (let i = 0; i < 120; i++) runtime.update(1 / 60);
    const late = snapshot();
    let movedAgain = 0;
    for (const [index, value] of late) {
        if (Math.abs(value - (mid.get(index) ?? value)) > 0.001) movedAgain++;
    }
    check(movedAgain >= 3, "继续推进仍在变化（呼吸 / 自动眨眼 / 动作循环持续生效）", `${movedAgain} 个参数`);

    // 参数必须留在合法区间内，否则模型会画歪
    let outOfRange = 0;
    for (let i = 0; i < runtime.model.getParameterCount(); i++) {
        const value = runtime.model.getParameterValueByIndex(i);
        const min = runtime.model.getParameterMinimumValue(i);
        const max = runtime.model.getParameterMaximumValue(i);
        if (!Number.isFinite(value) || value < min - 0.01 || value > max + 0.01) outOfRange++;
    }
    check(outOfRange === 0, "所有参数都在合法区间内（物理/动作没有把模型拉爆）", `${outOfRange} 个越界`);

    // 动作切换与优先级
    check(runtime.playGroup("Tap", 2), "可以播放 Tap 动作组");
    check(runtime.currentMotion.group === "Tap", "当前动作已切到 Tap", JSON.stringify(runtime.currentMotion));
    check(runtime.playGroup("Flick@Body", 3), "高优先级动作可以抢占（Flick@Body, priority=3）");
    check(runtime.currentMotion.group === "Flick@Body", "高优先级抢占生效", JSON.stringify(runtime.currentMotion));
    check(runtime.playGroup("不存在的组") === false, "未知动作组安全返回 false（不抛异常）");
    runtime.playRandomIdle();
    runtime.update(1 / 60);
    check(!runtime.userModel._motionManager.isFinished(), "Idle 循环动作不会立刻结束");

    // 运行时自带 drag 能力（主控已不再使用它——跟随鼠标会压缩原画，
    // 这里只验证 Cubism 运行时本身完好，不暗示有任何接线）
    runtime.setDragging(1, -0.5);
    for (let i = 0; i < 30; i++) runtime.update(1 / 60);
    const angleX = runtime.model.getParameterValueById(F.CubismFramework.getIdManager().getId("ParamAngleX"));
    check(Math.abs(angleX) > 0.5, "运行时 drag 能力完好（setDragging → ParamAngleX）", `ParamAngleX=${angleX.toFixed(2)}`);

    // 渲染层唯一依赖的数学
    const mvp = runtime.computeMvp(360, 480);
    const raw = mvp.getArray ? mvp.getArray() : null;
    check(!!raw && raw.length === 16, "computeMvp 返回 4×4 矩阵");
    if (raw) check(Array.from(raw).every(Number.isFinite), "MVP 矩阵元素全部有限");

    let disposed = false;
    try { runtime.dispose(); disposed = true; } catch (error) { check(false, "释放运行时", String(error?.message || error)); }
    check(disposed, "运行时可正常释放");
}

/* ------------------------------------------------------------------ *
 * 5. 资源完整性 + 如实标注 Node 覆盖不到的部分
 * ------------------------------------------------------------------ */
if (existsSync(`${MODEL_DIR}${MODEL_JSON}`)) {
    const physics = JSON.parse(readFileSync(`${MODEL_DIR}hiyori_free_t08.physics3.json`, "utf8"));
    check((physics?.PhysicsSettings || []).length > 0, "物理规则可解析", `${physics.PhysicsSettings.length} 条`);
}
check(existsSync(`${MODEL_DIR}hiyori_free_t08.2048/texture_00.png`), "贴图文件存在");
check(existsSync(`${MODEL_DIR}hiyori_free_t08.cdi3.json`), "显示信息 cdi3.json 存在");
check(existsSync(`${MODEL_DIR}LICENSE-ReadMe.txt`), "Live2D 示例数据许可说明随附");
const motionDir = `${MODEL_DIR}motion`;
check(existsSync(motionDir) && readdirSync(motionDir).filter(f => f.endsWith(".motion3.json")).length === 8,
    "8 段 motion3.json 文件齐备");

skip("renderer.drawModel()（需要真实 WebGL 上下文）",
    "由浏览器侧 controller-live2d-model.js 负责，实机走 controller-model-preview.html 的 Live2D 栏");

console.log("─ Live2D 运行时验收 ─");
for (const item of results) {
    const mark = item.skipped ? "  ○" : item.ok ? "  ✔" : "  ✖";
    console.log(`${mark} ${item.name}${item.extra ? `  [${item.extra}]` : ""}`);
}
const failed = results.filter(item => !item.ok);
const skipped = results.filter(item => item.skipped);
console.log(`\n合计 ${results.length} 项：通过 ${results.length - failed.length - skipped.length}，`
    + `跳过（浏览器专属）${skipped.length}，失败 ${failed.length}`);
process.exit(failed.length ? 1 : 0);
