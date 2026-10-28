import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

// Deliberately local-only. The server is read solely to recover the original membership.
const base='http://localhost:8085',apply=process.argv.includes('--apply');
if(!process.env.SEKAI_TEST_PASSWORD)throw Error('Missing test login secret');
const sql="SELECT JSON_OBJECT('id',t.id,'title',t.title,'artist',t.artist) FROM sekai_song_playlist_song ps JOIN sekai_song_playlist p ON p.id=ps.playlist_id JOIN sekai_song_track t ON t.id=ps.song_id WHERE p.id=6 AND p.user_id=3 AND t.user_id=3 ORDER BY ps.id;";
const original=execFileSync('ssh',['-i','C:/Users/administration/.ssh/sekai_codex_deploy','-o','BatchMode=yes','-o','ConnectTimeout=15','root@101.37.89.111','mysql --default-character-set=utf8mb4 --batch --raw --skip-column-names sekai_friend'],{input:sql,encoding:'utf8'}).trim().split(/\r?\n/).map(line=>JSON.parse(line));
assert.equal(original.length,118,'Original server playlist changed; stop for review');
const originalIds=new Set(original.map(s=>s.id));assert.equal(originalIds.size,118);
const login=await fetch(base+'/user/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({userName:'sekai',password:process.env.SEKAI_TEST_PASSWORD}),redirect:'manual'});
assert.ok(login.headers.get('location')?.includes('/home'),'Local login failed');
const Cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
async function library(){const r=await fetch(base+'/local-player/library',{headers:{Cookie}});assert.equal(r.status,200);return r.json();}
const before=await library();assert.equal(before.user.name,'sekai');assert.equal(before.user.id,3);
const playlist=before.playlists.find(p=>p.id===6);assert.ok(playlist.name.includes('网易云'));
for(const s of original){assert.ok(playlist.songIds.includes(s.id),'Original membership missing: '+s.id);assert.equal(before.songs.find(t=>t.id===s.id)?.title,s.title,'Local/server song identity differs: '+s.id);}
const removeIds=playlist.songIds.filter(id=>!originalIds.has(id));
if(!apply){console.log(JSON.stringify({dryRun:true,before:playlist.songIds.length,keep:118,removeMemberships:removeIds.length,librarySongs:before.songs.length,otherPlaylists:before.playlists.filter(p=>p.id!==6).map(p=>({id:p.id,name:p.name,songs:p.songIds.length}))}));}
else {
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=join('D:/dsh-render','playlist-repair-20261017-'+stamp);mkdirSync(backup,{recursive:false});
writeFileSync(join(backup,'library-before.json'),JSON.stringify({user:before.user,songs:before.songs,playlists:before.playlists},null,2));
writeFileSync(join(backup,'repair-plan.json'),JSON.stringify({playlistId:6,userId:3,original,removeIds},null,2));
const check=await library();assert.deepEqual(check.songs,before.songs);assert.deepEqual(check.playlists,before.playlists,'Account changed during backup; no changes applied');
let removed=0;
for(const id of removeIds){
 const r=await fetch(`${base}/playlists/6/songs/remove/${id}`,{method:'POST',headers:{Cookie},redirect:'manual'});
 assert.ok([302,303].includes(r.status)&&r.headers.get('location')?.endsWith('/playlists/6'),'Membership removal failed: '+id);
 removed++;if(removed%40===0)console.log(JSON.stringify({removed,total:removeIds.length}));
}
const after=await library(),fixed=after.playlists.find(p=>p.id===6);
assert.deepEqual([...fixed.songIds].sort((a,b)=>a-b),[...originalIds].sort((a,b)=>a-b));
assert.deepEqual(after.songs,before.songs,'Song fields or bindings changed');
assert.deepEqual(after.playlists.filter(p=>p.id!==6),before.playlists.filter(p=>p.id!==6),'Another playlist changed');
writeFileSync(join(backup,'library-after.json'),JSON.stringify({user:after.user,songs:after.songs,playlists:after.playlists},null,2));
const result={before:playlist.songIds.length,after:fixed.songIds.length,removedMemberships:removed,librarySongs:after.songs.length,otherPlaylistsUnchanged:true,songFieldsUnchanged:true,localFilesTouched:false,serverWritten:false,backup};
writeFileSync(join(backup,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
