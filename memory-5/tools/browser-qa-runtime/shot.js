// Screenshot capture for layout review.
// Run: node shot.js [--url=...] [--pages=songs,home,player] [--vps=390,1440] [--full]
const { chromium } = require('playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');
const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const baseUrl = args.url || 'http://127.0.0.1:8086';
const output = path.resolve(__dirname, '../../qa-output/shots');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wantFull = !!args.full;
const VPS = (args.vps || '390,1440').split(',').map(v => {
    const [w, h] = v.split('x').map(Number);
    return { name: 'w' + w, width: w, height: h || Math.round(w * 2.1) };
});

(async () => {
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: edge, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
    await context.request.post(baseUrl + '/user/login', { form: { userName: 'qa_mobile_layout', password: '123456' } });

    const songIds = {};
    const p0 = await context.newPage();
    await p0.goto(baseUrl + '/songs', { waitUntil: 'domcontentloaded' });
    await p0.waitForTimeout(600);
    const hrefs = await p0.$$eval('a[href^="/player/"]', as => as.map(a => a.getAttribute('href')));
    for (const h of hrefs) { const m = /\/player\/(\d+)/.exec(h); if (m && !songIds.audio) songIds.audio = m[1]; }
    await p0.goto(baseUrl + '/playlists', { waitUntil: 'domcontentloaded' });
    await p0.waitForTimeout(400);
    const pl = await p0.$$eval('a[href^="/playlists/"]', as => as.map(a => a.getAttribute('href')));
    for (const h of pl) { const m = /\/playlists\/(\d+)$/.exec(h); if (m) songIds.playlist = songIds.playlist || m[1]; }
    await p0.close();

    const pageDefs = [
        ['home', '/home'], ['songs', '/songs'], ['playlists', '/playlists'],
        ['favorites', '/favorites'], ['search', '/search?q=a'],
        ['playlist-detail', '/playlists/' + songIds.playlist],
        ['player-disc', '/player/' + songIds.audio + '?mode=disc'],
        ['player-lyrics', '/player/' + songIds.audio + '?mode=lyrics'],
        ['player-folia', '/player/' + songIds.audio + '?mode=folia']
    ].filter(([name]) => !args.pages || args.pages.split(',').includes(name));
    if (args.pages && args.pages.includes('login')) pageDefs.push(['login', '/login']);
    if (args.pages && args.pages.includes('video')) pageDefs.push(['player-video', '/player/1278']);

    const page = await context.newPage();
    for (const [name, url] of pageDefs) {
        for (const vp of VPS) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto(baseUrl + url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(args.wait ? Number(args.wait) : 1200);
            await page.screenshot({ path: path.join(output, `${name}-${vp.name}.png`), fullPage: wantFull });
        }
    }
    await browser.close();
    console.log('shots in ' + output);
})().catch(e => { console.error(e); process.exitCode = 1; });
