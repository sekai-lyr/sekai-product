// 手机上打开演出页到底被什么盖住了？逐层排查。
// 用法：node inspect-mobile-stage.cjs
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const base = 'https://sekaisong.com';
const USER = 'sekai', PASS = '20070831miku';
const OUT = path.resolve(__dirname, '../../qa-output');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const PROBE = () => {
  const rc = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const name = (el) => {
    if (!el) return '?';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList && el.classList.length) s += '.' + [...el.classList].slice(0, 4).join('.');
    return s;
  };
  const cx = Math.round(innerWidth / 2), cy = Math.round(innerHeight / 2);
  const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map(name);
  const fixed = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    fixed.push({ el: name(el), z: cs.zIndex, ...rc(el) });
  }
  const stage = document.querySelector('#local-stage');
  const ws = document.querySelector('#local-workspace');
  return {
    viewport: [innerWidth, innerHeight],
    bodyClass: document.body.className,
    scrollH: document.documentElement.scrollHeight,
    centerStack: stack,
    stage: stage ? { ...rc(stage), src: stage.getAttribute('src') || stage.dataset.stageUrl || '' } : null,
    workspace: ws ? rc(ws) : null,
    fixed: fixed.slice(0, 14),
    visibleText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260),
  };
};

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  try {
    const r = await ctx.request.post(base + '/user/login', { form: { userName: USER, password: PASS }, maxRedirects: 0 });
    console.log('login status', r.status());

    const lib = await (await ctx.request.get(base + '/local-player/library')).json();
    const song = (lib.songs || []).find((s) => s.fileName);
    console.log('song', song && { id: song.id, title: song.title, fileName: song.fileName });

    const targets = [
      ['player', `${base}/player/${song.id}`],
      ['local-player-id', `${base}/local-player?id=${song.id}`],
      ['local-player-plain', `${base}/local-player`],
    ];
    for (const [tag, url] of targets) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const info = await page.evaluate(PROBE);
      console.log(`\n===== ${tag}  ${url}`);
      console.log(JSON.stringify(info, null, 1));
      await page.screenshot({ path: path.join(OUT, `mobile-${tag}.png`), fullPage: false });
    }
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await browser.close();
  }
})();
