import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launchChrome,newPage,sleep} from 'file:///D:/dsh-render/cdp.mjs';
const base=process.env.SEKAI_QA_BASE||'http://localhost:8085';
if(!process.env.SEKAI_TEST_PASSWORD)throw Error('Missing test login secret');
const login=await fetch(base+'/user/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({userName:'sekai',password:process.env.SEKAI_TEST_PASSWORD}),redirect:'manual'});
assert.ok(login.headers.get('location')?.includes('/home'),'Login failed');
const cookies=login.headers.getSetCookie(),Cookie=cookies.map(v=>v.split(';')[0]).join('; ');
const before=await(await fetch(base+'/local-player/library',{headers:{Cookie}})).json();
const fixture=structuredClone(before);
if(process.env.SEKAI_QA_COMPLETED_PROGRESS==='1')for(const song of fixture.songs)song.preferences={...song.preferences,position:99999};
const netease=before.playlists.find(p=>p.name.includes('网易云')),qq=before.playlists.find(p=>p.name.includes('QQ音乐'));
assert.ok(netease&&qq);
const chrome=await launchChrome({port:9460}),page=await newPage(chrome.port),writes=[],errors=[];
async function evaluate(expression){const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function wait(expression){for(let i=0;i<160;i++){if(await evaluate(expression))return;await sleep(150);}throw Error('Timeout '+expression+' '+await evaluate(`document.querySelector('#local-status')?.textContent`));}
try{
 await page.send('Page.enable');await page.send('Runtime.enable');await page.send('DOM.enable');await page.send('Network.enable');await page.send('Network.setCacheDisabled',{cacheDisabled:true});
 for(const c of cookies){const p=c.split(';')[0],at=p.indexOf('=');await page.send('Network.setCookie',{name:p.slice(0,at),value:p.slice(at+1),url:base,httpOnly:true});}
 page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
 page.on('Fetch.requestPaused',async({requestId,request})=>{
  const path=new URL(request.url).pathname;let body,type='application/json';
  if(request.method!=='GET'){writes.push(path);body=JSON.stringify({saved:true});}
  else if(path==='/local-player/library')body=JSON.stringify(fixture);
  else if(path==='/js/local-player.js'||path==='/js/local-stage.js'){body=readFileSync('src/main/resources/static'+path,'utf8');type='application/javascript';}
  else {await page.send('Fetch.continueRequest',{requestId});return;}
  await page.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(body).toString('base64')});
 });
 await page.send('Fetch.enable',{patterns:[{urlPattern:'*/local-player/library*'},{urlPattern:'*/js/local-player.js*'},{urlPattern:'*/js/local-stage.js*'},{urlPattern:'*/api/listening/*'}]});
 await page.send('Page.navigate',{url:base+`/player/39?playlistId=${netease.id}&autoplay=1`});
 await wait(`document.querySelector('#local-account')?.textContent.includes('sekai')`);
 await wait(`document.querySelector('#local-status')?.textContent.includes('记录仍保留')`);
 const dom=await page.send('DOM.getDocument'),input=await page.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#local-link-folder'});
 await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['D:/Sekai_Song/audio']});
 await wait(`document.querySelector('#local-status')?.textContent.includes('本次关联')`);
 await wait(`document.querySelector('#local-stage')?.contentWindow.__sekaiLocalRestoreReady`);
 const initial=await evaluate(`({id:window.__sekaiLocalPlayer.track.id,title:window.__sekaiLocalPlayer.track.title,playlist:document.querySelector('#local-playlist').value,count:window.__sekaiLocalPlayer.queue.length})`);
 assert.equal(initial.playlist,String(netease.id));assert.equal(initial.count,netease.songIds.length);assert.equal(initial.id,39);
 assert.equal(initial.count,118,'Original NetEase playlist must contain exactly its 118 songs');
 const startTime=await evaluate(`(async()=>{const a=document.querySelector('#local-stage').contentDocument.querySelector('audio');a.muted=true;await a.play();return a.currentTime;})()`);
 await sleep(1100);
 const playback=await evaluate(`({id:window.__sekaiLocalPlayer.track.id,time:document.querySelector('#local-stage').contentDocument.querySelector('audio').currentTime})`);
 assert.equal(playback.id,39,'Song unexpectedly advanced');assert.ok(playback.time-startTime>.5,'Actual audio did not advance');
 await evaluate(`window.__sekaiLocalPlayer.changeMode('lyrics')`);
 await wait(`document.querySelector('#local-stage')?.contentWindow.__sekaiLocalRestoreReady && document.querySelector('#local-stage').contentDocument.querySelector('.now-playing')?.dataset.stageMode==='lyrics'`);
 const ids=new Set(netease.songIds);
 const observations=[];
 for(let i=0;i<5;i++){
  await evaluate('window.__sekaiLocalPlayer.next()');await wait(`document.querySelector('#local-stage')?.contentWindow.__sekaiLocalRestoreReady && new URL(document.querySelector('#local-stage').dataset.stageUrl,location.origin).href===document.querySelector('#local-stage').contentWindow.location.href`);
  const state=await evaluate(`({id:window.__sekaiLocalPlayer.track.id,playlist:document.querySelector('#local-playlist').value,count:window.__sekaiLocalPlayer.queue.length,mode:document.querySelector('#local-mode').value})`);
  assert.equal(state.mode,'lyrics','Song switch changed the performance mode');
  assert.ok(ids.has(state.id),'Crossed into another playlist');observations.push(state);
 }
 await sleep(1500);
 const stable=await evaluate('window.__sekaiLocalPlayer.track.id');assert.equal(stable,observations.at(-1).id,'Unexpected rapid automatic skipping');
 const after=await(await fetch(base+'/local-player/library',{headers:{Cookie}})).json();
 assert.deepEqual(after.songs,before.songs);assert.deepEqual(after.playlists,before.playlists);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({readOnly:true,syntheticCompletedProgress:process.env.SEKAI_QA_COMPLETED_PROGRESS==='1',initial,playbackAdvanced:playback.time-startTime,observations,stable,interceptedWrites:writes.length,accountUnchanged:true,errors}));
}finally{page.close();chrome.proc.kill();}
