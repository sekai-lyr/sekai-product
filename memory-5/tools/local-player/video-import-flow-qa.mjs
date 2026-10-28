import {launchChrome,newPage,sleep} from 'file:///D:/dsh-render/cdp.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const out='D:/dsh-render/qa-video-import-20261016';mkdirSync(out,{recursive:true});
const chrome=await launchChrome({port:9436}),page=await newPage(chrome.port),writes=[],errors=[];
const songs=[{id:221,title:'原视频歌曲',artist:'原歌手',album:'原专辑',fileName:'bilibili-221-35833842040.mp4',videoFileName:'bilibili-221-35833842040.mp4',preferences:{},favorite:false}];
const playlists=[{id:6,name:'原视频歌单',songIds:[221]},{id:7,name:'共享歌曲歌单',songIds:[221]}];
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
async function wait(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(120);}throw Error('Timeout: '+expression+' '+await evaluate(`document.querySelector('#local-status')?.textContent`));}
async function navigate(url){await page.send('Page.navigate',{url:'http://localhost:8085'+url});await wait(`document.querySelector('#local-account')?.textContent.includes('视频测试账户')`);}
const ready=`!document.querySelector('#local-stage').hidden && new URL(document.querySelector('#local-stage').dataset.stageUrl,location.origin).href===document.querySelector('#local-stage').contentWindow.location.href && document.querySelector('#local-stage').contentWindow.__sekaiLocalRestoreReady && document.querySelector('#local-stage').contentDocument.querySelector('video')?.readyState>=2`;
try{
    await page.send('Page.enable');await page.send('Runtime.enable');await page.send('DOM.enable');await page.send('Network.enable');await page.send('Network.setCacheDisabled',{cacheDisabled:true});
    page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
    page.on('Fetch.requestPaused',async({requestId,request})=>{
        try{
            const path=new URL(request.url).pathname;let response;
            if(request.method==='GET')response={user:{id:31,name:'视频测试账户'},songs,playlists,csrf:'video-fixture'};
            else{
                const body=JSON.parse(request.postData||'{}');writes.push({path,body});
                if(path.endsWith('/songs')){const song={id:900001,title:body.title,artist:body.artist,album:body.album,...body.file,preferences:{},favorite:false};songs.push(song);response={id:song.id};}
                else if(/\/playlists\/\d+\/songs\/\d+$/.test(path)){const parts=path.split('/'),p=playlists.find(p=>p.id===Number(parts.at(-3))),id=Number(parts.at(-1));if(!p.songIds.includes(id))p.songIds.push(id);response={saved:true};}
                else {const song=songs.find(s=>s.id===Number(path.split('/').at(-2)));if(!song)throw Error('Unknown target');if(path.endsWith('/binding'))Object.assign(song,body);if(path.endsWith('/lyrics'))song.lyrics=body.lyrics;if(path.endsWith('/preferences'))song.preferences=body;response={saved:true};}
            }
            await page.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(response)).toString('base64')});
        }catch(e){errors.push(String(e));await page.send('Fetch.failRequest',{requestId,errorReason:'Failed'});}
    });
    await page.send('Fetch.enable',{patterns:[{urlPattern:'*/local-player/library*'}]});
    await navigate('/local-player?songId=221&playlistId=6&media=video');
    await wait(`document.querySelector('#local-status').textContent.includes('记录仍保留')`);
    await evaluate(`(async()=>{
        const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('video-import-qa',{create:true});
        const bytes=Uint8Array.from(atob('${readFileSync('D:/dsh-render/qa-local-video-20261014/fixture.mp4').toString('base64')}'),c=>c.charCodeAt(0));
        for(const name of ['renamed-clip.mp4','new-video.mp4']){const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(bytes);await w.close();}
        for(const name of ['renamed-clip.lrc','new-video.lrc']){const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write('[00:00.000]第一句视频歌词\\n[00:01.000]第二句视频歌词');await w.close();}
        window.showOpenFilePicker=async()=>[await dir.getFileHandle('renamed-clip.mp4'),await dir.getFileHandle('renamed-clip.lrc')];
        document.querySelector('#local-files').click();
    })()`);
    await wait(`!document.querySelector('#local-import-panel').hidden && document.querySelector('#local-import-results').textContent.includes('2行已匹配')`);
    if(writes.length)throw Error('Preview mutated account');
    if(!await evaluate(`document.querySelector('#local-import-confirm').textContent.includes('关联') && document.querySelector('#local-import-results').textContent.includes('原视频歌曲')`))throw Error('Association preview lost original song');
    await evaluate(`document.querySelector('#local-import-confirm').click()`);await wait(ready);
    const associated=await evaluate(`({title:window.__sekaiLocalPlayer.track.title,id:window.__sekaiLocalPlayer.track.id,rows:window.__sekaiLocalPlayer.track.rows.length,original:!frames[0].document.querySelector('video').hidden})`);
    if(associated.id!==221||associated.rows!==2||!associated.original||songs.length!==1||playlists.some(p=>p.songIds.length!==1))throw Error(JSON.stringify({associated,songs,playlists}));
    await navigate('/local-player?songId=221&playlistId=6');await wait(ready);
    const restored=await evaluate(`({name:window.__sekaiLocalPlayer.track.file.name,rows:window.__sekaiLocalPlayer.track.rows.length,blob:frames[0].document.querySelector('video').src.startsWith('blob:')})`);
    if(restored.name!=='renamed-clip.mp4'||restored.rows!==2||!restored.blob)throw Error('Video handle/lyrics did not survive reload');
    await evaluate(`(()=>{const d=frames[0].document;d.querySelector('.local-video-actions button').click();window.__sekaiLocalPlayer.changeMode('derived-sea');})()`);
    await wait(`frames[0].document.querySelector('.now-playing')?.dataset.stageMode==='derived-sea' && !!frames[0].document.querySelector('.local-video-actions')`);
    const lyricMode=await evaluate(`frames[0].document.querySelector('video').hidden`);
    if(!lyricMode)throw Error('Changing performance covered lyrics with original video again');
    await navigate('/local-player');
    await evaluate(`(async()=>{const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('video-import-qa');window.showOpenFilePicker=async()=>[await dir.getFileHandle('new-video.mp4'),await dir.getFileHandle('new-video.lrc')];document.querySelector('#local-files').click();})()`);
    await wait(`!document.querySelector('#local-import-panel').hidden && document.querySelector('#local-import-results').textContent.includes('2行已匹配')`);
    await evaluate(`document.querySelector('#local-import-target').value='6';document.querySelector('#local-import-confirm').click()`);
    for(let i=0;i<100&&!playlists[0].songIds.includes(900001);i++)await sleep(120);
    if(songs.length!==2||!playlists[0].songIds.includes(900001)||playlists[1].songIds.length!==1)throw Error('New video import did not preserve playlist membership');
    await navigate('/local-player?songId=900001&playlistId=6');await wait(ready);
    await navigate('/local-player');
    await evaluate(`(async()=>{
        const root=await navigator.storage.getDirectory(),source=await root.getDirectoryHandle('video-import-qa'),dir=await root.getDirectoryHandle('video-bulk-qa',{create:true});
        const bytes=await(await source.getFileHandle('renamed-clip.mp4')).getFile();
        for(const name of ['bilibili-221-35833842040.mp4','unmatched.mp4']){const handle=await dir.getFileHandle(name,{create:true}),writer=await handle.createWritable();await writer.write(bytes);await writer.close();}
        const lrc=await dir.getFileHandle('bilibili-221-35833842040.lrc',{create:true}),writer=await lrc.createWritable();await writer.write('[00:00.000]批量关联第一句\\n[00:01.000]批量关联第二句');await writer.close();
        window.showDirectoryPicker=async()=>dir;document.querySelector('#local-link-existing').click();
    })()`);
    await wait(`document.querySelector('#local-status').textContent.includes('1 个文件未匹配')`);
    if(songs.length!==2||playlists[0].songIds.length!==2||playlists[1].songIds.length!==1)throw Error('Bulk video association changed library/playlist');
    await navigate('/local-player?songId=221&playlistId=6');await wait(ready);
    await evaluate(`window.showOpenFilePicker=undefined`);
    const doc=await page.send('DOM.getDocument'),input=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#local-files'});
    await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['D:/dsh-render/qa-local-video-20261014/fixture.mp4']});
    await wait(`!document.querySelector('#local-import-panel').hidden && !document.querySelector('#local-import-confirm').disabled`);
    await evaluate(`document.querySelector('#local-import-confirm').click()`);await wait(`(${ready}) && window.__sekaiLocalPlayer.track.file.name==='fixture.mp4'`);
    await navigate('/local-player?songId=221&playlistId=6');await wait(`document.querySelector('#local-status').textContent.includes('记录仍保留') || !document.querySelector('#local-stage').hidden`);
    const fallbackMissing=await evaluate(`document.querySelector('#local-stage').hidden && document.querySelector('#local-status').textContent.includes('记录仍保留')`);
    if(!fallbackMissing)throw Error('Nonpersistent file selection incorrectly restored a stale video handle');
    if(writes.some(w=>Object.values(w.body).some(v=>typeof v==='string'&&v.startsWith('data:')))||errors.length)throw Error(JSON.stringify(errors));
    writeFileSync(out+'/page.png',Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    const report={associated,restored,lyricMode,bulkAssociation:true,fallbackMissing,playlistIds:playlists.map(p=>({id:p.id,songIds:p.songIds})),songs:songs.length,metadataWrites:writes.length,errors};
    writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{page.close();chrome.proc.kill();}
