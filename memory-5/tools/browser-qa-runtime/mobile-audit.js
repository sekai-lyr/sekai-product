// Mobile/desktop layout audit for memory-5.
// Run: node mobile-audit.js [--url=http://127.0.0.1:8086] [--user=sekai] [--pass=123456] [--shots]
const { chromium } = require('playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const baseUrl = args.url || process.env.SEKAI_BASE_URL || 'http://127.0.0.1:8086';
const user = args.user || 'qa_mobile_layout';
const pass = args.pass || '123456';
const output = path.resolve(__dirname, '../../qa-output');
const wantShots = !!args.shots;
const edge = process.env.SEKAI_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const VIEWPORTS = [
    { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
    { name: 'laptop-1280', width: 1280, height: 800, mobile: false },
    { name: 'tablet-768', width: 768, height: 1024, mobile: true },
    { name: 'phone-414', width: 414, height: 896, mobile: true },
    { name: 'phone-390', width: 390, height: 844, mobile: true },
    { name: 'phone-360', width: 360, height: 800, mobile: true },
    { name: 'phone-320', width: 320, height: 740, mobile: true }
];

const probe = () => {
    const vw = innerWidth;
    const describe = (el) => {
        if (!el) return '?';
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        if (el.classList && el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.');
        return s;
    };
    const visible = (el, rect) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
        if (rect.width < 1 || rect.height < 1) return false;
        return true;
    };
    const offenders = [];
    const smallTaps = [];
    const clipped = [];
    const tinyText = [];
    const scrollers = [];
    for (const el of document.querySelectorAll('body *')) {
        const rect = el.getBoundingClientRect();
        if (!visible(el, rect)) continue;
        const cs = getComputedStyle(el);
        const overflowAmount = Math.round(Math.max(rect.right - vw, -rect.left));
        if (overflowAmount > 1) {
            offenders.push({
                el: describe(el), right: Math.round(rect.right), left: Math.round(rect.left),
                w: Math.round(rect.width), over: overflowAmount, pos: cs.position
            });
        }
        if (el.matches('a,button,input,select,textarea,[role="button"],summary,label')) {
            if (rect.width < 34 || rect.height < 34) {
                const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 22);
                if (text && el.tagName !== 'INPUT' || el.type === 'submit' || el.tagName === 'BUTTON') {
                    smallTaps.push({ el: describe(el), w: Math.round(rect.width), h: Math.round(rect.height), text });
                }
            }
        }
        if (el.children.length === 0 && (el.textContent || '').trim().length > 2) {
            const fs = parseFloat(cs.fontSize);
            if (fs && fs < 11.5) tinyText.push({ el: describe(el), fs, text: (el.textContent || '').trim().slice(0, 24) });
            if (cs.overflowX === 'hidden' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
                clipped.push({ el: describe(el), client: el.clientWidth, scroll: el.scrollWidth, text: (el.textContent || '').trim().slice(0, 30) });
            }
        }
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2) {
            scrollers.push({ el: describe(el), client: el.clientWidth, scroll: el.scrollWidth });
        }
    }
    const dedupe = (list, key = 'el') => {
        const seen = new Set();
        return list.filter(i => { const k = i[key] + '|' + (i.text || '') + '|' + (i.over || ''); if (seen.has(k)) return false; seen.add(k); return true; });
    };
    offenders.sort((a, b) => b.over - a.over);
    clipped.sort((a, b) => (b.scroll - b.client) - (a.scroll - a.client));
    return {
        vw, docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        hOverflow: document.documentElement.scrollWidth - vw,
        offenders: dedupe(offenders).slice(0, 10),
        offenderCount: offenders.length,
        smallTaps: dedupe(smallTaps).slice(0, 12),
        smallTapCount: smallTaps.length,
        clipped: dedupe(clipped).slice(0, 8),
        clippedCount: clipped.length,
        tinyText: dedupe(tinyText).slice(0, 8),
        tinyTextCount: tinyText.length,
        scrollers: dedupe(scrollers).slice(0, 6)
    };
};

