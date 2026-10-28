import { launchChrome,newPage,sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
const output='D:/dsh-render/qa-account-domain-20261012';mkdirSync(output,{recursive:true});
const chrome=await launchChrome({port:9389,userDataDir:'D:/dsh-render/domain-mobile-browser-profile'});const page=await newPage(chrome.port);
const evaluate=async expression=>(await page.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
try{
 await page.send('Page.enable');await page.send('Runtime.enable');await page.send('DOM.enable');
 await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await page.send('Page.navigate',{url:'https://sekaisong.com/local-player'});await sleep(1200);
 const doc=await page.send('DOM.getDocument');const input=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#local-files'});
 await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-606-1779121458818.flac']});
 for(let n=0;n<50;n++){if(await evaluate('document.querySelector("#local-stage").contentWindow.__sekaiLocalRestoreReady'))break;await sleep(300);}
 const geometry=await evaluate(`(()=>{const f=document.querySelector('#local-stage');const b=f.getBoundingClientRect();const a=f.contentDocument.querySelector('[data-player-action="play"]').getBoundingClientRect();return{secure:isSecureContext,frameBottom:b.bottom,viewport:innerHeight,playBottom:b.top+a.bottom,bodyHeight:document.body.scrollHeight,audioSource:f.contentDocument.querySelector('audio').currentSrc}})()`);
 if(!geometry.secure || geometry.frameBottom>geometry.viewport+2 || geometry.playBottom>geometry.viewport+2 || !geometry.audioSource.startsWith('blob:'))throw new Error('Mobile stage controls outside viewport');
 const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${output}/mobile.png`,Buffer.from(shot.data,'base64'));
 writeFileSync(`${output}/mobile-report.json`,JSON.stringify(geometry,null,2));console.log(JSON.stringify(geometry));
}finally{chrome.proc.kill();}
