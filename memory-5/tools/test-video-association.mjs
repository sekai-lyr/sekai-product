import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync('src/main/resources/static/js/local-player.js','utf8');
const section=source.slice(source.indexOf('    async function addFiles('),source.indexOf('    async function walk('));
function fixture(){
    const tracks=[{id:221,title:'原歌曲',artist:'原歌手',fileName:'song.flac',fileSize:20,videoFileName:'bilibili-221-35833842040.mp4'}];
    const writes=[],lists=[{name:'原歌单',songIds:[221]}];
    const context=vm.createContext({account:{id:3},libraryReady:Promise.resolve(),tracks,playlists:lists,current:-1,status:{},
        sidecars:new Map(),coverFiles:new Map(),lyricHandles:new Map(),handles:new WeakMap(),stem:f=>f.name.replace(/\.[^.]+$/,''),
        URL:{revokeObjectURL(){}},songSelect:{},parser:async()=>async()=>({common:{title:'无关标签',artist:'无关歌手'}}),
        api:async()=>{throw Error('Association must not create songs');},prepare:async t=>{t.ready=true;},
        persistBinding:async t=>writes.push(t.id),persistLyrics:async()=>{},refreshOptions(){},select:async()=>{},
        document:{querySelector:()=>({hidden:true,replaceChildren(){},append(){}}),createElement:()=>({})}});
    vm.runInContext(section,context);return {context,tracks,writes,lists};
}
{
    const {context,writes,tracks,lists}=fixture(),before=JSON.stringify(lists);
    const ids=await context.addFiles([{name:'renamed-video.mp4',size:50,lastModified:1}],true,true,221);
    assert.deepEqual(Array.from(ids),[221]);assert.deepEqual(writes,[221]);assert.equal(tracks.length,1);assert.equal(JSON.stringify(lists),before);
    assert.equal(tracks[0].fileName,'renamed-video.mp4');
    await assert.rejects(context.addFiles([{name:'a.mp4',size:1},{name:'b.mp4',size:1}],true,true,221),/一个|一首/);
    await assert.rejects(context.addFiles([{name:'a.mp4',size:1}],true,true,999),/歌曲|账户/);
}
{
    const {context,writes}=fixture();
    await context.addFiles([{name:'bilibili-221-35833842040.mp4',size:50,lastModified:1}],true);
    assert.deepEqual(writes,[221],'A legacy video must match even when the audio filename differs');
}
console.log('PASS: explicit video binding preserves target/playlist; renamed file accepted only with explicit target; bulk legacy video matched; multiple/unknown targets rejected.');
