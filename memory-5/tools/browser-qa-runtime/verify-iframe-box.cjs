const {chromium}=require('playwright-core');
const base='https://sekaisong.com';
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:810}});
  await ctx.request.post(base+'/user/login',{form:{userName:'sekai',password:'20070831miku'},maxRedirects:0});
  const page=await ctx.newPage();
  await page.goto(base+'/player/129',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(4000);
  await page.evaluate(()=>{
    document.body.classList.add('local-playback-ready');
    const f=document.querySelector('#local-stage'); f.hidden=false; f.src='/local-stage?mode=disc';
  });
  await page.waitForTimeout(4500);
  const r=await page.evaluate(()=>{
    const f=document.querySelector('#local-stage');const b=f.getBoundingClientRect();
    const w=document.querySelector('#local-workspace');const wb=w.getBoundingClientRect();const wc=getComputedStyle(w);
    const d=f.contentDocument;
    return {body:document.body.className,wpos:wc.position,wrect:[Math.round(wb.x),Math.round(wb.y),Math.round(wb.width),Math.round(wb.height)],stageHidden:f.hidden,stage:[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)],
      innerBody:[d.body.scrollWidth,d.body.scrollHeight],innerMain:d.querySelector('.now-playing')?[...(()=>{const q=d.querySelector('.now-playing').getBoundingClientRect();return [Math.round(q.width),Math.round(q.height)];})()]:null,
      outerScroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};
  });
  console.log(JSON.stringify(r));
  await page.screenshot({path:'B:/Sekai/Sekai/sekai/memory-5/target/shot/iframe-box.png'});
  await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
