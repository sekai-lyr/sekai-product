import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'D:/dsh-render/qa-local-layout-20261012';
mkdirSync(output, { recursive: true });
const chrome = await launchChrome({ port: 9388 });
const page = await newPage(chrome.port);
const errors = [], results = [];
page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.text));
const evaluate = async expression => {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
};
try {
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('DOM.enable');
    await page.send('Page.navigate', { url: 'http://localhost:8085/local-player' });
    await sleep(1500);
    for (const width of [1440, 390]) {
        await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
        await sleep(500);
        const layout = await evaluate(`(()=>{const nav=document.querySelector('.sidebar'),main=document.querySelector('.local-player-content');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,sidebar:!!nav,mainLeft:main.getBoundingClientRect().left,active:!!document.querySelector('.sidebar a.active[href="/local-player"]'),buttons:document.querySelectorAll('.local-toolbar button').length}})()`);
        if (!layout.sidebar || !layout.active || layout.scrollWidth > width + 1 || (width > 980 && layout.mainLeft < 200)) throw new Error(JSON.stringify(layout));
        results.push(layout);
        const screenshot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(`${output}/${width}.png`, Buffer.from(screenshot.data, 'base64'));
    }
    const doc = await page.send('DOM.getDocument');
    const input = await page.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#local-files' });
    await page.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: ['B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-89-1778404060584.mp3'] });
    let ready = false;
    for (let i = 0; i < 40; i++) {
        ready = await evaluate(`document.querySelector('#local-import-results').children.length===1`);
        if (ready) break;
        await sleep(500);
    }
    if (!ready || errors.length) throw new Error(JSON.stringify({ ready, errors }));
    console.log(JSON.stringify({ results, importPreview: ready, errors }));
} finally {
    page.close();
    chrome.proc.kill();
}
