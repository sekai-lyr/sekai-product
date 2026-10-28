// Effective-layout probe: prints computed styles that decide the mobile layout.
// Run: node computed.js [--url=...] [--vp=390] [--pages=home,songs]
const { chromium } = require('playwright-core');
const path = require('node:path');
const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const baseUrl = args.url || 'http://127.0.0.1:8086';
const width = Number(args.vp || 390);
const height = Number(args.h || 844);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const SELECTORS = [
    '.app-shell', '.sidebar', '.sidebar nav', '.sidebar nav a', '.sidebar-bottom', '.user-box', '.logo',
    '.content', '.hero-panel', '.stats-grid', '.home-tools-grid', '.two-column', '.song-list', '.song-row',
    '.grid-form', '.search-bar', '.result-list', '.playlist-hero', '.editor-panel', '.queue-panel',
    '.selection-shell', '.selection-toolbar', '.selection-feature', '.selection-track-list', '.selection-track',
    '.selection-pager', '.playlist-card-grid', '.playlist-card', '.song-card',
    '.player-layout', '.now-playing', '.player-stage', '.stage-art', '.stage-lyrics', '.stage-controls',
    '.lyric-stage', '.lyric-song-meta', '.lyric-scene', '.lyric-player-bar', '.stage-drawer', '.stage-tools',
    '.stage-view-switcher', '.stage-spectrum', '.bilibili-video-mode', '.bilibili-player', '.queue-panel.bilibili-queue'
];

const probe = (selectors) => {
    const out = {};
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        out[sel] = {
            display: cs.display,
            cols: cs.gridTemplateColumns,
            areas: cs.gridTemplateAreas === 'none' ? undefined : cs.gridTemplateAreas,
            pos: cs.position,
            ovf: `${cs.overflowX}/${cs.overflowY}`,
            w: Math.round(r.width), h: Math.round(r.height),
            x: Math.round(r.x), y: Math.round(r.y),
            scroll: el.scrollWidth > el.clientWidth + 2 ? `${el.clientWidth}->${el.scrollWidth}` : undefined,
            fs: cs.fontSize,
            vis: cs.visibility === 'hidden' || cs.display === 'none' ? 'hidden' : undefined
        };
    }
    // elements that could not be reached: fixed layers stacked above content
    const fixed = [...document.querySelectorAll('body *')].filter(el => {
        const cs = getComputedStyle(el);
        return cs.position === 'fixed' && cs.display !== 'none' && el.getBoundingClientRect().height > 20;
    }).map(el => ({ el: el.tagName.toLowerCase() + '.' + [...el.classList].join('.'), z: getComputedStyle(el).zIndex, h: Math.round(el.getBoundingClientRect().height), bottom: Math.round(innerHeight - el.getBoundingClientRect().bottom) }));
    return {
        vw: innerWidth, vh: innerHeight,
        contentTop: (() => { const c = document.querySelector('.content'); return c ? Math.round(c.getBoundingClientRect().top) : null; })(),
        sidebarH: (() => { const s = document.querySelector('.sidebar'); return s ? Math.round(s.getBoundingClientRect().height) : null; })(),
        navLinks: [...document.querySelectorAll('.sidebar nav a')].map(a => ({ t: a.textContent.trim(), h: Math.round(a.getBoundingClientRect().height), w: Math.round(a.getBoundingClientRect().width), y: Math.round(a.getBoundingClientRect().top) })),
        styles: out,
        fixedLayers: fixed
    };
};

(async () => {
    const browser = await chromium.launch({ executablePath: edge, headless: true });
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    await context.request.post(baseUrl + '/user/login', { form: { userName: 'qa_mobile_layout', password: '123456' } });
    const page = await context.newPage();
    const pages = (args.pages || 'home,songs,playlists,playlist-detail,player-disc,player-lyrics').split(',');
    const urls = {
        home: '/home', songs: '/songs', playlists: '/playlists', favorites: '/favorites',
        search: '/search?q=a', 'playlist-edit': '/playlists/30/edit', 'player-video': '/player/1278',
        login: '/login'
    };
    for (const name of pages) {
        const url = urls[name] || `/playlists/30` && name === 'playlist-detail' ? urls[name] || '/playlists/30' : urls[name];
        const target = urls[name] || (name.startsWith('player-') ? `/player/1275?mode=${name.replace('player-', '')}` : '/playlists/30');
        await page.goto(baseUrl + target, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        const data = await page.evaluate(probe, SELECTORS);
        console.log('===== ' + name + ' ' + width + 'x' + height + ' (' + target + ') =====');
        console.log(JSON.stringify(data, null, 1));
    }
    await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
