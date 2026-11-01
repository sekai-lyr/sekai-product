const {chromium}=require('playwright-core');
const base='https://sekaisong.com';
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:810}});
  await ctx.request.post(base+'/user/login',{form:{userName:'sekai',password:'20070831miku'},maxRedirects:0});
  const page=await ctx.newPage();
  await page.goto(base+'/player/129',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1200);
  const info=await page.evaluate(()=>{
    document.body.classList.add('local-playback-ready');
    const found=[];
    for(const sheet of document.styleSheets){
      let rules;try{rules=sheet.cssRules;}catch{continue;}
      const walk=list=>{for(const r of list){
        if(r.selectorText && /local-playback-ready|local-workspace/.test(r.selectorText)) found.push({href:(sheet.href||'inline').split('/').pop(),sel:r.selectorText,css:r.style.cssText});
        if(r.cssRules)walk(r.cssRules);}};
      walk(rules);
    }
    const ws=document.querySelector('#local-workspace');
    return {found, matches:ws.matches('.local-playback-ready #local-workspace'),
      pos:getComputedStyle(ws).position, bodyClass:document.body.className};
  });
  console.log(JSON.stringify(info,null,1));
  await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
