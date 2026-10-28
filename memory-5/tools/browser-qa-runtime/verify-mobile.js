// Mobile/desktop layout verifier with page invariants.
// Run: node verify-mobile.js [--url=http://127.0.0.1:8086] [--user=qa_mobile_layout] [--pass=123456]
// Exit code 0 = every check passed.
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
const edge = process.env.SEKAI_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PLAYLIST_ID = args.playlist || '31';
const AUDIO_SONG = args.song || '1280';
const VIDEO_SONG = args.video || '1283';
const NOLYRICS_SONG = args.nolyrics || '1284';

const results = [];
const check = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : '  → ' + JSON.stringify(detail)}`);
};

const phoneVps = [{ w: 320, h: 640 }, { w: 360, h: 800 }, { w: 390, h: 844 }, { w: 414, h: 896 }];
const wideVps = [{ w: 768, h: 1024 }, { w: 1024, h: 768 }, { w: 1440, h: 900 }];

// helpers injected into the page
const geometry = () => {
    const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom), top: Math.round(r.top), left: Math.round(r.left) };
    };
    return {
        vw: innerWidth, vh: innerHeight,
        docOverflow: document.documentElement.scrollWidth - innerWidth,
        scrollHeight: document.documentElement.scrollHeight,
        sidebar: rect('.sidebar'),
        panel: rect('.sidebar-panel'),
        content: rect('.content'),
        railHead: rect('.selection-rail-head'),
        toolbar: rect('.selection-toolbar'),
        pager: rect('nav.pager') || rect('.selection-carousel-pagination'),
        strip: rect('.selection-track-list'),
        stage: rect('.selection-stage'),
        activeCard: rect('.selection-track.is-active, .selection-track'),
        cardImg: rect('.selection-track.is-active img, .selection-track img'),
        stageControls: rect('.stage-controls'),
        stageArt: rect('.stage-art'),
        cover: rect('.cover-large'),
        disc: rect('.stage-disc'),
        lyricBar: rect('.lyric-player-bar'),
        lyricStage: rect('.lyric-stage'),
        seek: rect('.stage-seek'),
        lyricSeek: rect('.lyric-seek'),
        toolsToggle: rect('.stage-tools-toggle'),
        switcher: rect('.stage-view-switcher'),
        drawer: rect('.stage-drawer'),
        biliPlayer: rect('.bilibili-player')
    };
};

(async () => {
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: edge, headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const login = await context.request.post(baseUrl + '/user/login', { form: { userName: user, password: pass } });
    check('login works', login.status() < 400, login.status());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    // ---------- shell: nav behaviour at every width ----------
    for (const vp of [...phoneVps, ...wideVps]) {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await page.goto(baseUrl + '/home', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);
        const g = await page.evaluate(geometry);
        const narrow = vp.w <= 980;
        check(`[${vp.w}] no horizontal overflow (home)`, g.docOverflow <= 1, g.docOverflow);
        if (narrow) {
            check(`[${vp.w}] sidebar is a compact bar (home)`, g.sidebar.h <= 130, g.sidebar.h);
            check(`[${vp.w}] content starts high (home)`, g.content.top <= 130, g.content.top);
        } else {
            check(`[${vp.w}] desktop sidebar keeps 224px column (home)`, g.sidebar.w >= 200 && g.sidebar.w <= 260, g.sidebar.w);
            check(`[${vp.w}] desktop sidebar full height (home)`, g.sidebar.h >= vp.h - 2, g.sidebar.h);
        }
    }

    // nav toggle interaction at 390
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl + '/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const toggleVisible = await page.isVisible('[data-sidebar-toggle]');
    check('[390] hamburger visible', toggleVisible);
    await page.click('[data-sidebar-toggle]');
    await page.waitForTimeout(300);
    const opened = await page.evaluate(() => {
        const panel = document.querySelector('[data-sidebar-panel]');
        const scrim = document.querySelector('[data-sidebar-scrim]');
        const r = panel.getBoundingClientRect();
        return {
            display: getComputedStyle(panel).display,
            inside: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0,
            links: [...panel.querySelectorAll('nav a')].map(a => Math.round(a.getBoundingClientRect().height)),
            linkTexts: [...panel.querySelectorAll('nav a')].map(a => a.textContent.trim()),
            scrimVisible: !scrim.hidden && getComputedStyle(scrim).display !== 'none',
            expanded: document.querySelector('[data-sidebar-toggle]').getAttribute('aria-expanded')
        };
    });
    check('[390] nav panel opens with all items', opened.display === 'flex' && opened.links.length === 8 && opened.links.every(h => h >= 40), opened);
    check('[390] nav panel inside viewport', opened.inside);
    check('[390] scrim shown and aria-expanded true', opened.scrimVisible && opened.expanded === 'true');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check('[390] Escape closes nav', await page.evaluate(() => !document.querySelector('.sidebar').classList.contains('nav-open')));

    // nav must also work on the selection pages (they used to hide the nav)
    for (const [name, url] of [['songs', '/songs'], ['playlists', '/playlists'], ['playlist-detail', `/playlists/${PLAYLIST_ID}`]]) {
        await page.goto(baseUrl + url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        await page.click('[data-sidebar-toggle]');
        await page.waitForTimeout(300);
        const info = await page.evaluate(() => {
            const panel = document.querySelector('[data-sidebar-panel]');
            const links = [...panel.querySelectorAll('nav a')];
            return {
                display: getComputedStyle(panel).display,
                visible: links.filter(a => a.getBoundingClientRect().height > 0).length,
                total: links.length,
                barSticky: getComputedStyle(document.querySelector('.sidebar')).position,
                barTop: Math.round(document.querySelector('.sidebar').getBoundingClientRect().top)
            };
        });
        check(`[${name}] nav panel has visible links`, info.display === 'flex' && info.visible === info.total && info.total >= 8, info);
        check(`[${name}] sidebar stays sticky`, info.barSticky === 'sticky' && info.barTop === 0, info);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    }

    // ---------- songs page invariants ----------
    for (const vp of phoneVps) {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await page.goto(baseUrl + '/songs', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        const g = await page.evaluate(geometry);
        const tag = `songs ${vp.w}x${vp.h}`;
        check(`[${tag}] no horizontal overflow`, g.docOverflow <= 1, g.docOverflow);
        check(`[${tag}] pager inside first screen`, g.pager && g.pager.bottom <= vp.h && g.pager.top >= 0, g.pager);
        check(`[${tag}] toolbar does not overlap rail heading`, !g.toolbar || !g.railHead || g.toolbar.bottom <= g.railHead.top + 2, { toolbar: g.toolbar, railHead: g.railHead });
        check(`[${tag}] active card fits in strip`, g.activeCard && g.strip && g.activeCard.top >= g.strip.top - 2 && g.activeCard.bottom <= g.strip.bottom + 2, { card: g.activeCard, strip: g.strip });
        check(`[${tag}] card image keeps square-ish aspect`, g.cardImg && Math.abs(g.cardImg.w - g.cardImg.h) <= Math.max(14, g.cardImg.w * 0.12), g.cardImg);
        const taps = await page.evaluate(() => {
            const bad = [];
            document.querySelectorAll('.selection-toolbar a, .selection-toolbar button, .selection-search button, .selection-carousel-pagination a, .selection-track-action button, .selection-add-panel summary').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width < 1 || r.height < 1) return;
                if (r.height < 38 || r.width < 34) bad.push({ el: el.className || el.tagName, w: Math.round(r.width), h: Math.round(r.height) });
            });
            return bad;
        });
        check(`[${tag}] key controls >= 38px tall`, taps.length === 0, taps.slice(0, 6));
    }

    // ---------- playlist pages ----------
    for (const [name, url] of [['playlists', '/playlists'], ['playlist-detail', `/playlists/${PLAYLIST_ID}`]]) {
        for (const vp of [{ w: 390, h: 844 }, { w: 320, h: 640 }]) {
            await page.setViewportSize({ width: vp.w, height: vp.h });
            await page.goto(baseUrl + url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1200);
            const g = await page.evaluate(geometry);
            const tag = `${name} ${vp.w}x${vp.h}`;
            check(`[${tag}] no horizontal overflow`, g.docOverflow <= 1, g.docOverflow);
            check(`[${tag}] pager/actions reachable`, !g.pager || (g.pager.bottom <= vp.h && g.pager.top >= 0), g.pager);
            const taps = await page.evaluate(() => {
                const bad = [];
                document.querySelectorAll('.playlist-track-actions button, .playlist-index-actions a, .playlist-index-actions button, .playlist-track-admin summary, .selection-pager-numbers a, .selection-add-panel summary').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.width < 1 || r.height < 1) return;
                    if (r.height < 36 || r.width < 30) bad.push({ el: (el.className || el.tagName).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
                });
                return bad;
            });
            check(`[${tag}] destructive/small controls >= 36px`, taps.length === 0, taps.slice(0, 6));
        }
    }

    // ---------- player: disc ----------
    for (const vp of [{ w: 390, h: 844 }, { w: 360, h: 780 }, { w: 320, h: 640 }]) {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await page.goto(baseUrl + '/player/' + AUDIO_SONG + '?mode=disc', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        const g = await page.evaluate(geometry);
        const tag = `player-disc ${vp.w}x${vp.h}`;
        check(`[${tag}] no horizontal overflow`, g.docOverflow <= 1, g.docOverflow);
        check(`[${tag}] cover and disc inside stage box`, g.cover && g.stageArt && g.cover.left >= g.stageArt.left - 2 && g.disc.right <= g.stageArt.right + 2, { cover: g.cover, disc: g.disc, art: g.stageArt });
        check(`[${tag}] seek slider is touch sized`, g.seek && g.seek.h >= 40, g.seek);
        const reach = await page.evaluate(() => {
            const c = document.querySelector('.stage-controls');
            const t = document.querySelector('.stage-tools-toggle');
            const sw = document.querySelector('.stage-view-switcher');
            const r = (el) => el ? el.getBoundingClientRect() : null;
            const cr = r(c), tr = r(t), sr = r(sw);
            let overlap = null;
            if (tr && sr) {
                overlap = !(tr.right < sr.left || tr.left > sr.right || tr.bottom < sr.top || tr.top > sr.bottom);
            }
            return { controls: cr && { top: Math.round(cr.top), bottom: Math.round(cr.bottom) }, overlap, vh: innerHeight };
        });
        check(`[${tag}] tools toggle not covered by view switcher`, reach.overlap === false, reach);
        // scroll to the bottom, then the controls must be fully visible
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(400);
        const afterScroll = await page.evaluate(() => {
            const c = document.querySelector('.stage-controls').getBoundingClientRect();
            return { top: Math.round(c.top), bottom: Math.round(c.bottom), vh: innerHeight };
        });
        check(`[${tag}] controls reachable after scrolling`, afterScroll.bottom <= afterScroll.vh + 2 && afterScroll.top >= 0, afterScroll);
    }

    // disc page: drawer usable
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl + '/player/' + AUDIO_SONG + '?mode=disc', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const clickByData = (attr) => page.evaluate((a) => {
        const el = document.querySelector(`[${a}]`);
        if (el) el.click();
        return !!el;
    }, attr);
    await clickByData('data-stage-queue-toggle');
    await page.waitForTimeout(600);
    const drawer = await page.evaluate(() => {
        const d = document.querySelector('.stage-drawer');
        const list = d.querySelector('.queue-list');
        const body = d.querySelector('.stage-drawer-body');
        const last = body.querySelector('.stage-drawer-section:last-child');
        const sw = document.querySelector('.stage-view-switcher');
        const r = (el) => el && el.getBoundingClientRect();
        const dr = r(d), lr = r(last), lstr = r(list), sr = r(sw);
        let switcherBlocked = false;
        if (sr) {
            const hit = document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2);
            const covered = !hit || !sw.contains(hit);
            const styled = getComputedStyle(sw);
            switcherBlocked = covered || styled.visibility === 'hidden' || styled.display === 'none';
        }
        return {
            drawer: dr && { top: Math.round(dr.top), bottom: Math.round(dr.bottom), h: Math.round(dr.height) },
            queueListHeight: lstr && Math.round(lstr.height),
            queueItems: list.querySelectorAll('a').length,
            lastSectionBottom: lr && Math.round(lr.bottom),
            bodyScrolls: body.scrollHeight > body.clientHeight + 2,
            bodyClientHeight: body.clientHeight,
            vh: innerHeight,
            switcherBlocked
        };
    });
    check('[390] queue drawer fits the viewport', drawer.drawer && drawer.drawer.top >= -1 && drawer.drawer.bottom <= drawer.vh + 1, drawer);
    check('[390] queue list keeps usable height', drawer.queueListHeight >= 44 && drawer.queueItems > 0, drawer);
    check('[390] drawer sections reachable (scrolling body)', drawer.bodyScrolls || drawer.lastSectionBottom <= drawer.vh + 1, drawer);
    check('[390] view switcher hidden while drawer open', drawer.switcherBlocked === true, drawer);
    await clickByData('data-stage-drawer-close');
    await page.waitForTimeout(300);

    // ---------- player: lyrics & folia ----------
    for (const mode of ['lyrics', 'folia']) {
        for (const vp of [{ w: 390, h: 844 }, { w: 375, h: 667 }]) {
            await page.setViewportSize({ width: vp.w, height: vp.h });
            await page.goto(baseUrl + `/player/${AUDIO_SONG}?mode=${mode}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1500);
            const g = await page.evaluate(geometry);
            const tag = `player-${mode} ${vp.w}x${vp.h}`;
            check(`[${tag}] no horizontal overflow`, g.docOverflow <= 1, g.docOverflow);
            check(`[${tag}] player bar fully visible`, g.lyricBar && g.lyricBar.bottom <= vp.h + 1 && g.lyricBar.top >= 0, g.lyricBar);
            check(`[${tag}] lyric seek is touch sized`, g.lyricSeek && g.lyricSeek.h >= 40, g.lyricSeek);
            const taps = await page.evaluate(() => {
                const bad = [];
                document.querySelectorAll('.lyric-bar-actions button, .lyric-queue-button').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.width < 1) return;
                    if (r.width < 40 || r.height < 40) bad.push({ el: el.className, w: Math.round(r.width), h: Math.round(r.height) });
                });
                return bad;
            });
            check(`[${tag}] transport buttons >= 40px`, taps.length === 0, taps);
        }
    }

    // lyrics mode with a song that has no lyrics must show a hint
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl + '/player/' + NOLYRICS_SONG + '?mode=lyrics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const emptyHint = await page.evaluate(() => {
        const active = document.querySelector('[data-lyric-slot="active"]');
        return active ? (active.textContent || '').trim().slice(0, 60) : null;
    });
    check('[390] lyric stage shows an empty-state hint when no lyrics', !!emptyHint && emptyHint.length > 4, emptyHint);

    // ---------- songs page: in-page player panel ----------
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl + '/songs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    // The carousel page opens the full player on tap, so exercise the panel layout
    // by revealing it directly (this is what openPlayer() does via [hidden]).
    await page.evaluate(() => {
        const p = document.querySelector('.selection-player-panel');
        const list = document.querySelector('.selection-track-list');
        if (p) p.hidden = false;
        if (list) list.hidden = true;
        const rail = document.querySelector('.selection-rail');
        if (rail) rail.classList.add('is-playing');
    });
    await page.waitForTimeout(600);
    const panel = await page.evaluate(() => {
        const p = document.querySelector('.selection-player-panel');
        if (!p) return { missing: true };
        const rail = document.querySelector('.selection-rail');
        const back = p.querySelector('.selection-player-back');
        const ctrls = p.querySelector('.selection-player-controls');
        const r = (el) => el && el.getBoundingClientRect();
        const pr = r(p), rr = r(rail), br = r(back), cr = r(ctrls);
        const cs = getComputedStyle(p);
        return {
            hidden: p.hidden,
            panel: pr && { top: Math.round(pr.top), bottom: Math.round(pr.bottom), h: Math.round(pr.height) },
            rail: rr && { top: Math.round(rr.top), bottom: Math.round(rr.bottom) },
            back: br && { h: Math.round(br.height), w: Math.round(br.width) },
            controlsBottom: cr && Math.round(cr.bottom),
            scrollable: p.scrollHeight > p.clientHeight + 2,
            overflowY: cs.overflowY,
            vh: innerHeight
        };
    });
    check('[390] in-page player panel opens', panel.missing !== true && panel.hidden === false, panel);
    check('[390] in-page player panel inside rail', panel.panel && panel.rail && panel.panel.top >= panel.rail.top - 2 && panel.panel.bottom <= panel.vh + 1, panel);
    check('[390] in-page player panel content reachable', panel.scrollable || (panel.controlsBottom && panel.controlsBottom <= panel.panel.bottom + 2), panel);
    check('[390] in-page player back button >= 44px', panel.back && panel.back.h >= 44, panel);

    // ---------- long list reveal (app-motion) ----------
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl + '/songs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const reveal = await page.evaluate(() => {
        const items = [...document.querySelectorAll('.motion-reveal .motion-item, .motion-item')];
        const hidden = items.filter(el => Number(getComputedStyle(el).opacity) < 0.5);
        return { total: items.length, hidden: hidden.length, sample: hidden.slice(0, 3).map(el => (el.className || '').slice(0, 40)) };
    });
    check('[390] motion-reveal items are visible after load', reveal.hidden === 0 || reveal.total === 0, reveal);

    // ---------- console errors ----------
    check('no page errors', errors.length === 0, errors.slice(0, 4));

    await fs.writeFile(path.join(output, 'verify-mobile.json'), JSON.stringify({ results, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length }, null, 2));
    console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
    await browser.close();
    process.exitCode = results.some(r => !r.ok) ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
