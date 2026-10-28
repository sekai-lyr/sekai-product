(() => {
    // 封面/皮肤只做"路径连接"：数据库里存的是本地文件名（如 bilibili-222-xxx.jpg），
    // 浏览器从用户授权过的本地文件夹里取同名文件显示，服务器不存任何副本。
    const IMAGE=/\.(png|jpe?g|webp)$/i;
    const VIDEO=/\.(mp4|webm|mov|m4v)$/i;
    const REMOTE=/^(?:https?:)?\/\/|^\//i;
    const urls=[];
    const isLocalRef=value=>!!value && !REMOTE.test(value) && IMAGE.test(value);

    const references=new Promise((resolve,reject)=>{
        const request=indexedDB.open('sekai-local-file-handles',1);
        request.onupgradeneeded=()=>request.result.createObjectStore('references');
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    async function readReference(key){
        const db=await references;
        return new Promise((resolve,reject)=>{const request=db.transaction('references').objectStore('references').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    }
    let parser;
    function metadata(){
        parser ||= new Promise((resolve,reject)=>{
            if(window.sekaiParseLocalMetadata){resolve(window.sekaiParseLocalMetadata);return;}
            const script=document.createElement('script');script.src='/js/vendor/local-metadata.js';
            script.onload=()=>resolve(window.sekaiParseLocalMetadata);script.onerror=reject;document.head.append(script);
        });return parser;
    }
    // 记住的文件夹 -> { 文件名不带扩展名: entry }
    let directoryIndex;
    async function localIndex(userId){
        directoryIndex ||= (async()=>{
            const map=new Map();
            const roots=await readReference(`user:${userId}:directories`) || [];
            const walk=async(directory,prefix)=>{
                for await(const [name,entry] of directory.entries()){
                    if(entry.kind==='directory'){await walk(entry,`${prefix}${name}/`);continue;}
                    if(!IMAGE.test(name))continue;
                    const stem=name.replace(/\.[^.]+$/,'');
                    if(!map.has(stem))map.set(stem,{entry,path:prefix+name});
                }
            };
            for(const root of roots){
                try{
                    if(await root.queryPermission({mode:'read'})!=='granted')continue;
                    await walk(root,`${root.name}/`);
                }catch{/* 目录移动或授权失效时跳过 */}
            }
            return map;
        })();
        return directoryIndex;
    }
    async function fileFor(userId,name){
        try{
            const map=await localIndex(userId);
            const found=map.get(name.replace(/\.[^.]+$/,''));
            if(!found)return null;
            if(await found.entry.queryPermission({mode:'read'})!=='granted')return null;
            return await found.entry.getFile();
        }catch{return null;}
    }
    function blobUrl(file){const url=URL.createObjectURL(file);urls.push(url);return url;}

    // 视频没有同名封面图时的兜底：取一帧。
    function videoFrame(file){
        return new Promise(resolve=>{
            const url=URL.createObjectURL(file);
            const video=document.createElement('video');
            const done=value=>{URL.revokeObjectURL(url);video.removeAttribute('src');resolve(value);};
            const timer=setTimeout(()=>done(null),8000);
            video.muted=true;video.preload='metadata';video.src=url;
            video.addEventListener('error',()=>{clearTimeout(timer);done(null);});
            video.addEventListener('loadedmetadata',()=>{
                try{video.currentTime=Math.min(2,Math.max(0,(video.duration||4)/10));}catch{clearTimeout(timer);done(null);}
            });
            video.addEventListener('seeked',()=>{
                try{
                    const width=Math.min(960,video.videoWidth||640),height=Math.round(width*(video.videoHeight||360)/(video.videoWidth||640));
                    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
                    canvas.getContext('2d').drawImage(video,0,0,width,height);
                    canvas.toBlob(blob=>{clearTimeout(timer);done(blob && blob.size>2048?blob:null);},'image/jpeg',0.82);
                }catch{clearTimeout(timer);done(null);}
            });
        });
    }

    // ① 歌曲库/歌单卡片：优先用本机关联的封面句柄，其次用本地文件名
    async function fillCards(userId){
        const buttons=[...document.querySelectorAll('[data-selection-track][data-id]')];
        for(const button of buttons){
            try{
                let picture=null;
                const playlistId=button.dataset.playlistId;
                const refs=await readReference(playlistId
                    ? `user:${userId}:playlist:${playlistId}:song:${button.dataset.id}`
                    : `user:${userId}:song:${button.dataset.id}`);
                const global=playlistId ? await readReference(`user:${userId}:song:${button.dataset.id}`) : refs;
                if((refs?.coverBlob || global?.coverBlob) instanceof Blob){
                    picture=refs?.coverBlob || global?.coverBlob;
                }else if((refs?.cover || global?.cover) && await (refs?.cover || global?.cover).queryPermission({mode:'read'})==='granted'){
                    picture=await (refs?.cover || global?.cover).getFile();
                }else if(refs?.audio && await refs.audio.queryPermission({mode:'read'})==='granted'){
                    const name=refs.audio.name || '';
                    if(VIDEO.test(name)){
                        picture=await fileFor(userId,name);
                        if(!picture){const blob=await videoFrame(await refs.audio.getFile());if(blob)picture=blob;}
                    }else{
                        const read=await metadata();const embedded=(await read(await refs.audio.getFile())).common.picture?.[0];
                        if(embedded)picture=new Blob([embedded.data],{type:embedded.format});
                    }
                }
                if(!picture && isLocalRef(button.dataset.cover))picture=await fileFor(userId,button.dataset.cover);
                if(!picture)continue;
                const url=picture instanceof File || picture instanceof Blob ? blobUrl(picture) : null;
                if(!url)continue;
                button.dataset.cover=url;
                const image=button.querySelector('img');if(image)image.src=url;
                if(button.closest('.selection-track')?.classList.contains('is-active')){
                    document.querySelectorAll('[data-selection-feature-cover],[data-selection-background]').forEach(el=>{el.src=url;});
                }
            }catch{/* 文件缺失或未授权时保留占位图 */}
        }
    }

    // ② 其它页面元素：data-local-cover（图片）/ data-local-cover-bg（背景）
    async function fillElements(userId){
        for(const el of document.querySelectorAll('[data-song-cover-id]')){
            const refs=await readReference(`user:${userId}:song:${el.dataset.songCoverId}`);
            if(refs?.coverBlob instanceof Blob)el.src=blobUrl(refs.coverBlob);
            else if(refs?.cover && await refs.cover.queryPermission({mode:'read'})==='granted')el.src=blobUrl(await refs.cover.getFile());
        }

        for(const el of document.querySelectorAll('[data-local-cover]')){
            const name=el.dataset.localCover;
            if(!isLocalRef(name))continue;
            const file=await fileFor(userId,name);
            if(!file)continue;
            el.src=blobUrl(file);
        }
        for(const el of document.querySelectorAll('[data-local-cover-bg]')){
            const name=el.dataset.localCoverBg;
            if(!isLocalRef(name))continue;
            const file=await fileFor(userId,name);
            if(!file)continue;
            const url=blobUrl(file);
            el.style.backgroundImage=`linear-gradient(90deg, rgba(10,15,30,.86), rgba(10,15,30,.62)), url("${url}")`;
        }
    }

    (async()=>{
        const needsLibrary=document.querySelector('[data-selection-track][data-id]');
        let userId=null;
        try{
            const response=await fetch('/local-player/library');
            if(response.ok){const {user}=await response.json();userId=user?.id ?? null;}
        }catch{return;}
        if(userId==null)return;
        if(needsLibrary)await fillCards(userId);
        await fillElements(userId);
    })().catch(()=>{});
    window.addEventListener('pagehide',()=>urls.forEach(url=>URL.revokeObjectURL(url)));
})();
