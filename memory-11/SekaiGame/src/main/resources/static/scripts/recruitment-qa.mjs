import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const profile = await mkdtemp(join(tmpdir(), 'sekai-recruitment-'));
const output = process.argv[2] || join(profile, 'screenshots');
await mkdir(output, { recursive: true });
const chrome = spawn('C:/Users/administration/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe', [
    '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
const errors = [];
let socket;
try {
    const endpoint = await new Promise((resolve, reject) => {
        let logs = '';
        const timeout = setTimeout(() => reject(Error('Browser launch timed out: ' + logs)), 15000);
        chrome.once('error', reject);
        chrome.once('exit', code => { clearTimeout(timeout); reject(Error('Browser exited: ' + code + logs)); });
        chrome.stderr.on('data', data => {
            logs += data;
            const match = logs.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
            if (match) { clearTimeout(timeout); resolve(match[1]); }
        });
    });
    const targets = await (await fetch(`http://127.0.0.1:${endpoint}/json/list`)).json();
    socket = new WebSocket(targets[0].webSocketDebuggerUrl);
    await new Promise(resolve => socket.once('open', resolve));
    let sequence = 0;
    const pending = new Map();
    socket.on('message', data => {
        const message = JSON.parse(data);
        if (message.id) {
            const task = pending.get(message.id);
            if (task) { pending.delete(message.id); message.error ? task.reject(Error(JSON.stringify(message.error))) : task.resolve(message.result); }
        }
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const screenshot = async name => {
        const image = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(output, name + '.png'), Buffer.from(image.data, 'base64'));
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:8080/test/recruitment-preview.html' });
    for (let attempt = 0; attempt < 40; attempt++) {
        if (await evaluate('Boolean(window.previewApp)')) break;
        await wait(250);
    }
    await evaluate('document.querySelector("#play").click()');
    await wait(1600); await screenshot('opening-desktop');
    await wait(4500); await screenshot('reveal-desktop');
    await wait(3700); await screenshot('results-desktop');
    console.log('desktop', await evaluate('JSON.stringify({cards:document.querySelectorAll(".pack-flip-card").length,complete:document.querySelector(".recruitment-cinema").classList.contains("is-pack-open"),broken:[...document.querySelectorAll(".recruitment-cinema img")].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)})'));
    await evaluate('document.querySelector("#reveal-pack-results").click()');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate('document.querySelector("#play").click()');
    await wait(6200); await screenshot('reveal-mobile');
    await wait(3600); await screenshot('results-mobile');
    console.log('mobile', await evaluate('JSON.stringify({complete:document.querySelector(".recruitment-cinema").classList.contains("is-pack-open"),clipped:[...document.querySelectorAll(".pack-flip-card")].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight}).length})'));
    await evaluate('document.querySelector("#reveal-pack-results").click();document.querySelector("#count").value="1";document.querySelector("#rarity").value="R";document.querySelector("#reduced").checked=true;document.querySelector("#play").click()');
    console.log('reduced', await evaluate('JSON.stringify({cards:document.querySelectorAll(".pack-flip-card").length,complete:document.querySelector(".recruitment-cinema").classList.contains("is-pack-open")})'));
    await evaluate('document.querySelector("#reveal-pack-results").click();document.querySelector("#reduced").checked=false;document.querySelector("#play").click();document.querySelector("#skip-pack-animation").click()');
    await wait(10000);
    console.log('skip', await evaluate('document.querySelector("#modal-root").children.length'));
    console.log('runtimeErrors', JSON.stringify(errors));
    console.log('screenshots', output);
    if (errors.length) process.exitCode = 1;
} finally {
    socket?.close();
    chrome.kill();
}
