import {launchChrome,newPage,sleep} from 'file:///D:/dsh-render/cdp.mjs';
import {readdirSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const base='http://localhost:8085',root='D:/Sekai/_Song/video',out='D:/dsh-render/qa-sekai-video-real-20261016';
mkdirSync(out,{recursive:true});
const password=process.env.SEKAI_TEST_PASSWORD;if(!password)throw Error('Missing test login secret');
const login=await fetch(base+'/user/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({userName:'sekai',password}),redirect:'manual'});
if(!login.headers.get('location')?.includes('/home'))throw Error('Sekai login failed; no account data changed');
const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const before=await(await fetch(base+'/local-player/library',{headers:{Cookie:cookie}})).json();
if(before.user?.name!=='sekai')throw Error('Wrong account');
const files=readdirSync(root).filter(n=>/\.mp4$/i.test(n));
const matched=files.map(name=>({name,songs:before.songs.filter(s=>(s.fileName===name&&(!s.fileSize||s.fileSize===statSync(join(root,name)).size))||(s.videoFileName===name&&s.videoFileName!==s.fileName)).map(s=>s.id)}));
const chrome=await launchChrome({port:9438}),page=await newPage(chrome.port),errors=[],blockedWrites=[];
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
try{
    await page.send('Page.enable');await page.send('Runtime.enable');await page.send('DOM.enable');await page.send('Network.enable');await page.send('Network.setCacheDisabled',{cacheDisabled:true});
    for(const value of login.headers.getSetCookie()){const pair=value.split(';')[0],at=pair.indexOf('=');await page.send('Network.setCookie',{name:pair.slice(0,at),value:pair.slice(at+1),url:base,httpOnly:true});}
    page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
    page.on('Fetch.requestPaused',async({requestId,request})=>{
        if(request.method==='GET'){await page.send('Fetch.continueRequest',{requestId});return;}
        const path=new URL(request.url).pathname;
        blockedWrites.push({path});
        const allowed=/\/songs\/\d+\/(binding|lyrics|preferences)$/.test(path)||path.startsWith('/api/listening/');
        await page.send('Fetch.fulfillRequest',{requestId,responseCode:allowed?200:403,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({saved:allowed,id:'read-only-test'})).toString('base64')});
    });
    await page.send('Fetch.enable',{patterns:[{urlPattern:'*/local-player/library*'},{urlPattern:'*/api/listening/*'}]});
    await page.send('Page.navigate',{url:base+'/local-player'});
    for(let i=0;i<100&&!await evaluate(`document.querySelector('#local-status')?.textContent.includes('歌曲库已有')`);i++)await sleep(150);
    const initial=await evaluate(`({account:document.querySelector('#local-account')?.textContent,status:document.querySelector('#local-status')?.textContent,picker:typeof showDirectoryPicker,secure:isSecureContext})`);
    console.log(JSON.stringify({initial,videos:files.length,matched:matched.filter(m=>m.songs.length).length,ambiguous:matched.filter(m=>m.songs.length>1).length}));
    const doc=await page.send('DOM.getDocument'),input=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#local-link-folder'});
    const start=Date.now();await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[root]});
    const progress=[];
    for(let i=0;i<180;i++){
        const status=await evaluate(`document.querySelector('#local-status').textContent`);
        if(i%2===0){const item={seconds:Math.round((Date.now()-start)/1000),status,button:await evaluate(`document.querySelector('#local-link-existing').textContent`),bindings:blockedWrites.filter(w=>w.path.endsWith('/binding')).length};progress.push(item);console.log(JSON.stringify(item));}
        if(status.includes('本次关联')||status.includes('关联未全部完成'))break;
        await sleep(500);
    }
    await sleep(1000);
    const state=await evaluate(`({status:document.querySelector('#local-status').textContent,account:document.querySelector('#local-account').textContent,rows:window.__sekaiLocalPlayer.track?.rows?.length,title:window.__sekaiLocalPlayer.track?.title,video:!!frames[0]?.document.querySelector('video'),audio:frames[0]?.document.querySelector('audio')?.readyState,reports:[...document.querySelector('#local-link-results').children].map(e=>e.textContent)})`);
    const playback=await evaluate(`(async()=>{const d=frames[0].document,a=d.querySelector('audio'),v=d.querySelector('video');if(!a||!v)return null;a.muted=true;const start=Math.min(12,a.duration/3);a.currentTime=start;await a.play();await new Promise(r=>setTimeout(r,800));a.pause();await new Promise(r=>setTimeout(r,100));return {advanced:a.currentTime-start,videoTime:v.currentTime,audioTime:a.currentTime,delta:Math.abs(v.currentTime-a.currentTime),paused:a.paused&&v.paused,mutedVideo:v.muted};})()`);
    const after=await(await fetch(base+'/local-player/library',{headers:{Cookie:cookie}})).json();
    const unchanged=JSON.stringify(before.songs)===JSON.stringify(after.songs)&&JSON.stringify(before.playlists)===JSON.stringify(after.playlists);
    const matchedIds=new Set(matched.flatMap(m=>m.songs));
    const unmatchedBilibili=before.playlists.filter(p=>p.name.includes('B站')).flatMap(p=>p.songIds.filter(id=>!matchedIds.has(id)).map(id=>({id,title:before.songs.find(s=>s.id===id)?.title})));
    const report={readOnly:true,account:before.user.name,accountSongs:before.songs.length,videos:files.length,matched:matched.filter(m=>m.songs.length).length,unmatched:matched.filter(m=>!m.songs.length),unmatchedBilibili,seconds:(Date.now()-start)/1000,state,playback,progress,errors,unchanged,interceptedBindings:blockedWrites.filter(w=>w.path.endsWith('/binding')).length};
    writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
    if(!unchanged)throw Error('Account changed during read-only test');
    if(!playback||playback.advanced<.3||playback.delta>.25||!playback.paused||!playback.mutedVideo)throw Error('Real account video playback/seek synchronization failed');
    if(!progress.some(p=>p.button.includes('正在关联')))throw Error('No visible association progress');
}finally{page.close();chrome.proc.kill();}
