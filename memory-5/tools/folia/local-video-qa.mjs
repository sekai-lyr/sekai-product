import {launchChrome,newPage,sleep} from 'file:///D:/dsh-render/cdp.mjs';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
const out='D:/dsh-render/qa-local-video-20261014';mkdirSync(out,{recursive:true});
const chrome=await launchChrome({port:9425}),page=await newPage(chrome.port);
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
try{
    await page.send('Page.enable');await page.send('Runtime.enable');
    await page.send('Page.navigate',{url:'http://localhost:8085/login'});await sleep(600);
    const result=await evaluate(`(async()=>{
        const {mountVideo}=await import('/js/local-video.js');
        document.body.replaceChildren();document.body.style.cssText='margin:0;background:#111';
        const bytes=Uint8Array.from(atob('${readFileSync('D:/dsh-render/qa-local-video-20261014/fixture.mp4').toString('base64')}'),c=>c.charCodeAt(0));
        const file=new File([bytes],'fixture.mp4',{type:'video/mp4'}),url=URL.createObjectURL(file);
        window.__qaVideo={file,url};
        const stage=document.createElement('main');stage.style.cssText='position:relative;height:100vh';document.body.append(stage);
        const audio=document.createElement('audio');audio.src=url;audio.controls=true;audio.style.cssText='position:absolute;bottom:20px;left:20px;z-index:40';stage.append(audio);
        await new Promise((resolve,reject)=>{audio.onloadedmetadata=resolve;audio.onerror=()=>reject(Error(audio.error?.message || 'Fixture decode failed'));});
        // Browser-created WebM can lack its duration header; seek to establish its end.
        if(!Number.isFinite(audio.duration)){audio.currentTime=1e6;await new Promise(r=>audio.onseeked=r);audio.currentTime=0;}
        mountVideo({audio,stage,track:{file,url,rows:[]}});
        const video=stage.querySelector('video');await new Promise(r=>video.onloadeddata=r);
        await audio.play();await new Promise(r=>setTimeout(r,300));audio.pause();await new Promise(r=>setTimeout(r,100));
        const singleAudio=video.muted,paused=video.paused;
        const toggle=stage.querySelector('button');toggle.click();const lyrics=video.hidden;toggle.click();const original=!video.hidden;
        const extract=stage.querySelectorAll('button')[1];extract.click();
        for(let i=0;i<80 && !stage.querySelector('a');i++)await new Promise(r=>setTimeout(r,100));
        const link=stage.querySelector('a');if(!link)throw Error(stage.querySelector('[role=status]').textContent);
        const wav=await (await fetch(link.href)).arrayBuffer(),view=new DataView(wav);
        return {singleAudio,paused,lyrics,original,bytes:wav.byteLength,header:new TextDecoder().decode(wav.slice(0,4)),channels:view.getUint16(22,true),sampleRate:view.getUint32(24,true),fileName:link.download};
    })()`);
    if(!result.singleAudio||!result.paused||!result.lyrics||!result.original||result.header!=='RIFF'||result.bytes<1000)throw Error(JSON.stringify(result));
    writeFileSync(out+'/report.json',JSON.stringify(result,null,2));
    writeFileSync(out+'/video.png',Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await evaluate(`(()=>{
        const {file,url}=window.__qaVideo;document.body.replaceChildren();
        const track={key:'video-qa',file,url,title:'本机视频测试',artist:'测试音轨',album:'',index:0,cover:'/images/login-music-room.png',rows:[{seconds:0,text:'视频音轨与歌词演出'}],restore:{time:0,playing:false}};
        const iframe=document.createElement('iframe');iframe.style.cssText='border:0;width:100vw;height:100vh';document.body.append(iframe);
        window.__sekaiLocalPlayer={track,queue:[{title:track.title,index:0}],savePreferences(){},select(){},next(){},previous(){},changeMode(){},markUnavailable(){}};
        iframe.src='/local-stage?mode=disc&render=1';
    })()`);
    for(let i=0;i<80&&!await evaluate('frames[0]?.document.querySelector(".local-video-actions")');i++)await sleep(100);
    const integrated=await evaluate(`(async()=>{
        const d=frames[0].document,audio=d.querySelector('audio'),video=d.querySelector('video'),button=d.querySelector('.local-video-actions button');
        if(!video||!button)throw Error('Video controls missing from real stage');
        d.body.classList.remove('render-mode');audio.currentTime=.5;await new Promise(r=>setTimeout(r,200));
        const delta=Math.abs(audio.currentTime-video.currentTime);button.click();const lyrics=video.hidden;button.click();
        return {delta,lyrics,original:!video.hidden,muted:video.muted};
    })()`);
    if(integrated.delta>.15||!integrated.lyrics||!integrated.original||!integrated.muted)throw Error(JSON.stringify(integrated));
    writeFileSync(out+'/stage.png',Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    writeFileSync(out+'/integrated-report.json',JSON.stringify(integrated,null,2));
    console.log(JSON.stringify(result));
    console.log(JSON.stringify(integrated));
}finally{page.close();chrome.proc.kill();}
