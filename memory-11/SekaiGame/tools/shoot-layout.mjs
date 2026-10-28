/**
 * shoot-layout.mjs —— 用真实 Chromium 在多个视口下走一遍所有页面并截图。
 *
 * 为什么必须用真浏览器：jsdom 没有排版引擎，媒体查询、flex/grid、vh/vw、
 * 触摸目标尺寸这些东西它一概算不出来。移动端适配的验收只能靠真实排版。
 *
 * 用法：
 *   node SekaiGame/tools/shoot-layout.mjs                     # 全部视口 × 全部页面
 *   node SekaiGame/tools/shoot-layout.mjs --profile phone     # 只跑手机档
 *   node SekaiGame/tools/shoot-layout.mjs --dump home         # 打印某页面的可见按钮/文本
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pw = require("D:/Sekai_two/memory-11/.tools/rules-qa/node_modules/playwright");

const OUT = fileURLToPath(new URL("./out/layout/", import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const BASE = flag("--url", "http://127.0.0.1:8091");
const ONLY_PROFILE = flag("--profile", null);
const DUMP = flag("--dump", null);
const HEADFUL = args.includes("--headful");
const USER = flag("--user", "layout_probe");
const PASS = flag("--pass", "probe12345");

/**
 * 视口档位。deviceScaleFactor 用 1 让截图体积可控；
 * isMobile/hasTouch 决定 (pointer:coarse) 这类媒体查询的结果，必须如实设置。
 */
const PROFILES = {
    "desktop-1920": { width: 1920, height: 1080, isMobile: false, hasTouch: false },
    "laptop-1366": { width: 1366, height: 768, isMobile: false, hasTouch: false },
    "laptop-short": { width: 1440, height: 640, isMobile: false, hasTouch: false },
    "tablet-834": { width: 834, height: 1112, isMobile: true, hasTouch: true },
    "phone-390": { width: 390, height: 844, isMobile: true, hasTouch: true },
    "phone-360": { width: 360, height: 640, isMobile: true, hasTouch: true },
    "phone-land": { width: 844, height: 390, isMobile: true, hasTouch: true },
};

/** 侧栏导航（data-route）顺序 */
const ROUTES = ["home", "shop", "collection", "decks", "rules", "settings"];

const problems = [];
const check = (ok, name, extra = "") => { if (!ok) problems.push({ name, extra }); return ok; };

async function login(page) {
    const authVisible = await page.locator("#auth-screen:not(.hidden)").count();
    if (!authVisible) return "already";
    // 先试登录，失败再注册
    await page.fill("#auth-username", USER);
    await page.fill("#auth-password", PASS);
    await page.click(".auth-submit");
    await page.waitForTimeout(2500);
    if (await page.locator("#app-shell:not(.is-hidden)").count()) return "login";
    // 注册
    await page.click('[data-auth-mode="register"]');
    await page.fill("#auth-username", USER);
    await page.fill("#auth-password", PASS);
    if (await page.locator("#auth-nickname").count()) await page.fill("#auth-nickname", "布局探针");
    await page.click(".auth-submit");
    await page.waitForTimeout(3000);
    if (await page.locator("#app-shell:not(.is-hidden)").count()) return "register";
    return "failed:" + (await page.locator("#auth-error").textContent().catch(() => "?"));
}

