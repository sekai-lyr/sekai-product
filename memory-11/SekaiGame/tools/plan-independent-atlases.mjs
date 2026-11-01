import fs from 'node:fs';
import {ALL_CARDS} from '../src/main/resources/static/js/catalog.js';
import {VFX_CARD_PROFILES} from '../src/main/resources/static/js/authored-card-scenes.js';
const live=await(await fetch('http://127.0.0.1:8091/api/cards')).json();
const groups={};for(const c of live){const s=VFX_CARD_PROFILES[c.id]?.sheet;if(s)(groups[s]??=[]).push(c.id)}
const tasks=live.filter(c=>!VFX_CARD_PROFILES[c.id]||groups[VFX_CARD_PROFILES[c.id].sheet][0]!==c.id).map(c=>{const local=ALL_CARDS.find(x=>x.id===c.id);return{id:c.id,name:local?.name||c.name,type:c.type,description:local?.description||c.description,sheet:`independent-${c.id.replaceAll('_','-')}-sheet-v1.png`,reason:VFX_CARD_PROFILES[c.id]?'shared':'missing'}});
fs.writeFileSync('tools/independent-atlas-tasks.json',JSON.stringify(tasks,null,2));console.log(JSON.stringify({count:tasks.length,monster:tasks.filter(c=>c.type==='monster').length,spell:tasks.filter(c=>c.type==='spell').length,first:tasks.slice(0,3)},null,2));
