/**
 * fetch-live2d-framework.mjs — 取回 Live2D Cubism Web Framework 并打包成单文件 ESM
 *
 * 为什么要自己打包：
 *   Live2D 官方只发布 TypeScript 源码，npm 上没有官方预编译包，浏览器不能直接跑 .ts。
 *
 * ⚠ 必须与 Core 同源！曾经踩过的坑：
 *   最初从 GitHub Live2D/CubismWebFramework@develop 取框架、从 CDN 取 Core，
 *   结果两边版本不匹配 —— 官方 Core 的签名是
 *       Version.csmGetMocVersion(moc: Moc, mocBytes: ArrayBuffer)
 *   而那个版本的框架只传一个参数，于是 `loadModel()` 必然抛
 *       TypeError: Cannot read properties of undefined (reading 'byteLength')
 *   —— 而且这个错误在 Node 里"文件都在、JSON 都能解析"时完全看不出来。
 *   现在**框架与 Core 都从同一份官方 SDK zip 里取**，版本天然对齐。
 *
 * 用法：
 *   node SekaiGame/tools/fetch-live2d-framework.mjs [--sdk <zip 路径>]
 *   默认 SDK：<repo>/.tools/cubism-sdk/sdk.zip（CubismSdkForWeb-5-r.4）
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };

const STATIC = fileURLToPath(new URL("../src/main/resources/static/", import.meta.url));
const VENDOR = `${STATIC}js/vendor/live2d/`;
const BUILD_ROOT = fileURLToPath(new URL("../../.tools/cubism-build/", import.meta.url));
const WORK = `${BUILD_ROOT}sdk-framework/src/`;
const DEFAULT_SDK = fileURLToPath(new URL("../../.tools/cubism-sdk/sdk.zip", import.meta.url));
const SDK_ZIP = flag("--sdk", DEFAULT_SDK);

mkdirSync(VENDOR, { recursive: true });
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

if (!existsSync(SDK_ZIP)) {
    console.error(`找不到官方 SDK zip：${SDK_ZIP}`);
    console.error("下载地址（官方）：https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-5-r.4.zip");
    process.exit(2);
}

/* ------------------------------------------------------------------ *
 * 1. 从 SDK zip 解出 Framework/src/**（与 Core 同源，版本天然对齐）
 * ------------------------------------------------------------------ */
console.log(`▶ 从官方 SDK 解出 Framework：${SDK_ZIP}`);
const { execFileSync } = await import("node:child_process");
// 用 PowerShell 的 Expand-Archive 解压整个 zip 到临时目录（zip 内路径带顶层目录名）
const expandRoot = `${BUILD_ROOT}sdk-extract/`;
rmSync(expandRoot, { recursive: true, force: true });
mkdirSync(expandRoot, { recursive: true });
execFileSync("powershell", [
    "-NoProfile", "-NonInteractive", "-Command",
    `Expand-Archive -LiteralPath '${SDK_ZIP}' -DestinationPath '${expandRoot}' -Force`,
], { stdio: "inherit" });

const sdkRoot = readdirSync(expandRoot).map(name => `${expandRoot}${name}`).find(path => existsSync(`${path}/Framework/src`));
if (!sdkRoot) throw new Error("SDK 解压后找不到 Framework/src");
const frameworkSrc = `${sdkRoot}/Framework/src`;
const sdkVersion = existsSync(`${sdkRoot}/Framework/package.json`)
    ? JSON.parse(readFileSync(`${sdkRoot}/Framework/package.json`, "utf8")).version ?? "unknown"
    : "unknown";
console.log(`  SDK 目录：${sdkRoot}`);
console.log(`  框架版本：${sdkVersion}`);

/** 递归收集 src 下的 .ts（排除 .d.ts） */
function collectSources(dir, prefix = "") {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const rel = `${prefix}${entry.name}`;
        if (entry.isDirectory()) out.push(...collectSources(`${dir}/${entry.name}`, `${rel}/`));
        else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(rel);
    }
    return out;
}
const sources = collectSources(frameworkSrc);
console.log(`  源文件 ${sources.length} 个`);
for (const relative of sources) {
    const target = `${WORK}${relative}`;
    mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    writeFileSync(target, readFileSync(`${frameworkSrc}/${relative}`, "utf8"), "utf8");
}

/* ------------------------------------------------------------------ *
 * 2. 顺带用同一份 SDK 覆盖 Core，杜绝 Core/框架版本漂移
 * ------------------------------------------------------------------ */
const sdkCore = `${sdkRoot}/Core/live2dcubismcore.min.js`;
if (existsSync(sdkCore)) {
    writeFileSync(`${VENDOR}live2dcubismcore.min.js`, readFileSync(sdkCore));
    console.log(`  ✔ 同步覆盖 Core（${(readFileSync(sdkCore).length / 1024).toFixed(0)} KB）`);
}

// 入口：把框架所有模块的导出扁平合并成一个命名空间，方便运行时按需取用
const modules = sources.map(path => path.replace(/\.ts$/, ""));
const entryLines = [
    "// 由 tools/fetch-live2d-framework.mjs 生成：把 Cubism Web Framework 的全部导出聚合到一处。",
    ...modules.map((name, index) => `import * as m${index} from "./${name}";`),
    "const merged = {};",
    ...modules.map((_, index) => `Object.assign(merged, m${index});`),
    "export default merged;",
    "export { merged };",
];
writeFileSync(`${WORK}__entry.ts`, entryLines.join("\n"), "utf8");

const outfile = `${VENDOR}cubism-framework.esm.js`;
console.log("▶ esbuild 打包…");
// 直接用 esbuild 的 Node API：在 Windows 上比 execFileSync 调 .cmd 稳得多
const esbuild = await import(pathToFileURL(`${BUILD_ROOT}node_modules/esbuild/lib/main.js`).href);
await esbuild.build({
    entryPoints: [`${WORK}__entry.ts`],
    bundle: true,
    format: "esm",
    target: "es2020",
    minify: true,
    outfile,
    logLevel: "warning",
});

const bytes = readFileSync(outfile).length;
writeFileSync(`${VENDOR}cubism-framework.version.txt`,
    `CubismSdkForWeb（Core 与 Framework 同源）\nSDK 目录: ${sdkRoot.split(/[\\/]/).pop()}\n框架版本: ${sdkVersion}\n`
    + `打包时间: ${new Date().toISOString()}\n源文件: ${sources.length}\n产物字节: ${bytes}\n`, "utf8");
console.log(`✔ 产物 ${outfile} (${(bytes / 1024).toFixed(0)} KB)`);
console.log(`  Core 需要单独加载: js/vendor/live2d/live2dcubismcore.min.js（官方 CDN 分发，未在本步骤内）`);

if (!existsSync(`${VENDOR}live2dcubismcore.min.js`)) {
    console.warn("⚠ 缺少 live2dcubismcore.min.js —— 运行时需要它解析 .moc3");
}
