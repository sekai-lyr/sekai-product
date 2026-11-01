// 生产 E2E v2：playlist 6 全量 118 首，真实 LRC/PNG 字节，byFile 命中跳过 parser，
// 完整复现「确认关联所选歌曲」循环并逐段计时。音频内容用代理桩（confirm 不读音频）。
const {chromium}=require('playwright-core');
const fs=require('fs'),path=require('path');
const base='https://sekaisong.com';
const USER='sekai',PASS='20070831miku';
const ROOT='D:/Sekai_Song/SeKai（从网易云导入）';
const PLAYLIST_ID=6;
(async()=>{
  const all=fs.readdirSync(ROOT);
  const lrcs=new Map(all.filter(n=>/\.lrc$/i.test(n)).map(n=>[n,fs.readFileSync(path.join(ROOT,n))]));
  const pngs=new Map(all.filter(n=>/\.png$/i.test(n)).map(n=>[n,fs.readFileSync(path.join(ROOT,n))]));
  console.log(`real sidecars: lrc=${lrcs.size} png=${pngs.size}`);
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext();
  const t0=Date.now(),log=(...a)=>console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s]`,...a);
  try{
    await context.request.post(base+'/user/login',{form:{userName:USER,password:PASS},maxRedirects:0});
    const lib=await (await context.request.get(base+'/local-player/library')).json();
    const pl=lib.playlists.find(p=>p.id===PLAYLIST_ID);
    const songs=pl.songIds.map(id=>lib.songs.find(s=>s.id===id)).filter(s=>s&&s.fileName);
    log(`playlist "${pl.name}" songs=${songs.length} with server fileName`);
    // 把真实 LRC 按服务端文件名配对：服务端 fileName 例 1778404048318.flac；
    // 本地文件例 2-99-1778404048318.flac → 用尾段数字对应
    const tailOf=n=>String(n).match(/(\d{6,})/)?.[1]||null;
    const records=[];
    for(const s of songs){
      const tail=tailOf(s.fileName);
      const lrcName=tail?all.find(n=>/\.lrc$/i.test(n)&&n.includes(tail)):null;
      records.push({name:s.fileName,size:s.fileSize||4096,lrcName:lrcName||null,
        lrcB64:lrcName?lrcs.get(lrcName).toString('base64'):null});
    }
    log(`records=${records.length}, withLRC=${records.filter(r=>r.lrcB64).length}`);

    await context.addInitScript(()=>{
      const b64=u=>Uint8Array.from(atob(u),c=>c.charCodeAt(0));
      class FakeHandle{
        constructor(name,size,lastModified,content){
          this.kind='file';this.name=name;this._size=size;this._lm=lastModified;
          const real=content?new File([content],name,{lastModified}):new File([new Uint8Array(4)],name,{lastModified});
          Object.defineProperty(this,'_file',{value:content?real:new Proxy(real,{get:(t,p)=>p==='size'?size:p==='lastModified'?lastModified:Reflect.get(t,p)}),writable:true});
        }
        getFile(){return this._file;}
        async isSameEntry(o){return o?.name===this.name;}
        async queryPermission(){return 'granted';}
      }
      const mkEntry=(name,size,lastModified,content)=>new FakeHandle(name,size,lastModified,content);
      const buildRoot=recs=>{
        const audioEntries=[],lrcEntries=[];
        for(const r of recs){
          audioEntries.push([r.name,mkEntry(r.name,r.size,r.lastModified,null)]);
          if(r.lrcB64)lrcEntries.push([r.lrcName,mkEntry(r.lrcName,0,Date.now(),b64(r.lrcB64))]);
        }
        for(let i=0;i<40;i++)audioEntries.push([`bilibili-${200+i}-3583384200${i}.mp4`,mkEntry(`bilibili-${200+i}-3583384200${i}.mp4`,300*1048576,Date.now(),null)]);
        const sub={kind:'directory',name:'SeKai（从网易云导入）',
          entries:async function*(){yield* audioEntries;yield* lrcEntries;},
          isSameEntry:async o=>o?.name==='SeKai（从网易云导入）',queryPermission:async()=>'granted'};
        return {kind:'directory',name:'Sekai_Song',
          entries:async function*(){yield ['SeKai（从网易云导入）',sub];},
          isSameEntry:async o=>o?.name==='Sekai_Song',queryPermission:async()=>'granted'};
      };
      window.__buildRoot=buildRoot;
      Object.defineProperty(window,'showDirectoryPicker',{configurable:true,
        value:async()=>window.__root});
    });
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>{errors.push(e.message);log('PAGEERROR',e.message);});
    let posts=0;page.on('request',r=>{if(r.method()==='POST'){posts++;if(posts<=3||posts%20===0)log('POST#'+posts,r.url().replace(base,''));}});
    await page.goto(base+'/local-player',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#local-link-existing'),null,{timeout:30000});
    await page.evaluate(recs=>{window.__root=window.__buildRoot(recs);},records);
    await page.selectOption('#local-link-playlist',String(PLAYLIST_ID));
    const tClick=Date.now();
    await page.click('#local-link-existing');
    log('clicked 关联已有歌曲, waiting preview…');
    let ok=false;
    for(let i=0;i<120;i++){
      await page.waitForTimeout(500);
      const st=await page.evaluate(()=>({rows:document.querySelectorAll('#local-link-preview-rows tr').length,
        hidden:document.querySelector('#local-link-preview')?.hidden,
        status:document.querySelector('#local-status')?.textContent}));
      if(st.rows>0&&!st.hidden){log(`preview rows=${st.rows} in ${((Date.now()-tClick)/1000).toFixed(1)}s | ${st.status}`);ok=true;break;}
      if(i%10===9)log(`preview… rows=${st.rows} | ${st.status}`);
    }
    if(!ok)throw new Error('preview never rendered');
    const filled=await page.evaluate(()=>[...document.querySelectorAll('#local-link-preview-rows select')].filter(s=>s.value).length);
    log(`filled selects: ${filled}`);
    await page.click('#local-link-confirm');
    log('clicked 确认关联所选歌曲');
    const tConfirm=Date.now();let last='';
    for(let i=0;i<800;i++){
      await page.waitForTimeout(300);
      const st=await page.evaluate(()=>({btn:document.querySelector('#local-link-confirm')?.textContent,
        dis:document.querySelector('#local-link-confirm')?.disabled,
        status:document.querySelector('#local-status')?.textContent}));
      const sig=`${st.btn}|${st.status}`;
      if(sig!==last){last=sig;log(`+${((Date.now()-tConfirm)/1000).toFixed(1)}s btn="${st.btn}"`);}
      if(!st.dis&&i>2){log(`DONE in ${((Date.now()-tConfirm)/1000).toFixed(1)}s | ${st.status}`);break;}
    }
    log('errors:',JSON.stringify(errors),'posts:',posts);
  }finally{await browser.close();}
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
