import {readFileSync,writeFileSync,existsSync,readdirSync,mkdirSync} from 'node:fs';
import {join,basename,extname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),out='D:/dsh-render/video-lrc-20261016';
const {root,results}=JSON.parse(readFileSync(join(out,'audit.json'),'utf8'));
const rows=JSON.parse(readFileSync(join(out,'account-tracks.json'),'utf8'));
const apply=process.argv.includes('--apply'),cache=join(out,'netease-cache');mkdirSync(cache,{recursive:true});
const timed=s=>typeof s==='string'&&(s.match(/\[\d+:\d{2}(?:[.:]\d{1,3})?\]/g)||[]).length>=3;
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function aliases(s){
    const clean=String(s||'').normalize('NFKC').replace(/【[^】]*】/g,'').replace(/\[[^\]]*\]/g,'').trim();
    const main=clean.replace(/\([^)]*\)/g,'').trim(),inside=[...clean.matchAll(/\(([^)]*)\)/g)].map(m=>m[1].trim());
    return [...new Set([clean,main,...inside].filter(v=>normalize(v).length>=3))];
}
async function json(url,key){
    const path=join(cache,key+'.json');if(existsSync(path)){const saved=JSON.parse(readFileSync(path,'utf8'));if(saved.code!==200)throw Error('Provider restricted response '+saved.code);return saved;}
    const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0','Referer':'https://music.163.com/'}});
    if(!response.ok)throw Error('HTTP '+response.status);
    const body=await response.json();writeFileSync(path,JSON.stringify(body));if(body.code!==200)throw Error('Provider restricted response '+body.code);return body;
}
const report=[],known=rows.filter(r=>timed(r.lyrics));
let cursor=0;
async function work(){while(cursor<results.length){
    const item=results[cursor++],row=rows.find(r=>r.id===item.id),video=join(root,item.name),target=join(root,basename(item.name,extname(item.name))+'.lrc');
    const result={id:item.id,title:row?.title,file:target};
    try{
        if(existsSync(target)){result.status=timed(readFileSync(target,'utf8'))?'existing':'existing-invalid';report.push(result);continue;}
        const probe=JSON.parse((await exec('D:/dsh-render/ffmpeg-dl/extracted/ffmpeg-master-latest-win64-gpl/bin/ffprobe.exe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json',video],{timeout:20000,maxBuffer:1024*1024})).stdout);
        const duration=Number(probe.format?.duration);result.videoSeconds=duration;
        const names=aliases(row?.title),normalized=new Set(names.map(normalize));
        let lyrics,source;
        const same=known.filter(r=>r.id===row?.id||aliases(r.title).some(a=>normalized.has(normalize(a))));
        if(same.length===1){lyrics=same[0].lyrics;source={type:'account',songId:same[0].id};}
        if(!lyrics&&probe.streams?.some(s=>s.codec_type==='subtitle'&&['mov_text','subrip','ass','webvtt'].includes(s.codec_name))){
            const value=(await exec('D:/dsh-render/ffmpeg-dl/extracted/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe',['-v','error','-i',video,'-map','0:s:0','-f','lrc','pipe:1'],{timeout:30000,maxBuffer:4*1024*1024})).stdout;
            if(timed(value)){lyrics=value;source={type:'embedded-subtitle'};}
        }
        if(!lyrics&&Number.isFinite(duration)){
            const candidates=new Map();
            for(const name of names.slice(0,2)){
                const key=Buffer.from(name).toString('hex');
                const data=await json('https://music.163.com/api/search/get/web?'+new URLSearchParams({s:name,type:'1',limit:'20',offset:'0'}),'search-'+key);
                for(const song of data.result?.songs||[]){
                    if(!aliases(song.name).some(a=>normalized.has(normalize(a))))continue;
                    const seconds=Number(song.duration??song.dt)/1000,gap=Math.abs(seconds-duration);
                    if(gap<=3)candidates.set(song.id,{id:song.id,title:song.name,artist:(song.artists||song.ar||[]).map(a=>a.name).join('/'),seconds,gap});
                }
            }
            const ranked=[...candidates.values()].sort((a,b)=>a.gap-b.gap);result.candidates=ranked.slice(0,4);
            if(ranked.length&&(!ranked[1]||ranked[1].gap-ranked[0].gap>.8||ranked[1].artist===ranked[0].artist)){
                const best=ranked[0],data=await json(`https://music.163.com/api/song/lyric?id=${best.id}&lv=1&kv=1&tv=-1`,'lyric-'+best.id);
                if(timed(data.lrc?.lyric)){lyrics=data.lrc.lyric;source={type:'netease-duration-match',...best};}
            }
        }
        if(lyrics){
            const times=[...lyrics.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)].map(m=>Number(m[1])*60+Number(m[2])+Number('0.'+(m[3]||'0')));
            if(Math.max(...times)>duration+3){result.status='timing-out-of-range';}
            else{if(apply)writeFileSync(target,lyrics.replace(/^\uFEFF/,'').replace(/\r?\n/g,'\r\n'),{encoding:'utf8',flag:'wx'});
                result.status=apply?'written':'ready';result.source=source;result.timingVerification='title-duration-only; listen to confirm video intro offset';}
        }else result.status='not-found-or-ambiguous';
    }catch(error){result.status='error';result.error=String(error.message);}
    report.push(result);
    if(report.length%20===0)console.log(JSON.stringify({done:report.length,total:results.length,counts:report.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})}));
    writeFileSync(join(out,'fill-report.json'),JSON.stringify(report,null,2));
}}
await Promise.all([work(),work(),work()]);
writeFileSync(join(out,'fill-report.json'),JSON.stringify(report,null,2));
const summary={root,total:results.length,lrcFiles:readdirSync(root).filter(n=>n.endsWith('.lrc')).length,counts:report.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),report:join(out,'fill-report.json')};
writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
