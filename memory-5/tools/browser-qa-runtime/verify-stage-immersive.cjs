// 演出页沉浸改造验收：手机 / 桌面 / 设置切换 / 导入页不受影响。
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const base = 'https://sekaisong.com';
const USER = 'sekai', PASS = '20070831miku';
const OUT = path.resolve(__dirname, '../../qa-output');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const state = () => {
  const cs = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { display: s.display, z: s.zIndex, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    body: document.body.className,
    scrollH: document.documentElement.scrollHeight,
    vh: innerHeight,
    sidebar: cs('.sidebar'),
    tools: cs('#local-playback-tools'),
    workspace: cs('#local-workspace'),
    stage: cs('#local-stage'),
    empty: cs('#local-empty'),
    chrome: cs('.stage-chrome'),
  };
};

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const cases = [
    ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['desktop', { viewport: { width: 1440, height: 810 } }],
  ];
  for (const [tag, opts] of cases) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    try {
      await ctx.request.post(base + '/user/login', { form: { userName: USER, password: PASS }, maxRedirects: 0 });
      await page.goto(`${base}/player/129`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2200);
      const a = await page.evaluate(state);
      console.log(`\n===== ${tag} 沉浸态`);
      console.log(JSON.stringify(a, null, 1));
      await page.screenshot({ path: path.join(OUT, `v2-${tag}-immersive.png`) });

      // 点设置
      await page.evaluate(()=>document.getElementById('stage-settings-toggle').click());
      await page.waitForTimeout(700);
      const b = await page.evaluate(state);
      console.log(`===== ${tag} 设置态`);
      console.log(JSON.stringify({ body: b.body, scrollH: b.scrollH, sidebar: b.sidebar, tools: b.tools, chrome: b.chrome }, null, 1));
      await page.screenshot({ path: path.join(OUT, `v2-${tag}-settings.png`) });

      // 回演出
      await page.evaluate(()=>document.getElementById('stage-settings-toggle').click());
      await page.waitForTimeout(500);
      const c = await page.evaluate(state);
      console.log(`===== ${tag} 回到沉浸 : body=${c.body}`);

      if (tag === 'phone') {
        await page.goto(`${base}/local-player`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        const d = await page.evaluate(state);
        console.log('===== phone 导入页 body=', d.body, ' scrollH=', d.scrollH, ' tools=', d.tools && d.tools.display);
        await page.screenshot({ path: path.join(OUT, 'v2-phone-import.png') });
      }
    } catch (e) {
      console.error('ERR', tag, e.message);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
})();
