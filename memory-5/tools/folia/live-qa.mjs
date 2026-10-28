import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { writeFileSync } from 'node:fs';
const chrome = await launchChrome({port:9370});
const page = await newPage(chrome.port);
const errors = [];
page.on('Runtime.exceptionThrown', ({exceptionDetails}) => errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Network.enable');
const login = await fetch('http://localhost:8085/user/login', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'userName=sekai&password=20070831miku',redirect:'manual'});
const cookie = login.headers.getSetCookie().find(x=>x.startsWith('JSESSIONID_M5=')).split(';')[0].slice('JSESSIONID_M5='.length);
await page.send('Network.setCookie',{name:'JSESSIONID_M5',value:cookie,domain:'localhost',path:'/'});
const results=[];
try {
    for(const song of [36,606])for(const mode of ['lyrics','folia-classic','folia']) {
        await page.send('Page.navigate',{url:`http://localhost:8085/player/${song}?playlistId=${song===36?6:24}&mode=${mode}`});
        await sleep(2500);
        for(let i=0;i<20;i++){
            const ready=await page.send('Runtime.evaluate',{expression:`Boolean(window.__stageTimeline && (${JSON.stringify(mode)} !== 'folia' || document.querySelector('.lyric-stage').dataset.foliaEngine === 'sonnet'))`,returnByValue:true});
            if(ready.result.value)break; await sleep(500);
        }
        const check=await page.send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
            const audio=document.querySelector('audio.stage-audio');
            const seek=document.querySelector('[data-stage-seek]');
            seek.value='333';seek.dispatchEvent(new Event('input',{bubbles:true}));seek.dispatchEvent(new Event('change',{bubbles:true}));
            await new Promise(r=>setTimeout(r,350));
            const expectedSeek=audio.duration*.333,actualSeek=audio.currentTime;
            await audio.play();await new Promise(r=>setTimeout(r,450));audio.pause();await new Promise(r=>setTimeout(r,100));
            const before=window.__stageTimeline.now();
            const state=()=>[document.querySelector('.lyric-backdrop img').style.transform,...Array.from(document.querySelector('[data-lyric-slot="active"]').children).map(s=>s.style.transform)].join('|');
            const beforeVisual=state();await new Promise(r=>setTimeout(r,300));
            const after=window.__stageTimeline.now();
            const rows=Array.from(document.querySelectorAll('#lyrics p[data-time]')).filter(row=>row.querySelector('b')?.textContent.trim());
            const expected=rows.filter(row=>Number(row.dataset.time)<=after).at(-1)?.querySelector('b').textContent.trim();
            const actual=document.querySelector('[data-lyric-slot="active"]').dataset.text;
            return {duration:audio.duration,expectedSeek,actualSeek,seekError:Math.abs(actualSeek-expectedSeek),before,after,frozen:before===after&&beforeVisual===state(),expected,actual,synchronized:expected===actual,engine:document.querySelector('.lyric-stage').dataset.foliaEngine};
        })()`});
        results.push({song,mode,...check.result.value,exception:check.exceptionDetails});console.log(JSON.stringify(results.at(-1)));
    }
} finally {writeFileSync('D:/dsh-render/qa-sonnet-20261011/live-report.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({errors}));page.close();chrome.proc.kill();}
