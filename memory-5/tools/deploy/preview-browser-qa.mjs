import {launchChrome,newPage,sleep} from 'file:///D:/dsh-render/cdp.mjs';
const chrome=await launchChrome({port:9398,userDataDir:'D:/dsh-render/sekai-private-test-20261012/qa-browser'});const page=await newPage(chrome.port);
const errors=[];const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
const wait=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await sleep(250);}throw new Error('Private browser check timed out');};
try{
    await page.send('Page.enable');await page.send('Runtime.enable');
    page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.text));
    await page.send('Page.navigate',{url:'http://localhost:18085/login'});await wait(`!!document.querySelector('input[name="password"]')`);
    await evaluate(`(()=>{document.querySelector('input[name="userName"]').value='sekai';document.querySelector('input[name="password"]').value=${JSON.stringify(process.env.SEKAI_QA_PASSWORD)};document.querySelector('input[name="password"]').form.requestSubmit();})()`);
    await wait(`location.pathname==='/home'`);
    await page.send('Page.navigate',{url:'http://localhost:18085/local-player'});await wait(`document.querySelector('#local-account')?.textContent.includes('账户歌曲')`);
    const result=await evaluate(`(async()=>{const library=await(await fetch('/local-player/library')).json();return {secureContext:isSecureContext,folderPicker:typeof showDirectoryPicker==='function',songs:library.songs.length,adminBlocked:(await fetch('/api/admin/overview')).status,deleteBlocked:(await fetch('/local-player/library/songs/36',{method:'DELETE'})).status};})()`);
    if(!result.secureContext || !result.folderPicker || result.songs!==641 || result.adminBlocked!==403 || result.deleteBlocked!==403)throw new Error(JSON.stringify(result));
    if(errors.length)throw new Error(JSON.stringify(errors));
    console.log(JSON.stringify({login:true,...result,errors}));
}catch(error){
    console.log(JSON.stringify({location:await evaluate(`({protocol:location.protocol,host:location.hostname,port:location.port,path:location.pathname})`),errors}));throw error;
}finally{page.close();chrome.proc.kill();}
