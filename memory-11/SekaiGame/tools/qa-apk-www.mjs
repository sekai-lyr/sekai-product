// APK 内置副本的端到端校验：直接把 android-app/.../assets/www 当作 WebView 的根目录起服务，
// 走与 MainActivity 相同的路径（index.html -> js/main.js 链路 -> images/vfx-mobile/*.webp），
// 逐张确认陷阱卡演出真的能取到并解码自己的 webp。
//   node tools/qa-apk-www.mjs
import { chromium } from "../../.tools/rules-qa/node_modules/playwright/index.mjs";
import http from "node:http";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, "..");
const WWW = path.join(GAME, "android-app/app/src/main/assets/www");
const CHROME = "C:/Users/administration/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };

const server = http.createServer(async (req, res) => {
    try {
        const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
        const file = path.join(WWW, rel);
        if (!file.startsWith(WWW)) { res.writeHead(403).end(); return; }
        const body = await readFile(file);
        res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
        res.end(body);
    } catch { res.writeHead(404).end("not found"); }
});
const port = await new Promise(r => server.listen(0, "127.0.0.1", () => r(server.address().port)));

async function openBrowser() {
    const executablePath = existsSync(CHROME) ? CHROME : undefined;
    try {
        const browser = await chromium.launch({ executablePath, headless: true });
        return { browser, close: () => browser.close() };
    } catch (error) {
        if (!/EPERM|spawn/i.test(String(error?.message))) throw error;
    }
    const profile = path.join(GAME, "android-app/build/_qa-profile");
    const cdp = 9500 + (process.pid % 300);
    const child = spawn(executablePath, ["--headless=new", `--remote-debugging-port=${cdp}`, `--user-data-dir=${profile}`,
        "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "--force-color-profile=srgb", "about:blank"],
        { stdio: "ignore", windowsHide: true });
    let browser = null;
    for (let i = 0; i < 120 && !browser; i++) {
        await new Promise(r => setTimeout(r, 250));
        try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdp}`); } catch { /* pending */ }
    }
    if (!browser) { child.kill(); throw new Error("chrome CDP endpoint never became ready"); }
    return { browser, close: async () => { await browser.close().catch(() => {}); child.kill(); } };
}

const session = await openBrowser();
const context = session.browser.contexts()[0] || await session.browser.newContext();
const page = await context.newPage();
await page.setViewportSize({ width: 390, height: 844 }); // 手机视口，和 APK 实际使用场景一致
const errors = [];
page.on("pageerror", e => errors.push(`pageerror: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !/favicon|404/i.test(m.text())) errors.push(`console: ${m.text()}`); });

try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const report = await page.evaluate(async () => {
        document.querySelector("#auth-screen")?.classList.add("hidden");
        const { ALL_CARDS } = await import("./js/catalog.js");
        const { VFX_CARD_PROFILES } = await import("./js/authored-card-scenes.js");
        const { playCardPerformance } = await import("./js/card-performance-fx.js");
        const traps = ALL_CARDS.filter(c => c.type === "trap");
        const fails = [];
        let checked = 0;
        for (const card of traps) {
            const profile = VFX_CARD_PROFILES[card.id];
            if (!profile) { fails.push(`${card.id}: 没有图集登记`); continue; }
            const W = innerWidth, H = innerHeight;
            const slot = { left: W * .5 - 50, top: H * .55, width: 100, height: 130 };
            const done = playCardPerformance(card, "trap", slot, slot);
            const layer = document.querySelector(`[data-card-performance="${card.id}"]`);
            if (!layer) { fails.push(`${card.id}: 没有演出层`); continue; }
            const atlas = [...layer.querySelectorAll("div")].find(n => String(n.style.backgroundImage || "").includes("-sheet-v1.webp"));
            if (!atlas) { fails.push(`${card.id}: 没有使用 webp 图集节点`); continue; }
            const url = (String(atlas.style.backgroundImage).match(/url\(['"]?(.*?)['"]?\)/) || [])[1];
            const want = `images/vfx-mobile/${profile.sheet.replace(/\.png$/, ".webp")}`;
            if (url !== want) fails.push(`${card.id}: 图集路径为 ${url}，期望 ${want}`);
            // 真正把这张 webp 解码出来，确认 APK 里确实打包了它。
            const loaded = await new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => resolve({ ok: false });
                img.src = url;
            });
            if (!loaded.ok) { fails.push(`${card.id}: ${url} 无法加载`); continue; }
            if (loaded.w !== loaded.h || loaded.w % 4 !== 0) fails.push(`${card.id}: webp 尺寸 ${loaded.w}x${loaded.h} 不是 4×4 等分网格`);
            atlas.style.opacity = "1";
            const box = atlas.getBoundingClientRect();
            if (box.right > W + 1 || box.left < -1) fails.push(`${card.id}: 图集超出手机视口`);
            for (const animation of layer.getAnimations({ subtree: true })) animation.finish();
            await done;
            checked++;
        }
        return { traps: traps.length, checked, fails, online: location.hostname };
    });
    assert.deepEqual(errors, [], `www 控制台错误: ${errors.join(" | ")}`);
    assert.deepEqual(report.fails, [], "APK 内置副本校验失败");
    console.log(JSON.stringify({ viewport: "390x844", ...report, consoleErrors: errors.length }, null, 2));
    console.log("APK 内置副本（www）通过：45 张陷阱卡的 webp 图集路径正确、可解码、不溢出手机视口。");
} finally {
    await session.close();
    server.close();
}
