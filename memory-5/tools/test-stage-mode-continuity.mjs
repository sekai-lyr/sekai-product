import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Removing the continuation guard in select must fail this regression.
const source=readFileSync('src/main/resources/static/js/local-player.js','utf8');
const select=source.slice(source.indexOf('    async function select('),source.indexOf('    function changeMode('));
const restore=source.slice(source.indexOf('    function restorePreferences('),source.indexOf('    const preferenceTimers='));
const storage=new Map();
const context=vm.createContext({
    tracks:[{file:{name:'first.mp3'},preferences:{stageMode:'disc'}},{file:{name:'second.mp3'},preferences:{stageMode:'folia-sonnet'}}],
    current:-1,generation:0,modeSelect:{value:'lyrics'},songSelect:{},status:{},
    modes:['disc','lyrics','folia-sonnet','derived-stars'],
    frame:{contentDocument:null},window:{__sekaiLocalPlayer:{track:null}},
    savePreferences(){},prepare:async()=>{},refreshOptions(){},restorePreferences(){},
    unavailable(){throw Error('Unexpected unavailable file');}
    ,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))}
});
vm.runInContext(restore+select+`
    function render(){window.__sekaiLocalPlayer.track=tracks[current];}
    globalThis.pick=select;
`,context);
context.tracks[0].preferences.volume=.2;context.tracks[0].preferences.rate=1.25;context.tracks[0].preferences.playMode='shuffle';
context.tracks[1].key='second';
Object.assign(context.tracks[1].preferences,{volume:.9,rate:2,playMode:'repeat-one',bookmarks:[{time:12}],loopA:3,loopB:8});
await context.pick(0,true);
assert.equal(storage.get('sekai.player.volume'),'0.2');
storage.set('sekai.player.volume','0.45');storage.set('sekai.player.playbackRate','1.5');storage.set('sekai.player.playMode','sequence');
assert.equal(context.modeSelect.value,'disc','First open can restore the song setting');
context.modeSelect.value='derived-stars';
await context.pick(1,true);
assert.equal(storage.get('sekai.player.volume'),'0.45','Next song keeps adjusted volume');
assert.equal(storage.get('sekai.player.playbackRate'),'1.5','Next song keeps speed');
assert.equal(storage.get('sekai.player.playMode'),'sequence','Next song keeps playback order');
assert.equal(storage.get('sekai.player.bookmarks.second'),'[{"time":12}]','Bookmarks still belong to the selected song');
assert.equal(storage.get('sekai.player.loop.second'),'{"a":3,"b":8}','AB loop remains song-specific');
assert.equal(context.modeSelect.value,'derived-stars','Next song must keep the current performance');
await context.pick(0,true);
assert.equal(context.modeSelect.value,'derived-stars','Previous song must keep the current performance');
context.modeSelect.value='lyrics';
await context.pick(1,true);
assert.equal(context.modeSelect.value,'lyrics','A manual mode change must carry into subsequent songs');
assert.equal(context.tracks[1].preferences.stageMode,'folia-sonnet','Selecting a song must not mutate its saved settings directly');
console.log('PASS: initial restore, next/previous continuity, manual change continuity; saved settings preserved.');
