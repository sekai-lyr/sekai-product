import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('src/main/resources/static/js/local-player.js','utf8');
const start=source.indexOf("    document.querySelector('#local-restore').addEventListener");
const end=source.indexOf("    for (const id of ['local-files'",start);
let restore;
const button={hidden:false};
let scanned=0;
let permission='prompt';
const root={queryPermission:async()=>permission,requestPermission:async()=>{permission='granted';return permission;}};
const track={availability:'permission',handle:{queryPermission:async()=>permission,getFile:async()=>({name:'song.flac'})}};
const context=vm.createContext({document:{querySelector:()=>({...button,addEventListener:(_,callback)=>{restore=callback;}})},
    libraryReady:Promise.resolve(),account:{id:3},remembered:async()=>[root],tracks:[track],
    linkDirectory:async()=>{scanned++;},refreshOptions(){},status:{},playbackPage:false,current:0});
vm.runInContext(source.slice(start,end),context);
await restore();
assert.equal(scanned,0,'Restoring existing handles must not scan and rematch the entire directory');
assert.equal(track.availability,'linked');
permission='denied';
root.requestPermission=async()=>'denied';
track.handle.requestPermission=async()=>'denied';
await restore();
assert.equal(track.availability,'permission','Denied permission must remain recoverable, not delete the song');
assert.equal(scanned,0);
console.log('PASS: permission restoration reuses stored handles without rescanning or removing songs.');

const load=source.slice(source.indexOf('    async function loadLibrary('),source.indexOf('    async function addFiles('));
const elements=new Map();
const getElement=key=>{if(!elements.has(key))elements.set(key,{append(){},hidden:true});return elements.get(key);};
const savedHandle={queryPermission:async()=>'granted',getFile:async()=>({name:'song.flac'})};
const saved=new Map([['user:3:song:9',{audio:savedHandle,fileName:'song.flac',fileSize:42}]]);
const reload=vm.createContext({fetch:async()=>({ok:true,json:async()=>({user:{id:3,name:'sekai'},csrf:'token',playlists:[],songs:[{id:9}]})}),
    remembered:async key=>saved.get(key),referenceKey:track=>`user:3:song:${track.id}`,
    document:{querySelector:getElement,body:{dataset:{}}},playlistSelect:{append(){}},importTarget:{append(){}},
    Option:function(){},refreshOptions(){},status:{},URLSearchParams,location:{search:''},modes:[],requestedSongId:null,
    account:null,csrf:'',playlists:[],tracks:[],window:{}});
vm.runInContext(load+';globalThis.reloadLibrary=loadLibrary;',reload);
await reload.reloadLibrary();
assert.equal(reload.tracks[0].availability,'linked');
assert.equal(reload.tracks[0].handle,savedHandle);
await reload.reloadLibrary();
assert.equal(reload.tracks[0].availability,'linked','Loading the same account again must reuse its saved handle');
console.log('PASS: repeated account loading restores saved accessible handles automatically.');
