import fs from 'node:fs';
const {ALL_CARDS}=await import('../src/main/resources/static/js/catalog.js');
const {VFX_CARD_PROFILES,AUTHORED_CARD_SCENES}=await import('../src/main/resources/static/js/authored-card-scenes.js');
const traps=ALL_CARDS.filter(c=>c.type==='trap');
const rows=traps.map(c=>({id:c.id,name:c.name,rarity:c.rarity,sheet:VFX_CARD_PROFILES[c.id]?.sheet||null,authored:!!AUTHORED_CARD_SCENES[c.id]}));
const counts={}; for(const r of rows) if(r.sheet) counts[r.sheet]=(counts[r.sheet]||0)+1;
console.log(JSON.stringify({count:rows.length,mapped:rows.filter(x=>x.sheet).length,uniqueSheets:new Set(rows.map(x=>x.sheet).filter(Boolean)).size,reused:Object.entries(counts).filter(([,n])=>n>1),missing:rows.filter(x=>!x.sheet),rows},null,2));

