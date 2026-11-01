const {chromium}=require('playwright-core');
const base='https://sekaisong.com';
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:810}});
  await ctx.request.post(base+'/user/login',{form:{userName:'sekai',password:'20070831miku'},maxRedirects:0});
  const lib=await (await ctx.request.get(base+'/local-player/library')).json();
  const song=lib.songs.find(s=>s.serverAudioUrl) || lib.songs.find(s=>s.serverVideoUrl);
  console.log('pick',song?.id,song?.title,'audio',!!song?.serverAudioUrl,'video',!!song?.serverVideoUrl);
  if(!song){console.log('no server media song');await browser.close();return;}
  const page=await ctx.newPage();
  await page.goto(`${base}/player/${song.id}?autoplay=1`,{waitUntil:'domcontentloaded'});
  for(let i=0;i<30;i++){await page.waitForTimeout(500);
    const ready=await page.evaluate(()=>{const f=document.querySelector('#local-stage');return f&&!f.hidden&&f.clientHeight>100;});
    if(ready){console.log('ready at',i*0.5);break;}}
  await page.waitForTimeout(3500);
  const geo=await page.evaluate(()=>{
    const b=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];};
    const f=document.querySelector('#local-stage');const d=f?.contentDocument;
    return {body:document.body.className,scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
      workspace:b('#local-workspace'),stage:b('#local-stage'),vw:innerWidth,vh:innerHeight,
      innerStage:d?(()=>{const n=d.querySelector('.now-playing');const r=n?.getBoundingClientRect();return r?[Math.round(r.width),Math.round(r.height)]:null})():null};
  });
  console.log(JSON.stringify(geo));
  await page.screenshot({path:'B:/Sekai/Sekai/sekai/memory-5/target/shot/immersive-live.png'});
  await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
