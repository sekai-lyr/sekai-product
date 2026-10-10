/**
 * lib/cubism-core.mjs — 在 Node 里以「浏览器等价」的方式加载 Live2D Cubism Core
 *
 * 踩过的两个坑，都记在这里免得后人重走：
 *
 *  1. Core 是 Emscripten wasm2js 构建 —— WASM 已被翻译成 JS 内嵌在同一个文件里，
 *     没有外部 .wasm 依赖。但它仍然走**异步**初始化：
 *       new Promise(a=>a(ta())).then(...).then(exports => module.asm = exports)
 *
 *  2. 就绪判据不能用 `Core.asm`。Core 把 `asm` 挂在内部的 Emscripten Module 上，
 *     而 `Live2DCubismCore` 是另一个对象；在 jsdom 里跑通之后
 *     `Core.asm` 依然是 undefined，但 `Core.Moc.fromArrayBuffer` 已经完全可用。
 *     → 正确的判据是**真的去解析一次 .moc3**，成功即就绪。
 *
 *  3. 用 `new Function` 或 `node:vm` 造沙箱都会失败：Core 在模块作用域做
 *     `var WebAssembly = {}` 的遮蔽、并按脚本目录推断路径，脱离真实 DOM 后
 *     这条链不会完成。**最可靠的做法是 jsdom + 真实 <script> 注入**，
 *     再把 Node 的真实 WebAssembly 注入 jsdom window（jsdom 自己不提供）。
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** 优先按包名解析（Node 会沿目录向上找到仓库根的 node_modules），失败再退回绝对路径 */
async function importJsdom() {
    try {
        return await import("jsdom");
    } catch {
        const fallback = pathToFileURL(
            new URL("../../../node_modules/jsdom/lib/api.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
        ).href;
        return import(fallback);
    }
}

/**
 * @param {string} corePath  live2dcubismcore.min.js 的绝对路径
 * @param {{probeBuffer?: ArrayBuffer, timeoutMs?: number}} [options]
 *        probeBuffer 提供时会反复尝试解析它，直到成功（这是唯一可靠的就绪判据）。
 * @returns {Promise<{core: object, window: object, document: object}>}
 */
export async function loadCubismCoreInNode(corePath, options = {}) {
    const { JSDOM, VirtualConsole } = await importJsdom();
    const source = readFileSync(corePath, "utf8");
    // 静默 jsdom 的控制台：Core 在 runtime 就绪前被调用会抛异常，
    // jsdom 会把它当"窗口内未捕获异常"打到 stderr，把真正的输出淹掉。
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
        runScripts: "dangerously",
        pretendToBeVisual: true,
        url: "http://127.0.0.1:8091/",
        virtualConsole,
    });
    // jsdom 不实现 WebAssembly，必须把 Node 的真实实现注入进去
    Object.defineProperty(dom.window, "WebAssembly", { value: WebAssembly, configurable: true, writable: true });
    const script = dom.window.document.createElement("script");
    script.textContent = source;
    dom.window.document.head.appendChild(script);

    const timeoutMs = options.timeoutMs ?? 8000;
    const deadline = Date.now() + timeoutMs;
    const probe = options.probeBuffer;
    // wasm2js 的 runtime 初始化是异步的，先给它一点时间再做第一次探测，
    // 免得每次都从"未就绪"的异常路径走一遍。
    await new Promise(resolve => setTimeout(resolve, options.settleMs ?? 250));
    while (Date.now() < deadline) {
        const core = dom.window.Live2DCubismCore;
        if (core && typeof core.Moc?.fromArrayBuffer === "function") {
            if (!probe) return { core, window: dom.window, document: dom.window.document };
            try {
                // 真正解析一次才算就绪（asm 标志不可信，见文件头注释）
                const moc = core.Moc.fromArrayBuffer(probe);
                if (moc) return { core, window: dom.window, document: dom.window.document };
            } catch { /* 还没就绪，继续等 */ }
        }
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error("Live2D Core 未在超时内就绪");
}

/** 读一个文件成 ArrayBuffer（.moc3 是二进制，不能用字符串中转） */
export function readArrayBuffer(path) {
    const buffer = readFileSync(path);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * 判断 Core 是否可用；不可用时返回原因字符串，便于验收脚本如实汇报。
 * @returns {{ok: boolean, reason?: string}}
 */
export function describeCoreAvailability(core) {
    if (!core) return { ok: false, reason: "未加载" };
    if (typeof core.Moc?.fromArrayBuffer !== "function") return { ok: false, reason: "未暴露 Moc.fromArrayBuffer" };
    return { ok: true };
}
