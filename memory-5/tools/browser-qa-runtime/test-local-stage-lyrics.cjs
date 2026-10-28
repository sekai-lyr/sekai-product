const {chromium}=require('playwright-core');
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const modes=[...readFileSync('src/main/resources/static/js/stage-catalog.js','utf8').matchAll(/\{ id: '([^']+)'/g)].map(match=>match[1]);
assert.equal(modes.length,23);

(async()=>{
    const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    try{
        const page=await browser.newPage();
        const errors=[];
        let currentMode='loading';
        page.on('pageerror',error=>errors.push({mode:currentMode,message:error.message}));
        if(!process.env.SEKAI_TEST_LIVE_ASSETS)for(const file of ['local-stage.js','stage-mode.js','lyrics-stage.js','derived-performances.js','derived-scenes.js']){
            await page.route(`**/js/${file}*`,route=>route.fulfill({contentType:'text/javascript',body:readFileSync(`src/main/resources/static/js/${file}`)}));
        }
        await page.route('https://sekaisong.com/__local_stage_lyrics_qa__',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`
            <script>
            window.__sekaiLocalPlayer={
                track:{id:123,key:'qa:123',title:'测试歌曲',artist:'测试歌手',album:'测试专辑',
                    cover:'/images/login-music-room.png',url:'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=',
                    fileName:'test.wav',rows:[{seconds:1,text:'第一句'},{seconds:2,text:'第二句'}],
                    restore:{time:0,playing:false}},queue:[],
                changeMode(mode){window.lastChangeMode=mode;document.querySelector('iframe').src='/local-stage?mode='+mode;},
                savePreferences(){},toggleServerMedia(){},next(){},previous(){},select(){},markUnavailable(){}
            };
            </script><iframe src="/local-stage?mode=disc"></iframe>`}));
        await page.goto('https://sekaisong.com/__local_stage_lyrics_qa__');
        for(const mode of modes){
            currentMode=mode;
            await page.evaluate(mode=>document.querySelector('iframe').src=`/local-stage?mode=${mode}&qa=1`,mode);
            try{
                await page.waitForFunction(expected=>{
                    const doc=document.querySelector('iframe')?.contentDocument;
                    return doc?.querySelector('.now-playing')?.dataset.stageMode===expected
                        && doc.querySelector('.now-playing').dataset.songTitle==='测试歌曲'
                        && doc.querySelectorAll('#lyrics p[data-time]').length===2;
                },mode,{timeout:12000});
            }catch(error){
                const state=await page.evaluate(()=>{
                    const frame=document.querySelector('iframe'),doc=frame.contentDocument;
                    return {url:frame.src,title:doc?.querySelector('h1')?.textContent,rows:doc?.querySelectorAll('#lyrics p[data-time]').length,stageTitle:doc?.querySelector('.now-playing')?.dataset.songTitle};
                });
                throw Error(JSON.stringify({mode,state,errors}));
            }
            const result=await page.evaluate(()=>{
                const doc=document.querySelector('iframe').contentDocument;
                return {mode:doc.querySelector('.now-playing').dataset.stageMode,title:doc.querySelector('h1').textContent,rows:[...doc.querySelectorAll('#lyrics p[data-time]')].map(row=>row.querySelector('b').textContent)};
            });
            assert.equal(result.mode,mode);
            assert.equal(result.title,'测试歌曲');
            assert.deepEqual(result.rows,['第一句','第二句']);
        }
        await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelector('[data-stage-view-option="disc"]').click());
        await page.waitForFunction(()=>{
            const doc=document.querySelector('iframe')?.contentDocument;
            return doc?.readyState==='complete' && doc.querySelector('.now-playing')?.dataset.stageMode==='disc'
                && doc.querySelector('.now-playing')?.dataset.songTitle==='测试歌曲';
        });
        await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelector('[data-stage-view-option="lyrics"]').click());
        try{
            await page.waitForFunction(()=>{
                const doc=document.querySelector('iframe')?.contentDocument;
                return doc?.querySelector('.now-playing')?.dataset.stageMode==='lyrics' && doc.querySelectorAll('#lyrics p[data-time]').length===2;
            },null,{timeout:12000});
        }catch(error){
            throw Error(JSON.stringify({state:await page.evaluate(()=>{
                const frame=document.querySelector('iframe'),doc=frame.contentDocument;
                return {url:frame.src,mode:doc?.querySelector('.now-playing')?.dataset.stageMode,rows:doc?.querySelectorAll('#lyrics p[data-time]').length,lastChangeMode:window.lastChangeMode};
            }),errors}));
        }
        assert.equal(errors.length,0,JSON.stringify(errors));
        console.log(`PASS: all ${modes.length} stages receive the same title and timed LRC rows`);
    }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
