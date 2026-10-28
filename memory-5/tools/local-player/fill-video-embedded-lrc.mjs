import {parseFile} from 'file:///D:/dsh-render/local-player-build/node_modules/music-metadata/lib/index.js';
import {readFileSync,writeFileSync,readdirSync,existsSync,realpathSync} from 'node:fs';
import {join,basename,extname} from 'node:path';
const out='D:/dsh-render/video-lrc-20261016',audit=JSON.parse(readFileSync(join(out,'audit.json'),'utf8'));
const cloud=JSON.parse(readFileSync(join(out,'fill-report.json'),'utf8'));
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const names=s=>{s=String(s||'').normalize('NFKC').replace(/【[^】]*】/g,'');return [s,s.replace(/\([^)]*\)/g,''),...[...s.matchAll(/\(([^)]*)\)/g)].map(m=>m[1])].map(norm).filter(s=>s.length>=3);};
const timed=s=>typeof s==='string'&&(s.match(/\[\d+:\d{2}(?:[.:]\d{1,3})?\]/g)||[]).length>=3;
const sources=[],audioMetadata=new Map(),visited=new Set();let scanned=0;
for(const root of ['D:/SekaiSongExternalUploads/memory-5/uploads/audio','D:/Sekai_Song/audio']){
    if(!existsSync(root))continue;
    const actual=realpathSync(root);if(visited.has(actual))continue;visited.add(actual);
    for(const name of readdirSync(root).filter(n=>/\.(flac|mp3|m4a)$/i.test(n))){
        scanned++;
        try{
            const file=join(root,name),data=await parseFile(file,{skipCovers:true,duration:false,skipPostHeaders:true});
            const id=name.match(/^\d+-(\d+)-/);if(id)audioMetadata.set(Number(id[1]),{title:data.common.title,artist:data.common.artist,duration:data.format.duration});
            let lyrics;
            for(const value of data.common.lyrics||[]){
                const text=typeof value==='string'?value:value.text;
                if(timed(text)){lyrics=text;break;}
                if(value.timeStampFormat===2&&value.syncText?.length){
                    const text=value.syncText.filter(l=>Number.isFinite(l.timestamp)&&l.text?.trim()).map(l=>`[${String(Math.floor(l.timestamp/60000)).padStart(2,'0')}:${(l.timestamp/1000%60).toFixed(3).padStart(6,'0')}]${l.text}`).join('\n');
                    if(timed(text)){lyrics=text;break;}
                }
            }
            const sidecar=join(root,basename(name,extname(name))+'.lrc');if(!lyrics&&existsSync(sidecar)){const v=readFileSync(sidecar,'utf8');if(timed(v))lyrics=v;}
            if(lyrics)sources.push({file,title:data.common.title,artist:data.common.artist,duration:data.format.duration,lyrics});
        }catch{}
    }
}
const pack='D:/dsh-render/qq-pack-assets',account=JSON.parse(readFileSync(join(out,'account-tracks.json'),'utf8'));
if(existsSync(pack))for(const name of readdirSync(pack).filter(n=>n.endsWith('.lrc'))){
    const id=Number(name.match(/^(\d+) - /)?.[1]),row=account.find(r=>r.id===id),meta=audioMetadata.get(id);
    const file=join(pack,name),lyrics=readFileSync(file,'utf8');
    if(row&&meta&&timed(lyrics))sources.push({file,title:row.title,artist:row.artist,duration:meta.duration,lyrics});
}
writeFileSync(join(out,'embedded-sources.json'),JSON.stringify(sources));
let added=0;const matches=[];
for(const item of cloud){
    const video=audit.results.find(r=>r.id===item.id),target=join(audit.root,basename(video.name,extname(video.name))+'.lrc');
    if(existsSync(target)||!Number.isFinite(item.videoSeconds))continue;
    const aliases=names(item.title),choices=sources.filter(s=>names(s.title).some(n=>aliases.includes(n))&&Math.abs(s.duration-item.videoSeconds)<=3);
    const unique=[...new Map(choices.map(s=>[s.lyrics,s])).values()];
    if(unique.length!==1)continue;
    const source=unique[0],times=[...source.lyrics.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)].map(m=>Number(m[1])*60+Number(m[2])+Number('0.'+(m[3]||'0')));
    if(Math.max(...times)>item.videoSeconds+3)continue;
    writeFileSync(target,source.lyrics.replace(/\r?\n/g,'\r\n'),{encoding:'utf8',flag:'wx'});added++;
    matches.push({id:item.id,title:item.title,file:target,source:source.file,gap:Math.abs(source.duration-item.videoSeconds),verification:'title-duration; listen to confirm video intro offset'});
}
writeFileSync(join(out,'embedded-matches.json'),JSON.stringify(matches,null,2));
console.log(JSON.stringify({scanned,withSynchronizedLyrics:sources.length,added,totalLrc:readdirSync(audit.root).filter(n=>n.endsWith('.lrc')).length}));
