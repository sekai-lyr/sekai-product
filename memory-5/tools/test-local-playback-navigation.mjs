import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Detect resuming a completed target, replaying stale ended events, and concurrent moves.
const stageSource=readFileSync('src/main/resources/static/js/local-stage.js','utf8');
const metadata=stageSource.slice(stageSource.indexOf("    audio.addEventListener('loadedmetadata'"),stageSource.indexOf("    audio.addEventListener('pause'"));
const ended=stageSource.slice(stageSource.indexOf("    audio.addEventListener('ended'"),stageSource.indexOf('    for(const [action,handler]'));
const handlers={},track={key:'one',restore:{time:9999,playing:true}};
let advances=0;
const ctx=vm.createContext({track,player:{track,next:()=>advances++},window:{},localStorage:{getItem:()=>null},audio:{duration:120,currentTime:0,addEventListener:(name,fn)=>handlers[name]=fn,play:()=>Promise.resolve()}});
vm.runInContext(metadata+ended,ctx);
handlers.loadedmetadata();
assert.equal(ctx.audio.currentTime,0,'Completed saved progress must restart at zero, not at duration-.05');
ctx.player.track={key:'two'};
handlers.ended({stopImmediatePropagation(){}});
assert.equal(advances,0,'A discarded stage must not advance the new song');
ctx.player.track=track;
handlers.ended({stopImmediatePropagation(){}});
assert.equal(advances,1,'The active stage can advance once');

const source=readFileSync('src/main/resources/static/js/local-player.js','utf8');
const select=source.slice(source.indexOf('    async function select('),source.indexOf('    function changeMode('));
const selection=vm.createContext({tracks:[{id:1,key:'one',file:{},preferences:{position:5}},{id:2,key:'two',file:{},preferences:{position:120}}],current:0,generation:0,modeSelect:{value:'disc'},modes:['disc'],songSelect:{},status:{},frame:{contentDocument:null},window:{__sekaiLocalPlayer:{track:{key:'one'}}},savePreferences(){},prepare:async()=>{},refreshOptions(){},restorePreferences(){},unavailable(){throw Error('Unavailable');},render:state=>selection.rendered=state});
vm.runInContext(select+'globalThis.pick=select;',selection);
await selection.pick(1,true);
assert.equal(selection.rendered.time,0,'Selecting another song must start it at zero');

const move=source.slice(source.indexOf('    async function move('),source.indexOf('    window.__sekaiLocalPlayer='));
let release,calls=0;
const movement=vm.createContext({moving:false,localStorage:{getItem:()=>null},tracks:[{availability:'linked'},{availability:'linked'}],current:0,visible:()=>[0,1],status:{},select:()=>{calls++;return new Promise(resolve=>release=resolve);}});
vm.runInContext(move+'globalThis.move=move;',movement);
const first=movement.move(1),second=movement.move(1);
assert.equal(calls,1,'Concurrent next calls must not launch multiple selections');
release(true);await Promise.all([first,second]);
console.log('PASS: completed resume restarts, stale ended ignored, new song starts at zero, next is single-flight.');
