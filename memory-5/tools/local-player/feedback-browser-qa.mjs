import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const output='D:/dsh-render/qa-feedback-overview-20261012';mkdirSync(output,{recursive:true});
const chrome=await launchChrome({port:9393,userDataDir:`${output}/browser`});const page=await newPage(chrome.port);
const errors=[],results=[];
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
const wait=async expression=>{for(let i=0;i<40;i++){if(await evaluate(expression))return;await sleep(250);}throw new Error(`Timeout: ${expression}`);};
try{
    await page.send('Page.enable');await page.send('Runtime.enable');await page.send('Network.enable');
    page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    await page.send('Page.navigate',{url:'http://localhost:8085/feedback'});await wait(`document.querySelector('#website-status')?.textContent.includes('欢迎')`);
    if(!await evaluate(`document.querySelector('#website-review-form').hidden && !document.querySelector('#feedback-login').hidden && !document.querySelector('a[href="/admin/overview"]')`))throw new Error('Anonymous access incorrect');
    if((await fetch('http://localhost:8085/api/admin/overview')).status!==401)throw new Error('Anonymous admin API exposed');
    const password=process.env.SEKAI_QA_PASSWORD;if(!password)throw new Error('SEKAI_QA_PASSWORD missing');
    const login=await fetch('http://localhost:8085/user/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({userName:'sekai',password}),redirect:'manual'});
    if(!login.headers.get('location')?.includes('/home'))throw new Error('Login failed');
    const raw=login.headers.getSetCookie().find(cookie=>cookie.startsWith('JSESSIONID_M5='));if(!raw)throw new Error('No login cookie');
    await page.send('Network.setCookie',{name:'JSESSIONID_M5',value:raw.split(';')[0].split('=')[1],domain:'localhost',path:'/'});
    for(const route of ['admin/overview','feedback']){
        await page.send('Page.navigate',{url:`http://localhost:8085/${route}`});
        await wait(route==='feedback'?`!document.querySelector('#website-review-form')?.hidden`:`document.querySelectorAll('.website-stat').length===12`);
        if(route==='feedback' && await evaluate(`document.querySelectorAll('#website-review-form select').length`))throw new Error('Comment box must not ask for ratings');
        for(const width of [1440,390]){
            await page.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await sleep(200);
            const result=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,sidebar:!!document.querySelector('.sidebar'),status:document.querySelector('#website-status').textContent,cards:document.querySelectorAll('.website-stat').length})`);
            if(result.scrollWidth>width || !result.sidebar)throw new Error(JSON.stringify(result));results.push({route,...result});
            const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${output}/${route.replace('/','-')}-${width}.png`,Buffer.from(shot.data,'base64'));
        }
    }
    // Test user text as text, never executable HTML; no real review is submitted.
    await page.send('Fetch.enable',{patterns:[{urlPattern:'*/api/feedback*'}]});
    page.on('Fetch.requestPaused',async({requestId})=>page.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({reviews:[{id:1,author:'测试昵称',usability:4,innovation:5,content:'<img src=x onerror="window.__xss=1">',status:'approved',createdMs:Date.now()}],own:[],loggedIn:false,csrf:''})).toString('base64')}));
    await page.send('Page.navigate',{url:'http://localhost:8085/feedback'});await wait(`document.querySelector('.website-review p')?.textContent.includes('<img')`);
    if(await evaluate(`!!window.__xss || !!document.querySelector('.website-review img')`))throw new Error('Review HTML executed');
    if(errors.length)throw new Error(JSON.stringify(errors));
    writeFileSync(`${output}/report.json`,JSON.stringify({results,errors,xssSafe:true},null,2));console.log(JSON.stringify({results,errors,xssSafe:true}));
}finally{page.close();chrome.proc.kill();}
