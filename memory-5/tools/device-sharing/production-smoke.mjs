// Explicit deployment smoke test: synthetic media and a disposable QA account only.
// Never accepts real account credentials or a real music directory.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {createIndex,saveIndex,loadIndex} from './files.mjs';
import {startProvider} from './provider.mjs';

const site='https://sekaisong.com',username='deviceqa'+randomBytes(6).toString('hex');
const password=randomBytes(24).toString('base64url'),cookies=new Map();
const root=await mkdtemp(join(tmpdir(),'sekai-production-qa-'));
let csrf='',songId,credentials,provider,userId;
console.log(JSON.stringify({qaAccount:username}));
async function request(path,{method='GET',body,form,headers={},anonymous=false}={}){
    const response=await fetch(site+path,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{
        ...(!anonymous?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join(';'),'X-Local-Library-CSRF':csrf}:{}),
        ...(body?{'Content-Type':'application/json'}:{}),...(form?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...headers
    },body:body?JSON.stringify(body):form?new URLSearchParams(form):undefined});
    if(!anonymous)for(const value of response.headers.getSetCookie()){const [key,...parts]=value.split(';')[0].split('=');cookies.set(key,parts.join('='));}
    return response;
}
async function json(path,options){const r=await request(path,options);assert.equal(r.status,200,path);return r.json();}
async function state(){return (await json('/api/device-sharing/devices')).find(d=>d.id===credentials.deviceId);}
async function until(check){for(let n=0;n<100;n++){if(await check())return;await delay(100);}throw Error('Device state timeout');}
try {
    const register=await request('/user/register',{method:'POST',form:{userName:username,nickName:'设备发布验证',password,confirmPassword:password}});
    assert.equal(new URL(register.headers.get('location'),site).pathname,'/login');
    const login=await request('/user/login',{method:'POST',form:{userName:username,password}});assert.equal(new URL(login.headers.get('location'),site).pathname,'/home');
    const library=await json('/local-player/library');csrf=library.csrf;userId=library.user.id;
    console.log(JSON.stringify({qaAccount:username,userId}));
    if(process.env.SEKAI_DEVICE_BROWSER_QA==='1'){
        // Read-only production browser smoke: no folder permission or share-button interaction.
        const {chromium}=await import('../browser-qa-runtime/node_modules/playwright-core/index.mjs');
        const browser=await chromium.launch({channel:'chrome',headless:true});
        try{
            const context=await browser.newContext();await context.addCookies([...cookies].map(([name,value])=>({name,value,url:site})));
            const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
            await page.goto(site+'/device-sharing');await page.locator('#sharing-playlist').waitFor();
            assert.equal(await page.locator('#device-pair').count(),0);
            assert.equal(await page.locator('#browser-start').isDisabled(),true);
            const originAccepted=await page.evaluate(()=>new Promise(resolve=>{
                const ws=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/device-sharing/channel');
                const timer=setTimeout(()=>{ws.close();resolve(false);},10000);
                ws.onopen=()=>{clearTimeout(timer);ws.close();resolve(true);};ws.onerror=()=>{clearTimeout(timer);resolve(false);};
            }));assert.equal(originAccepted,true,'Production HTTPS browser Origin must be accepted');assert.deepEqual(errors,[]);
            console.log(JSON.stringify({browserPage:'PASS',noClientRequired:true,startsOff:true,httpsBrowserOrigin:true}));
        }finally{await browser.close();}
    }
    const bytes=Buffer.alloc(2097152);for(let n=0;n<bytes.length;n++)bytes[n]=n%251;
    await writeFile(join(root,'synthetic.wav'),bytes);await writeFile(join(root,'synthetic.lrc'),'[00:00.00]Synthetic deployment test');
    ({id:songId}=await json('/local-player/library/songs',{method:'POST',body:{title:'设备共享临时验证',artist:'QA',album:'QA',file:{fileName:'synthetic.wav',fileSize:bytes.length,lastModified:0}}}));
    const pairing=await json('/api/device-sharing/pairing',{method:'POST',body:{}});
    credentials=await json('/api/device-sharing/pair',{method:'POST',body:{code:pairing.code,name:'临时发布验证电脑'}});
    const {index}=await createIndex([root],[{id:songId,fileName:'synthetic.wav',fileSize:bytes.length}]);
    await saveIndex(join(root,'index.json'),index);provider=startProvider({site,credentials,index});await provider.ready;
    assert.equal((await state()).sharing,false);
    await json(`/api/device-sharing/devices/${credentials.deviceId}/sharing`,{method:'POST',body:{enabled:true}});
    await until(async()=>(await state()).sharing);
    const media=`/api/device-sharing/media/${credentials.deviceId}/${songId}/audio`;
    const all=await request(media);assert.equal(all.status,200);assert.deepEqual(Buffer.from(await all.arrayBuffer()),bytes);
    const range=await request(media,{headers:{Range:'bytes=65530-65550'}});assert.equal(range.status,206);
    assert.equal(range.headers.get('content-range'),'bytes 65530-65550/2097152');assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(65530,65551));
    assert.equal((await request(media,{anonymous:true})).status,401);
    provider.stop();await until(async()=>!(await state()).sharing);assert.equal((await request(media)).status,409);
    provider.close();await until(async()=>!(await state()).online);
    provider=startProvider({site,credentials,index:await loadIndex(join(root,'index.json'))});await provider.ready;
    assert.equal((await state()).sharing,false);
    console.log(JSON.stringify({result:'PASS',https:true,wss:true,bytes:bytes.length,range:true,anonymousDenied:true,stop:true,persistedIndex:true,reconnectStartsOff:true}));
} finally {
    provider?.close();
    if(credentials)await request(`/api/device-sharing/devices/${credentials.deviceId}/revoke`,{method:'POST',body:{}}).catch(()=>{});
    if(songId)await request(`/local-player/library/songs/${songId}`,{method:'DELETE'}).catch(()=>{});
    await request('/logout').catch(()=>{});
    await rm(root,{recursive:true,force:true});
}
