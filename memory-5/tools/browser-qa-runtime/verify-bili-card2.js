// Verify B站 card rendering on the live site after self-hosting the covers.
// Run: node verify-bili-card2.js [--url=https://sekaisong.com]
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
    const failed = [];
    page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    await page.goto(baseUrl + '/songs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const report = await page.evaluate(() => [...document.querySelectorAll('.selection-track')].map(card => {
        const link = card.querySelector('[data-selection-track]');
        const img = card.querySelector('img.selection-track-cover');
        const badge = card.querySelector('.selection-track-video-art');
        return {
            title: (link?.dataset.title || '').slice(0, 28),
            src: img ? img.getAttribute('src') : null,
            loaded: img ? img.complete && img.naturalWidth > 0 : null,
            natural: img ? `${img.naturalWidth}x${img.naturalHeight}` : null,
            fallbackUsed: img ? img.dataset.fallback === '1' : null,
            badge: badge ? getComputedStyle(badge).position : null,
        };
    }));
    console.log('cards:');
    report.forEach(r => console.log('  ' + JSON.stringify(r)));

    // 让正在播放的卡片转到正面再截一张
    await page.locator('.selection-track.is-active').first().click({ trial: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, 'bili-songs-live.png') });
    console.log('saved bili-songs-live.png');
    if (failed.length) console.log('http >=400:\n  ' + failed.slice(0, 8).join('\n  '));
    else console.log('no failing requests');
    await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
