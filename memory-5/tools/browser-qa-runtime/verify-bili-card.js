// Verify B站 card rendering on the live site: cover img visible, badge is a pill (not a block).
// Run: node verify-bili-card.js [--url=https://sekaisong.com]
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
    page.on('requestfailed', r => failed.push(r.url()));
    await page.goto(baseUrl + '/songs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const report = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.selection-track')];
        return cards.map(card => {
            const link = card.querySelector('[data-selection-track]');
            const img = card.querySelector('img.selection-track-cover');
            const badge = card.querySelector('.selection-track-video-art');
            const imgBox = img ? img.getBoundingClientRect() : null;
            const badgeBox = badge ? badge.getBoundingClientRect() : null;
            const badgeStyle = badge ? getComputedStyle(badge) : null;
            return {
                title: link?.dataset.title || '',
                hasImg: !!img,
                imgSrc: img ? img.getAttribute('src') : null,
                imgComplete: img ? img.complete : null,
                imgNatural: img ? `${img.naturalWidth}x${img.naturalHeight}` : null,
                imgBox: imgBox ? { w: Math.round(imgBox.width), h: Math.round(imgBox.height) } : null,
                hasBadge: !!badge,
                badgePosition: badgeStyle ? badgeStyle.position : null,
                badgeBox: badgeBox ? { w: Math.round(badgeBox.width), h: Math.round(badgeBox.height) } : null,
                // 叠在一起的特征：角标和图片几乎同尺寸，或角标盖住整张图
                overlapsWholeImage: !!(imgBox && badgeBox && badgeBox.width > imgBox.width * 0.8 && badgeBox.height > imgBox.height * 0.8),
                cardBox: (() => { const b = card.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; })(),
            };
        });
    });

    console.log('cards:', report.length);
    for (const c of report) {
        console.log(JSON.stringify(c));
    }
    const bili = report.filter(c => c.hasBadge);
    console.log('\nB站 cards:', bili.length);
    if (bili.length) {
        await page.locator('.selection-track', { has: page.locator('.selection-track-video-art') }).first()
            .screenshot({ path: path.join(outDir, 'bili-card.png') });
        console.log('saved bili-card.png');
    }
    if (failed.length) console.log('failed requests:', failed.slice(0, 6));
    await browser.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
