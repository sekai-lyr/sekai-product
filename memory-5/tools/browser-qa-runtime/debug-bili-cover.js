// Why does the Bilibili cover fall back to the placeholder in this browser?
// Run: node debug-bili-cover.js [--url=https://sekaisong.com]
const { chromium } = require('playwright-core');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const baseUrl = args.url || 'https://sekaisong.com';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
    const browser = await chromium.launch({ executablePath: edge, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.request.post(baseUrl + '/user/login', { form: { userName: 'qa_mobile_layout', password: '123456' } });
    const page = await context.newPage();
    page.on('requestfailed', r => console.log('REQFAIL', r.url().slice(0, 80), r.failure()?.errorText));
    page.on('response', r => { if (r.url().includes('hdslb')) console.log('RESP', r.status(), r.url().slice(0, 80)); });
    await page.goto(baseUrl + '/songs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const detail = await page.evaluate(async (url) => {
        const img = [...document.querySelectorAll('img.selection-track-cover')]
            .find(i => (i.getAttribute('data-local-cover') || '').includes('hdslb'));
        const out = {
            attrSrc: img?.getAttribute('src') || null,
            dataLocalCover: img?.getAttribute('data-local-cover') || null,
            referrerpolicy: img?.getAttribute('referrerpolicy') || null,
            complete: img?.complete, natural: img ? `${img.naturalWidth}x${img.naturalHeight}` : null,
            fallbackFlag: img?.dataset.fallback || null,
        };
        out.fetchStatus = await fetch(out.dataLocalCover, { mode: 'no-cors' })
            .then(r => 'no-cors ' + r.type)
            .catch(e => 'fetch error: ' + e.message);
        out.imgLoadStatus = await new Promise(resolve => {
            const probe = new Image();
            probe.referrerPolicy = 'no-referrer';
            probe.onload = () => resolve('loaded ' + probe.naturalWidth + 'x' + probe.naturalHeight);
            probe.onerror = () => resolve('error event');
            probe.src = out.dataLocalCover;
            setTimeout(() => resolve('timeout'), 8000);
        });
        return out;
    }, null);
    console.log(JSON.stringify(detail, null, 2));
    await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
