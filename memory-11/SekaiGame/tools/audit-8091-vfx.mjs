import fs from 'node:fs';
import crypto from 'node:crypto';
import {VFX_CARD_PROFILES,DEDICATED_PROCEDURAL_SPELLS} from '../src/main/resources/static/js/authored-card-scenes.js';
const base='http://127.0.0.1:8091';
const cards=await (await fetch(base+'/api/cards')).json();
const source=await (await fetch(base+'/js/authored-card-scenes.js')).text();
const local=fs.readFileSync('src/main/resources/static/js/authored-card-scenes.js','utf8');
const groups={};for(const c of cards){const s=VFX_CARD_PROFILES[c.id]?.sheet;if(s)(groups[s]??=[]).push(c.id)}
const assets={};const files=Object.keys(groups);let cursor=0;
await Promise.all(Array.from({length:6},async()=>{while(cursor<files.length){const s=files[cursor++];const r=await fetch(base+'/images/vfx/'+s);const b=Buffer.from(await r.arrayBuffer());assets[s]={status:r.status,sha:crypto.createHash('sha256').update(b).digest('hex')};}}));
const rows=cards.map(c=>{const sheet=VFX_CARD_PROFILES[c.id]?.sheet;return {id:c.id,name:c.name,type:c.type,sheet:sheet||null,sharedWith:sheet?groups[sheet].filter(id=>id!==c.id):[],procedural:DEDICATED_PROCEDURAL_SPELLS[c.id]||null,http:sheet?assets[sheet].status:null}});
const report={liveModuleMatchesDisk:source===local,total:cards.length,byType:Object.fromEntries([...new Set(cards.map(c=>c.type))].map(t=>{const a=rows.filter(c=>c.type===t);return[t,{total:a.length,mapped:a.filter(c=>c.sheet).length,exclusive:a.filter(c=>c.sheet&&!c.sharedWith.length).length,missing:a.filter(c=>!c.sheet).length}]})),uniqueSheets:files.length,missing:rows.filter(c=>!c.sheet),shared:rows.filter(c=>c.sharedWith.length),badHttp:rows.filter(c=>c.sheet&&c.http!==200),assets,rows};
fs.writeFileSync('tools/8091-vfx-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,assets:undefined,rows:undefined},null,2));
