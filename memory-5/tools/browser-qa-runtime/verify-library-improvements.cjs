// Run only against the isolated local QA database (qa_layout fixture).
const {chromium}=require('playwright-core');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.LIBRARY_QA_URL || 'http://127.0.0.1:18085';
if(new URL(base).hostname!=='127.0.0.1')throw new Error('This mutating QA requires the isolated local preview.');
const output=path.resolve(__dirname,'../../qa-output/library-improvements');
(async()=>{
    await fs.mkdir(output,{recursive:true});
    const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    const context=await browser.newContext();const page=await context.newPage();const errors=[];const checks=[];
    page.on('pageerror',error=>errors.push(error.message));
    try {
        for(const width of [390,768,1440]) {
            await page.setViewportSize({width,height:width===1440?900:844});await page.goto(base+'/login');
            const box=await page.locator('#loginForm button[type=submit]').boundingBox();assert.ok(box.y+box.height<=844,`Login below fold at ${width}: ${JSON.stringify(box)}`);
            await page.screenshot({path:path.join(output,`login-${width}.png`)});checks.push(`login first viewport ${width}`);
        }
        await page.locator('#userName').fill('qa_layout');await page.locator('#password').fill('qa-library-2026');
        await Promise.all([page.waitForURL('**/home'),page.locator('#loginForm button[type=submit]').click()]);
        for(const width of [390,768,1440]) {
            await page.setViewportSize({width,height:width===1440?900:844});
            for(const route of ['/home','/songs?view=list','/songs?keyword=qa-no-result','/library-tools','/search?q=夜色']) {
                const response=await page.goto(base+route);assert.equal(response.status(),200,route);
                await page.locator('main').waitFor();
                const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(size.scroll<=size.width+1,`${width} ${route} overflow ${JSON.stringify(size)}`);
                checks.push(`${width} ${route}`);
            }
            await page.screenshot({path:path.join(output,`search-${width}.png`)});
        }
        await page.goto(base+'/library-tools');await page.locator('#smart-results .library-row').first().waitFor();
        await page.locator('#smart-rule').selectOption('missing-lyrics');await page.locator('#smart-results .library-row').first().waitFor();
        await page.screenshot({path:path.join(output,'library-tools-desktop.png'),fullPage:true});
        const [download]=await Promise.all([page.waitForEvent('download'),page.getByText('下载资料备份',{exact:true}).click()]);
        const backup=path.join(output,'qa-library.json');await download.saveAs(backup);
        const data=JSON.parse(await fs.readFile(backup,'utf8'));assert.equal(data.version,1);assert.ok(data.tracks.length>0);assert.ok(!JSON.stringify(data).includes('file_name'));
        await page.locator('#backup-file').setInputFiles(backup);await page.locator('#restore-preview').waitFor({state:'visible'});
        await page.locator('#restore-confirm').click();await page.getByText(/恢复完成：新增 0 首/).waitFor();checks.push('backup preview and idempotent restore');
        await page.locator('#scan-duplicates').click();const preview=page.getByText('保留第一首并预览',{exact:true}).first();
        if(await preview.count()){await preview.click();await page.locator('#merge-preview').waitFor({state:'visible'});await page.locator('#merge-cancel').click();checks.push('duplicate preview and cancel');}
        await page.goto(base+'/netease');await page.locator('textarea[name=songIds]').fill('invalid-no-song');await page.locator('form[data-import-source] button[type=submit]').click();await page.getByText('查看进度与结果',{exact:false}).waitFor();
        await page.goto(base+'/library-tools');await page.getByText(/有未完成项/).first().waitFor({timeout:15000});checks.push('durable import failure displayed');
        await page.goto(base+'/songs?view=list');const href=await page.locator('.library-row > a').first().getAttribute('href');
        await page.goto(base+href);await page.locator('.playback-file-tools').waitFor();assert.equal(await page.locator('.playback-file-tools').getAttribute('open'),null);
        await page.locator('.playback-file-tools > summary').click();await page.locator('#local-files').waitFor({state:'attached'});checks.push('playback file tools accessible');
        const pcm=Buffer.alloc(8000*2*3),wav=Buffer.alloc(44+pcm.length);wav.write('RIFF');wav.writeUInt32LE(36+pcm.length,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);
        await page.locator('#local-files').setInputFiles({name:'qa-playback.wav',mimeType:'audio/wav',buffer:wav});
        await page.locator('#local-match-files').click();await page.locator('#local-import-confirm').waitFor({state:'visible'});await page.locator('#local-import-confirm').click();
        await page.waitForFunction(()=>document.body.classList.contains('local-playback-ready'));
        await page.frameLocator('#local-stage').locator('audio').waitFor({state:'attached'});
        assert.ok(await page.frameLocator('#local-stage').locator('audio').evaluate(audio=>audio.src.startsWith('blob:')));
        await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'playback-390.png')});
        const stageBox=await page.locator('#local-workspace').boundingBox();assert.ok(stageBox.width<=390);checks.push('local audio playback with file tools and mobile stage');

        assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'report.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,errors,output}));
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
