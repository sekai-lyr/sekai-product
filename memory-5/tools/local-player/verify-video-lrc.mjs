import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {join,basename,extname} from 'node:path';
const out='D:/dsh-render/video-lrc-20261016',audit=JSON.parse(readFileSync(join(out,'audit.json'),'utf8'));
const prior=JSON.parse(readFileSync(join(out,'fill-report.json'),'utf8'));
const invalid=[],missing=[],present=[];
for(const item of audit.results){
    const name=basename(item.name,extname(item.name))+'.lrc',file=join(audit.root,name);
    if(existsSync(file)){
        const text=readFileSync(file,'utf8'),count=(text.match(/\[\d+:\d{2}(?:[.:]\d{1,3})?\]/g)||[]).length;
        if(count<3)invalid.push(name);else present.push({id:item.id,title:item.title,name,timedLines:count});
    }else{
        const old=prior.find(r=>r.id===item.id),title=String(item.title||'').normalize('NFKC').replace(/【[^】]*】/g,'').replace(/\[[^\]]*\]/g,'').trim();
        const alias=[title,title.replace(/\([^)]*\)/g,'').trim(),...[...title.matchAll(/\(([^)]*)\)/g)].map(m=>m[1].trim())].filter(v=>v.replace(/[^\p{L}\p{N}]/gu,'').length>=3).slice(0,2);
        const restricted=alias.some(n=>{const path=join(out,'netease-cache','search-'+Buffer.from(n).toString('hex')+'.json');return existsSync(path)&&JSON.parse(readFileSync(path,'utf8')).code!==200;});
        missing.push({id:item.id,title:item.title,name,reason:restricted?'provider-restricted':old?.status||'missing',candidates:old?.candidates});
    }
}
const summary={root:audit.root,videos:audit.results.length,validLrc:present.length,invalid,missing:missing.length,providerRestricted:missing.filter(r=>r.reason==='provider-restricted').length};
writeFileSync(join(out,'verification.json'),JSON.stringify({summary,present,missing},null,2));
writeFileSync(join(audit.root,'LRC补充清单-20261016.json'),JSON.stringify({summary,present,missing},null,2));
console.log(JSON.stringify(summary));
if(invalid.length)process.exitCode=1;
