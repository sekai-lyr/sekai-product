const {chromium}=require('playwright-core');
const base='https://sekaisong.com';
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:810}});
  await ctx.request.post(base+'/user/login',{form:{userName:'sekai',password:'20070831miku'},maxRedirects:0});
  const lib=await (await ctx.request.get(base+'/local-player/library')).json();
  const song=lib.songs[0];
  const page=await ctx.newPage();
  await page.goto(`${base}/player/${song.id}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  const before=await page.evaluate(()=>({body:document.body.className,vw:innerWidth,vh:innerHeight}));
  const after=await page.evaluate(()=>{
    document.body.classList.add('local-playback-ready');
    const w=document.querySelector('#local-workspace').getBoundingClientRect();
    const cs=getComputedStyle(document.querySelector('#local-workspace'));
    const sb=document.querySelector('.sidebar');
    return {pos:cs.position,w:Math.round(w.width),h:Math.round(w.height),x:Math.round(w.x),y:Math.round(w.y),
      sidebar:sb?getComputedStyle(sb).display:'none', bodyW:document.body.getBoundingClientRect().width};
  });
  await page.screenshot({path:'B:/Sekai/Sekai/sekai/memory-5/target/shot/immersive-forced.png'});
  console.log(JSON.stringify({before,after},null,1));
  await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
