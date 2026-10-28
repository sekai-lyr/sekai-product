import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync('src/main/resources/static/js/local-player.js', 'utf8');
const start = source.indexOf('    async function addFiles(');
const end = source.indexOf('    async function walk(', start);
const tracks = [1, 2, 3].map(id => ({ id, fileName: `${id}.flac`, fileSize: 10, title: `Song ${id}`, artist: 'Singer' }));
const playlists = [{name:'网易云',songIds:[1,2]}, {name:'QQ音乐',songIds:[2,3]}, {name:'其他',songIds:[1]}];
const before = JSON.stringify(playlists), writes = [], resultItems = [];
const prepared=[];
const status = {textContent:''};
const progress=[];let currentStatus='';
Object.defineProperty(status,'textContent',{get:()=>currentStatus,set:value=>{currentStatus=value;progress.push(value);}});
const context = vm.createContext({
    account:{id:2},libraryReady:Promise.resolve(),tracks,playlists,current:-1,status,
    sidecars:new Map(),coverFiles:new Map(),lyricHandles:new Map(),handles:new WeakMap(),
    stem:file=>file.name,URL:{revokeObjectURL(){}},songSelect:{},
    parser:async()=>async()=>({common:{title:'Unknown',artist:'Unknown'}}),
    api:async()=>{throw Error('Linking must not create songs or modify playlists');},
    prepare:async track=>{prepared.push(track.id);track.ready=true;},persistBinding:async track=>writes.push(track.id),
    refreshOptions(){},select:async()=>{},
    document:{querySelector:selector=>selector==='#local-link-results'?{replaceChildren(){resultItems.length=0;},append(item){resultItems.push(item.textContent);}}:{hidden:true},createElement:()=>({textContent:''})}
});
vm.runInContext(source.slice(start,end),context);
await context.addFiles([1,2,3,4].map(id=>({name:`${id}.flac`,size:10,lastModified:1})),true);
assert.deepEqual(writes,[1,2,3]);
assert.deepEqual(prepared,[],'Bulk linking known filenames must not parse every media file before playback');
assert.equal(JSON.stringify(playlists),before);
assert.equal(tracks.length,3);
assert.match(resultItems[0],/2\/2/);assert.match(resultItems[1],/2\/2/);assert.match(resultItems[2],/1\/1/);
assert.match(status.textContent,/1 个文件未匹配/);
assert.ok(progress.some(text=>/正在关联.*1\/4/.test(text)),'Bulk association must report visible progress before completion');
context.account=null;
await assert.rejects(context.addFiles([],true),/请先登录/);
console.log('PASS: mixed directory links three existing playlists; shared songs preserved; unknown files skipped; no song/playlist creation; login required.');
