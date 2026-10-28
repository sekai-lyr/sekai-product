import {execFileSync} from 'node:child_process';
import {readdirSync,existsSync,statSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseFile} from 'file:///D:/dsh-render/local-player-build/node_modules/music-metadata/lib/index.js';
const sql=`SELECT JSON_OBJECT('id',t.id,'title',t.title,'artist',t.artist,'coverUrl',t.cover_url,'audioUrl',t.audio_url,'lyrics',t.lyric_text,'localAudio',t.local_audio_url,'fileName',b.file_name) FROM sekai_song_track t JOIN sekai_song_playlist_song p ON p.song_id=t.id LEFT JOIN sekai_song_local_binding b ON b.song_id=t.id AND b.user_id=t.user_id WHERE p.playlist_id=24 AND t.user_id=3 ORDER BY t.id`;
export async function audit(){
    const rows=execFileSync('B:/MySQL/bin/mysql.exe',['--user=root','--database=sekai_friend','--default-character-set=utf8mb4','--batch','--raw','--skip-column-names','-e',sql],{encoding:'utf8',maxBuffer:8*1024*1024}).trim().split(/\r?\n/).filter(Boolean).map(row=>JSON.parse(row));
    const roots=[resolve('uploads/audio'),'D:/SekaiSongExternalUploads/memory-5/uploads/audio'].filter(existsSync);
    const files=roots.flatMap(root=>readdirSync(root).filter(name=>/\.(flac|mp3|m4a|wav|ogg|aac|opus)$/i.test(name)).map(name=>({name,path:join(root,name)})));
    const timestamped=text=>typeof text==='string' && /\[\d+:\d{1,2}(?:[.:]\d{1,3})?\]/.test(text);
    const result=[];
    for(const row of rows){
        let file=files.find(file=>file.name===row.fileName) || files.find(file=>file.name===basename(row.localAudio || ''));
        if(!file){const matches=files.filter(file=>new RegExp(`^\\d+-${row.id}-\\d+\\.`).test(file.name));if(matches.length===1)file=matches[0];}
        let lyrics=timestamped(row.lyrics)?row.lyrics:null,source=lyrics?'账户已有同步歌词':null;
        if(file && !lyrics){
            const sidecar=file.path.replace(/\.[^.]+$/,'.lrc');
            if(existsSync(sidecar)){const {readFileSync}=await import('node:fs');const text=readFileSync(sidecar,'utf8');if(timestamped(text)){lyrics=text;source='同名LRC';}}
            if(!lyrics){try{const tags=(await parseFile(file.path,{skipCovers:true,duration:false,skipPostHeaders:true})).common;
                for(const lyric of tags.lyrics || []){const text=typeof lyric==='string'?lyric:lyric.text;if(timestamped(text)){lyrics=text;source='音频内嵌同步歌词';break;}
                    if(lyric.timeStampFormat===2 && lyric.syncText?.length){lyrics=lyric.syncText.filter(line=>Number.isFinite(line.timestamp) && line.text?.trim()).map(line=>`[${String(Math.floor(line.timestamp/60000)).padStart(2,'0')}:${(line.timestamp/1000%60).toFixed(3).padStart(6,'0')}]${line.text}`).join('\n');if(lyrics){source='音频内嵌逐句时间戳';break;}}
                }
            }catch{}}
        }
        result.push({...row,path:file?.path,size:file?statSync(file.path).size:0,lyrics,lyricSource:source});
    }
    return result;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
    const items=await audit();console.log(JSON.stringify({playlist:'顾天鹏（QQ音乐）',songs:items.length,audio:items.filter(item=>item.path).length,lyrics:items.filter(item=>item.lyrics).length,totalBytes:items.reduce((sum,item)=>sum+item.size,0),withLyrics:items.filter(item=>item.lyrics).map(({id,title,artist,size,lyricSource})=>({id,title,artist,size,lyricSource}))}));
}
