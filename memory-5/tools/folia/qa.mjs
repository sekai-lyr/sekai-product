import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'D:/dsh-render/qa-sonnet-20261011';
mkdirSync(out, { recursive: true });
const chrome = await launchChrome({ port: 9368 });
const page = await newPage(chrome.port);
const errors = [];
page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Network.enable');
const login = await fetch('http://localhost:8085/user/login', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'userName=sekai&password=20070831miku', redirect: 'manual' });
const cookie = login.headers.getSetCookie().find(x => x.startsWith('JSESSIONID_M5=')).split(';')[0].split('=').slice(1).join('=');
await page.send('Network.setCookie', { name: 'JSESSIONID_M5', value: cookie, domain: 'localhost', path: '/' });
const report = [];
try {
    for (const mode of ['folia', 'lyrics', 'folia-classic']) {
        await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
        await page.send('Page.navigate', { url: `http://localhost:8085/player/36?playlistId=6&mode=${mode}&render=1` });
        await sleep(5000);
        const evaluate = async expression => (await page.send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
        for (let wait = 0; wait < 20 && !await evaluate('window.__stageReady === true'); wait++) await sleep(1000);
        const ready = await evaluate('({ready:window.__stageReady,engine:document.querySelector(".lyric-stage")?.dataset.foliaEngine,program:window.__foliaProgram})');
        for (const t of [14, 20, 32, 45, 62]) {
            await evaluate(`window.__stageSetFrame(${t * 60},60)`);
            await sleep(250);
            const shot = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
            writeFileSync(`${out}/${mode}-${t}.png`, Buffer.from(shot.data, 'base64'));
        }
        const text = await evaluate('({state:window.__stageState(),subtitle:document.querySelector("[data-folia-subtitle]")?.textContent,canvas:document.querySelector(".folia-article canvas")?.width})');
        const timing = await evaluate(`(() => {
            const rows = Array.from(document.querySelectorAll('#lyrics p[data-time]'))
                .filter(row => row.querySelector('b')?.textContent.trim())
                .filter(row => !(['folia','folia-classic'].includes('${mode}') && Number(row.dataset.time) < 12
                    && /^(?:作词|作詞|作曲|编曲|編曲|混音|制作|製作|演唱|歌手|翻译|翻譯)\\s*[:：]/i.test(row.querySelector('b').textContent)));
            const failures = [];
            for (let index = 0; index < rows.length; index++) {
                const t = Number(rows[index].dataset.time) + .025;
                window.__stageSetFrame(t * 60, 60);
                const actual = document.querySelector('[data-lyric-slot="active"]').dataset.text;
                const expected = rows[index].querySelector('b').textContent.trim();
                if (actual !== expected) failures.push({t,actual,expected});
            }
            window.__stageSetFrame(1200,60);
            const spans = Array.from(document.querySelector('[data-lyric-slot="active"]').children);
            const bounds = spans.map(s => s.getBoundingClientRect());
            let overlaps = 0;
            for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++) {
                const a=bounds[i],b=bounds[j];
                if(a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top)overlaps++;
            }
            return {checked:rows.length, failures, overlaps};
        })()`);
        await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
        await evaluate('window.__stageSetFrame(1200,60)'); await sleep(300);
        const mobile = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(`${out}/${mode}-mobile.png`, Buffer.from(mobile.data, 'base64'));
        report.push({ mode, ready, text, timing, overflow: await evaluate('document.documentElement.scrollWidth > innerWidth') });
        console.log(JSON.stringify(report.at(-1)));
    }
} finally {
    writeFileSync(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2));
    console.log(JSON.stringify({ errors })); page.close(); chrome.proc.kill();
}
