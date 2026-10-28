import { readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFile } from 'file:///D:/dsh-render/local-player-build/node_modules/music-metadata/lib/index.js';
const base='http://localhost:8085';
const password=process.env.SEKAI_TEST_PASSWORD;if(!password)throw new Error('SEKAI_TEST_PASSWORD is required');
const login=await fetch(base+'/user/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({userName:'sekai',password}),redirect:'manual'});
if(!login.headers.get('location')?.includes('/home'))throw new Error('Login failed');
const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const library=await (await fetch(base+'/local-player/library',{headers:{Cookie:cookie}})).json();
if(library.user?.name!=='sekai')throw new Error('Wrong account');
const roots=[resolve('uploads/audio'),'D:/SekaiSongExternalUploads/memory-5/uploads/audio'];
const files=roots.filter(existsSync).flatMap(root=>readdirSync(root).filter(name=>/\.(flac|mp3|m4a|wav|ogg|aac|opus)$/i.test(name)).map(name=>({name,path:join(root,name)})));
const normalize=v=>String(v || '').normalize('NFKC').toLowerCase().replace(/\s/g,'');
const references=[],missing=[];
for(const song of library.songs){
 let found=files.find(f=>f.name===song.fileName);
 if(!found && song.fileName){
  const candidates=files.filter(f=>new RegExp(`^\\d+-${song.id}-\\d+\\.`).test(f.name));
  if(candidates.length===1){
   const tags=(await parseFile(candidates[0].path,{skipCovers:true,duration:false,skipPostHeaders:true})).common;
   if(normalize(tags.title)===normalize(song.title) && normalize(tags.artist)===normalize(song.artist))found=candidates[0];
  }
 }
 if(!found){if(song.fileName)missing.push({id:song.id,fileName:song.fileName});continue;}
 const stat=statSync(found.path);
 const file={fileName:found.name,fileSize:stat.size,lastModified:Math.trunc(stat.mtimeMs)};
 const response=await fetch(`${base}/local-player/library/songs/${song.id}/binding`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-Local-Library-CSRF':library.csrf},body:JSON.stringify(file)});
 if(!response.ok)throw new Error(`Binding failed for song ${song.id}: ${response.status}`);
 references.push({id:song.id,...file});
}
const after=await (await fetch(base+'/local-player/library',{headers:{Cookie:cookie}})).json();
if(after.songs.length!==library.songs.length)throw new Error('Unexpected song count change');
writeFileSync('D:/dsh-render/deploy-20261011/sekai-local-references.json',JSON.stringify({userId:library.user.id,references},null,2));
const sql=references.map(file=>{
 if(!/^[a-zA-Z0-9_.-]+$/.test(file.fileName))throw new Error('Unexpected legacy filename');
 return `INSERT INTO sekai_song_local_binding(song_id,user_id,file_name,file_size,last_modified,preferences_json) SELECT id,user_id,'${file.fileName}',${file.fileSize},${file.lastModified},JSON_OBJECT() FROM sekai_song_track WHERE id=${file.id} AND user_id=${library.user.id} ON DUPLICATE KEY UPDATE file_name=VALUES(file_name),file_size=VALUES(file_size),last_modified=VALUES(last_modified);`;
}).join('\n');
writeFileSync('D:/dsh-render/deploy-20261011/sekai-local-references.sql',sql);
writeFileSync('D:/dsh-render/deploy-20261011/sekai-local-binding-report.json',JSON.stringify({account:'sekai',songs:library.songs.length,bound:references.length,unavailable:missing},null,2));
console.log(JSON.stringify({account:'sekai',songs:library.songs.length,bound:references.length,unavailable:missing.length,audioUploaded:false}));
