import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const output='D:/dsh-render/qa-local-browser-20261011';mkdirSync(output,{recursive:true});
const chrome=await launchChrome({port:9379});const page=await newPage(chrome.port);
const errors=[],requests=[],report=[];
page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
page.on('Network.requestWillBeSent',({request})=>requests.push({url:request.url,method:request.method,bodyLength:request.postData?.length || 0}));
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
const wait=async expression=>{for(let i=0;i<60;i++){if(await evaluate(expression))return;await sleep(500);}throw new Error(`Timeout: ${expression}`);};
const ready=`document.querySelector('#local-stage').contentWindow.location.href===new URL(document.querySelector('#local-stage').dataset.stageUrl,location.origin).href && document.querySelector('#local-stage').contentWindow.__sekaiLocalRestoreReady && document.querySelector('#local-stage').contentWindow.__stageTimeline && (document.querySelector('#local-stage').contentDocument.querySelector('.now-playing')?.dataset.stageMode!=='folia' || document.querySelector('#local-stage').contentWindow.__stageReady===true)`;
try {
 await page.send('Page.enable');await page.send('Runtime.enable');await page.send('DOM.enable');await page.send('Network.enable');
 await page.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await page.send('Page.navigate',{url:'http://localhost:8085/local-player'});await sleep(1200);
 const doc=await page.send('DOM.getDocument');const input=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#local-files'});
 await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-36-1778404055914.flac','B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-606-1779121458818.flac']});
 await wait(ready);
 const lrc=execFileSync('B:/MySQL/bin/mysql.exe',['--user=root','--default-character-set=utf8mb4','--raw','--batch','--skip-column-names','--database=sekai_friend','-e','SELECT lyric_text FROM sekai_song_track WHERE id=36'],{encoding:'utf8'}).trim();
 await evaluate(`(()=>{const file=new File([${JSON.stringify(lrc)}],'花の塔.lrc',{type:'text/plain'});const list=new DataTransfer();list.items.add(file);const input=document.querySelector('#local-lrc');input.files=list.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`window.__sekaiLocalPlayer.track?.rows.length>10 && (${ready})`);
 for(const mode of ['disc','lyrics','folia-classic','folia']) {
  await evaluate(`window.__sekaiLocalPlayer.changeMode(${JSON.stringify(mode)})`);
  await wait(`document.querySelector('#local-stage').contentDocument?.querySelector('.now-playing')?.dataset.stageMode===${JSON.stringify(mode)} && (${ready})`);
  await wait('document.querySelector("#local-stage").contentDocument.querySelector("audio").readyState>=1');
  await evaluate(`(async()=>{const a=document.querySelector('#local-stage').contentDocument.querySelector('audio');a.currentTime=32;await a.play();})()`);
  await sleep(800);
  const live=await evaluate(`(()=>{const w=document.querySelector('#local-stage').contentWindow;const a=w.document.querySelector('audio');return{mode:${JSON.stringify(mode)},src:a.currentSrc,duration:a.duration,time:a.currentTime,paused:a.paused,lyrics:w.document.querySelectorAll('#lyrics p[data-time]').length,engine:w.document.querySelector('.lyric-stage')?.dataset.foliaEngine,state:w.__stageState?.(),status:document.querySelector('#local-status').textContent}})()`);
  if(!live.src.startsWith('blob:') || live.time<=32 || live.paused)throw new Error('Local playback failed');
  await evaluate('document.querySelector("#local-stage").contentDocument.querySelector("audio").pause()');
  const time=await evaluate('document.querySelector("#local-stage").contentDocument.querySelector("audio").currentTime');await sleep(350);
  const frozen=await evaluate('document.querySelector("#local-stage").contentDocument.querySelector("audio").currentTime');
  live.pauseFrozen=Math.abs(time-frozen)<.001;
  await evaluate(`(()=>{const d=document.querySelector('#local-stage').contentDocument;const s=d.querySelector('[data-stage-seek]');s.value='500';s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  live.seek=await evaluate(`(()=>{const a=document.querySelector('#local-stage').contentDocument.querySelector('audio');return{time:a.currentTime,duration:a.duration}})()`);
  if(Math.abs(live.seek.time/live.seek.duration-.5)>.03)throw new Error('Seek failed');
  const point=await evaluate(`(()=>{const f=document.querySelector('#local-stage');const r=f.contentDocument.querySelector('[data-stage-seek]').getBoundingClientRect();const b=f.getBoundingClientRect();return{x:b.left+r.left+r.width*.65,y:b.top+r.top+r.height/2}})()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await sleep(150);
  live.clickSeek=await evaluate(`(()=>{const a=document.querySelector('#local-stage').contentDocument.querySelector('audio');return a.currentTime/a.duration})()`);
  if(Math.abs(live.clickSeek-.65)>.03)throw new Error('Pointer seek failed');
  report.push(live);const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${output}/${mode}.png`,Buffer.from(shot.data,'base64'));
 }
 const before=await evaluate('document.querySelector("#local-stage").contentDocument.querySelector("audio").currentTime');
 await evaluate('window.__sekaiLocalPlayer.changeMode("disc")');await wait(ready);await wait('document.querySelector("#local-stage").contentDocument.querySelector("audio").readyState>=1');
 const after=await evaluate('document.querySelector("#local-stage").contentDocument.querySelector("audio").currentTime');
 if(Math.abs(before-after)>.5)throw new Error('Mode switch lost playback position');
 await evaluate('window.__sekaiLocalPlayer.next()');await wait(`window.__sekaiLocalPlayer.track?.index===1 && (${ready})`);
 await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(500);
 const mobile=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${output}/mobile.png`,Buffer.from(mobile.data,'base64'));
 await evaluate(`(async()=>{
  const original=document.querySelector('#local-files').files[0];
  const head=new Uint8Array(await original.slice(0,4*1024*1024).arrayBuffer());const blocks=[];let at=4,last=false;
  while(!last){const start=at;last=!!(head[at]&128);const type=head[at]&127;const length=(head[at+1]<<16)|(head[at+2]<<8)|head[at+3];at+=4;
   if(type===4){const data=head.slice(at,at+length);const view=new DataView(data.buffer);const vendorLength=view.getUint32(0,true);const countAt=4+vendorLength;const tag=new TextEncoder().encode('LYRICS='+${JSON.stringify(lrc)});const extended=new Uint8Array(data.length+4+tag.length);extended.set(data);const extendedView=new DataView(extended.buffer);extendedView.setUint32(countAt,view.getUint32(countAt,true)+1,true);extendedView.setUint32(data.length,tag.length,true);extended.set(tag,data.length+4);blocks.push(new Uint8Array([head[start],extended.length>>16,(extended.length>>8)&255,extended.length&255]),extended);
   }else blocks.push(original.slice(start,at+length));at+=length;
  }
  const fixture=new File([original.slice(0,4),...blocks,original.slice(at)],'embedded-花の塔.flac',{type:'audio/flac'});
  const list=new DataTransfer();list.items.add(fixture);const input=document.querySelector('#local-files');input.files=list.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 })()`);
 await wait('document.querySelector("#local-track").options.length===4');
 await evaluate('window.__sekaiLocalPlayer.select(2)');await wait(`window.__sekaiLocalPlayer.track?.index===2 && (${ready})`);
 const embedded=await evaluate('({rows:window.__sekaiLocalPlayer.track.rows.length,title:window.__sekaiLocalPlayer.track.title,duration:document.querySelector("#local-stage").contentDocument.querySelector("audio").duration})');
 if(embedded.rows<30 || embedded.duration<270)throw new Error('Embedded FLAC lyrics extraction failed');
 await page.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 const doc2=await page.send('DOM.getDocument');const input2=await page.send('DOM.querySelector',{nodeId:doc2.root.nodeId,selector:'#local-files'});
 await page.send('DOM.setFileInputFiles',{nodeId:input2.nodeId,files:['B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-89-1778404060584.mp3']});
 await wait('document.querySelector("#local-track").options.length===5');
 await evaluate(`(async()=>{
  const original=document.querySelector('#local-files').files[0];const head=new Uint8Array(await original.slice(0,10).arrayBuffer());
  const oldSize=head[0]===73 && head[1]===68 && head[2]===51 ? 10+((head[6]&127)<<21)+((head[7]&127)<<14)+((head[8]&127)<<7)+(head[9]&127) : 0;
  const size=n=>new Uint8Array([(n>>21)&127,(n>>14)&127,(n>>7)&127,n&127]);const text=new TextEncoder().encode(${JSON.stringify(lrc)});
  const data=new Uint8Array(5+text.length);data.set([3,101,110,103,0]);data.set(text,5);
  const block=new Uint8Array(10+data.length);block.set([85,83,76,84]);block.set(size(data.length),4);block.set(data,10);
  const tag=new Uint8Array(10);tag.set([73,68,51,4,0,0]);tag.set(size(block.length),6);
  const file=new File([tag,block,original.slice(oldSize)],'embedded-USLT.mp3',{type:'audio/mpeg'});const list=new DataTransfer();list.items.add(file);const input=document.querySelector('#local-files');input.files=list.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 })()`);
 await wait('document.querySelector("#local-track").options.length===6');await evaluate('window.__sekaiLocalPlayer.select(4)');await wait(`window.__sekaiLocalPlayer.track?.index===4 && (${ready})`);
 const mp3Embedded=await evaluate('({rows:window.__sekaiLocalPlayer.track.rows.length,duration:document.querySelector("#local-stage").contentDocument.querySelector("audio").duration})');
 if(mp3Embedded.rows<30 || mp3Embedded.duration<30)throw new Error('MP3 USLT extraction or playback failed');
 const unexpected=requests.filter(r=>r.method==='POST' || /\/uploads\/audio\/|\/external-uploads\/audio\//.test(r.url));
 const result={report,errors,unexpected,modeSwitch:{before,after},embedded,mp3Embedded,requests};
 writeFileSync(`${output}/report.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({report,errors,unexpected,modeSwitch:{before,after},embedded,mp3Embedded},null,2));
 if(errors.length || unexpected.length)throw new Error('Browser errors or unexpected audio upload/download');
} catch(error) {
 console.log(JSON.stringify({error:error.message,errors,state:await evaluate(`({status:document.querySelector('#local-status')?.textContent,frame:document.querySelector('#local-stage')?.src,track:window.__sekaiLocalPlayer?.track && {title:window.__sekaiLocalPlayer.track.title,warning:window.__sekaiLocalPlayer.track.tagWarning},body:document.querySelector('#local-stage')?.contentDocument?.body?.innerText.slice(0,1200)})`)}));
 const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${output}/failure.png`,Buffer.from(shot.data,'base64'));throw error;
} finally {chrome.proc.kill();}