(async () => {
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: edge, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
    const report = { baseUrl, pages: {}, errors: [], notes: [] };

    // login
    const res = await context.request.post(baseUrl + '/user/login', {
        form: { userName: user, password: pass }, maxRedirects: 5
    });
    const loggedIn = res.status() < 400;
    report.login = { status: res.status(), ok: loggedIn };
    if (!loggedIn) throw new Error('login failed: ' + res.status());

    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text().slice(0, 160)); });

    // discover ids from the library
    let songId = null, biliSongId = null, playlistId = null;
    await page.goto(baseUrl + '/songs', { waitUntil: 'domcontentloaded' });
    const songHrefs = await page.$$eval('a[href^="/player/"]', as => as.map(a => a.getAttribute('href')));
    for (const href of songHrefs) { const id = /\/player\/(\d+)/.exec(href); if (id) { songId = songId || id[1]; } }
    await page.goto(baseUrl + '/playlists', { waitUntil: 'domcontentloaded' });
    const plHrefs = await page.$$eval('a[href^="/playlists/"]', as => as.map(a => a.getAttribute('href')));
    for (const href of plHrefs) { const m = /\/playlists\/(\d+)$/.exec(href); if (m) playlistId = playlistId || m[1]; }
    report.ids = { songId, playlistId, songLinks: songHrefs.length };

    const pages = [
        { name: 'login', url: '/login', anon: true, wait: 1200 },
        { name: 'register', url: '/register', anon: true, wait: 1200 },
        { name: 'home', url: '/home' },
        { name: 'songs', url: '/songs' },
        { name: 'playlists', url: '/playlists' },
        { name: 'favorites', url: '/favorites' },
        { name: 'search', url: '/search?q=a' },
        { name: 'netease', url: '/netease' },
        { name: 'qq', url: '/qq' },
        { name: 'bilibili', url: '/bilibili' }
    ];
    if (playlistId) {
        pages.push({ name: 'playlist-detail', url: '/playlists/' + playlistId });
        pages.push({ name: 'playlist-edit', url: '/playlists/' + playlistId + '/edit' });
    }
    if (songId) {
        pages.push({ name: 'player-disc', url: '/player/' + songId + '?mode=disc' });
        pages.push({ name: 'player-lyrics', url: '/player/' + songId + '?mode=lyrics' });
        pages.push({ name: 'player-folia', url: '/player/' + songId + '?mode=folia' });
    }

    for (const spec of pages) {
        report.pages[spec.name] = {};
        for (const vp of VIEWPORTS) {
            const ctx = spec.anon ? await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.mobile, deviceScaleFactor: 1 })
                : context;
            const p = spec.anon ? await ctx.newPage() : page;
            try {
                console.error(`[audit] ${spec.name} ${vp.name}`);
                if (!spec.anon) await p.setViewportSize({ width: vp.width, height: vp.height });
                await p.goto(baseUrl + spec.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
                await p.waitForTimeout(spec.wait || 700);
                const data = await p.evaluate(probe);
                report.pages[spec.name][vp.name] = data;
                if (wantShots) {
                    await p.screenshot({ path: path.join(output, `shots/${spec.name}-${vp.name}.png`), fullPage: false });
                }
            } catch (e) {
                report.pages[spec.name][vp.name] = { error: String(e).slice(0, 200) };
            } finally {
                if (spec.anon) { await p.close(); await ctx.close(); }
            }
        }
    }

    // summary
    const summary = [];
    for (const [name, vps] of Object.entries(report.pages)) {
        for (const [vp, d] of Object.entries(vps)) {
            if (d.error) { summary.push({ page: name, vp, error: d.error }); continue; }
            if (d.hOverflow > 0 || d.smallTapCount || d.clippedCount) {
                summary.push({
                    page: name, vp, hOverflow: d.hOverflow, offenders: d.offenderCount,
                    smallTaps: d.smallTapCount, clipped: d.clippedCount, tiny: d.tinyTextCount,
                    top: d.offenders.slice(0, 3).map(o => `${o.el}(+${o.over})`)
                });
            }
        }
    }
    report.summary = summary;
    await fs.writeFile(path.join(output, 'mobile-audit.json'), JSON.stringify(report, null, 2));
    await browser.close();
    console.log(JSON.stringify(summary, null, 1));
})().catch(e => { console.error(e); process.exitCode = 1; });
