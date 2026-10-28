import { launchChrome, newPage, sleep } from 'file:///D:/dsh-render/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const width = Number(process.env.QA_WIDTH || 1440);
const snapshotTime = Number(process.env.QA_TIME || 12.2);
const height = Number(process.env.QA_HEIGHT || 900);
const out = (process.env.QA_OUTPUT || 'D:/dsh-render/qa-gallery-20261013') + '-' + width; mkdirSync(out, { recursive: true });
const chrome = await launchChrome({ port: 9417 }); const page = await newPage(chrome.port);
const errors = [], report = [], network = [];
const evaluate = async expression => { const r = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const wait = async expression => { for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await sleep(250); } throw Error('Timed out: ' + expression); };
try {
    await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Network.enable');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    page.on('Runtime.exceptionThrown', ({ exceptionDetails: e }) => errors.push(e.exception?.description || e.text));
    page.on('Runtime.consoleAPICalled', e => { if (e.type === 'error') errors.push(e.args.map(a => a.value || a.description).join(' ')); });
    page.on('Network.responseReceived', ({ response }) => { if (response.status >= 400) network.push({ url: response.url, status: response.status }); });
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    if(process.env.QA_REDUCED==='1')await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await page.send('Page.navigate', { url: 'http://localhost:8085/login' }); await wait('!!document.body');
    await evaluate(`(() => {
        document.body.replaceChildren();document.body.style.cssText='margin:0;background:#111';
        const bytes=new Uint8Array(44+8000*2*90),v=new DataView(bytes.buffer);
        const str=(o,s)=>[...s].forEach((c,i)=>bytes[o+i]=c.charCodeAt(0));str(0,'RIFF');v.setUint32(4,bytes.length-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,bytes.length-44,true);
        const rows=[{seconds:2,text:'风を待って 世界へ'},{seconds:5,text:"I don't know where to go, English words 与 空格"},{seconds:8,text:'👨‍👩‍👧‍👦 与 café 和 é 完整字符'},{seconds:12,text:'非常长的一句歌词在舞台上依然应该完整显示不要只留下半个字符'},{seconds:15,text:'短句'},{seconds:15.3,text:'下一句也要及时出现'},{seconds:20,text:'花の塔 君が持ってきた漫画'}];
        const track={key:'qa-gallery',title:'演出测试',artist:'本地测试音频',album:'',index:0,url:URL.createObjectURL(new Blob([bytes],{type:'audio/wav'})),cover:'/images/login-music-room.png',rows,restore:{time:0,playing:false}};
        const frame=document.createElement('iframe');frame.id='qa-stage';frame.style.cssText='border:0;width:100vw;height:100vh;display:block';document.body.append(frame);
        window.__sekaiLocalPlayer={track,queue:[{title:track.title,index:0}],savePreferences(){},select(){},next(){},previous(){},changeMode(mode){frame.src='/local-stage?mode='+mode+'&render=1'}};
    })()`);
    const modes = (process.env.QA_MODES || 'disc,lyrics,folia-classic,folia,folia-sonnet,folia-tempera,folia-lumiere,folia-luminous,folia-cadenza,folia-partita,folia-fume,folia-tilt,folia-claddagh,folia-monet,folia-pendolo,folia-cappella,folia-diorama,folia-still').split(',');
    for (const mode of modes) {
        const errorStart = errors.length;
        await evaluate(`window.__sekaiLocalPlayer.changeMode(${JSON.stringify(mode)})`);
        await wait(`document.querySelector('#qa-stage').contentWindow.__stageReady === true`);
        await sleep(1200);
        await evaluate(`document.querySelector('#qa-stage').contentDocument.body.classList.remove('render-mode')`);
        await evaluate(`document.querySelector('#qa-stage').contentWindow.__stageSetFrame(${snapshotTime}*60,60)`); await sleep(700);
        const result = await evaluate(`(() => {const w=document.querySelector('#qa-stage').contentWindow,d=w.document;return {mode:d.querySelector('.now-playing').dataset.stageMode,engine:d.querySelector('.lyric-stage')?.dataset.foliaEngine,program:w.__foliaProgram,canvases:d.querySelector('[data-folia-article]')?.shadowRoot?.querySelectorAll('canvas').length,shadowText:d.querySelector('[data-folia-article]')?.shadowRoot?.textContent.slice(-400),state:w.__stageState?.(),error:w.__foliaGalleryError,menu:d.querySelectorAll('[data-stage-view-option]').length}})()`);
        const shot = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${mode}.png`, Buffer.from(shot.data, 'base64'));
        if (process.env.QA_RESIZE === '1') {
            await page.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 640, deviceScaleFactor: 1, mobile: false });
            await evaluate(`frames[0].__stageSetFrame(5.6*60,60)`); await sleep(700);
            const resized = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${mode}-1024x640.png`, Buffer.from(resized.data, 'base64'));
            result.resize = await evaluate(`({width:frames[0].innerWidth,height:frames[0].innerHeight,active:frames[0].__stageState().active})`);
            if (result.resize.active !== (mode === 'disc' ? '5' : 1)) throw Error('Resize lost playback position: '+mode);
            await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
            await sleep(150);
        }
        result.errors = errors.slice(errorStart); report.push(result); console.log(JSON.stringify(result));
        result.layout = await evaluate(`(() => {const w=frames[0],r=w.document.querySelector('[data-folia-article]')?.shadowRoot;return {rootFont:w.getComputedStyle(w.document.documentElement).fontSize,canvases:[...(r?.querySelectorAll('canvas')||[])].map(e=>({html:e.outerHTML.slice(0,400),rect:e.getBoundingClientRect().toJSON(),parent:e.parentElement.outerHTML.slice(0,300)}))}})()`);
        console.log(JSON.stringify(result.layout));
        result.seeks = [];
        if (mode.startsWith('derived-')) {
            result.deterministic = await evaluate(`(() => {const w=frames[0],canvas=w.document.querySelector('[data-folia-article] canvas');w.__stageSetFrame(12.2*60,60);const first=canvas.toDataURL();w.__stageSetFrame(14*60,60);const moving=canvas.toDataURL();w.__stageSetFrame(12.2*60,60);return {sameTimeIdentical:first===canvas.toDataURL(),timeChangesImage:first!==moving};})()`);
            if (!result.deterministic.sameTimeIdentical || (process.env.QA_REDUCED!=='1' && !result.deterministic.timeChangesImage)) throw Error('Audio-time rendering failed: '+mode);
            if(process.env.QA_REDUCED==='1'&&result.deterministic.timeChangesImage)throw Error('Reduced motion still animates: '+mode);
            if(mode!=='derived-stars'){
                result.scene=await evaluate(`(() => {
                    const w=frames[0],host=w.document.querySelector('[data-folia-article]'),states=[];
                    for(const t of [2.01,2.2,3,5.05,5.5,8.2,12.1,12.9,14,15.05,15.28,15.31,15.5,20.9]){
                        w.__stageSetFrame(t*60,60);const s=host.__derivedScene;
                        const expected=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(host.dataset.activeText)].length;
                        states.push({...s,expected,t,width:w.innerWidth,height:w.innerHeight});
                    }return states;
                })()`);
                const features={'derived-fold':'perspective-paper','derived-sea':'refracted-water','derived-dialogue':'cinematic-dialogue','derived-gather':'curved-character-storm'};
                if(result.scene.some(s=>s.feature!==features[mode]||s.glyphs!==s.expected||s.bounds.left<0||s.bounds.right>s.width||s.bounds.top<80||s.bounds.bottom>s.height-100))throw Error('Scene text bounds or glyph integrity failed: '+mode);
                await evaluate(`frames[0].__stageSetFrame(12.18*60,60)`);
                const transitionShot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(out+'/'+mode+'-transition.png',Buffer.from(transitionShot.data,'base64'));
                result.sceneSettings=await evaluate(`(() => {
                    const w=frames[0],h=w.document.querySelector('[data-folia-settings-host]'),r=h.shadowRoot||h,c=w.document.querySelector('[data-folia-article] canvas');
                    const inputs=r.querySelectorAll('input'),color=r.querySelector('select');
                    const set=(el,value,event)=>{el.value=value;el.dispatchEvent(new w.Event(event));return c.toDataURL();};
                    w.__stageSetFrame(13*60,60);set(inputs[1],'0','input');const a=c.toDataURL();w.__stageSetFrame(14*60,60);const frozen=a===c.toDataURL();
                    const b=set(inputs[0],'1.3','input'),sizeChangesImage=a!==b;
                    const d=set(inputs[2],'48','input'),densityChangesImage=b!==d;
                    const e=set(color,'ice','change'),colorChangesImage=d!==e;
                    r.querySelector('button').click();
                    const start=performance.now();for(let i=0;i<20;i++)w.__stageSetFrame((12+i*.05)*60,60);
                    return {frozen,sizeChangesImage,densityChangesImage,colorChangesImage,millisecondsPerFrame:(performance.now()-start)/20};
                })()`);
                if(!result.sceneSettings.frozen||!result.sceneSettings.sizeChangesImage||!result.sceneSettings.densityChangesImage||!result.sceneSettings.colorChangesImage)throw Error('Scene settings failed: '+mode);
                console.log(JSON.stringify({mode,sceneSettings:result.sceneSettings}));
            }
        }
        for (const time of [0, 2.1, 5.1, 8.1, 15.1, 15.4, 20.1, 3]) {
            result.seeks.push(await evaluate(`(() => {const w=frames[0];w.__stageSetFrame(${time}*60,60);return w.__stageState();})()`));
        }
        const expected = mode === 'disc' ? [null,'2','5','8','15','15.3','20','2'] : [-1,0,1,2,4,5,6,0];
        if (result.seeks.some((state, i) => state.active !== expected[i])) throw Error('Seek synchronization failed: '+mode);
        if ((mode.startsWith('folia-') && mode !== 'folia-classic') || mode.startsWith('derived-')) {
            await evaluate(`document.querySelector('#qa-stage').contentDocument.querySelector('[data-performance-settings-toggle]').click()`);
            await sleep(150);
            result.settings = await evaluate(`(() => {const d=document.querySelector('#qa-stage').contentDocument,h=d.querySelector('[data-folia-settings-host]'),r=h.shadowRoot||h;return {controls:r.querySelectorAll('input,select,button').length,text:r.textContent.slice(0,180),panel:!d.querySelector('#performance-settings').hidden}})()`);
            if (mode === 'derived-stars') {
                result.skySettings = await evaluate(`(() => {
                    const w=frames[0],h=w.document.querySelector('[data-folia-settings-host]'),r=h.shadowRoot||h,c=w.document.querySelector('[data-folia-article] canvas');
                    const sky=r.querySelectorAll('select')[1],trail=r.querySelectorAll('input')[3];
                    const set=(el,value,event)=>{el.value=value;el.dispatchEvent(new w.Event(event));return c.toDataURL();};
                    w.__stageSetFrame(24*60,60);
                    const night=set(sky,'night','change'),dusk=set(sky,'dusk','change');
                    set(sky,'night','change');const short=set(trail,'.15','input'),long=set(trail,'1.5','input');
                    const start=performance.now();for(let i=0;i<20;i++)w.__stageSetFrame((24+i*.1)*60,60);
                    const millisecondsPerFrame=(performance.now()-start)/20;
                    r.querySelector('button').click();
                    return {skyChangesImage:night!==dusk,exposureChangesImage:short!==long,resetSky:sky.value,resetTrail:trail.value,millisecondsPerFrame};
                })()`);
                if(!result.skySettings.skyChangesImage||!result.skySettings.exposureChangesImage||result.skySettings.resetSky!=='auto')throw Error('Star sky controls failed');
                console.log(JSON.stringify(result.skySettings));
            }
            const settingsShot = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${mode}-settings.png`, Buffer.from(settingsShot.data, 'base64'));
        }
        if (mode.startsWith('derived-') && process.env.QA_LIVE === '1') {
            await evaluate(`document.querySelector('#qa-stage').src='/local-stage?mode=${mode}'`);
            await wait(`frames[0].location.search === '?mode=${mode}' && !!frames[0].__stageTimeline && !frames[0].__stageSetFrame && !!frames[0].document.querySelector('[data-folia-article] canvas') && frames[0].document.querySelector('audio')?.readyState >= 2`);
            result.live = await evaluate(`(async () => {
                const w=frames[0],a=w.document.querySelector('audio'),c=w.document.querySelector('[data-folia-article] canvas');
                a.muted=true;a.currentTime=24;await a.play();
                await new Promise(r=>setTimeout(r,200));const first=c.toDataURL(),start=a.currentTime;
                await new Promise(r=>setTimeout(r,1200));const moving=c.toDataURL(),elapsed=a.currentTime-start;a.pause();
                await new Promise(r=>setTimeout(r,150));const paused=c.toDataURL();
                await new Promise(r=>setTimeout(r,400));
                return {elapsed,playingChangesCanvas:first!==moving,pauseFreezesCanvas:paused===c.toDataURL()};
            })()`);
            if(result.live.elapsed<.7||!result.live.playingChangesCanvas||!result.live.pauseFreezesCanvas)throw Error('Live star playback failed');
            console.log(JSON.stringify(result.live));
        }
    }
} finally {
    writeFileSync(out + '/report.json', JSON.stringify({ report, errors, network }, null, 2));
    console.log(JSON.stringify({ checked: report.length, errors, network }));page.close();chrome.proc.kill();
}
