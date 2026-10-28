import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
const chrome=await launchChrome({port:9389});const page=await newPage(chrome.port);
const evaluate=async expression=>(await page.send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
const writes=[];
try {
    await page.send('Page.enable');await page.send('Runtime.enable');await page.send('DOM.enable');await page.send('Network.enable');
    page.on('Network.requestWillBeSent',({request})=>{if(request.method==='POST')writes.push(request.url);});
    await page.send('Page.navigate',{url:'http://localhost:8085/local-player'});await sleep(1000);
    if(!await evaluate(`!!document.querySelector('#local-import-confirm')`))throw new Error('No confirmation step: selecting files currently saves immediately');
    const doc=await page.send('DOM.getDocument');const input=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#local-files'});
    await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['B:/Sekai/Sekai/sekai/memory-5/uploads/audio/2-89-1778404060584.mp3']});
    for(let i=0;i<40;i++){if(await evaluate(`document.querySelectorAll('#local-import-results tr').length>0`))break;await sleep(300);}
    const rows=await evaluate(`document.querySelectorAll('#local-import-results tr').length`);
    if(rows!==1 || writes.length)throw new Error(JSON.stringify({rows,writes}));
    console.log(JSON.stringify({rows,writes,confirmation:true}));
} finally {page.close();chrome.proc.kill();}
