import {audit} from './audit-qq-test-pack.mjs';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {parseFile} from 'file:///D:/dsh-render/local-player-build/node_modules/music-metadata/lib/index.js';
const dir='D:/dsh-render/qq-pack-assets';
mkdirSync(dir,{recursive:true});
const rows=await audit();
if(rows.length!==135 || rows.some(r=>!r.path))throw Error('音频数量或路径不完整，停止');
const entries=[];let lyrics=0,covers=0,index=0;
async function work(){
 while(index<rows.length){
  const r=rows[index++];const stem=`${r.id} - ${r.title} - ${r.artist}`.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150).replace(/[. ]+$/,'');
  entries.push({path:r.path,name:stem+'.flac',size:r.size});
  const lp=dir+'/'+stem+'.lrc';
  if(!r.lyrics && existsSync(lp))r.lyrics=readFileSync(lp,'utf8');
  if(!r.lyrics){
   const id=r.audioUrl?.match(/[?&]songid=(\d+)/i)?.[1] || r.audioUrl?.match(/^\d+$/)?.[0];
   const mid=r.audioUrl?.match(/songDetail\/([A-Za-z0-9]+)/)?.[1];
   if(id||mid){try{
    const payload={comm:{ct:24,cv:0},lyric:{method:'GetPlayLyricInfo',module:'music.musichallSong.PlayLyricInfo',param:{songMID:mid||'',songID:Number(id||0),qrc:0,roma:0,trans:1}}};
    const url='https://u.y.qq.com/cgi-bin/musicu.fcg?data='+encodeURIComponent(JSON.stringify(payload));
    const response=await fetch(url,{headers:{Referer:'https://y.qq.com/','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});
    const data=(await response.json()).lyric?.data;const text=data?.lyric?.includes('[')?data.lyric:Buffer.from(data?.lyric||'','base64').toString('utf8');
    if(/\[\d+:\d{2}(?:[.:]\d+)?\]/.test(text)){r.lyrics=text;r.lyricSource='QQ对应songid';}
   }catch{}}
  }
  if(r.lyrics){writeFileSync(lp,r.lyrics,'utf8');entries.push({path:lp,name:stem+'.lrc'});lyrics++;}
  const cp=dir+'/'+stem+'.png';
  try{if(!existsSync(cp)){const m=await parseFile(r.path,{duration:false,skipPostHeaders:true});let image=m.common.picture?.[0]?.data;
   if(!image && r.coverUrl?.startsWith('/uploads/')){const path=process.cwd()+r.coverUrl;if(existsSync(path))image=readFileSync(path);}
   if(!image && /^https?:/.test(r.coverUrl||'')){const response=await fetch(r.coverUrl,{signal:AbortSignal.timeout(12000)});if(response.ok)image=Buffer.from(await response.arrayBuffer());}
   if(image)execFileSync('D:/dsh-render/ffmpeg-dl/extracted/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe',['-v','error','-i','pipe:0','-frames:v','1',cp],{input:image,timeout:30000});}
   if(existsSync(cp)){entries.push({path:cp,name:stem+'.png'});covers++;}
  }catch{}
  console.log(JSON.stringify({done:rows.filter(x=>x.done).length+1,id:r.id,lyrics:!!r.lyrics,cover:existsSync(cp)}));r.done=true;
 }
}
await Promise.all([work(),work(),work()]);
const report={songs:rows.length,lyrics,covers,missingLyrics:rows.filter(r=>!r.lyrics).map(({id,title,artist})=>({id,title,artist})),missingCovers:rows.filter(r=>!entries.some(e=>e.name.startsWith(r.id+' - ')&&e.name.endsWith('.png'))).map(({id,title})=>({id,title}))};
const rp=dir+'/打包清单.json';writeFileSync(rp,JSON.stringify(report,null,2));entries.push({path:rp,name:'打包清单.json'});
const readme=dir+'/使用说明.txt';writeFileSync(readme,'解压后，在网站选择关联本地文件夹，选择解压目录，再导入歌曲库或歌单。音频保存在使用者本机。\n本包包含全部135首原始FLAC。歌词和封面覆盖率见打包清单.json；缺失歌词没有伪造。\n仅供私人测试，请勿公开传播。');entries.push({path:readme,name:'使用说明.txt'});
writeFileSync(dir+'/entries.json',JSON.stringify(entries));console.log(JSON.stringify(report));
