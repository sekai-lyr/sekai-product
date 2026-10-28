import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve, join, basename, extname } from 'node:path';

const root = realpathSync(resolve('uploads/video'));
const out = 'D:/dsh-render/video-lrc-20261016';
mkdirSync(out, { recursive: true });
const query = `SELECT JSON_OBJECT('id',t.id,'title',t.title,'artist',t.artist,'audioUrl',t.audio_url,'video',t.local_video_url,'lyrics',t.lyric_text) FROM sekai_song_track t JOIN sekai_song_user u ON u.id=t.user_id WHERE u.user_name='sekai' ORDER BY t.id;`;
const raw = execFileSync('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=15','-i','C:/Users/administration/.ssh/sekai_codex_deploy','root@101.37.89.111','mysql --default-character-set=utf8mb4 --batch --raw --skip-column-names sekai_friend'], { input: query, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const timed = text => typeof text === 'string' && (text.match(/\[\d+:\d{2}(?:[.:]\d{1,3})?\]/g)||[]).length >= 3;
const names = readdirSync(root).filter(name => /\.(mp4|webm|mov)$/i.test(name));
const mapped = names.map(name => {
    const match = name.match(/^bilibili-(\d+)-(\d+)\./), row = rows.find(r => r.id === Number(match?.[1]));
    return {name,cid:match?.[2],row};
});
const results=[];
for(const item of mapped){
    const target=join(root,basename(item.name,extname(item.name))+'.lrc');
    if(existsSync(target)){results.push({name:item.name,id:item.row?.id,status:timed(readFileSync(target,'utf8'))?'existing':'existing-invalid'});continue;}
    const source=timed(item.row?.lyrics)?item:mapped.find(other=>other.cid===item.cid&&timed(other.row?.lyrics));
    if(source){
        if(process.argv.includes('--apply'))writeFileSync(target,source.row.lyrics.replace(/\r?\n/g,'\r\n'),{encoding:'utf8',flag:'wx'});
        results.push({name:item.name,id:item.row?.id,title:item.row?.title,status:process.argv.includes('--apply')?'written':'ready',sourceSong:source.row.id});
    }else results.push({name:item.name,id:item.row?.id,title:item.row?.title,artist:item.row?.artist,status:item.row?'missing':'unmapped'});
}
writeFileSync(join(out,'account-tracks.json'),JSON.stringify(rows));
writeFileSync(join(out,'audit.json'),JSON.stringify({root,results},null,2));
console.log(JSON.stringify({root,files:names.length,accountSongs:rows.length,statuses:results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),missing:results.filter(r=>r.status==='missing').map(({id,title,artist})=>({id,title,artist})).slice(0,65)},null,2));
