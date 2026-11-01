const {chromium}=require('playwright-core');
const base='https://sekaisong.com';
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const ctx=await browser.newContext({viewport:{width:1800,height:921}});
  await ctx.request.post(base+'/user/login',{form:{userName:'sekai',password:'20070831miku'},maxRedirects:0});
  const lib=await (await ctx.request.get(base+'/local-player/library')).json();
  const song=lib.songs.find(s=>s.fileName)||lib.songs[0];
  const page=await ctx.newPage();
  await page.goto(`${base}/player/${song.id}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2500);
  const info=await page.evaluate(()=>{
    const cs=s=>{const n=document.querySelector(s);if(!n)return 'missing';const c=getComputedStyle(n);const r=n.getBoundingClientRect();return {display:c.display,pos:c.position,x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),hidden:n.hidden};};
    return {url:location.pathname,body:document.body.className,
      tools:cs('#local-playback-tools'),workspace:cs('#local-workspace'),stage:cs('#local-stage'),
      title:document.querySelector('.section-title')?.innerText, plays:document.querySelector('#local-status')?.textContent?.slice(0,60), h1:document.querySelector('h1')?.textContent};
  });
  console.log(JSON.stringify(info,null,1));
  await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
