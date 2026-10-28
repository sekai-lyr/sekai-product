import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launchChrome,newPage,sleep} from 'file:///D:/dsh-render/cdp.mjs';
const source=readFileSync('src/main/resources/static/js/local-player.js','utf8');
const render=source.slice(source.indexOf('    function render('),source.indexOf('    async function select('));
const chrome=await launchChrome({port:9458}),page=await newPage(chrome.port);
async function evaluate(expression){const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
try{
    await page.send('Page.enable');await page.send('Runtime.enable');
    await page.send('Page.navigate',{url:'http://localhost:8085/login?history-baseline=1'});await sleep(400);
    await page.send('Page.navigate',{url:'http://localhost:8085/local-player?songId=1'});await sleep(600);
    await evaluate(`(()=>{
        document.body.innerHTML='<iframe id="test-stage"></iframe><div id="local-empty"></div><button id="local-favorite"></button>';
        const frame=document.querySelector('#test-stage'),status={},modeSelect={value:'disc'},playbackPage=true;
        const tracks=[{id:1,key:'test:1',ready:true,file:new Blob([]),rows:[],title:'First',preferences:{}},{id:2,key:'test:2',ready:true,file:new Blob([]),rows:[],title:'Second',preferences:{}}];
        let current=0,generation=0;
        window.__sekaiLocalPlayer={};const visible=()=>[0,1],label=t=>t.title;
        ${render}
        window.historyRender=(index,mode)=>{current=index;modeSelect.value=mode;render();};
    })()`);
    const initial=await evaluate('history.length');
    for(const [index,mode] of [[0,'disc'],[0,'lyrics'],[1,'disc']]){
        await evaluate(`historyRender(${index},${JSON.stringify(mode)})`);await sleep(500);
    }
    const after=await evaluate('({length:history.length,path:location.pathname,mode:new URL(location.href).searchParams.get("mode")})');
    assert.equal(after.length,initial,'Stage reloads must not add browser history entries');
    assert.equal(after.path,'/player/2','The outer URL must identify the current song');
    const nav=await page.send('Page.getNavigationHistory');
    await page.send('Page.navigateToHistoryEntry',{entryId:nav.entries[nav.currentIndex-1].id});await sleep(500);
    assert.ok(await evaluate('location.search.includes("history-baseline=1")'),'One Back must leave the player, not rewind its iframe');
    console.log(JSON.stringify({passed:true,initialHistory:initial,after,backToPreviousPage:true}));
}finally{page.close();chrome.proc.kill();}