/** 收集当前页面的横向溢出与超小触摸目标 */
async function auditLayout(page, label) {
    const data = await page.evaluate(() => {
        const vw = window.innerWidth, vh = window.innerHeight;
        const out = { vw, vh, docScrollW: document.documentElement.scrollWidth, overflow: [], smallTargets: [], tinyText: [] };
        const visible = el => {
            const s = getComputedStyle(el);
            if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.05) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        };
        for (const el of document.querySelectorAll("body *")) {
            if (!visible(el)) continue;
            const r = el.getBoundingClientRect();
            const id = el.id ? `#${el.id}` : "";
            const cls = (el.className && typeof el.className === "string")
                ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
            const tag = el.tagName.toLowerCase() + id + cls;
            // 横向溢出：元素超出视口右侧或左侧（留 2px 容差）
            if (r.right > vw + 2 || r.left < -2) {
                // 忽略装饰性超大背景层
                if (!/(aura|backdrop|glow|particles|fx|beam|scanline)/i.test(tag)) {
                    out.overflow.push({ tag, left: Math.round(r.left), right: Math.round(r.right) });
                }
            }
            // 可点元素 < 44px（iOS/Android 的最小触摸目标建议值）
            if (/^(button|a|input|select|textarea)$/.test(el.tagName.toLowerCase()) && r.width < 44) {
                out.smallTargets.push({ tag, w: Math.round(r.width), h: Math.round(r.height) });
            }
            if (el.children.length === 0 && el.textContent.trim()) {
                const fs = parseFloat(getComputedStyle(el).fontSize);
                if (fs > 0 && fs < 11) out.tinyText.push({ tag, fs });
            }
        }
        // 去重
        const uniq = list => [...new Map(list.map(i => [JSON.stringify(i), i])).values()].slice(0, 12);
        out.overflow = uniq(out.overflow);
        out.smallTargets = uniq(out.smallTargets);
        out.tinyText = uniq(out.tinyText);
        return out;
    });
    check(data.docScrollW <= data.vw + 2, `[${label}] 页面无横向滚动`,
        `scrollWidth=${data.docScrollW} > innerWidth=${data.vw}`);
    check(data.overflow.length === 0, `[${label}] 无元素横向溢出视口`,
        data.overflow.map(o => `${o.tag}(${o.left}..${o.right})`).join(", "));
    return data;
}

mkdirSync(OUT, { recursive: true });
const browser = await pw.chromium.launch({ headless: !HEADFUL });
const report = [];

for (const [profileName, profile] of Object.entries(PROFILES)) {
    if (ONLY_PROFILE && profileName !== ONLY_PROFILE) continue;
    const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        isMobile: profile.isMobile,
        hasTouch: profile.hasTouch,
        deviceScaleFactor: 1,
        locale: "zh-CN",
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 220)); });
    page.on("pageerror", err => consoleErrors.push("pageerror: " + String(err.message).slice(0, 220)));

    await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    const authResult = await login(page);
    await page.waitForTimeout(3000);

    if (DUMP) {
        const info = await page.evaluate(() => {
            const btns = [...document.querySelectorAll("button,[data-route],[role=button]")]
                .filter(el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== "none" && r.width > 0; })
                .map(el => `${el.tagName.toLowerCase()}#${el.id || "-"}[${el.dataset.route || el.dataset.action || ""}] "${(el.textContent || "").trim().slice(0, 24)}"`);
            return { btns: [...new Set(btns)] };
        });
        console.log(`\n===== DUMP @ ${profileName}（登录=${authResult}）=====`);
        console.log(info.btns.join("\n"));
        await context.close();
        continue;
    }

    await page.screenshot({ path: `${OUT}${profileName}-00-home.png` });
    await auditLayout(page, `${profileName} home`);

    for (const route of ROUTES.slice(1)) {
        const btn = page.locator(`[data-route="${route}"]`).first();
        if (!(await btn.count())) { problems.push({ name: `[${profileName}] 缺少导航入口 ${route}`, extra: "" }); continue; }
        await btn.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1600);
        await page.screenshot({ path: `${OUT}${profileName}-${route}.png` });
        await auditLayout(page, `${profileName} ${route}`);
        await page.locator('[data-route="home"]').first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1000);
    }

    if (consoleErrors.length) {
        problems.push({ name: `[${profileName}] 控制台错误`, extra: [...new Set(consoleErrors)].slice(0, 6).join(" | ") });
    }
    report.push({ profileName, authResult, consoleErrors: [...new Set(consoleErrors)].length });
    await context.close();
}

await browser.close();

console.log("\n===== 视口 × 登录 =====");
for (const r of report) console.log(`  ${r.profileName.padEnd(16)} 登录=${r.authResult}  控制台错误=${r.consoleErrors}`);
console.log("\n===== 布局问题 =====");
if (!problems.length) console.log("  （无）");
for (const p of problems) console.log(`  ✖ ${p.name}${p.extra ? "  — " + p.extra : ""}`);
console.log(`\n截图目录：${OUT}`);
process.exit(problems.length ? 1 : 0);
