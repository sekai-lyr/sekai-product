// 抖音竖屏展示视频录制：Playwright 驱动 sekaisong.com 真实页面
const {chromium}=require('playwright-core');const {randomUUID}=require('crypto');const fs=require('fs');
const base='https://sekaisong.com';
const OUT='B:/Sekai/Sekai/sekai/memory-5/target/video-build';
const user='douyin_demo_'+randomUUID().replace(/-/g,'').slice(0,14),pass='Dy!'+randomUUID().replace(/-/g,'').slice(0,12);
fs.writeFileSync(OUT+'/demo-account.txt',user+' '+pass);
const wav=fs.readFileSync(OUT+'/bgm.wav');
const wav64=wav.toString('base64');
const songs=[
 {title:'星屑セレナーデ',artist:'虚拟歌姬・雪乃',album:'夜空电台 Vol.1'},
 {title:'夏空サイダー',artist:'虚拟歌姬・雪乃',album:'夜空电台 Vol.1'},
 {title:'電子の妖精',artist:'DJ メフィスト',album:'夜空电台 Vol.2'},
 {title:'夢の答え',artist:'虚拟歌姬・雪乃',album:'夜空电台 Vol.2'},
 {title:'月光ディスコ',artist:'DJ メフィスト',album:'夜空电台 Vol.1'},
 {title:' twilight パレード',artist:'星屑乐队',album:'夜空电台 Vol.2'},
];
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
let context;try{
 context=await browser.newContext({viewport:{width:720,height:1280},deviceScaleFactor:1,recordVideo:{dir:OUT+'/raw',size:{width:720,height:1280}}});
 const page=await context.newPage();page.setDefaultTimeout(30000);
 // S1 登录页（未登录大图）
 await page.goto(base+'/login',{waitUntil:'networkidle'});
 await page.waitForTimeout(3500);
 // 注册并登录（API 直连）
 assert2((await context.request.post(base+'/user/register',{form:{userName:user,nickName:'夜曲',password:pass,confirmPassword:pass},maxRedirects:0})).status()===302,'register');
 assert2((await context.request.post(base+'/user/login',{form:{userName:user,password:pass},maxRedirects:0})).status()===302,'login');
 // S2 首页
 await page.goto(base+'/home',{waitUntil:'networkidle'});
 await page.waitForTimeout(1200);
 await mousePan(page,2);
 await page.waitForTimeout(1800);
 // 建歌单 + 歌曲
 const lib=await (await context.request.get(base+'/local-player/library')).json();const csrf=lib.csrf,uid=lib.user.id;
 const post=async(path,data)=>{const r=await context.request.post(base+'/local-player/library'+path,{data,headers:{'X-Local-Library-CSRF':csrf}});if(r.status()!==200)throw Error(path+' '+await r.text());return r.json()};
 const pl=await post('/playlists',{name:'夜空电台 ✦ 精选'});
 const ids=[];
 for(const s of songs){const r=await post('/songs',{title:s.title,artist:s.artist,album:s.album,file:{fileName:'v.wav',fileSize:wav.length,lastModified:Date.now()}});ids.push(r.id);await post(`/playlists/${pl.id}/songs/${r.id}`);}
 // 种子本地文件（OPFS + IndexedDB），让每首歌都能本地播放
 await page.evaluate(async({uid,pid,ids,wav64})=>{
  const root=await navigator.storage.getDirectory();
  const write=async(name,bytes)=>{const h=await root.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(bytes);await w.close();return h};
  const bytes=Uint8Array.from(atob(wav64),c=>c.charCodeAt(0));
  const audio=await write('demo.wav',bytes);
  const file=await audio.getFile();
  const db=await new Promise((ok,no)=>{const r=indexedDB.open('sekai-local-file-handles',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  await Promise.all(ids.map((sid,i)=>new Promise((ok,no)=>{const t=db.transaction('references','readwrite');t.objectStore('references').put({audio,fileName:file.name,fileSize:file.size,lastModified:file.lastModified+i},`user:${uid}:playlist:${pid}:song:${sid}`);t.oncomplete=ok;t.onerror=()=>no(t.error)})));
 },{uid,pid:pl.id,ids,wav64});
 // S3 曲库页
 await page.goto(base+'/songs',{waitUntil:'networkidle'});
 await page.waitForTimeout(1500);
 await mousePan(page,3);
 await page.waitForTimeout(1500);
 // S4 本地库/歌单审计页
 await page.goto(base+`/local-player?playlistId=${pl.id}`,{waitUntil:'networkidle'});
 await page.waitForTimeout(3000);
 // S5 播放页舞台特效（核心）
 await page.goto(base+`/player/${ids[0]}?playlistId=${pl.id}`,{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(3000);
 const played=await page.evaluate(async()=>{const p=window.__sekaiLocalPlayer;if(!p)return 'NO_PLAYER';await p.select(0);if(p.play)await p.play?.();else document.querySelector('[data-local-play],.play-btn,button')?.click();return 'OK '+(p.track&&p.track.title)});
 console.log('PLAY:',played);
 await page.waitForTimeout(15000);
 // S6 主题切换（playlists 页）
 await page.goto(base+'/playlists',{waitUntil:'networkidle'});
 await page.waitForTimeout(1200);
 const themes=['b','c','d','a'];
 for(const t of themes){await page.evaluate(v=>{const s=document.querySelector('[data-site-theme-select]');if(s){s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}))}},t);await page.waitForTimeout(1400);}
 // S7 设备共享页
 await page.evaluate(v=>{const s=document.querySelector('[data-site-theme-select]');if(s){s.value='b';s.dispatchEvent(new Event('change',{bubbles:true}))}});
 await page.goto(base+'/device-sharing',{waitUntil:'networkidle'});
 await page.waitForTimeout(4000);
 // S8 收尾：回到播放页舞台
 await page.goto(base+`/player/${ids[0]}?playlistId=${pl.id}`,{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(2500);
 await page.evaluate(async()=>{const p=window.__sekaiLocalPlayer;if(p){await p.select(0);p.play?.()}});
 await page.waitForTimeout(7000);
 console.log('DONE',user);
}catch(e){console.error('FAILED',e);process.exit(1)}finally{await browser.close()}
function assert2(c,m){if(!c)throw Error('assert '+m)}
async function mousePan(page,strokes){const vp=page.viewportSize();for(let i=0;i<strokes;i++){await page.mouse.move(vp.width/2,vp.height*0.7);await page.mouse.down();await page.mouse.move(vp.width/2,vp.height*(0.45+0.05*i),{steps:12});await page.mouse.up();await page.waitForTimeout(500)}}
})().catch(e=>{console.error(e);process.exit(1)});
