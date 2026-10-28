// UI fixture only; no comments/likes are written to the real database.
import { launchChrome,newPage,sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
const output='D:/dsh-render/qa-listener-plaza-20261012';mkdirSync(output,{recursive:true});
const chrome=await launchChrome({port:9395,userDataDir:`${output}/browser`});const page=await newPage(chrome.port);
const errors=[],writes=[];let sortObserved=false;
const roots=[{id:901,author:'海盐汽水',content:'封面和歌词自动匹配很方便，希望以后能更轻松地换设备。',createdMs:Date.now()-180000,likeCount:12,liked:false,replyCount:2,isAdmin:false,status:'approved'},
    {id:902,author:'月光收集者',content:'Folia 的演出很有氛围，暂停时动画也能停住，这个细节很喜欢。🎧',createdMs:Date.now()-120000,likeCount:8,liked:false,replyCount:0,isAdmin:false,status:'approved'}];
const replies=[{id:903,parentId:901,replyToId:901,replyToAuthor:'海盐汽水',author:'Sekai',content:'谢谢建议！跨设备目前需要重新关联本机音乐，我会继续优化引导。',createdMs:Date.now()-90000,likeCount:3,liked:false,isAdmin:true,status:'approved'},
    {id:904,parentId:901,replyToId:903,replyToAuthor:'Sekai',author:'海盐汽水',content:'明白啦，期待下一次更新 😊',createdMs:Date.now()-60000,likeCount:1,liked:false,isAdmin:false,status:'approved'}];
const evaluate=async expression=>{const result=await page.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;};
const wait=async expression=>{for(let i=0;i<40;i++){if(await evaluate(expression))return;await sleep(250);}throw new Error(`Timeout ${expression}`);};
try{
    await page.send('Page.enable');await page.send('Runtime.enable');await page.send('Network.enable');
    page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    await page.send('Fetch.enable',{patterns:[{urlPattern:'*/api/feedback*'}]});
    page.on('Fetch.requestPaused',async({requestId,request})=>{
        const url=new URL(request.url);let body;
        if(request.method==='POST'){
            const payload=JSON.parse(request.postData);writes.push({path:url.pathname,payload});
            if(url.pathname.endsWith('/like')){roots[0].liked=payload.liked;roots[0].likeCount=payload.liked?13:12;body={liked:payload.liked,likeCount:roots[0].likeCount};}
            else body={id:905};
        }else if(url.pathname.endsWith('/replies'))body={replies};
        else {if(url.searchParams.get('sort')==='hot')sortObserved=true;body={reviews:roots,own:[],loggedIn:true,csrf:'fixture',nickname:'试听者',community:{comments:2,replies:2,participants:3}};}
        await page.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
    });
    await page.send('Page.navigate',{url:'http://localhost:8085/feedback'});await wait(`document.querySelectorAll('.plaza-replies .plaza-comment').length===2`);
    const layouts=[];
    for(const width of [1440,768,390]){
        await page.send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<500});await sleep(200);
        const layout=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,badge:document.querySelectorAll('.plaza-author-badge').length,roots:document.querySelector('#public-reviews').children.length})`);
        if(layout.scrollWidth>width || layout.badge!==1 || layout.roots!==2)throw new Error(JSON.stringify(layout));layouts.push(layout);
        const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${output}/${width}.png`,Buffer.from(shot.data,'base64'));
    }
    await evaluate(`document.querySelector('#comment-emoji-toggle').click();document.querySelector('#comment-emojis button').click()`);
    if(!await evaluate(`document.querySelector('#review-content').value.includes('😊') && document.querySelector('#comment-length').textContent.startsWith('2')`))throw new Error('Emoji insertion failed');
    await evaluate(`document.querySelector('#comment-901 .plaza-action').click()`);await wait(`document.querySelector('#comment-901 .plaza-action').getAttribute('aria-pressed')==='true'`);
    await evaluate(`document.querySelector('#comment-903 .plaza-action:last-child').click()`);
    await wait(`!!document.querySelector('#comment-901 > .plaza-reply-composer')`);
    await evaluate(`(()=>{const form=document.querySelector('.plaza-reply-composer');form.querySelector('textarea').value='楼中楼互动测试';form.requestSubmit();})()`);
    await wait(`document.querySelector('#website-status').textContent.includes('回复已收到')`);
    const reply=writes.find(write=>write.payload.parentId);if(reply?.payload.parentId!==901 || reply.payload.replyToId!==903)throw new Error(JSON.stringify(writes));
    await evaluate(`document.querySelector('[data-comment-sort="hot"]').click()`);await wait(`document.querySelector('[data-comment-sort="hot"]').getAttribute('aria-pressed')==='true'`);
    if(!sortObserved)throw new Error('Sort did not reach API');
    roots[0].content='<img src=x onerror="window.__xss=1">';await evaluate(`document.querySelector('[data-comment-sort="latest"]').click()`);await wait(`document.querySelector('#comment-901 .plaza-comment-content').textContent.includes('<img')`);
    if(await evaluate(`!!window.__xss || !!document.querySelector('#comment-901 .plaza-comment-content img')`))throw new Error('HTML injection');
    if(errors.length)throw new Error(JSON.stringify(errors));
    const report={fixture:true,layouts,emoji:true,like:true,replyToUser:true,sort:true,xssSafe:true,errors};writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{page.close();chrome.proc.kill();}
