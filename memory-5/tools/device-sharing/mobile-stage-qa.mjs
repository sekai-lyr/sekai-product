import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
export async function mobileStages(page,modes){
    await mkdir('D:/dsh-render/mobile-stages',{recursive:true});
    await page.evaluate(()=>{
        document.querySelector('#local-stage').contentDocument.querySelector('audio')?.pause();
    });
    for(const [width,height] of [[320,568],[390,844],[568,320],[844,390]]){
        await page.setViewportSize({width,height});
        for(const mode of modes){
            console.error('MOBILE',width,height,mode);
            await page.evaluate(mode=>window.__sekaiLocalPlayer.changeMode(mode),mode);
            await page.waitForFunction(mode=>{
                const f=document.querySelector('#local-stage');return f?.contentDocument?.querySelector('.now-playing')?.dataset.stageMode===mode&&(f.contentWindow.__stageReady===true||(['disc','lyrics','folia-classic'].includes(mode)&&f.contentWindow.__sekaiStageEngine));
            },mode,{timeout:20000});
            await page.waitForFunction(()=>document.querySelector('#local-stage')?.contentDocument?.querySelector('audio')?.readyState>=1);
            await page.frameLocator('#local-stage').locator('audio').evaluate(a=>{a.currentTime=2.3;return a.play();});
            await page.waitForTimeout(450);
            await page.frameLocator('#local-stage').locator('audio').evaluate(a=>a.pause());
            const result=await page.evaluate(()=>{
                const f=document.querySelector('#local-stage'),w=f.contentWindow,d=f.contentDocument;
                const bar=d.querySelector('.lyric-player-bar,.stage-controls'),rect=bar.getBoundingClientRect();
                const scene=d.querySelector('.lyric-scene'),sr=scene?.getBoundingClientRect();
                const controls=[...d.querySelectorAll('.performance-actions button,.performance-actions a,.stage-view-toggle,.lyric-player-bar button,.lyric-player-bar select,.stage-controls button')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent.trim(),fits:r.left>=-1&&r.right<=w.innerWidth+1&&r.top>=-1&&r.bottom<=w.innerHeight+1};});
                const active=d.querySelector('.stage-lyrics .lyrics p.active'),box=d.querySelector('.stage-lyrics .lyrics');
                const a=active?.getBoundingClientRect(),b=box?.getBoundingClientRect();
                return {active:a?.toJSON(),box:b?.toJSON(),lyricFits:!a||!b||(a.top>=b.top-2&&a.bottom<=b.bottom+2),frameHeight:f.clientHeight,innerHeight:w.innerHeight,barFits:rect.left>=-1&&rect.right<=w.innerWidth+1&&rect.bottom<=w.innerHeight+1,sceneFits:!sr||(sr.top>=0&&sr.bottom<=rect.top+1&&sr.height>40),controls,engine:d.querySelector('.lyric-stage')?.dataset.foliaEngine};
            });
            await page.screenshot({path:`D:/dsh-render/mobile-stages/${mode}-${width}.png`});
            if(mode==='disc')console.error('DISC BOUNDS',JSON.stringify(result));
            assert.equal(result.frameHeight,height,`${mode} iframe viewport`);
            assert.ok(result.barFits,`${mode} ${width} bar ${JSON.stringify(result)}`);
            assert.ok(result.lyricFits,`${mode} ${width} lyric clipped ${JSON.stringify(result)}`);
            assert.ok(result.sceneFits,`${mode} ${width} scene overlaps controls ${JSON.stringify(result)}`);
            assert.ok(result.controls.every(c=>c.fits),`${mode} ${width} offscreen button ${JSON.stringify(result)}`);
        }
    }
    console.error('PASS mobile: all 23 modes ready in portrait and landscape, stage/control bounds, screenshots recorded');
}
