const { chromium } = require('playwright-core');
const { readFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.THEME_QA_URL || 'http://127.0.0.1:18086';
const live = process.argv.includes('--live');
const out = 'D:/dsh-render/themes-20261025/qa';
const root = path.resolve(__dirname, '../../src/main/resources/static');
const head = '<script src="/js/site-theme.js?v=20261025"></script><link rel="stylesheet" href="/css/site-theme.css?v=20261025">';
(async () => {
    mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        if (!live) await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.pathname === '/js/site-theme.js' || url.pathname === '/css/site-theme.css') {
                return route.fulfill({ body: readFileSync(path.join(root, url.pathname)), contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css' });
            }
            if (route.request().resourceType() === 'document' && route.request().method() === 'GET' && url.origin === base) {
                const response = await route.fetch();
                const text = await response.text();
                return route.fulfill({ response, body: text.includes('/js/site-theme.js') ? text : text.replace('</head>', head + '</head>') });
            }
            return route.continue();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(base + '/login');
        for (const theme of ['a', 'b', 'c', 'd']) {
            await page.locator('[data-site-theme-select]').selectOption(theme);
            assert.equal(await page.locator('html').getAttribute('data-site-theme'), theme);
            await page.screenshot({ path: `${out}/login-${theme}.png` });
        }
        await page.reload();
        assert.equal(await page.locator('[data-site-theme-select]').inputValue(), 'd');
        const tab = await context.newPage();
        await tab.goto(base + '/register');
        await page.locator('[data-site-theme-select]').selectOption('c');
        await tab.waitForFunction(() => document.documentElement.dataset.siteTheme === 'c');
        await tab.close();
        await page.locator('#userName').fill('qa_mobile_layout');
        await page.locator('#password').fill('123456');
        await Promise.all([page.waitForURL('**/home'), page.locator('button[type="submit"]').click()]);
        let checks = 0;
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            for (const theme of ['a', 'b', 'c', 'd']) {
                await page.evaluate(theme => { localStorage.setItem('sekai.site.theme', theme); }, theme);
                for (const route of ['/home', '/songs', '/playlists', '/favorites', '/local-player', '/feedback', '/device-sharing']) {
                    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(200);
                    assert.equal(await page.locator('html').getAttribute('data-site-theme'), theme);
                    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
                    assert.ok(!overflow, `${theme} ${width} ${route}: horizontal overflow`);
                    if (width === 390) await page.locator('[data-sidebar-toggle]').click();
                    await page.locator('[data-site-theme-select]').selectOption(theme);
                    if (width === 390) await page.locator('[data-sidebar-toggle]').click();
                    if (['/home', '/songs', '/feedback', '/local-player'].includes(route)) await page.screenshot({ path: `${out}/${route.slice(1)}-${theme}-${width}.png` });
                    checks++;
                }
            }
        }
        await page.evaluate(() => localStorage.setItem('sekai.site.theme', 'invalid'));
        await page.reload();
        assert.equal(await page.locator('html').getAttribute('data-site-theme'), 'a');
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ live, pageChecks: checks, persistence: true, crossTab: true, invalidFallback: true, errors, screenshots: out }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
