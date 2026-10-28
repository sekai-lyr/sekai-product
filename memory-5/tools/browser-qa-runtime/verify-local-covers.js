// Check the live site for JS errors and what the cover elements look like now.
// Run: node verify-local-covers.js [--url=https://sekaisong.com]
const { chromium } = require('playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const baseUrl = args.url || 'https://sekaisong.com';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const outDir = path.resolve(__dirname, '../../qa-output/shots');

(async () => {
    await fs.mkdir(outDir, { recursive: true });
    const browser = await chromium.launch({ executablePath: edge, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.request.post(baseUrl + '/user/login', { form: { userName: 'qa_mobile_layout', password: '123456' } });
    const page = await context.newPage();
    const errors = [];
    const failed = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 120)));
    page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().slice(0, 90)); });

    await page.goto(baseUrl + '/songs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => ({
        scriptLoaded: [...document.scripts].some(s => (s.src || '').includes('local-library-covers.js')),
        cards: [...document.querySelectorAll('[data-selection-track]')].map(el => ({
            title: (el.dataset.title || '').slice(0, 22),
            localRef: el.querySelector('img.selection-track-cover')?.getAttribute('data-local-cover') || null,
            src: (el.querySelector('img.selection-track-cover')?.getAttribute('src') || '').slice(-46),
            resolvedBlob: (el.querySelector('img.selection-track-cover')?.getAttribute('src') || '').startsWith('blob:'),
        })),
    }));
    console.log('script loaded:', info.scriptLoaded);
    info.cards.forEach(c => console.log('  ' + JSON.stringify(c)));
    console.log('console errors:', errors.length ? errors.slice(0, 4) : 'none');
    console.log('http >=400 :', failed.length ? failed.slice(0, 5) : 'none');

    await page.screenshot({ path: path.join(outDir, 'local-covers-live.png') });
    console.log('saved local-covers-live.png');
    await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
