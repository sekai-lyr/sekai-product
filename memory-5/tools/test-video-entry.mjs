import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let replacement;
const form={action:'http://localhost:8085/songs/video/221',querySelector:()=>({value:'/playlists/6'}),replaceWith:box=>{replacement=box;}};
const context=vm.createContext({URL,URLSearchParams,location:{href:'http://localhost:8085/playlists/6'},document:{
    querySelectorAll:()=>[form],createElement:tag=>({tag,children:[],append(...items){this.children.push(...items);}})
}});
vm.runInContext(readFileSync('src/main/resources/static/js/local-upload-links.js','utf8'),context);
const link=replacement.children.find(child=>child.tag==='a');
const url=new URL(link.href,'http://localhost:8085');
assert.equal(url.pathname,'/player/221');assert.equal(url.searchParams.get('playlistId'),'6');assert.equal(url.searchParams.get('media'),'video');
assert.match(link.textContent,/关联.*视频/);
console.log('PASS: legacy video entry retains song, playlist and video context without uploading binaries.');
