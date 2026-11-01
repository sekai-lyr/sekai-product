const {chromium}=require('playwright-core');
const base='https://sekaisong.com';
const OUT=process.argv[2];
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const ctx=await browser.newContext({viewport:{width:1800,height:921}});
  await ctx.request.post(base+'/user/login',{form:{userName:'sekai',password:'20070831miku'},maxRedirects:0});
  const lib=await (await ctx.request.get(base+'/local-player/library')).json();
  const pick=lib.songs.filter(s=>s.coverUrl).slice(0,5).map(s=>({id:s.id,title:s.title,coverUrl:String(s.coverUrl).slice(0,60),fileName:s.fileName}));
  console.log(JSON.stringify(pick,null,1));
  const song=lib.songs.find(s=>s.coverUrl)||lib.songs[0];
  const page=await ctx.newPage();
  await page.goto(`${base}/player/${song.id}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3500);
  await page.screenshot({path:OUT});
  const info=await page.evaluate(()=>{
    const g=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};};
    return {art:g('.stage-art'),copy:g('.stage-copy'),cover:g('.cover-large'),disc:g('.stage-disc'),lyrics:g('.stage-lyrics'),bg:g('.stage-bg-img'),body:document.body.className};
  });
  console.log(JSON.stringify(info));
  console.log('saved',OUT,song.id,song.title);
  await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
