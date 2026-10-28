// Exercises the real HTTP controller, WebSocket relay, and filesystem provider.
// Removing stream forwarding, ownership checks, or stop handling must fail this test.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createIndex,saveIndex,loadIndex} from './files.mjs';
import {startProvider} from './provider.mjs';

const [site,songText,name,deviceName]=process.argv.slice(2),songId=Number(songText);
assert.match(site,/^http:\/\/127\.0\.0\.1:\d+$/);
const root=await mkdtemp(join(tmpdir(),'sekai-device-e2e-'));
let provider,credentials;
async function session(owner){const r=await fetch(`${site}/__device_qa/session?owner=${owner}`);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const cookie=await session(31),other=await session(3);
async function request(path,{method='GET',body,as=cookie,headers={}}={}){
    console.error('HTTP',method,path,headers.Range||'');
    return fetch(site+path,{method,headers:{...(as?{Cookie:as}:{}),'X-Local-Library-CSRF':'device-e2e',...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
}
async function eventually(check){for(let n=0;n<80;n++){if(await check())return;await delay(50);}throw Error('State transition timed out');}
const device=async()=>{const r=await request('/api/device-sharing/devices');assert.equal(r.status,200);return (await r.json()).find(d=>d.id===credentials.deviceId);};
async function enable(){const r=await request(`/api/device-sharing/devices/${credentials.deviceId}/sharing`,{method:'POST',body:{enabled:true}});assert.equal(r.status,200);await eventually(async()=>(await device())?.sharing);}
try {
    const bytes=Buffer.alloc(196608);for(let n=0;n<bytes.length;n++)bytes[n]=n%251;
    bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
    bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
    bytes.writeUInt32LE(22050,24);bytes.writeUInt32LE(44100,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
    bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
    await writeFile(join(root,name),bytes);
    const lyricText=process.env.SEKAI_MOBILE_QA==='1'?'[00:00.00]在音乐里看见完整的世界\n[00:02.00]A longer English lyric should fit the mobile window completely\n[00:03.50]长一点的中文歌词也要完整显示':'[00:00.00]Device test';
    const stem=name.replace(/\.wav$/,'');await writeFile(join(root,stem+'.lrc'),lyricText);
    const {index}=await createIndex([root],[{id:songId,fileName:name,fileSize:bytes.length}]);
    assert.equal(index.files.length,2);await saveIndex(join(root,'index.json'),index);
    const pairing=await request('/api/device-sharing/pairing',{method:'POST'});assert.equal(pairing.status,200);
    const paired=await request('/api/device-sharing/pair',{method:'POST',body:{code:(await pairing.json()).code,name:deviceName}});
    assert.equal(paired.status,200);credentials=await paired.json();
    provider=startProvider({site,credentials,index});await provider.ready;
    assert.equal((await device()).sharing,false);
    const path=`/api/device-sharing/media/${credentials.deviceId}/${songId}/audio`;
    await enable();
    for(const [range,status,want] of [[null,200,bytes],['bytes=65530-65550',206,bytes.subarray(65530,65551)],['bytes=-7',206,bytes.subarray(-7)]]){
        const r=await request(path,{headers:range?{Range:range}:{}});assert.equal(r.status,status);assert.deepEqual(Buffer.from(await r.arrayBuffer()),want);
    }
    assert.equal((await request(path,{method:'HEAD'})).headers.get('content-length'),'196608');
    assert.equal((await request(path,{headers:{Range:'bytes=999999-'}})).status,416);
    assert.equal((await request(path,{as:null})).status,401);
    assert.equal((await request(path,{as:other})).status,404);
    const lyric=await request(path.replace(/audio$/,'lyric'));assert.equal(await lyric.text(),lyricText);
    if(process.env.SEKAI_DEVICE_BROWSER_QA==='1') {
        const {chromium}=await import('../browser-qa-runtime/node_modules/playwright-core/index.mjs');
        const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
        try {
            const context=await browser.newContext();
            const [cookieName,...value]=cookie.split('=');await context.addCookies([{name:cookieName,value:value.join('='),url:site}]);
            const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
            await page.goto(site+`/player/${songId}?autoplay=1`);
            await page.waitForTimeout(1500);console.error('PLAYER STATUS',await page.locator('#local-status').textContent());
            const audio=page.frameLocator('#local-stage').locator('audio');await audio.waitFor({state:'attached'});
            await audio.evaluate(a=>a.play());
            await eventually(()=>audio.evaluate(a=>a.currentTime>0.1 && a.readyState>=2));
            assert.equal(await audio.evaluate(a=>a.src.includes('/api/device-sharing/media/')),true);
            const modes=await page.locator('#local-mode option').evaluateAll(options=>options.map(o=>o.value));
            assert.equal(modes.length,23);
            for(const mode of modes){
                await page.locator('#local-mode').selectOption(mode,{force:true});
                await page.waitForFunction(mode=>document.querySelector('#local-stage')?.contentDocument?.querySelector('.now-playing')?.dataset.stageMode===mode,mode);
                await page.frameLocator('#local-stage').locator('audio').waitFor({state:'attached'});
            }
            assert.deepEqual(errors,[]);
            console.error('PASS isolated Chrome: remote WAV playback and all 23 stage modes mount');
            if(process.env.SEKAI_MOBILE_QA==='1')await (await import('./mobile-stage-qa.mjs')).mobileStages(page,modes);
        } finally {await browser.close();}
    }
    provider.stop();await eventually(async()=>!(await device()).sharing);
    assert.equal((await request(path)).status,409);
    assert.equal((await request(`/api/device-sharing/devices/${credentials.deviceId}/sharing`,{method:'POST',body:{enabled:true}})).status,409);
    provider.resume();await delay(100);await enable();
    provider.close();await eventually(async()=>!(await device()).online);
    provider=startProvider({site,credentials,index:await loadIndex(join(root,'index.json'))});await provider.ready;
    assert.equal((await device()).sharing,false);await enable();
    const final=await request(path);assert.deepEqual(Buffer.from(await final.arrayBuffer()),bytes);
    await unlink(join(root,name));assert.equal((await request(path)).status,404,'Deleted source is unavailable, not a successful media response');
    if(process.env.SEKAI_DEVICE_BROWSER_QA==='1'){
        provider.close();await eventually(async()=>!(await device()).online);
        const {browserProviderTest}=await import('./browser-provider-e2e.mjs');
        await browserProviderTest({site,songId,name,bytes,cookie});
    }
    console.log('PASS real WebSocket + HTTP: full/range/HEAD, ownership, stop/resume, persisted index reconnect');
} finally {
    provider?.close();
    if(credentials)await request(`/api/device-sharing/devices/${credentials.deviceId}/revoke`,{method:'POST'}).catch(()=>{});
    await rm(root,{recursive:true,force:true});
}
