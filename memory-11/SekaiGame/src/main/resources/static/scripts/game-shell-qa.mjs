import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const profile = await mkdtemp(join(tmpdir(), 'sekai-shell-'));
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
    await send('Page.navigate', { url: 'http://127.0.0.1:8080/?build=3.0.0-lobby' });
    await wait(2000);
    await screenshot('login-desktop');
    await evaluate(`(async () => {
        const {CardGameApp} = await import('./js/app.js?v=3.0.0-lobby');
        const {ensureProfile,createNewProfile} = await import('./js/profile.js?v=1.7.1');
        const p = ensureProfile(createNewProfile());
        p.decks.forEach(d => d.main.forEach(id => p.cards[id] = 3));
        ['water_009','water_010','water_012'].forEach(id => p.cards[id] = 1);
        p.profile.name = '星野';
        document.querySelector('#auth-screen').classList.add('hidden');
        window.qaApp = new CardGameApp(p, {onStartDuel: value => window.qaStart = value.mode});
    })()`);
    await wait(1000);
    for (const route of ['home','shop','collection','decks','rules','settings']) {
        await evaluate(`window.qaApp.navigate('${route}')`);
        await wait(600);
        await screenshot(route + '-desktop');
        console.log(route, await evaluate(`JSON.stringify({page:document.querySelector('#app-shell').dataset.page,overflow:document.querySelector('#screen-root').scrollWidth>innerWidth,broken:[...document.querySelectorAll('#screen-root img')].filter(i=>i.complete&&!i.naturalWidth).length})`));
    }
    await evaluate('window.qaApp.navigate("collection");document.querySelector("#collection-search").value="不存在的卡名";document.querySelector("#collection-search").dispatchEvent(new Event("input"))');
    await wait(250);
    console.log('searchEmpty', await evaluate('document.querySelectorAll(".collection-grid .catalog-card").length === 0'));
    await evaluate('window.qaApp.navigate("decks")');
    console.log('deckControls', await evaluate('Boolean(document.querySelector("#save-deck") && document.querySelector("#deck-name-input"))'));
    await evaluate('window.qaApp.navigate("rules");document.querySelector("[data-manual-target=rule-08]").click()');
    console.log('manual', await evaluate('document.querySelector("#rule-08").open'));
    await evaluate('window.qaApp.navigate("settings");document.querySelector("#setting-sound").checked=false;document.querySelector("#save-settings").click()');
    console.log('settings', await evaluate('window.qaApp.collection.settings.soundEnabled === false'));
    await evaluate('window.qaApp.navigate("shop");document.querySelector("[data-open-count]").click()');
    console.log('purchaseConfirm', await evaluate('Boolean(document.querySelector("#confirm-pack-open"))'));
    await screenshot('purchase-desktop');
    await evaluate('window.qaApp.closeModal();window.qaApp.navigate("home");document.querySelector("#home-stage-duel").click()');
    await screenshot('stages-desktop');
    await evaluate('window.qaApp.closeModal()');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    for (const route of ['home','shop','collection','decks','rules','settings']) {
        await evaluate(`window.qaApp.navigate('${route}')`);
        await wait(450);
        await screenshot(route + '-mobile');
        console.log(route+' mobile', await evaluate(`JSON.stringify({overflow:document.querySelector('#screen-root').scrollWidth>innerWidth,nav:[...document.querySelectorAll('.sidebar button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})})`));
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    await evaluate('window.qaApp.navigate("home")');
    await wait(300);
    await screenshot('home-landscape');
    console.log('landscape', await evaluate('JSON.stringify({width:innerWidth,height:innerHeight,start:document.querySelector("#home-start-duel").getBoundingClientRect().toJSON()})'));
    console.log('runtimeErrors', JSON.stringify(errors));
    console.log('screenshots', output);
    if (errors.length) process.exitCode = 1;
} finally {
    socket?.close();
    chrome.kill();
}
