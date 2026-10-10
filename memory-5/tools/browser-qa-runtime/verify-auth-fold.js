// Auth showcase verification: node verify-auth-fold.js [--source]
// --source previews edited templates/assets when the running server caches old templates.
const { chromium } = require('playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const project = path.resolve(__dirname, '../../src/main/resources');
const output = process.env.SEKAI_QA_OUTPUT || path.resolve(__dirname, '../../qa-output');
const baseUrl = process.env.SEKAI_BASE_URL || 'http://127.0.0.1:8085';
const sourcePreview = process.argv.includes('--source');

(async () => {
    await fs.mkdir(output, { recursive: true });
    const template = await fs.readFile(path.join(project, 'templates/showcase.html'), 'utf8');
    const fragment = template.slice(template.indexOf('<div class="login-product-showcase"'), template.lastIndexOf('</body>'));
    const browser = await chromium.launch({ executablePath: process.env.SEKAI_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const report = { source: sourcePreview ? 'Source assets over server-rendered forms; no authentication requests sent.' : 'Running application; no authentication requests sent.', checks: [], errors: [] };
    const check = (name, success) => { report.checks.push({ name, success }); assert.ok(success, name); };
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (route.request().method() !== 'GET') return route.abort();
        if (url.origin !== baseUrl) return route.abort();
        if (sourcePreview && (url.pathname === '/login' || url.pathname === '/register')) {
            const response = await route.fetch();
            const html = (await response.text()).replace(/(<section class="brand-area"[^>]*>)[\s\S]*?(<\/section>)/, '$1' + fragment + '$2');
            return route.fulfill({ response, body: html });
        }
        if (sourcePreview && /^\/(css|js)\/[a-z-]+\.(css|js)$/.test(url.pathname)) {
            const body = await fs.readFile(path.join(project, 'static', url.pathname.slice(1)), 'utf8');
            return route.fulfill({ status: 200, contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body });
        }
        return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
    const state = () => page.evaluate(() => ({
        layers: [...document.querySelectorAll('[data-product-panel]')].map(el => ({ page: el.dataset.page, transform: getComputedStyle(el).transform, opacity: getComputedStyle(el).opacity, clip: getComputedStyle(el.querySelector('.panel-surface')).clipPath })),
        index: document.querySelector('[data-showcase-index]').textContent,
        overflow: document.documentElement.scrollWidth > innerWidth,
        form: { x: document.querySelector('.form-area').getBoundingClientRect().x, y: document.querySelector('.form-area').getBoundingClientRect().y },
        brandWidth: document.querySelector('.brand-area').getBoundingClientRect().width,
        pageLeft: Math.min(...[...document.querySelectorAll('[data-product-panel]')].map(el => el.getBoundingClientRect().left)),
        monitorBottom: document.querySelector('.monitor-base').getBoundingClientRect().bottom,
        footerTop: document.querySelector('.showcase-footer').getBoundingClientRect().top
    }));
    const screenshot = name => page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
    try {
        await page.goto(baseUrl + '/login');
        await page.waitForTimeout(2100);
        await page.locator('[data-showcase-toggle]').click();
        await screenshot('login-desktop-expanded');
        const expanded = await state();
        check('Five project page previews', expanded.layers.length === 5);
        check('Desktop is split into equal halves', expanded.brandWidth === 720 && expanded.form.x === 720);
        check('Expanded desktop pages stay inside the left panel', expanded.pageLeft >= 16);
        check('Layers project out of the screen', expanded.layers.every(layer => Number(layer.transform.slice(9, -1).split(',')[14]) > 5));
        await page.waitForTimeout(250);
        check('Pause freezes all page transforms', JSON.stringify((await state()).layers) === JSON.stringify(expanded.layers));
        await page.locator('[data-showcase-toggle]').click();
        await page.waitForFunction(() => [...document.querySelectorAll('[data-product-panel] .panel-surface')].some(el => getComputedStyle(el).clipPath !== 'none'));
        await page.waitForTimeout(160);
        await page.locator('[data-showcase-toggle]').click();
        await screenshot('login-desktop-dissolve');
        check('Pixel dissolve is present', (await state()).layers.some(layer => layer.clip !== 'none'));
        await page.locator('[data-showcase-toggle]').click();
        const seen = new Set();
        for (let i = 0; i < 42; i++) { seen.add((await state()).index); await page.waitForTimeout(200); }
        check('All five pages appear during the cycle', seen.size === 5);
        report.cyclePages = [...seen];
        await page.locator('[data-showcase-toggle]').click();
        await page.locator('#password').fill('preview-only');
        await page.locator('#togglePassword').click();
        check('Login password visibility works', await page.locator('#password').getAttribute('type') === 'text');
        await page.locator('#password').fill('');
        for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(150);
            const result = await state();
            check(`No horizontal overflow at ${viewport.width}px`, !result.overflow);
            if (viewport.width <= 860) check(`Form follows artwork at ${viewport.width}px`, result.form.y > 0 && result.form.x === 0);
            check(`Monitor clears the caption at ${viewport.width}px`, result.monitorBottom < result.footerTop);
            await screenshot('login-' + viewport.width);
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(baseUrl + '/register');
        await page.waitForTimeout(2100);
        await page.locator('[data-showcase-toggle]').click();
        await screenshot('register-desktop');
        await page.locator('#userName').fill('preview-only');
        await page.locator('#password').fill('abcdef');
        await page.locator('#confirmPassword').fill('different');
        await page.locator('button[type="submit"]').click();
        check('Register mismatch validation works', (await page.locator('#registerError').textContent()).includes('不一致'));
        await page.locator('#userName').fill('');
        await page.locator('#password').fill('');
        await page.locator('#confirmPassword').fill('');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForTimeout(150);
        const reduced = await state();
        await page.waitForTimeout(300);
        check('Reduced motion is fully static', JSON.stringify((await state()).layers) === JSON.stringify(reduced.layers));
        check('Reduced motion hides the play control', await page.locator('[data-showcase-toggle]').isHidden());
        await screenshot('register-reduced-motion');
        check('No browser errors or failing resources', report.errors.length === 0);
    } finally {
        await fs.writeFile(path.join(output, 'showcase-checks.json'), JSON.stringify(report, null, 2));
        await browser.close();
        console.log(JSON.stringify(report, null, 2));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
