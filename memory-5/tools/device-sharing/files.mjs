import {lstat, realpath, readdir, open, mkdir, rename, readFile, rm} from 'node:fs/promises';
import {resolve, relative, isAbsolute, join, dirname, extname, basename} from 'node:path';
import {randomUUID} from 'node:crypto';

const media=new Set(['.mp3','.flac','.m4a','.wav','.ogg','.aac','.opus','.mp4','.webm','.mov']);
const covers=new Set(['.jpg','.jpeg','.png','.webp']);
const limits={audio:1024**4,lyric:256*1024,cover:8*1024*1024};
function allowed(path,kind) {
    const extension=extname(path).toLowerCase();
    return kind==='audio'?media.has(extension):kind==='lyric'?extension==='.lrc':kind==='cover' && covers.has(extension);
}
function inside(root,path) {
    const part=relative(root,path);
    return part!=='' && part!=='..' && !part.startsWith('..\\') && !part.startsWith('../') && !isAbsolute(part);
}
async function canonicalRoot(selected) {
    const root=resolve(selected);
    let current=root;
    while(true) {
        const stat=await lstat(current);
        if(stat.isSymbolicLink() || !stat.isDirectory())throw Error('Select an actual directory, not a link');
        const parent=dirname(current);if(parent===current)break;current=parent;
    }
    return realpath(root);
}
async function checkedPath(root,path) {
    root=await canonicalRoot(root);
    if(typeof path!=='string' || isAbsolute(path) || path.includes('\0') || path.split(/[\\/]/).some(p=>p==='..' || p.includes(':')))
        throw Error('Invalid indexed path');
    const target=resolve(root,path);
    if(!inside(root,target))throw Error('File is outside the shared directory');
    let current=root;
    for(const part of relative(root,target).split(/[\\/]/)) {
        current=join(current,part);
        if((await lstat(current)).isSymbolicLink())throw Error('Linked files and junctions cannot be shared');
    }
    if(!inside(root,await realpath(target)))throw Error('File is outside the shared directory');
    return target;
}
export async function createIndex(selectedRoots,songs) {
    if(!Array.isArray(selectedRoots) || !selectedRoots.length || selectedRoots.length>16 || !Array.isArray(songs) || songs.length>100000)
        throw Error('Invalid library selection');
    const roots=[];
    for(const selected of selectedRoots) {
        const root=await canonicalRoot(selected);
        if(!roots.includes(root))roots.push(root);
    }
    const files=[],byName=new Map();let visited=0;
    async function scan(rootNumber,path='') {
        for(const entry of await readdir(join(roots[rootNumber],path),{withFileTypes:true})) {
            if(++visited>100000)throw Error('Directory contains too many entries');
            const item=join(path,entry.name);
            if(entry.isSymbolicLink())continue;
            if(entry.isDirectory()){await scan(rootNumber,item);continue;}
            if(!entry.isFile() || !(media.has(extname(item).toLowerCase()) || covers.has(extname(item).toLowerCase()) || extname(item).toLowerCase()==='.lrc'))continue;
            const target=await checkedPath(roots[rootNumber],item),stat=await lstat(target);
            const file={root:rootNumber,path:item,size:stat.size};files.push(file);
            const key=entry.name.toLowerCase();if(!byName.has(key))byName.set(key,[]);byName.get(key).push(file);
        }
    }
    for(let i=0;i<roots.length;i++)await scan(i);
    const index={version:1,sharing:false,roots,files:[]},ambiguous=[],missing=[];
    for(const song of songs) {
        if(!Number.isSafeInteger(song.id) || song.id<=0)throw Error('Invalid song id');
        let candidates=(byName.get(String(song.fileName||'').toLowerCase())||[]).filter(f=>allowed(f.path,'audio') && (!song.fileSize || song.fileSize===f.size));
        if(!candidates.length && song.videoFileName)candidates=(byName.get(String(song.videoFileName).toLowerCase())||[]).filter(f=>allowed(f.path,'audio'));
        if(candidates.length>1){ambiguous.push(song.id);continue;}
        if(!candidates.length){missing.push(song.id);continue;}
        const audio=candidates[0];index.files.push({...audio,songId:song.id,kind:'audio'});
        const stem=basename(audio.path,extname(audio.path)).toLowerCase();
        const siblings=files.filter(f=>f.root===audio.root && dirname(f.path)===dirname(audio.path) && basename(f.path,extname(f.path)).toLowerCase()===stem);
        for(const kind of ['lyric','cover']) {
            const matches=siblings.filter(f=>allowed(f.path,kind) && f.size<=limits[kind]);
            if(matches.length===1)index.files.push({...matches[0],songId:song.id,kind});
        }
    }
    return {index,ambiguous,missing};
}
export async function openIndexedFile(index,songId,kind) {
    if(!Number.isSafeInteger(songId) || !Object.hasOwn(limits,kind))throw Error('Invalid media request');
    const matches=index.files.filter(f=>f.songId===songId && f.kind===kind);
    if(matches.length!==1)throw Error('File is not shared');
    const file=matches[0],root=index.roots[file.root];
    if(typeof root!=='string' || !allowed(file.path,kind))throw Error('File is not shared');
    const path=await checkedPath(root,file.path),before=await lstat(path);
    if(!before.isFile() || before.size>limits[kind] || (file.size!==undefined && file.size!==before.size))throw Error('Shared file changed');
    const handle=await open(path,'r');
    try {
        const actual=await handle.stat();await checkedPath(root,file.path);
        if(!actual.isFile() || actual.ino!==before.ino || actual.dev!==before.dev || actual.size!==before.size)throw Error('Shared file changed');
        return {handle,size:actual.size,extension:extname(path).toLowerCase()};
    }catch(error){await handle.close();throw error;}
}
export async function saveIndex(path,index) {
    const content=JSON.stringify({...index,sharing:false});
    await mkdir(dirname(path),{recursive:true,mode:0o700});
    const temporary=join(dirname(path),`.sekai-index-${randomUUID()}.tmp`);
    try {
        const handle=await open(temporary,'wx',0o600);
        try{await handle.writeFile(content,'utf8');await handle.sync();}finally{await handle.close();}
        await rename(temporary,path);
        if(await readFile(path,'utf8')!==content)throw Error('Index was not persisted');
    }finally{await rm(temporary,{force:true});}
}
export async function loadIndex(path) {
    if((await lstat(path)).size>32*1024*1024)throw Error('Invalid saved index');
    const index=JSON.parse(await readFile(path,'utf8'));
    if(index.version!==1 || !Array.isArray(index.roots) || !Array.isArray(index.files) || index.roots.length>16 || index.files.length>300000)
        throw Error('Invalid saved index');
    return {...index,sharing:false};
}
