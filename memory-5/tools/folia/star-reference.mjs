import {launchChrome,newPage,sleep} from 'file:///D:/dsh-render/cdp.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='D:/dsh-render/star-reference-20261015';mkdirSync(out,{recursive:true});
const chrome=await launchChrome({port:9431}),page=await newPage(chrome.port);
try{
    await page.send('Page.enable');await page.send('Runtime.enable');
    await page.send('Page.navigate',{url:'https://www.douyin.com/video/7531989821113011514'});
    await sleep(12000);
    await page.send('Runtime.evaluate',{expression:'document.querySelectorAll("video").forEach(v=>{v.muted=true;v.play().catch(()=>{})})'});
    await sleep(1500);
    const r=await page.send('Runtime.evaluate',{expression:'({title:document.title,text:document.body.innerText.slice(0,1800),videos:[...document.querySelectorAll("video")].map(v=>({src:v.currentSrc,ready:v.readyState,duration:v.duration}))})',returnByValue:true});
    console.log(JSON.stringify(r.result.value));
    writeFileSync(out+'/page.png',Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    for(const t of [0,6,12,18,22]){
        await page.send('Runtime.evaluate',{expression:`(()=>{const v=[...document.querySelectorAll('video')].find(v=>v.duration>20&&v.duration<25);if(v){v.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:black;z-index:2147483647';document.body.append(v);v.pause();v.currentTime=${t};return true;}return false;})()`,returnByValue:true});
        await sleep(650);
        writeFileSync(out+`/frame-${t}.png`,Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    }
}finally{page.close();chrome.proc.kill();}
