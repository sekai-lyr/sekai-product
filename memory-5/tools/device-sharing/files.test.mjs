import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createIndex, openIndexedFile, saveIndex, loadIndex} from './files.mjs';

async function fixture(run) {
    const temporary=await mkdtemp(join(tmpdir(),'sekai-share-test-'));
    try {await mkdir(join(temporary,'music'));await mkdir(join(temporary,'outside'));await run(temporary);}
    finally {await rm(temporary,{recursive:true,force:true});}
}
test('index matches owned songs, survives restart, and returns the selected bytes',()=>fixture(async root=>{
    const music=join(root,'music');await writeFile(join(music,'song.flac'),'test-audio');
    const result=await createIndex([music],[{id:9,fileName:'song.flac',fileSize:10}]);
    assert.equal(result.index.files.length,1);
    const config=join(root,'index.json');await saveIndex(config,result.index);
    const loaded=await loadIndex(config);
    const opened=await openIndexedFile(loaded,9,'audio');
    try {assert.equal((await opened.handle.readFile()).toString(),'test-audio');}finally{await opened.handle.close();}
    assert.equal(loaded.sharing,false,'Restart must not enable sharing');
}));
test('ambiguous names are not silently selected',()=>fixture(async root=>{
    const music=join(root,'music');await mkdir(join(music,'one'));await mkdir(join(music,'two'));
    await writeFile(join(music,'one','same.mp3'),'a');await writeFile(join(music,'two','same.mp3'),'b');
    const result=await createIndex([music],[{id:9,fileName:'same.mp3',fileSize:1}]);
    assert.equal(result.index.files.length,0);assert.deepEqual(result.ambiguous,[9]);
}));
test('outside files, symlink directories, traversal, and unsupported content are denied',()=>fixture(async root=>{
    const music=join(root,'music'),outside=join(root,'outside');
    await writeFile(join(outside,'secret.mp3'),'secret');
    await symlink(outside,join(music,'escape'),'junction');
    const result=await createIndex([music],[{id:9,fileName:'secret.mp3'}]);
    assert.equal(result.index.files.length,0);
    await assert.rejects(openIndexedFile({roots:[music],files:[{songId:9,kind:'audio',root:0,path:'../outside/secret.mp3'}]},9,'audio'));
    await assert.rejects(openIndexedFile({roots:[music],files:[{songId:9,kind:'audio',root:0,path:'escape/secret.mp3'}]},9,'audio'));
    await writeFile(join(music,'secret.txt'),'not audio');
    await assert.rejects(openIndexedFile({roots:[music],files:[{songId:9,kind:'audio',root:0,path:'secret.txt'}]},9,'audio'));
}));
test('deleted files and post-index junction replacements cannot be opened',()=>fixture(async root=>{
    const music=join(root,'music');await mkdir(join(music,'album'));await writeFile(join(music,'album','song.mp3'),'abc');
    const {index}=await createIndex([music],[{id:9,fileName:'song.mp3',fileSize:3}]);
    await rm(join(music,'album'),{recursive:true});
    await assert.rejects(openIndexedFile(index,9,'audio'));
    await writeFile(join(root,'outside','song.mp3'),'abc');await symlink(join(root,'outside'),join(music,'album'),'junction');
    await assert.rejects(openIndexedFile(index,9,'audio'));
}));
