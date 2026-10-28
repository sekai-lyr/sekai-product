import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({window:{},Date,fetch:async url=>({ok:true,status:200,json:async()=>[{songId:9,deviceId:'device',extension:'.flac'}],text:async()=>'[00:01]test'})});
vm.runInContext(readFileSync('src/main/resources/static/js/device-sharing-player.js','utf8'),context);
const track={id:9,title:'Song',lyrics:'[00:01]test'};
assert.equal(await context.window.SekaiDeviceSources.prepare(track,()=>[{seconds:1,text:'test'}]),true);
assert.equal(track.remote,true);assert.equal(track.ready,true);assert.equal(track.rows.length,1);
assert.equal(track.url,'/api/device-sharing/media/device/9/audio');
const missing={id:10};assert.equal(await context.window.SekaiDeviceSources.prepare(missing,()=>[]),false);
console.log('PASS: remote source preparation uses authenticated streaming URL, keeps lyrics, and rejects missing sources.');
const covered=vm.createContext({window:{},Date,URL:{createObjectURL:()=> 'blob:remote-cover',revokeObjectURL:()=>{}},fetch:async url=>{
    if(url.endsWith('/sources'))return {ok:true,json:async()=>[{songId:9,deviceId:'device',extension:'.wav'}]};
    if(url.endsWith('/cover'))return {ok:true,headers:{get:()=> '4'},blob:async()=>({size:4})};
    return {ok:true};
}});
vm.runInContext(readFileSync('src/main/resources/static/js/device-sharing-player.js','utf8'),covered);
const withCover={id:9,lyrics:'test'};await covered.window.SekaiDeviceSources.prepare(withCover,()=>[{seconds:0,text:'test'}]);
assert.equal(withCover.cover,'blob:remote-cover','Remote sidecar cover must be available without a browser file association');

const scoped=vm.createContext({window:{},Date,fetch:async url=>({ok:true,status:200,json:async()=>[{songId:9,deviceId:'device',extension:'.flac',videoExtension:'.mp4',playlistId:4}]})});
vm.runInContext(readFileSync('src/main/resources/static/js/device-sharing-player.js','utf8'),scoped);
assert.equal(await scoped.window.SekaiDeviceSources.prepare({id:9,playlistId:5},()=>[]),false,'Another playlist must not reuse a shared file');
const own={id:9,playlistId:4};
assert.equal(await scoped.window.SekaiDeviceSources.prepare(own,()=>[]),true);
assert.equal(own.remoteVideoUrl,'/api/device-sharing/media/device/9/video');
console.log('PASS: device source is scoped to its playlist and exposes the paired video.');
