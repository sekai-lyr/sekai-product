import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const frames='D:/dsh-render/frames/sonnet-original-20261011';
mkdirSync(frames,{recursive:true});
const chrome=await launchChrome({port:9372});
const page=await newPage(chrome.port);
try {
    await page.send('Page.enable');await page.send('Runtime.enable');await page.send('Network.enable');
    const login=await fetch('http://localhost:8085/user/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'userName=sekai&password=20070831miku',redirect:'manual'});
    const cookie=login.headers.getSetCookie().find(x=>x.startsWith('JSESSIONID_M5=')).split(';')[0].slice('JSESSIONID_M5='.length);
    await page.send('Network.setCookie',{name:'JSESSIONID_M5',value:cookie,domain:'localhost',path:'/'});
    await page.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await page.send('Page.navigate',{url:'http://localhost:8085/player/36?playlistId=6&mode=folia&render=1'});
    await sleep(3500);
    for(let i=0;i<30;i++){
        const state=await page.send('Runtime.evaluate',{expression:'window.__stageReady===true',returnByValue:true});
        if(state.result.value)break;
        if(i===29)throw new Error('Sonnet not ready');
        await sleep(500);
    }
    for(let frame=0;frame<360;frame++){
        await page.send('Runtime.evaluate',{expression:`window.__stageSetFrame(${(14+frame/30)*60},60)`});
        const shot=await page.send('Page.captureScreenshot',{format:'jpeg',quality:92,fromSurface:true});
        writeFileSync(`${frames}/f${String(frame).padStart(5,'0')}.jpg`,Buffer.from(shot.data,'base64'));
        if(frame%60===0)console.log(`frames=${frame}/360`);
    }
} finally {page.close();chrome.proc.kill();}
