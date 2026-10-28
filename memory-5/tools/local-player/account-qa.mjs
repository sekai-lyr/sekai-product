import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const base=process.env.SEKAI_BASE_URL || 'http://localhost:8085';
const live=base.startsWith('https:');
const output=live?'D:/dsh-render/qa-account-domain-20261012':'D:/dsh-render/qa-account-local-20261011';mkdirSync(output,{recursive:true});
const password=process.env.SEKAI_TEST_PASSWORD;if(!password)throw new Error('SEKAI_TEST_PASSWORD required');
const login=await fetch(base+'/user/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({userName:'sekai',password}),redirect:'manual'});
if(!login.headers.get('location')?.includes('/home'))throw new Error('Login failed');
const cookies=login.headers.getSetCookie().map(value=>value.split(';')[0]);
const cookie=cookies.join('; ');
const headers={Cookie:cookie};
const initial=await (await fetch(base+'/local-player/library',{headers})).json();
const mutations={...headers,'Content-Type':'application/json','X-Local-Library-CSRF':initial.csrf};
const saved=Object.fromEntries(initial.songs.filter(s=>[36,606,89].includes(s.id)).map(s=>[s.id,s.preferences]));
const savedBindings=initial.songs.filter(s=>[36,606,89].includes(s.id) && s.fileName && s.fileSize).map(s=>({id:s.id,fileName:s.fileName,fileSize:s.fileSize,lastModified:s.lastModified,lyricFileName:s.lyricFileName}));
const chrome=await launchChrome({port:9383,userDataDir:live?'D:/dsh-render/account-domain-qa-browser-profile':'D:/dsh-render/account-qa-browser-profile'});const page=await newPage(chrome.port);
const errors=[],requests=[],report={initialSongs:initial.songs.length,account:initial.user.name,modes:[]};
page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
page.on('Network.requestWillBeSent',({request})=>{if(!request.url.startsWith('blob:'))requests.push({url:request.url,method:request.method,bytes:request.postData?.length || 0});});
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result.value;};
const ready=`document.querySelector('#local-stage').contentWindow.location.href===new URL(document.querySelector('#local-stage').dataset.stageUrl,location.origin).href && document.querySelector('#local-stage').contentWindow.__sekaiLocalRestoreReady && document.querySelector('#local-stage').contentWindow.__stageTimeline && (document.querySelector('#local-stage').contentDocument.querySelector('.now-playing')?.dataset.stageMode!=='folia' || document.querySelector('#local-stage').contentWindow.__stageReady===true)`;
const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(300);}throw new Error('Timeout '+expression);};
try{
 await page.send('Page.enable');await page.send('Runtime.enable');await page.send('DOM.enable');await page.send('Network.enable');
 for(const value of cookies){const index=value.indexOf('=');await page.send('Network.setCookie',{name:value.slice(0,index),value:value.slice(index+1),domain:new URL(base).hostname,path:'/',secure:live,httpOnly:true});}
 await page.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await page.send('Page.navigate',{url:base+'/local-player?songId=36'});
 await wait(`document.querySelector('#local-account').textContent.includes('sekai') && document.querySelector('#local-track').options.length>600`);
 const root=await page.send('DOM.getDocument');const input=await page.send('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#local-files'});
 await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-36-1778404055914.flac','B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-606-1779121458818.flac']});
 await wait(ready);
 for(const mode of ['disc','lyrics','folia-classic','folia']){
  await evaluate(`window.__sekaiLocalPlayer.changeMode(${JSON.stringify(mode)})`);await wait(`(${ready}) && document.querySelector('#local-stage').contentDocument.querySelector('.now-playing').dataset.stageMode===${JSON.stringify(mode)}`);
  await evaluate(`(async()=>{const a=document.querySelector('#local-stage').contentDocument.querySelector('audio');a.currentTime=32;await a.play();})()`);await sleep(650);
  const state=await evaluate(`(()=>{const w=document.querySelector('#local-stage').contentWindow;const a=w.document.querySelector('audio');return{mode:${JSON.stringify(mode)},id:window.__sekaiLocalPlayer.track.id,src:a.currentSrc,time:a.currentTime,paused:a.paused,rows:w.document.querySelectorAll('#lyrics p[data-time]').length,engine:w.document.querySelector('.lyric-stage')?.dataset.foliaEngine}})()`);
  if(!state.src.startsWith('blob:') || state.paused || state.time<=32 || state.rows<30)throw new Error('Account local stage failed');report.modes.push(state);
  await evaluate(`document.querySelector('#local-stage').contentDocument.querySelector('audio').pause()`);
 }
 await evaluate(`(()=>{const w=document.querySelector('#local-stage').contentWindow;w.document.querySelector('[data-add-bookmark]').click();w.document.querySelector('audio').volume=.6;w.document.querySelector('audio').playbackRate=1.25;localStorage.setItem('sekai.player.playMode','repeat-one');window.__sekaiLocalPlayer.savePreferences();})()`);await sleep(900);
 const persisted=await (await fetch(base+'/local-player/library',{headers})).json();report.preferences=persisted.songs.find(s=>s.id===36).preferences;
 if(report.preferences.playMode!=='repeat-one' || report.preferences.volume!==.6 || report.preferences.rate!==1.25 || !report.preferences.bookmarks.length)throw new Error('Preferences did not persist');
 const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${output}/account-folia.png`,Buffer.from(shot.data,'base64'));
 const doc=await page.send('DOM.getDocument');const mp3Input=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#local-files'});
 await page.send('DOM.setFileInputFiles',{nodeId:mp3Input.nodeId,files:['B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-89-1778404060584.mp3']});
 await sleep(800);
 await evaluate(`(async()=>{const source=document.querySelector('#local-files').files[0];const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle('__qa_local_library__',{create:true});const audio=await dir.getFileHandle(source.name,{create:true});await source.stream().pipeTo(await audio.createWritable());const lrc=await dir.getFileHandle(source.name.slice(0,source.name.lastIndexOf('.'))+'.lrc',{create:true});const writer=await lrc.createWritable();await writer.write(['[00:01]本地歌词测试','[00:03]歌词仍在设备上'].join(String.fromCharCode(10)));await writer.close();await window.__sekaiLocalPlayer.rememberDirectory(dir);})()`);
 await page.send('Page.navigate',{url:base+'/local-player?songId=89'});await wait(ready);
 report.restored=await evaluate(`({id:window.__sekaiLocalPlayer.track.id,source:document.querySelector('#local-stage').contentDocument.querySelector('audio').currentSrc,rows:window.__sekaiLocalPlayer.track.rows.length})`);
 if(report.restored.id!==89 || !report.restored.source.startsWith('blob:') || report.restored.rows!==2)throw new Error('Remembered local file or LRC did not restore');
 await evaluate(`(async()=>{const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle('__qa_local_library__');await dir.removeEntry('2-89-1778404060584.lrc');await window.__sekaiLocalPlayer.select(window.__sekaiLocalPlayer.track.index);})()`);
 await wait(ready);report.missingLrc=await evaluate('document.querySelector("#local-status").textContent');
 if(!report.missingLrc.includes('LRC不可用'))throw new Error('Deleted LRC not detected');
 await evaluate(`(async()=>{const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle('__qa_local_library__');await dir.removeEntry('2-89-1778404060584.mp3');await window.__sekaiLocalPlayer.select(window.__sekaiLocalPlayer.track.index);})()`);
 report.missingAudio=await evaluate('({message:document.querySelector("#local-status").textContent,hidden:document.querySelector("#local-stage").hidden})');
 if(!report.missingAudio.hidden || !report.missingAudio.message.includes('记录仍保留'))throw new Error('Deleted local file handling failed');
 const after=await (await fetch(base+'/local-player/library',{headers})).json();report.afterSongs=after.songs.length;
 if(after.songs.length!==initial.songs.length || !after.songs.some(s=>s.id===89))throw new Error('Missing file unexpectedly deleted account song');
 const badCsrf=await fetch(base+'/local-player/library/songs/36/binding',{method:'POST',headers:{...mutations,'X-Local-Library-CSRF':'wrong'},body:JSON.stringify({fileName:'song.flac',fileSize:1,lastModified:0})});report.badCsrf=badCsrf.status;if(badCsrf.status!==403)throw new Error('CSRF not enforced');
 report.unexpectedAudio=requests.filter(r=>/\/uploads\/audio\/|\/external-uploads\/audio\//.test(r.url) || (r.method==='POST' && (r.bytes>65536 || !/\/local-player\/library\//.test(r.url))));
 report.errors=errors;report.requests=requests;
 writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,requests:undefined},null,2));
 if(errors.length || report.unexpectedAudio.length)throw new Error('Browser errors or audio transmission');
}catch(error){console.log(JSON.stringify({error:error.message,errors,status:await evaluate('document.querySelector("#local-status")?.textContent')}));throw error;}
finally{
 chrome.proc.kill();
 for(const binding of savedBindings){const {id,...file}=binding;await fetch(`${base}/local-player/library/songs/${id}/binding`,{method:'POST',headers:mutations,body:JSON.stringify(file)});}
 for(const [id,previous]of Object.entries(saved)){
  const defaults={stageMode:'disc',playMode:'sequence',volume:1,rate:1,position:0,bookmarks:[],loopA:null,loopB:null};
  await fetch(`${base}/local-player/library/songs/${id}/preferences`,{method:'POST',headers:mutations,body:JSON.stringify({...defaults,...previous})});
 }
}
