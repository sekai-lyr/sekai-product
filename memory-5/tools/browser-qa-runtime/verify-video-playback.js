const { chromium } = require('playwright-core');

const baseUrl = 'http://127.0.0.1:8085';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const trackIds = process.argv.slice(2);

const waitFor = async (predicate, timeoutMs = 12000) => {
  const started = Date.now();
  while (!(await predicate())) {
    if (Date.now() - started > timeoutMs) throw new Error('playback timeout');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

(async () => {
  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  const failures = [];

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="userName"]').fill('sekai');
    await page.locator('input[name="password"]').fill('123456520baba');
    await Promise.all([
      page.waitForURL((url) => !url.pathname.endsWith('/login')),
      page.locator('button[type="submit"]').click(),
    ]);

    for (const id of trackIds) {
      try {
        await page.goto(`${baseUrl}/player/${id}`, { waitUntil: 'domcontentloaded' });
        const video = page.locator('video.bilibili-native-player');
        if ((await video.count()) !== 1) throw new Error('local video element missing');

        await video.evaluate(async (element) => {
          element.muted = true;
          await element.play();
        });
        await waitFor(async () => video.evaluate((element) =>
          Number.isFinite(element.duration) && element.duration > 2 && element.currentTime > 0.5 && !element.error));

        const middle = await video.evaluate((element) => {
          const target = Math.max(1, Math.floor(element.duration / 2));
          element.currentTime = target;
          return target;
        });
        await video.evaluate((element) => element.play());
        await waitFor(async () => video.evaluate((element, target) =>
          element.currentTime > target + 0.5 && !element.error, middle));

        const nearEnd = await video.evaluate((element) => {
          const target = Math.max(1, element.duration - 4);
          element.currentTime = target;
          return target;
        });
        await video.evaluate((element) => element.play());
        await waitFor(async () => video.evaluate((element, target) =>
          element.currentTime > target + 0.5 && !element.error, nearEnd));

        const state = await video.evaluate((element) => ({
          duration: element.duration,
          currentTime: element.currentTime,
          readyState: element.readyState,
          networkState: element.networkState,
          error: element.error && element.error.message,
          src: element.getAttribute('src'),
        }));
        console.log(JSON.stringify({ id, status: 'passed', ...state }));
      } catch (error) {
        failures.push({ id, error: error.message });
        console.log(JSON.stringify({ id, status: 'failed', error: error.message }));
      }
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ tested: trackIds.length, failed: failures.length, failures }));
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(2);
});
