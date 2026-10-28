// Browser-only account fixture. Real DB endpoints are covered by transactional Java integration tests.
import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const output='D:/dsh-render/qa-import-flow-20261012';mkdirSync(output,{recursive:true});
const chrome=await launchChrome({port:9390,userDataDir:`${output}/browser`});const page=await newPage(chrome.port);
const songs=[],playlists=[{id:77,name:'已有测试歌单',songIds:[]}],writes=[],errors=[],modes=[];
let next=900001;
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
const wait=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await sleep(250);}throw new Error(`Timeout ${expression}`);};
const ready=`document.querySelector('#local-stage').contentWindow.location.href===new URL(document.querySelector('#local-stage').dataset.stageUrl,location.origin).href && document.querySelector('#local-stage').contentWindow.__sekaiLocalRestoreReady && document.querySelector('#local-stage').contentWindow.__stageTimeline && (document.querySelector('#local-stage').contentDocument.querySelector('.now-playing')?.dataset.stageMode!=='folia' || document.querySelector('#local-stage').contentWindow.__stageReady===true)`;
try{
    await page.send('Page.enable');await page.send('Runtime.enable');await page.send('DOM.enable');await page.send('Network.enable');
    page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    page.on('Fetch.requestPaused',async({requestId,request})=>{
        const path=new URL(request.url).pathname;let body={};
        if(request.method==='POST'){
            body=JSON.parse(request.postData || '{}');writes.push({path,body});
            if(path.endsWith('/library/playlists')){playlists.push({id:78,name:body.name,songIds:[]});body={id:78};}
            else if(path.endsWith('/library/songs')){
                const song={id:next++,title:body.title,artist:body.artist,album:body.album,favorite:false,preferences:{},...body.file};songs.push(song);body={id:song.id};
            }else if(/\/playlists\/\d+\/songs\/\d+$/.test(path)){
                const parts=path.split('/');playlists.find(p=>p.id===Number(parts.at(-3))).songIds.push(Number(parts.at(-1)));body={saved:true};
            }else{
                const id=Number(path.split('/').at(-2)),song=songs.find(s=>s.id===id);
                if(path.endsWith('/binding'))Object.assign(song,body);
                if(path.endsWith('/lyrics'))song.lyrics=body.lyrics;
                if(path.endsWith('/preferences'))song.preferences=body;
                body={saved:true};
            }
        }else body={user:{id:31,name:'浏览器测试账户'},csrf:'fixture',songs,playlists};
        await page.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
    });
    await page.send('Fetch.enable',{patterns:[{urlPattern:'*/local-player/library*'}]});
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await page.send('Page.navigate',{url:'http://localhost:8085/local-player'});await wait(`document.querySelector('#local-account').textContent.includes('浏览器测试账户')`);
    const doc=await page.send('DOM.getDocument');const input=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#local-files'});
    await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-89-1778404060584.mp3']});
    await wait(`document.querySelector('#local-import-results').children.length===1`);
    if(writes.length)throw new Error('Preview wrote account data');
    await evaluate(`(async()=>{
        const root=await navigator.storage.getDirectory();const folder=await root.getDirectoryHandle('__import_qa__',{create:true});
        const audio=await folder.getFileHandle('test.mp3',{create:true});const writer=await audio.createWritable();await writer.write(document.querySelector('#local-files').files[0]);await writer.close();
        const lrc=await folder.getFileHandle('test.lrc',{create:true});const lw=await lrc.createWritable();await lw.write('[00:01.000]测试第一句\\n[00:08.000]测试第二句');await lw.close();
        const cover=await folder.getFileHandle('test.png',{create:true});const cw=await cover.createWritable();await cw.write(new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],{type:'image/png'}));await cw.close();
        window.showDirectoryPicker=async()=>folder;
        document.querySelector('#local-remember').click();
    })()`);
    await wait(`document.querySelector('#local-import-results').textContent.includes('2行已匹配')`);
    if(writes.length)throw new Error('Folder preview wrote account data');
    await evaluate(`document.querySelector('#local-import-target').value='new';document.querySelector('#local-import-target').dispatchEvent(new Event('change'));document.querySelector('#local-import-name').value='新建测试歌单';document.querySelector('#local-import-confirm').click()`);
    for(let i=0;i<80 && !playlists.find(p=>p.id===78)?.songIds.length;i++)await sleep(250);
    if(songs.length!==1 || playlists.find(p=>p.id===78).songIds[0]!==songs[0].id || !songs[0].lyrics.includes('测试第二句'))throw new Error(JSON.stringify({songs,playlists}));
    const id=songs[0].id;
    await page.send('Page.navigate',{url:`http://localhost:8085/local-player?songId=${id}&playlistId=78`});await wait(ready);
    const restored=await evaluate(`({rows:window.__sekaiLocalPlayer.track.rows.length,cover:window.__sekaiLocalPlayer.track.cover.startsWith('blob:'),audio:document.querySelector('#local-stage').contentDocument.querySelector('audio').src.startsWith('blob:')})`);
    if(restored.rows!==2 || !restored.cover || !restored.audio)throw new Error(JSON.stringify(restored));
    await evaluate(`(()=>{const card=document.createElement('div');card.className='selection-track is-active';const button=document.createElement('a');button.dataset.selectionTrack='';button.dataset.id='${id}';button.append(document.createElement('img'));card.append(button);document.body.append(card);const script=document.createElement('script');script.src='/js/local-library-covers.js';document.head.append(script);})()`);
    await wait(`document.querySelector('[data-selection-track] img')?.src.startsWith('blob:')`);
    await evaluate(`document.querySelector('.selection-track').remove()`);
    for(const mode of ['disc','lyrics','folia-classic','folia']){
        await evaluate(`window.__sekaiLocalPlayer.changeMode('${mode}')`);await wait(ready);
        const result=await evaluate(`({mode:document.querySelector('#local-stage').contentDocument.querySelector('.now-playing').dataset.stageMode,rows:window.__sekaiLocalPlayer.track.rows.length})`);modes.push(result);
        if(result.mode!==mode || result.rows!==2)throw new Error(JSON.stringify(result));
    }
    await page.send('Page.navigate',{url:'http://localhost:8085/local-player'});await wait(`document.querySelector('#local-account').textContent.includes('浏览器测试账户')`);
    await evaluate(`(async()=>{const root=await navigator.storage.getDirectory();window.showDirectoryPicker=async()=>await root.getDirectoryHandle('__import_qa__');document.querySelector('#local-remember').click();})()`);await wait(`document.querySelector('#local-import-results').textContent.includes('2行已匹配')`);
    for(const width of [1440,390]){
        await page.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await sleep(350);
        if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw new Error(`Overflow ${width}`);
        const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${output}/${width}.png`,Buffer.from(shot.data,'base64'));
    }
    if(errors.length)throw new Error(JSON.stringify(errors));
    if(writes.some(w=>Object.keys(w.body).some(key=>['audio','cover','data','blob'].includes(key))))throw new Error('Binary upload payload');
    const report={previewWrites:0,accountFixture:true,restored,modes,playlistMembership:playlists.find(p=>p.id===78).songIds,metadataWrites:writes.length,errors};
    writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
    console.log(JSON.stringify({errors,diagnostics:await evaluate(`({status:document.querySelector('#local-status')?.textContent,track:window.__sekaiLocalPlayer?.track?.title,frame:document.querySelector('#local-stage')?.src,audio:document.querySelector('#local-stage')?.contentDocument?.querySelector('audio')?.readyState,stageReady:document.querySelector('#local-stage')?.contentWindow?.__stageReady})`)}));throw error;
}finally{page.close();chrome.proc.kill();}
