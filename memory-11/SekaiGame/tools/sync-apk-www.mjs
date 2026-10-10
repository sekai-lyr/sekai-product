// 把桌面 Web 源同步进 APK 内置副本 (android-app/app/src/main/assets/www)。
//
// 重要：www 不是 static 的纯拷贝，它带有三处移动端专属改动，绝不能被覆盖：
//   1. index.html            额外引入 css/mobile-perf.css
//   2. js/main.js            离线模式逻辑（appassets.androidplatform.net 免登录等）
//   3. js/authored-card-scenes.js  图集从 images/vfx/*.png 改为 images/vfx-mobile/*.webp
// 因此这三份文件走"搬运 + 重新施加移动端替换"，其余文件才直接拷贝。
//
//   node tools/sync-apk-www.mjs           # 执行同步
//   node tools/sync-apk-www.mjs --check   # 只校验，不写入
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, "..");
const WEB = path.join(GAME, "src/main/resources/static");
const WWW = path.join(GAME, "android-app/app/src/main/assets/www");
const CHECK = process.argv.includes("--check");

// 可以直接整份拷贝的文件：www 与 static 的差异只来自版本号/本批次改动。
const VERBATIM = [
    "js/trap-atlas-profiles.js",
    "js/card-performance.js",
    "js/card-performance-fx.js",
    "js/authored-card-scenes.js", // 见下方特殊处理（拷贝后再施加移动端替换）
    "js/card-scene-language.js",
    "js/card-storyboards.js",
    "js/effects.js",
    "js/app.js",
    "js/controller.js",
    "js/ui.js",
];
// 只校验、不拷贝：这些文件带有移动端专属逻辑。
const PATCHED = ["index.html", "js/main.js"];

const MOBILE_URL = {
    from: "background:url('/images/vfx/${sheet}?v=trap-independent-1')",
    to: 'background:url(\'images/vfx-mobile/${sheet.replace(".png",".webp")}?v=trap-quality-3\')',
};

const problems = [];
const applied = [];

/* 1. 整份拷贝（authored-card-scenes.js 需要额外替换图集路径） */
for (const rel of VERBATIM) {
    const src = path.join(WEB, rel);
    const dst = path.join(WWW, rel);
    if (!existsSync(src)) { problems.push(`缺少源文件 ${rel}`); continue; }
    let text = readFileSync(src, "utf8");
    if (rel === "js/authored-card-scenes.js") {
        if (!text.includes(MOBILE_URL.from)) { problems.push(`${rel}: 找不到图集 URL 锚点，移动端替换无法施加`); continue; }
        text = text.replace(MOBILE_URL.from, MOBILE_URL.to);
        if (!text.includes("images/vfx-mobile/")) { problems.push(`${rel}: 移动端图集路径替换失败`); continue; }
    }
    const current = existsSync(dst) ? readFileSync(dst, "utf8") : null;
    if (current === text) continue;
    if (!CHECK) {
        mkdirSync(path.dirname(dst), { recursive: true });
        writeFileSync(dst, text);
    }
    applied.push(rel);
}

/* 2. 移动端专属文件：只确认它们还在，绝不覆盖 */
const guards = [
    ["index.html", "css/mobile-perf.css", "移动端性能样式表"],
    ["js/main.js", "appassets.androidplatform.net", "离线模式域名白名单"],
    ["js/authored-card-scenes.js", "images/vfx-mobile/", "移动端图集目录"],
];
for (const [rel, needle, label] of guards) {
    const file = path.join(WWW, rel);
    const text = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (!text.includes(needle)) problems.push(`${rel}: 丢失 ${label}（${needle}）`);
}

/* 3. 陷阱图集素材：APK 只内置 webp 版，源 png 不打包 */
const sheetProfiles = readFileSync(path.join(WEB, "js/trap-atlas-profiles.js"), "utf8");
const sheets = [...sheetProfiles.matchAll(/"([a-z0-9-]+-sheet-v[12]\.png)"/g)].map(m => m[1]);
const trapSheets = [...new Set(sheets)].filter(s => s.startsWith("trap-"));
const missingWebp = trapSheets.filter(s => !existsSync(path.join(WWW, "images/vfx-mobile", s.replace(/\.png$/, ".webp"))));
if (missingWebp.length) problems.push(`vfx-mobile 缺少 ${missingWebp.length} 个陷阱图集: ${missingWebp.slice(0, 3).join(", ")}${missingWebp.length > 3 ? " …" : ""}`);

/* 4. 版本号一致性：APK 内置副本的版本串必须与 Web 源完全一致（否则会加载到旧模块） */
const pick = text => [...text.matchAll(/from "(\.\/(?:ui|controller|app|effects|card-performance|card-performance-fx|authored-card-scenes|card-storyboards|card-scene-language|trap-atlas-profiles)\.js\?v=[\w.\-]+)"/g)]
    .map(m => m[1]).sort();
const webMain = readFileSync(path.join(WEB, "index.html"), "utf8");
const html = readFileSync(path.join(WWW, "index.html"), "utf8");
const mainVersion = (html.match(/js\/main\.js\?v=([\w.\-]+)/) || [])[1];
const webMainVersion = (webMain.match(/js\/main\.js\?v=([\w.\-]+)/) || [])[1];
if (mainVersion !== webMainVersion) problems.push(`main.js 入口版本不一致: apk=${mainVersion} web=${webMainVersion}`);
const apkRefs = pick(readFileSync(path.join(WWW, "js/main.js"), "utf8")), webRefs = pick(readFileSync(path.join(WEB, "js/main.js"), "utf8"));
if (JSON.stringify(apkRefs) !== JSON.stringify(webRefs)) {
    problems.push(`main.js 模块版本不一致:\n  apk=${apkRefs.join(",")}\n  web=${webRefs.join(",")}`);
}
for (const rel of ["js/effects.js", "js/app.js", "js/controller.js", "js/ui.js", "js/card-performance.js", "js/card-performance-fx.js", "js/authored-card-scenes.js", "js/card-storyboards.js", "js/card-scene-language.js"]) {
    const a = pick(readFileSync(path.join(WWW, rel), "utf8"));
    const b = pick(readFileSync(path.join(WEB, rel), "utf8"));
    if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${rel} 模块版本不一致: apk=${a.join(",")} web=${b.join(",")}`);
}

console.log(JSON.stringify({
    mode: CHECK ? "check" : "sync",
    copiedOrChanged: applied,
    trapSheets: trapSheets.length,
    vfxMobileMissing: missingWebp.length,
    mainJsVersion: mainVersion,
    problems,
}, null, 2));
if (problems.length) process.exitCode = 1;
