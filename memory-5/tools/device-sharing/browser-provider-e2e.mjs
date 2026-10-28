import assert from 'node:assert/strict';
import {chromium} from '../browser-qa-runtime/node_modules/playwright-core/index.mjs';

// The picker is substituted with a real browser-owned FileSystemDirectoryHandle.
// File reads, IndexedDB persistence, WebSocket and playback are not mocked.
export async function browserProviderTest({site,songId,name,bytes,cookie}){
    const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
    const errors=[];
    let context,deviceId,csrf,createdPlaylist;
    try{
        const [cookieName,...value]=cookie.split('=');
        context=await browser.newContext();await context.addCookies([{name:cookieName,value:value.join('='),url:site}]);
        const library=await (await context.request.get(site+'/local-player/library')).json();csrf=library.csrf;
        let playlist=library.playlists.find(item=>item.songIds.includes(songId));
        if(!playlist){
            const headers={'X-Local-Library-CSRF':csrf};
            const created=await context.request.post(site+'/local-player/library/playlists',{headers,data:{name:'设备浏览器验证'}});
            assert.equal(created.status(),200);createdPlaylist=(await created.json()).id;
            const added=await context.request.post(site+`/local-player/library/playlists/${createdPlaylist}/songs/${songId}`,{headers,data:{}});
            assert.equal(added.status(),200);playlist={id:createdPlaylist};
        }
        const playlistId=playlist.id;
        const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
        await page.goto(site+'/device-sharing');await page.locator('#sharing-playlist').waitFor();
        const directory='browser-provider-qa-'+songId;
        await page.evaluate(async({directory,name,base64,playlistId,songId})=>{
            const root=await navigator.storage.getDirectory(),folder=await root.getDirectoryHandle(directory,{create:true});
            const file=await folder.getFileHandle(name,{create:true}),writer=await file.createWritable();
            await writer.write(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)));await writer.close();
            const lrc=await folder.getFileHandle(name.replace(/\.wav$/,'.lrc'),{create:true}),lyricWriter=await lrc.createWritable();
            await lyricWriter.write('[00:00.00]Browser shared lyrics');await lyricWriter.close();
            const library=await fetch('/local-player/library').then(r=>r.json());
            const db=await new Promise((resolve,reject)=>{
                const request=indexedDB.open('sekai-local-file-handles',1);
                request.onupgradeneeded=()=>request.result.createObjectStore('references');
                request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
            });
            const audio=await folder.getFileHandle(name),lyric=await folder.getFileHandle(name.replace(/\.wav$/,'.lrc'));
            const media=await audio.getFile();
            await new Promise((resolve,reject)=>{
                const tx=db.transaction('references','readwrite');
                tx.objectStore('references').put({audio,lyric,fileName:name,fileSize:media.size,lastModified:media.lastModified},`user:${library.user.id}:playlist:${playlistId}:song:${songId}`);
                tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
            });db.close();
        },{directory,name,base64:bytes.toString('base64'),playlistId,songId});
        await page.reload();await page.locator('#sharing-playlist').selectOption(String(playlistId));
        await page.waitForFunction(()=>!document.querySelector('#browser-start').disabled);
        assert.ok((await page.locator('#browser-summary').textContent()).includes('1/'));
        await page.evaluate(()=>{window.showDirectoryPicker=()=>{throw Error('Remembered folders must not require another picker');};});
        await page.locator('#browser-start').click();
        await page.waitForFunction(()=>document.querySelector('#device-notice').textContent.includes('共享中'));
        const sources=await page.evaluate(()=>fetch('/api/device-sharing/sources').then(r=>r.json()));
        const source=sources.find(s=>s.songId===songId);assert.ok(source);deviceId=source.deviceId;
        const media=`/api/device-sharing/media/${source.deviceId}/${songId}/audio`;
        const playback=await browser.newContext();await playback.addCookies([{name:cookieName,value:value.join('='),url:site}]);
        const request=await playback.request.get(site+media,{headers:{Range:'bytes=65530-65550'}});
        assert.equal(request.status(),206);assert.deepEqual(await request.body(),bytes.subarray(65530,65551));
        const listener=await playback.newPage();listener.on('pageerror',e=>errors.push(e.message));
        await listener.goto(site+`/player/${songId}?playlistId=${playlistId}&autoplay=1`,{waitUntil:'domcontentloaded'});
        const audio=listener.frameLocator('#local-stage').locator('audio');await audio.waitFor({state:'attached'});
        await audio.evaluate(a=>a.play());await listener.waitForFunction(()=>document.querySelector('#local-stage')?.contentDocument?.querySelector('audio')?.currentTime>.1);
        await listener.close();
        await page.locator('#browser-stop').click();
        await page.waitForFunction(()=>document.querySelector('#browser-stop').disabled);
        const denied=await playback.request.get(site+media);assert.ok([404,409].includes(denied.status()));
        await page.reload();await page.waitForFunction(()=>!document.querySelector('#browser-start').disabled);
        assert.equal(await page.locator('#browser-summary').textContent().then(t=>t.includes('1/')),true);
        await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'D:/dsh-render/browser-sharing-desktop.png',fullPage:true});
        await page.setViewportSize({width:390,height:844});await page.screenshot({path:'D:/dsh-render/browser-sharing-mobile.png',fullPage:true});
        await page.setViewportSize({width:1440,height:900});
        const stored=await page.evaluate(()=>new Promise((resolve,reject)=>{
            const request=indexedDB.open('sekai-browser-sharing',1);request.onerror=()=>reject(request.error);
            request.onsuccess=()=>{const query=request.result.transaction('devices').objectStore('devices').getAll();query.onsuccess=()=>resolve(query.result.map(r=>({deviceId:r.deviceId,token:r.token,files:r.index.files.length})));};
        }));
        assert.ok(stored.some(r=>r.deviceId===source.deviceId&&r.files===2));assert.ok(stored.every(r=>r.token===undefined));
        await page.locator('#browser-start').click();await page.waitForFunction(()=>document.querySelector('#device-notice').textContent.includes('共享中'));
        const restored=await playback.request.get(site+media,{headers:{Range:'bytes=-7'}});assert.equal(restored.status(),206);assert.deepEqual(await restored.body(),bytes.subarray(-7));
        await page.close();
        await new Promise(resolve=>setTimeout(resolve,200));
        const stopped=await playback.request.get(site+media);assert.ok([404,409].includes(stopped.status()));
        assert.deepEqual(errors,[]);
        console.error('PASS browser-only provider: folder handle, two contexts, playback, stop, reload persistence, no stored token, page close');
    }finally{
        if(deviceId&&context)await context.request.post(site+`/api/device-sharing/devices/${deviceId}/revoke`,{headers:{'X-Local-Library-CSRF':csrf},data:{}}).catch(()=>{});
        if(createdPlaylist&&context)await context.request.post(site+`/playlists/delete/${createdPlaylist}`).catch(()=>{});
        await browser.close();
    }
}
