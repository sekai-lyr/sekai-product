import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='D:/dsh-render/qa-local-only-20261011';mkdirSync(out,{recursive:true});
const login=await fetch('http://localhost:8085/user/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({userName:'sekai',password:process.env.SEKAI_QA_PASSWORD}),redirect:'manual'});
const raw=login.headers.getSetCookie().find(x=>x.startsWith('JSESSIONID_M5='));
if(!raw || !login.headers.get('location')?.includes('/home'))throw new Error('QA login failed');
const cookie=raw.split(';')[0];
const request=(path,authenticated=false)=>fetch(`http://localhost:8085${path}`,{
    method:path.endsWith('audio-folder-path')?'POST':'GET',
    headers:{...(authenticated?{Cookie:cookie}:{}),Range:'bytes=0-1023'}});
const audio='/uploads/audio/2-36-1778404055914.flac';
const anonymous=await request(audio);await anonymous.arrayBuffer();
const owned=await request(audio,true);const ownedBytes=(await owned.arrayBuffer()).byteLength;
const endpoints=[];
for(const path of ['/bilibili/direct/221','/bilibili/stream/221','/playlists/6/audio-folder-path']){
    const response=await request(path,true);endpoints.push({path,status:response.status});await response.arrayBuffer();
}
const chrome=await launchChrome({port:9375});const page=await newPage(chrome.port);const errors=[];
page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
const views=[];
try {
    await page.send('Page.enable');await page.send('Runtime.enable');await page.send('Network.enable');
    await page.send('Network.setCookie',{name:'JSESSIONID_M5',value:cookie.slice('JSESSIONID_M5='.length),domain:'localhost',path:'/'});
    const evaluate=async expression=>(await page.send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
    for(const song of [221,36])for(const mode of ['disc','lyrics','folia-classic','folia']){
        await page.send('Page.navigate',{url:`http://localhost:8085/player/${song}?mode=${mode}`});await sleep(1800);
        if(song===36&&mode==='folia')for(let i=0;i<20 && !await evaluate('document.querySelector(".lyric-stage")?.dataset.foliaEngine==="sonnet"');i++)await sleep(500);
        views.push({song,mode,...await evaluate('({audio:document.querySelectorAll("audio.stage-audio").length,iframe:document.querySelectorAll("iframe").length,uploadOnly:document.body.textContent.includes("上传你自己的音乐，开启四种演出"),engine:document.querySelector(".lyric-stage")?.dataset.foliaEngine})')});
        if(song===221&&mode==='folia'){
            const shot=await page.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${out}/upload-required.png`,Buffer.from(shot.data,'base64'));
        }
    }
    const report={anonymousAudio:anonymous.status,ownedAudio:owned.status,ownedBytes,endpoints,views,errors};
    writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
    if(anonymous.status!==401||owned.status!==206||ownedBytes!==1024||endpoints.some(x=>x.status!==410)||errors.length||views.some(x=>x.iframe|| (x.song===221? !x.uploadOnly||x.audio : x.uploadOnly||x.audio!==1)))throw new Error('Local-only QA failed');
} finally {page.close();chrome.proc.kill();}
