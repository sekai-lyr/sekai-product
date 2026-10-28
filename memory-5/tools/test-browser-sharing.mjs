import test from 'node:test';
import assert from 'node:assert/strict';
const modulePath='../src/main/resources/static/js/browser-sharing.mjs';
test('browser sharing matches only owned songs, sidecars and rejects ambiguous media',async()=>{
    const {buildIndex}=await import(modulePath);
    const file=(name,path,content)=>{const f=new File([content],name,{lastModified:123});return {file:f,path};};
    const files=[file('song.wav','album/song.wav','abc'),file('song.lrc','album/song.lrc','[00:00]test'),file('song.png','album/song.png','png'),
        file('duplicate.mp3','a/duplicate.mp3','abc'),file('duplicate.mp3','b/duplicate.mp3','abc'),file('other.mp3','other.mp3','private')];
    const result=await buildIndex({files,songs:[{id:9,fileName:'song.wav',fileSize:3},{id:10,fileName:'duplicate.mp3',fileSize:3},{id:11,fileName:'missing.mp3'}]});
    assert.deepEqual(result.index.files.map(f=>[f.songId,f.kind]),[[9,'audio'],[9,'lyric'],[9,'cover']]);
    assert.deepEqual(result.ambiguous,[10]);assert.deepEqual(result.missing,[11]);
});
test('a remembered browser handle is checked again before each read',async()=>{
    const {readSource}=await import(modulePath);
    let file=new File(['abc'],'song.wav',{lastModified:123}),permission='granted';
    const entry={size:3,lastModified:123,handle:{queryPermission:async()=>permission,getFile:async()=>file}};
    assert.equal(await (await readSource(entry)).text(),'abc');
    permission='prompt';await assert.rejects(readSource(entry));permission='granted';
    file=new File(['changed'],'song.wav',{lastModified:456});await assert.rejects(readSource(entry));
});
