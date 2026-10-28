import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
const chrome=await launchChrome({port:9391});const page=await newPage(chrome.port);
const results=[],errors=[];
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
try{
    await page.send('Page.enable');await page.send('Runtime.enable');
    page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.text));
    await page.send('Page.navigate',{url:'http://localhost:8085/local-player'});await sleep(1000);
    for(const width of [1440,390]){
        await page.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});await sleep(200);
        const result=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,open:document.querySelector('.local-import-guide')?.open,items:document.querySelectorAll('.local-import-guide li').length,example:!!document.querySelector('.local-import-guide pre')})`);
        if(result.open || result.items!==8 || !result.example || result.scrollWidth>width)throw new Error(JSON.stringify(result));results.push(result);
    }
    await evaluate(`document.querySelector('.local-import-guide summary').click()`);
    if(!await evaluate(`document.querySelector('.local-import-guide').open`))throw new Error('Guide does not expand');
    await evaluate(`document.querySelector('.local-import-guide summary').click()`);
    if(await evaluate(`document.querySelector('.local-import-guide').open`))throw new Error('Guide does not collapse');
    await page.send('Page.navigate',{url:'http://localhost:8085/local-player?songId=36'});await sleep(700);
    if(await evaluate(`document.querySelector('.local-import-guide').open`))throw new Error('Guide blocks playback by default');
    if(errors.length)throw new Error(JSON.stringify(errors));
    console.log(JSON.stringify({results,collapse:true,playbackCollapsed:true,errors}));
}finally{page.close();chrome.proc.kill();}
