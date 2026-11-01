const {chromium}=require('playwright-core');
const fs=require('fs');
const css=fs.readFileSync('B:/Sekai/Sekai/sekai/memory-5/src/main/resources/static/css/library-experience.css','utf8');
const base='https://sekaisong.com';
(async()=>{
  for(const vp of [{width:1440,height:810,tag:'1440x810'},{width:900,height:700,tag:'900x700'}]){
    const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    const ctx=await browser.newContext({viewport:vp});
    await ctx.request.post(base+'/user/login',{form:{userName:'sekai',password:'20070831miku'},maxRedirects:0});
    const page=await ctx.newPage();
    await page.goto(base+'/player/129',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1200);
    // 线上样式已生效，不再注入
    const r=await page.evaluate(()=>{
      document.body.classList.add('local-playback-ready');
      const box=s=>{const n=document.querySelector(s);if(!n)return null;const c=getComputedStyle(n);const b=n.getBoundingClientRect();
        return {d:c.display,pos:c.position,w:Math.round(b.width),h:Math.round(b.height),x:Math.round(b.x),y:Math.round(b.y)};};
      return {vw:innerWidth,vh:innerHeight,
        sidebar:box('.sidebar'),title:box('.section-title'),tools:box('#local-playback-tools'),status:box('#local-status'),
        audit:box('.playback-file-tools'),workspace:box('#local-workspace'),stage:box('#local-stage'),
        scrollW:document.documentElement.scrollWidth};
    });
    console.log(vp.tag,JSON.stringify(r));
    await browser.close();
  }
})().catch(e=>{console.error(e.message);process.exit(1);});
