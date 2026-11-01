// 生产 E2E：复现「确认关联所选歌曲」流程，逐秒记录进度，定位卡点。
// 用 sekai 账号 + 真实歌单；假文件为 OPFS 中的零填充 .flac（文件名=歌曲标题）。
// 不改服务端数据：选了歌单时 persistBinding 不发 POST，无 LRC/封面则 persistLyrics 不发 POST。
const {chromium}=require('playwright-core');
const base='https://sekaisong.com';
const USER=process.argv[2]||'sekai',PASS=process.argv[3]||'20070831miku';
const PLAYLIST_NAME=process.argv[4]||'SeKai（从网易云导入）';
const N_FILES=Number(process.argv[5]||30);
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext();
  const t0=Date.now(),log=(...a)=>console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s]`,...a);
  try{
    const lr=await context.request.post(base+'/user/login',{form:{userName:USER,password:PASS},maxRedirects:0});
    log('login status',lr.status());
    const lib=await (await context.request.get(base+'/local-player/library')).json();
    const pl=lib.playlists.find(p=>p.name.includes(PLAYLIST_NAME.replace('（','（')))||lib.playlists.find(p=>p.name===PLAYLIST_NAME);
    log('playlists:',lib.playlists.map(p=>`${p.id}:${p.name}(${p.songIds.length})`).join(' | '));
    if(!pl)throw new Error('playlist not found');
    const titles=[];for(const id of pl.songIds){const s=lib.songs.find(x=>x.id===id);if(s&&s.title)titles.push(s.title);}
    const unique=[...new Set(titles)].slice(0,N_FILES);
    log(`playlist "${pl.name}" id=${pl.id} songs=${titles.length}, using ${unique.length} fake files`);

    await context.addInitScript(()=>{ // 覆写目录选择器：返回 OPFS 根
      Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:async()=>await navigator.storage.getDirectory()});
    });
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>{errors.push(e.message);log('PAGEERROR',e.message);});
    const reqs=[];page.on('request',r=>{if(r.method()!=='GET'||r.url().includes('library')){reqs.push(`${r.method()} ${r.url()}`);log('REQ',r.method(),r.url().replace(base,''));}});
    await page.goto(base+'/local-player',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__sekaiLocalPlayer!==undefined||document.querySelector('#local-link-existing'),null,{timeout:30000});
    // 在 OPFS 写入假文件
    await page.evaluate(async titles=>{
      const root=await navigator.storage.getDirectory();
      for(let i=0;i<titles.length;i++){
        const name=`${titles[i].replace(/[\\/:*?"<>|]/g,'_')}.flac`;
        const h=await root.getFileHandle(name,{create:true});
        const w=await h.createWritable();await w.write(new Uint8Array(200000+i));await w.close();
      }
      return root.name;
    },unique);
    log('fake files written to OPFS');
    await page.selectOption('#local-link-playlist',String(pl.id));
    const tClick=Date.now();
    await page.click('#local-link-existing');
    log('clicked 关联已有歌曲／视频, waiting preview…');
    // 预览阶段监控
    let previewDone=false;
    for(let i=0;i<240;i++){
      await page.waitForTimeout(500);
      const st=await page.evaluate(()=>({
        status:document.querySelector('#local-status')?.textContent||document.querySelector('.local-status')?.textContent||'',
        statusAny:[...document.querySelectorAll('.local-status,[id*=status]')].map(e=>e.textContent).filter(Boolean).slice(0,3),
        rows:document.querySelectorAll('#local-link-preview-rows tr').length,
        hidden:document.querySelector('#local-link-preview')?.hidden
      }));
      if(st.rows>0&&!st.hidden){previewDone=true;log(`preview rows=${st.rows} after ${((Date.now()-tClick)/1000).toFixed(1)}s; statusAny=${JSON.stringify(st.statusAny)}`);break;}
      if(i%10===9)log(`preview… rows=${st.rows} status=${JSON.stringify(st.statusAny)}`);
    }
    if(!previewDone)throw new Error('preview never rendered');
    // 确认阶段监控：每 300ms 记录按钮与状态
    await page.click('#local-link-confirm');
    log('clicked 确认关联所选歌曲');
    const tConfirm=Date.now();let last='';
    for(let i=0;i<600;i++){
      await page.waitForTimeout(300);
      const st=await page.evaluate(()=>({
        btn:document.querySelector('#local-link-confirm')?.textContent,
        dis:document.querySelector('#local-link-confirm')?.disabled,
        status:[...document.querySelectorAll('.local-status,[id*=status]')].map(e=>e.textContent).filter(Boolean).slice(0,2)
      }));
      const sig=`${st.btn}|${st.status.join(' / ')}`;
      if(sig!==last){last=sig;log(`CONFIRM +${((Date.now()-tConfirm)/1000).toFixed(1)}s btn="${st.btn}" status=${JSON.stringify(st.status)}`);}
      if(!st.dis && i>2){log(`button re-enabled after ${((Date.now()-tConfirm)/1000).toFixed(1)}s — flow ended`);break;}
    }
    log('final errors:',JSON.stringify(errors));
    log('total requests captured:',reqs.length);
  }finally{await browser.close();}
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
