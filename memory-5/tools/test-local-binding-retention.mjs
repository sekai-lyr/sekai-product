import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// A temporary File selection must not erase an existing persistent handle.
const source=readFileSync('src/main/resources/static/js/local-player.js','utf8');
const code=source.slice(source.indexOf('    async function persistBinding('),source.indexOf('    async function persistLyrics('));
const audio={name:'song.flac'};
const saved={audio,fileName:'song.flac',fileSize:42,lastModified:12};
const records=new Map([['user:3:song:9',saved]]);
let failApi=false;
const context=vm.createContext({account:{id:3},referenceKey:()=> 'user:3:song:9',
    remembered:async function(key,value){if(arguments.length>1)records.set(key,value);return records.get(key);},
    api:async()=>{if(failApi)throw Error('Network unavailable');},bindingPlaylistId:()=>null});
vm.runInContext(code+';globalThis.save=persistBinding;',context);
await context.save({id:9,file:{name:'song.flac',size:42,lastModified:12}});
assert.equal(records.get('user:3:song:9')?.audio,audio,'File-input fallback must preserve matching saved audio handle');
const replacement={name:'other.flac'};
failApi=true;
await assert.rejects(context.save({id:9,file:{name:'other.flac',size:50,lastModified:15},handle:replacement}));
assert.equal(records.get('user:3:song:9')?.audio,replacement,'A failed cloud metadata save must not discard the local file grant');
failApi=false;
await context.save({id:9,file:{name:'different.flac',size:60,lastModified:20}});
assert.equal(records.get('user:3:song:9')?.audio,undefined,'Never reuse a handle for a different selected file');
console.log('PASS: matching handles survive fallback selection; local grants survive cloud failures; different files do not reuse stale handles.');

// One song can belong to two website playlists without sharing a file handle.
const keyCode=source.slice(source.indexOf('    const bindingPlaylistId='),source.indexOf('    async function loadBindings(){'));
const selected={value:'11'};
const scoped=vm.createContext({account:{id:3},playlistSelect:selected});
vm.runInContext(keyCode+';globalThis.keyFor=referenceKey;',scoped);
assert.equal(scoped.keyFor({id:9}),'user:3:playlist:11:song:9');
selected.value='12';
assert.equal(scoped.keyFor({id:9}),'user:3:playlist:12:song:9');
assert.equal(scoped.keyFor({id:9},null),'user:3:song:9');
console.log('PASS: the same song uses separate browser bindings in two playlists.');
