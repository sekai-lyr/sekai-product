import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const output='D:/dsh-render/qa-listening-20261012';mkdirSync(output,{recursive:true});
const password=process.env.SEKAI_QA_PASSWORD;if(!password)throw new Error('SEKAI_QA_PASSWORD missing');
const login=await fetch('http://localhost:8085/user/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({userName:'sekai',password}),redirect:'manual'});
const raw=login.headers.getSetCookie().find(cookie=>cookie.startsWith('JSESSIONID_M5='));if(!raw || !login.headers.get('location')?.includes('/home'))throw new Error('Login failed');
const cookie=raw.split(';')[0];
const chrome=await launchChrome({port:9394,userDataDir:`${output}/browser`});const page=await newPage(chrome.port);
const errors=[],requests=[];
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
const wait=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await sleep(250);}throw new Error(`Timeout ${expression}`);};
const overview=async()=>{const r=await fetch('http://localhost:8085/api/admin/overview',{headers:{Cookie:cookie}});if(!r.ok)throw new Error('Overview inaccessible');return (await r.json()).data;};
try{
    await page.send('Page.enable');await page.send('Runtime.enable');await page.send('DOM.enable');await page.send('Network.enable');
    await page.send('Network.setCookie',{name:'JSESSIONID_M5',value:cookie.split('=')[1],domain:'localhost',path:'/'});
    // Avoid unrelated preference writes during this real playback test.
    await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{let player;Object.defineProperty(window,'__sekaiLocalPlayer',{configurable:true,get:()=>player,set:value=>{player=value;player.savePreferences=()=>{};}});})()`});
    page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.text));
    page.on('Network.requestWillBeSent',({request})=>{if(request.method==='POST')requests.push({url:request.url,body:request.postData});});
    await page.send('Page.navigate',{url:'http://localhost:8085/local-player'});await wait(`document.querySelector('#local-account')?.textContent.includes('账户歌曲')`);
    const doc=await page.send('DOM.getDocument');const input=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#local-files'});
    await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-89-1778404060584.mp3']});await wait(`document.querySelector('#local-import-results').children.length===1`);
    await evaluate(`(async()=>{
        const source=document.querySelector('#local-files').files[0],root=await navigator.storage.getDirectory(),folder=await root.getDirectoryHandle('__listening_qa__',{create:true});
        const audio=await folder.getFileHandle(source.name,{create:true}),writer=await audio.createWritable();await writer.write(source);await writer.close();
        const db=await new Promise(resolve=>{const request=indexedDB.open('sekai-local-file-handles',1);request.onsuccess=()=>resolve(request.result);});
        await new Promise((resolve,reject)=>{const tx=db.transaction('references','readwrite');tx.objectStore('references').put({audio,fileName:source.name,fileSize:source.size},'user:3:song:89');tx.oncomplete=resolve;tx.onerror=reject;});
    })()`);
    const before=await overview();
    await page.send('Page.navigate',{url:'http://localhost:8085/player/89?mode=disc'});
    await wait(`document.querySelector('#local-stage')?.contentWindow.__sekaiLocalRestoreReady && document.querySelector('#local-stage').contentWindow.__stageTimeline`);
    await evaluate(`(async()=>{const audio=document.querySelector('#local-stage').contentDocument.querySelector('audio');audio.volume=0;await audio.play();})()`);
    await sleep(3000);
    await evaluate(`(()=>{const audio=document.querySelector('#local-stage').contentDocument.querySelector('audio');audio.currentTime=Math.min(audio.duration-10,audio.currentTime+70);})()`);
    await sleep(3500);
    await evaluate(`document.querySelector('#local-stage').contentDocument.querySelector('audio').pause()`);
    await sleep(1000);const paused=await overview();await sleep(2000);const after=await overview();
    const listened=Number(after.playedMs)-Number(before.playedMs),plays=Number(after.plays)-Number(before.plays);
    if(listened<5000 || listened>10000 || plays!==1 || after.playedMs!==paused.playedMs)throw new Error(JSON.stringify({listened,plays,paused:paused.playedMs,after:after.playedMs}));
    const unexpected=requests.filter(request=>!request.url.includes('/api/listening/'));
    if(unexpected.length || errors.length)throw new Error(JSON.stringify({unexpected,errors}));
    await evaluate(`(async()=>{const root=await navigator.storage.getDirectory();await root.removeEntry('__listening_qa__',{recursive:true});})()`);
    const report={listenedMs:listened,plays,pausedDidNotCount:true,seekDidNotInflate:true,audioUploaded:false,unrelatedWrites:unexpected.length,errors};
    writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{page.close();chrome.proc.kill();}
