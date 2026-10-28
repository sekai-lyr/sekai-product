(() => {
    'use strict';
    const frame = document.querySelector('#local-stage');
    const status = document.querySelector('#local-status');
    const songSelect = document.querySelector('#local-track');
    const modeSelect = document.querySelector('#local-mode');
    const playlistSelect=document.querySelector('#local-playlist');
    let account=null, csrf='', playlists=[], libraryReady;
    const handles=new WeakMap(), filePaths=new WeakMap(), lyricHandles=new Map();
    let databasePromise;
    function database(){
        databasePromise ||= new Promise((resolve,reject)=>{
            const request=indexedDB.open('sekai-local-file-handles',1);
            request.onupgradeneeded=()=>request.result.createObjectStore('references');
            request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });return databasePromise;
    }
    async function remembered(key,value){
        const db=await database();return new Promise((resolve,reject)=>{
            const write=arguments.length>1;const tx=db.transaction('references',write?'readwrite':'readonly');
            const request=write?tx.objectStore('references').put(value,key):tx.objectStore('references').get(key);
            tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
    }
    async function rememberedPlaylist(userId,available){
        const db=await database();
        const keys=await new Promise((resolve,reject)=>{
            const request=db.transaction('references','readonly').objectStore('references').getAllKeys();
            request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });
        const prefix=`user:${userId}:playlist:`;
        const found=keys.find(key=>typeof key==='string' && key.startsWith(prefix) && available.some(p=>key.startsWith(`${prefix}${p.id}:song:`)));
        return found?.slice(prefix.length).split(':')[0] || null;
    }
    const bindingPlaylistId=()=>/^\d+$/.test(playlistSelect.value) ? playlistSelect.value : null;
    const referenceKey=(track,playlistId=bindingPlaylistId())=>playlistId && track.id
        ? `user:${account.id}:playlist:${playlistId}:song:${track.id}`
        : `user:${account?.id || 'guest'}:song:${track.id || track.key}`;
    async function loadBindings(){
        const playlistId=bindingPlaylistId();
        for(const track of tracks){
            const refs=await remembered(referenceKey(track));
            const global=await remembered(referenceKey(track,null));
            Object.assign(track,{handle:refs?.audio,videoHandle:refs?.video,lyricHandle:refs?.lyric,
                coverHandle:refs?.cover || global?.cover,coverBlob:refs?.coverBlob || global?.coverBlob,
                playlistId,deviceFileName:refs?.fileName,deviceFileSize:refs?.fileSize,file:null,videoFile:null,ready:false,
                availability:track.serverAudioUrl || track.serverVideoUrl?'linked':'unlinked'});
            if(!refs?.audio)continue;
            try{track.availability=await refs.audio.queryPermission({mode:'read'})==='granted'?'linked':'permission';
                if(track.availability==='linked')await refs.audio.getFile();}
            catch{track.availability='missing';}
        }
        const remoteSources=await window.SekaiDeviceSources?.sources() || [];
        for(const track of tracks)if(track.availability==='unlinked' && remoteSources.some(source=>
            String(source.songId)===String(track.id) && (playlistId
                ? String(source.playlistId)===playlistId : source.playlistId==null)))track.availability='remote';
        document.querySelector('#local-restore').hidden=!tracks.some(track=>track.availability==='permission');
        refreshOptions();
    }
    async function api(path,body,method='POST'){
        const response=await fetch(`/local-player/library${path}`,{method,headers:{'Content-Type':'application/json','X-Local-Library-CSRF':csrf},body:body===undefined?undefined:JSON.stringify(body)});
        if(!response.ok)throw new Error(response.status===401?'登录已过期，请重新登录。':'账户字段保存失败，请重试。');
        return response.json();
    }
    async function refreshPlaylistAudit(){
        if(!account)return;
        try{
            const container=document.querySelector('#local-playlist-audit');
            window.SekaiPlaylistAudit.render(container,await window.SekaiPlaylistAudit.audit({
                user:account,songs:tracks,playlists
            }));
        }catch{document.querySelector('#local-playlist-audit').textContent='本机文件状态暂时无法读取，请刷新页面重试。';}
    }
    let tracks = [], current = -1, generation = 0, parserPromise, moving=false;
    const sidecars = new Map();
    const coverFiles = new Map();
    let pendingFiles = [], pendingTracks = [];
    let pendingBindingId = null;
    const importPanel=document.querySelector('#local-import-panel');
    const importTarget=document.querySelector('#local-import-target');
    const importName=document.querySelector('#local-import-name');
    const importConfirm=document.querySelector('#local-import-confirm');
    const requestedSongId=document.body.dataset.songId || new URLSearchParams(location.search).get('songId');
    const playbackPage=document.body.classList.contains('local-playback-page');
    const requestedSong=!!requestedSongId;
    if(requestedSong){
        document.querySelector('#local-files-label').textContent=new URLSearchParams(location.search).get('media')==='video'?'关联本首视频':'关联本首音频或视频';
    }
    document.querySelector('#local-playback-tools').hidden=!requestedSong;
    if(requestedSong)document.querySelector('.section-title h1').textContent='歌曲演出';
    const stem = file => (filePaths.get(file) || file.webkitRelativePath || file.name).replace(/\.[^.]+$/, '').toLowerCase();
    const isAudio=file=>/\.(mp3|flac|m4a|wav|ogg|aac|opus)$/i.test(file.name);
    const isVideo=file=>/\.(mp4|webm|mov)$/i.test(file.name);
    const normalized=value=>String(value || '').normalize('NFKC').toLowerCase().replace(/\s/g,'');
    function mediaGroups(files){
        const groups=new Map();
        for(const file of files){
            if(!isAudio(file) && !isVideo(file))continue;
            const key=stem(file),group=groups.get(key) || {audio:null,video:null};
            if(isAudio(file))group.audio=file;else group.video=file;
            groups.set(key,group);
        }
        return [...groups.values()].map(group=>({file:group.audio || group.video,videoFile:group.audio ? group.video : null}));
    }
    const modes = window.SekaiStages.map(item => item.id);
    const savedMode = localStorage.getItem('sekai.local.mode');
    if (modes.includes(savedMode)) modeSelect.value = savedMode;

    function parseLyrics(text) {
        const rows = [];
        const offset = Number(String(text).match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
        for (const line of String(text || '').split(/\r?\n/)) {
            const stamps = [...line.matchAll(/\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
            const words = line.replace(/\[[^\]]*\]/g, '').trim();
            if (!words) continue;
            for (const stamp of stamps) rows.push({seconds:Math.max(0, Number(stamp[1])*60 + Number(stamp[2]) + Number(`0.${stamp[3] || '0'}`) + offset),text:words});
        }
        return rows.sort((a,b) => a.seconds-b.seconds);
    }
    async function readLocalLyric(file) {
        const bytes=new Uint8Array(await file.arrayBuffer());
        if(bytes[0]===0xff && bytes[1]===0xfe)return new TextDecoder('utf-16le').decode(bytes);
        if(bytes[0]===0xfe && bytes[1]===0xff)return new TextDecoder('utf-16be').decode(bytes);
        try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
        catch{return new TextDecoder('gb18030').decode(bytes);}
    }
    function parser() {
        parserPromise ||= new Promise((resolve,reject) => {
            const script = document.createElement('script'); script.src='/js/vendor/local-metadata.js';
            script.onload=()=>resolve(window.sekaiParseLocalMetadata); script.onerror=()=>{parserPromise=null;reject(new Error('本地标签解析器加载失败'));};
            document.head.append(script);
        });
        return parserPromise;
    }
    async function prepare(track) {
        if (track.ready) {
            const lrc=sidecars.get(stem(track.file));
            if(lrc && track.sidecar!==lrc){track.rows=parseLyrics(await readLocalLyric(lrc));track.sidecar=lrc;}
            return;
        }
        if(track.cover?.startsWith('blob:'))URL.revokeObjectURL(track.cover);
        // 库里存的是本地文件名（bilibili-222-xxx.jpg）时不能当 URL 用：封面由下面的
        // coverHandle / 同名图片提供，这里只接受真正的 URL。
        track.cover=/^(?:https?:)?\/\//i.test(track.coverUrl || '') || /^\/(?!\/)/.test(track.coverUrl || '') ? track.coverUrl : null;
        track.title ||= track.file.name.replace(/\.[^.]+$/, ''); track.artist ||= ''; track.album ||= ''; track.rows=parseLyrics(track.lyrics || '');
        try {
            const read = await parser(); const tags = (await read(track.file)).common;
            if(!track.id){track.title=tags.title || track.title; track.artist=tags.artist || track.artist; track.album=tags.album || track.album;}
            const picture = tags.picture?.[0];
            if (picture && !track.coverHandle && !(track.coverBlob instanceof Blob) && !coverFiles.has(stem(track.file))) {
                track.coverBlob=new Blob([picture.data],{type:picture.format});
                track.cover=URL.createObjectURL(track.coverBlob);
            }
            for (const lyric of tags.lyrics || []) {
                const rows = parseLyrics(typeof lyric === 'string' ? lyric : lyric.text);
                if (rows.length) {track.rows=rows;break;}
                if (lyric.timeStampFormat === 2 && lyric.syncText?.length) {
                    track.rows=lyric.syncText.filter(row=>Number.isFinite(row.timestamp) && row.text?.trim()).map(row=>({seconds:row.timestamp/1000,text:row.text}));
                    if (track.rows.length) break;
                }
            }
        } catch (error) { track.tagWarning=error.message; }
        let lrc = sidecars.get(stem(track.file));
        if(track.lyricHandle){
            try{lrc=await track.lyricHandle.getFile();track.lyricUnavailable=false;}
            catch(error){track.lyricUnavailable=true;lrc=null;}
        }
        if(track.coverHandle){try{const picture=await track.coverHandle.getFile();if(track.cover)URL.revokeObjectURL(track.cover);track.cover=URL.createObjectURL(picture);}catch{}}
        const coverFile=coverFiles.get(stem(track.file));
        if(coverFile){if(track.cover?.startsWith('blob:'))URL.revokeObjectURL(track.cover);track.cover=URL.createObjectURL(coverFile);track.coverHandle=handles.get(coverFile);}
        if(track.coverBlob instanceof Blob){if(track.cover?.startsWith('blob:'))URL.revokeObjectURL(track.cover);track.cover=URL.createObjectURL(track.coverBlob);}
        if (lrc) {track.rows=parseLyrics(await readLocalLyric(lrc));track.sidecar=lrc;}
        track.ready=true;
    }
    function prepareServer(track) {
        track.cover=/^(?:https?:)?\/\//i.test(track.coverUrl || '') || /^\/(?!\/)/.test(track.coverUrl || '') ? track.coverUrl : null;
        if(track.coverBlob instanceof Blob)track.cover=URL.createObjectURL(track.coverBlob);
        track.rows=parseLyrics(track.lyrics || '');
        track.serverMedia=track.serverMedia || (track.serverAudioUrl ? 'audio' : 'video');
        track.url=track.serverMedia==='video' ? track.serverVideoUrl : track.serverAudioUrl;
        track.remoteFileName=track.url?.split('/').pop();
        track.availability='linked';
        track.ready=true;
    }
    function snapshot() {
        const audio=frame.contentDocument?.querySelector('audio');
        return {time:audio?.currentTime || 0,playing:audio ? !audio.paused : false};
    }
    function render(state={time:0,playing:false}) {
        const track=tracks[current]; if (!track?.ready) return;
        frame.contentDocument?.querySelector('audio')?.pause();
        track.activeMediaFileName=track.serverMedia==='video' && track.videoFile ? track.videoFile.name : track.file?.name;
        track.url ||= track.file ? URL.createObjectURL(track.serverMedia==='video' && track.videoFile ? track.videoFile : track.file) : track.serverAudioUrl || track.serverVideoUrl;
        const videoPlaying=/\.(mp4|webm|mov)$/i.test(track.activeMediaFileName || track.remoteFileName || '');
        modeSelect.disabled=videoPlaying;
        document.querySelector('#local-cloud').disabled=videoPlaying;
        document.querySelector('#local-lrc').disabled=videoPlaying;
        window.__sekaiLocalPlayer.track={...track,index:current,restore:state};
        window.__sekaiLocalPlayer.queue=visible().map(index=>({title:label(tracks[index]),index}));
        frame.hidden=false; document.querySelector('#local-empty').hidden=true;
        document.body.classList.toggle('local-playback-ready',playbackPage);
        frame.dataset.stageUrl=`/local-stage?mode=${encodeURIComponent(videoPlaying?'disc':modeSelect.value)}&selection=${++generation}`;
        frame.contentWindow.location.replace(frame.dataset.stageUrl);
        if(playbackPage && track.id){
            const url=new URL(location.href);url.pathname=`/player/${track.id}`;
            url.searchParams.set('mode',modeSelect.value);
            if(bindingPlaylistId())url.searchParams.set('playlistId',bindingPlaylistId());else url.searchParams.delete('playlistId');
            history.replaceState(history.state,'',url);
        }
        status.textContent=`${track.title} · ${track.artist || '本地文件'} · ${videoPlaying?'视频原画面播放':track.lyricUnavailable?'本地LRC不可用，请重新关联':(track.rows.length ? `${track.rows.length}行同步歌词` : '没有同步歌词，请选择LRC或匹配云端歌词')} · ${track.remote?'设备共享实时播放':(track.serverAudioUrl || track.serverVideoUrl ? '网站素材播放' : '本机播放')}`;
        document.querySelector('#local-favorite').textContent=track.favorite?'取消收藏':'收藏当前歌曲';
    }
    async function select(index, playing=false) {
        const track=tracks[index];if (!track) return false;
        const switching=window.__sekaiLocalPlayer.track && window.__sekaiLocalPlayer.track.key!==track.key;
        savePreferences();const request=++generation;
        frame.contentDocument?.querySelector('audio')?.pause();
        current=index; songSelect.value=String(index); status.textContent='正在本机读取音频标签…';
        if(track.handle){
            try{
                let permission=await track.handle.queryPermission({mode:'read'});
                if(permission!=='granted' && navigator.userActivation?.isActive)permission=await track.handle.requestPermission({mode:'read'});
                if(permission!=='granted')throw new DOMException('需要本机授权','NotAllowedError');
                track.file=await track.handle.getFile();
                if((track.deviceFileName || track.fileName)!==track.file.name || ((track.deviceFileSize || track.fileSize) && (track.deviceFileSize || track.fileSize)!==track.file.size))throw new DOMException('文件已改变，需要重新关联','NotFoundError');
                handles.set(track.file,track.handle);track.ready=false;
            }catch(error){track.file=null;track.localAccessError=error;}
        }
        if(track.videoHandle){
            try{
                let permission=await track.videoHandle.queryPermission({mode:'read'});
                if(permission!=='granted' && navigator.userActivation?.isActive)permission=await track.videoHandle.requestPermission({mode:'read'});
                track.videoFile=permission==='granted' ? await track.videoHandle.getFile() : null;
            }catch{track.videoFile=null;}
        }
        if(!track.file && (track.serverAudioUrl || track.serverVideoUrl)) {
            prepareServer(track);
        } else if(!track.file){
            try{if(!await window.SekaiDeviceSources?.prepare(track,parseLyrics)){unavailable(track,track.localAccessError);return false;}}
            catch{status.textContent='供音电脑未共享、离线或正在忙碌，请检查设备共享设置。';return false;}
        }else{
            if(track.remote || (track.url && !track.url.startsWith('blob:'))){track.remote=false;track.url=null;track.ready=false;}
            await prepare(track);track.availability='linked';
            if(track.sidecar && track.rows.length)void persistLyrics(track).catch(error=>{status.textContent=error.message;});
        }
        if (request !== generation) return false;
        refreshOptions();songSelect.value=String(index);
        if(!window.__sekaiLocalPlayer.track && modes.includes(track.preferences?.stageMode))modeSelect.value=track.preferences.stageMode;
        restorePreferences(track,!window.__sekaiLocalPlayer.track);
        render({time:switching?0:Number(track.preferences?.position || 0),playing});return true;
    }
    function changeMode(mode) {
        if (!modes.includes(mode) || modeSelect.disabled) return;
        const state=snapshot(); modeSelect.value=mode; localStorage.setItem('sekai.local.mode',mode); render(state);
        savePreferences();
    }
    function toggleServerMedia(){
        const track=tracks[current];
        if(!track || !(track.file && track.videoFile) && !(track.serverAudioUrl && track.serverVideoUrl) && !track.remoteVideoUrl)return;
        const state=snapshot();
        track.serverMedia=track.serverMedia==='video'?'audio':'video';
        if(track.url?.startsWith('blob:'))URL.revokeObjectURL(track.url);
        track.url=track.file ? null : track.serverMedia==='video' ? track.remoteVideoUrl || track.serverVideoUrl
            : track.remote ? `/api/device-sharing/media/${encodeURIComponent(track.remoteSource.deviceId)}/${track.id}/audio` : track.serverAudioUrl;
        if(track.remote)track.remoteFileName='remote'+(track.serverMedia==='video'?track.remoteSource.videoExtension:track.remoteSource.extension);
        else if(track.url)track.remoteFileName=track.url.split('/').pop();
        render(state);
    }
    async function move(delta) {
        if(moving)return;
        moving=true;
        try{
        const mode=localStorage.getItem('sekai.player.playMode');
        let candidates=visible().filter(index=>['linked','remote'].includes(tracks[index].availability));
        if(mode==='shuffle'){const other=candidates.filter(index=>index!==current);if(other.length)candidates=other;candidates=candidates.sort(()=>Math.random()-.5);}
        else {const at=candidates.indexOf(current);candidates=Array.from({length:candidates.length},(_,step)=>candidates[(at+delta*(step+1)+candidates.length*2)%candidates.length]);}
        for(const index of candidates)if(await select(index,true))return;
        status.textContent='没有可读取的本地歌曲，请重新关联音乐文件夹。';
        }finally{moving=false;}
    }
    window.__sekaiLocalPlayer={track:null,queue:[],changeMode,toggleServerMedia,select:index=>select(index,true),next:()=>move(1),previous:()=>move(-1),parseLyrics,
        rememberDirectory:(root)=>linkDirectory(root),savePreferences,markUnavailable:key=>{if(tracks[current]?.key===key)unavailable(tracks[current],new DOMException('文件不可用','NotFoundError'));}};
    function label(track){return `${track.title || track.file?.name || track.fileName || '本地音乐'}${track.availability==='linked'?'':' · '+({missing:'文件已删除或移动',permission:'待授权',unlinked:'待关联'}[track.availability] || '待关联')}`;}
    function visible(){return tracks.map((_,index)=>index).filter(index=>{
        if(playlistSelect.value==='favorites')return tracks[index].favorite;
        if(playlistSelect.value==='all')return true;
        return playlists.find(p=>String(p.id)===playlistSelect.value)?.songIds.includes(tracks[index].id);
    });}
    function refreshOptions(){songSelect.replaceChildren(new Option('选择歌曲',''),...visible().map(index=>new Option(label(tracks[index]),String(index))));if(current>=0)songSelect.value=String(current);}
    function unavailable(track,error){
        if(!track)return;track.availability=error?.name==='NotAllowedError'?'permission':(track.handle?'missing':'unlinked');track.file=null;track.ready=false;
        if(track.url){URL.revokeObjectURL(track.url);track.url=null;}
        frame.contentDocument?.querySelector('audio')?.pause();frame.hidden=true;document.querySelector('#local-empty').hidden=false;
        document.body.classList.remove('local-playback-ready');
        if(playbackPage){document.querySelector('#local-empty h1').textContent=track.title;document.querySelector('#local-empty p').textContent='歌曲已在歌单中。本机文件未关联或授权已失效，请在上方重新关联或授权，不需要重新导入歌单。';}
        status.textContent=`${track.title}：${track.availability==='permission'?'需要恢复本机授权':'本地文件不可用，请重新关联'}。账户歌曲记录仍保留。`;refreshOptions();
        document.querySelector('#local-restore').hidden=track.availability!=='permission';
    }
    function restorePreferences(track,restorePlayback=true){
        const p=track.preferences || {};
        if(track.id && !p.bookmarks && !localStorage.getItem(`sekai.player.bookmarks.${track.key}`)){
            const previous=localStorage.getItem(`sekai.player.bookmarks.${track.id}`);
            if(previous)localStorage.setItem(`sekai.player.bookmarks.${track.key}`,previous);
        }
        if(restorePlayback){
            if(p.playMode)localStorage.setItem('sekai.player.playMode',p.playMode);
            if(p.volume!==undefined)localStorage.setItem('sekai.player.volume',p.volume);
            if(p.rate!==undefined)localStorage.setItem('sekai.player.playbackRate',p.rate);
        }
        if(p.bookmarks)localStorage.setItem(`sekai.player.bookmarks.${track.key}`,JSON.stringify(p.bookmarks));
        if(p.loopA!==undefined || p.loopB!==undefined)localStorage.setItem(`sekai.player.loop.${track.key}`,JSON.stringify({a:p.loopA,b:p.loopB}));
    }
    const preferenceTimers=new Map();
    function savePreferences(){
        const track=tracks[current];if(!account || !track?.id)return;
        const audio=frame.contentDocument?.querySelector('audio');if(!audio || audio.readyState<1 || frame.contentDocument.querySelector('.now-playing')?.dataset.songId!==track.key)return;
        clearTimeout(preferenceTimers.get(track.id));
            let bookmarks=[],loop={};
            try{bookmarks=JSON.parse(localStorage.getItem(`sekai.player.bookmarks.${track.key}`)||'[]');loop=JSON.parse(localStorage.getItem(`sekai.player.loop.${track.key}`)||'{}');}catch{}
            const preferences={stageMode:modeSelect.value,playMode:localStorage.getItem('sekai.player.playMode') || 'sequence',volume:audio.volume,rate:audio.playbackRate,
                position:audio.currentTime,bookmarks:bookmarks.slice(0,30).map(b=>({time:b.time,label:String(b.label || '').slice(0,120)})),loopA:loop.a??null,loopB:loop.b??null};
        track.preferences=preferences;
        preferenceTimers.set(track.id,setTimeout(async()=>{
            try{await api(`/songs/${track.id}/preferences`,preferences);}catch(error){status.textContent=error.message;}
            preferenceTimers.delete(track.id);
        },350));
    }
    async function persistBinding(track){
        const key=referenceKey(track),previous=await remembered(key);
        const sameFile=previous?.fileName===track.file.name && previous.fileSize===track.file.size &&
            (previous.lastModified===undefined || previous.lastModified===track.file.lastModified);
        if(!track.handle && sameFile)track.handle=previous.audio;
        if(!track.lyricHandle && sameFile && (!track.sidecar || track.sidecar.name===previous.lyric?.name))track.lyricHandle=previous.lyric;
        if(!track.coverHandle && sameFile)track.coverHandle=previous.cover;
        if(track.coverBlob===undefined)track.coverBlob=previous?.coverBlob;
        if(track.handle || track.videoHandle || track.lyricHandle || track.coverHandle || track.coverBlob)await remembered(key,{audio:track.handle,video:track.videoHandle,lyric:track.lyricHandle,cover:track.coverHandle,coverBlob:track.coverBlob,fileName:track.file.name,fileSize:track.file.size,lastModified:track.file.lastModified});
        else await remembered(key,null);
        if(account && track.id && !bindingPlaylistId())await api(`/songs/${track.id}/binding`,{fileName:track.file.name,fileSize:track.file.size,lastModified:track.file.lastModified,lyricFileName:track.lyricHandle?.name || track.sidecar?.name || null});
    }
    async function persistLyrics(track){
        if(!account || !track.id || !track.rows.length)return;
        const lyrics=track.rows.map(row=>{const minutes=Math.floor(row.seconds/60),seconds=(row.seconds%60).toFixed(3).padStart(6,'0');return `[${String(minutes).padStart(2,'0')}:${seconds}]${row.text}`;}).join('\n');
        if(lyrics===track.lyrics)return;
        await api(`/songs/${track.id}/lyrics`,{lyrics});track.lyrics=lyrics;
    }
    async function loadLibrary(){
        const response=await fetch('/local-player/library');if(response.status===401){
            document.querySelector('#local-playlist-audit').textContent='登录后可查看各歌单缺少哪些本机文件和歌曲资料。';return;
        }
        if(!response.ok)throw new Error('账户歌曲目录加载失败。');
        const data=await response.json();account=data.user;csrf=data.csrf;playlists=data.playlists;
        document.querySelector('#local-account').textContent=`${account.name} · 账户歌曲`;document.querySelector('#local-account').href='/songs';
        tracks=data.songs.map(song=>({...song,key:`account:${account.id}:${song.id}`,availability:'unlinked'}));
        playlistSelect.append(...playlists.map(p=>new Option(p.name,String(p.id))));
        const requestedPlaylist=document.body.dataset.playlistId || new URLSearchParams(location.search).get('playlistId') || localStorage.getItem(`sekai.local.playlist.${account.id}`) || await rememberedPlaylist(account.id,playlists);
        if(playlists.some(p=>String(p.id)===requestedPlaylist))playlistSelect.value=requestedPlaylist;
        if(bindingPlaylistId())localStorage.setItem(`sekai.local.playlist.${account.id}`,playlistSelect.value);
        await loadBindings();
        importTarget.append(...playlists.map(p=>new Option(`歌单：${p.name}`,String(p.id))));
        const linkPlaylist=document.querySelector('#local-link-playlist');
        linkPlaylist.append(...playlists.map(p=>new Option(p.name,String(p.id))));
        if(requestedPlaylist && playlists.some(p=>String(p.id)===requestedPlaylist))linkPlaylist.value=requestedPlaylist;
        void refreshPlaylistAudit();
        document.querySelector('#local-restore').hidden=!tracks.some(track=>track.availability==='permission');
        const linked=tracks.filter(track=>track.availability==='linked').length;
        const needsPermission=tracks.filter(track=>track.availability==='permission').length;
        status.textContent=`${account.name}：歌曲库已有${tracks.length}首，已自动恢复本机关联${linked}首。${needsPermission?'另有'+needsPermission+'首只需恢复文件访问授权，无需重新关联；浏览器出现选项时可选择“每次访问都允许”。':'新增歌曲时再选择本机文件。'}`;
        const params=new URLSearchParams(location.search);
        const requestedMode=document.body.dataset.stageMode || params.get('mode');
        if(modes.includes(requestedMode))modeSelect.value=requestedMode;
        const requested=tracks.findIndex(track=>String(track.id)===requestedSongId);
        if(requested>=0){
            await select(requested,document.body.dataset.autoplay==='true' || params.get('autoplay')==='1');
            if(modes.includes(requestedMode) && modeSelect.value!==requestedMode)changeMode(requestedMode);
        }
    }
    async function addFiles(files,linkOnly=false,confirmed=false,targetId=null) {
        await libraryReady;
        if(linkOnly && !account)throw new Error('请先登录，再关联已有歌单。');
        const target=targetId==null?null:tracks.find(track=>String(track.id)===String(targetId));
        if(targetId!=null){
            if(!account || !target)throw new Error('目标歌曲不属于当前账户，请重新打开歌曲。');
            if(mediaGroups(files).length!==1)throw new Error('关联本首歌曲时请选择一组同名音视频，可同时选择同名歌词和封面。');
        }
        for (const file of files) if (/\.lrc$/i.test(file.name)){sidecars.set(stem(file),file);if(handles.get(file))lyricHandles.set(stem(file),handles.get(file));}
        for (const file of files) if (/\.(png|jpe?g|webp)$/i.test(file.name))coverFiles.set(stem(file),file);
        let linked=0,added=0,unmatched=0;
        const imported=[];
        const groups=mediaGroups(files),total=groups.length;
        let processed=0,completed=false;
        const progressButton=linkOnly?document.querySelector('#local-link-existing'):null;
        if(progressButton)progressButton.disabled=true;
        try {
        for (const group of groups) {
            const file=group.file;
            processed++;
            if(linkOnly){
                status.textContent=`正在关联 ${processed}/${total}：已关联 ${linked} 首，未匹配 ${unmatched} 个。文件保留在本机，请勿关闭页面。`;
                if(progressButton)progressButton.textContent=`正在关联 ${processed}/${total}`;
            }
            const key=`${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
            let matches=target?[target]:tracks.filter(track=>(track.fileName===file.name && (!track.fileSize || track.fileSize===file.size)) ||
                (track.videoFileName===file.name && track.videoFileName!==track.fileName));
            if(account && !matches.length){
                try{const read=await parser();let tags;
                    try{tags=(await read(file,{skipCovers:true})).common;}catch(error){if(!/\.(mp4|webm|mov)$/i.test(file.name))throw error;tags={title:file.name.replace(/\.[^.]+$/,'')};}
                    const candidates=tracks.filter(track=>normalized(track.title)===normalized(tags.title) && normalized(track.artist)===normalized(tags.artist));
                    if(candidates.length===1)matches=candidates;
                    else {if(linkOnly){unmatched++;continue;}const saved=await api('/songs',{title:tags.title || file.name.replace(/\.[^.]+$/,''),artist:tags.artist || '',album:tags.album || '',file:{fileName:file.name,fileSize:file.size,lastModified:file.lastModified}});
                        let track=tracks.find(t=>t.id===saved.id);if(!track){track={id:saved.id,title:tags.title || file.name,artist:tags.artist || '',album:tags.album || '',key:`account:${account.id}:${saved.id}`};tracks.push(track);added++;}matches=[track];}
                }catch(error){status.textContent=error.message;unmatched++;continue;}
            }
            if(!account && !matches.length){let track=tracks.find(t=>t.key===key);if(!track){track={file,key};tracks.push(track);added++;}matches=[track];}
            for(const track of matches){
                if(track.url){URL.revokeObjectURL(track.url);track.url=null;}
                // 同名的封面图（如 bilibili-222-xxx.mp4 + bilibili-222-xxx.jpg）也要一起记住，
                // 否则歌单/歌曲库的卡片拿不到封面，只能显示占位块。
                const coverFile=coverFiles.get(stem(file));
                const coverHandle=(coverFile && handles.get(coverFile)) || track.coverHandle || null;
                Object.assign(track,{file,fileName:file.name,fileSize:file.size,deviceFileName:file.name,deviceFileSize:file.size,lastModified:file.lastModified,handle:handles.get(file),videoFile:group.videoFile || track.videoFile,videoHandle:group.videoFile ? handles.get(group.videoFile) : track.videoHandle,lyricHandle:lyricHandles.get(stem(file)),coverHandle,availability:'linked',ready:false});
                track.sidecar=sidecars.get(stem(file));
                if(!linkOnly || confirmed)await prepare(track);
                await persistBinding(track);
                if(confirmed)await persistLyrics(track);
                imported.push(track.id);linked++;
            }
        }
        refreshOptions();
        if(confirmed){if(unmatched || !linked)throw new Error('部分文件未能保存，请检查匹配结果后重试。');completed=true;void refreshPlaylistAudit();return [...new Set(imported.filter(Boolean))];}
        if (current<0 && tracks.some(track=>track.availability==='linked')) await select(tracks.findIndex(track=>track.availability==='linked'));
        else if(current>=0 && imported.includes(tracks[current].id))await select(current,playbackPage);
        else if (current>=0 && tracks[current].file) {
            songSelect.value=String(current);
            const lrc=sidecars.get(stem(tracks[current].file));
            if (lrc) {tracks[current].rows=parseLyrics(await readLocalLyric(lrc));render(snapshot());}
        } else status.textContent='所选文件中没有支持的音频。';
        if(linkOnly){
            const linkedIds=new Set(imported);
            const results=document.querySelector('#local-link-results');results.replaceChildren();
            for(const playlist of playlists){
                const ids=new Set(playlist.songIds);
                const count=[...ids].filter(id=>linkedIds.has(id)).length;
                const available=tracks.filter(track=>ids.has(track.id) && track.availability==='linked').length;
                const item=document.createElement('li');item.textContent=`${playlist.name}：本次关联 ${count} 首，本机可用 ${available}/${ids.size} 首`;results.append(item);
            }
            document.querySelector('#local-link-report').hidden=false;
            status.textContent=`本次关联 ${linkedIds.size} 首已有歌曲，${unmatched} 个文件未匹配。未新增歌曲，原歌单归属保持不变；音频未上传。`;
        }else if(linked)status.textContent=`已关联${linked}条歌曲，新增${added}条账户字段${unmatched?`，${unmatched}个文件未匹配`:''}。音频未上传。`;
        completed=true;
        }finally{
            if(progressButton){progressButton.disabled=false;progressButton.textContent=completed?`已关联 ${new Set(imported).size} 首 · 重新选择`:'关联已有歌曲／视频';}
        }
    }
    async function walk(root,prefix,files){for await(const [name,entry] of root.entries()){
        if(entry.kind==='directory')await walk(entry,`${prefix}${name}/`,files);
        else if(/\.(mp3|flac|m4a|wav|ogg|aac|opus|mp4|webm|mov|lrc|png|jpe?g|webp)$/i.test(name)){const file=await entry.getFile();handles.set(file,entry);filePaths.set(file,prefix+name);files.push(file);}
    }}
    const linkPlaylist=document.querySelector('#local-link-playlist');
    const linkPreview=document.querySelector('#local-link-preview');
    const linkRows=document.querySelector('#local-link-preview-rows');
    let linkGroups=[],linkPreviewPlaylist=null;
    async function previewExistingFiles(files){
        await libraryReady;
        const playlist=playlists.find(p=>String(p.id)===linkPlaylist.value);
        if(!playlist)throw new Error('请先选择要关联的网站歌单。');
        linkPreviewPlaylist=playlist.id;linkGroups=[];linkRows.replaceChildren();
        const candidates=tracks.filter(track=>playlist.songIds.includes(track.id));
        const prior=[];
        for(const other of playlists){
            if(other.id===playlist.id)continue;
            for(const id of other.songIds){
                const refs=await remembered(`user:${account.id}:playlist:${other.id}:song:${id}`);
                if(refs?.audio)prior.push({playlist:other.name,refs});
            }
        }
        for(const group of mediaGroups(files)){
            const file=group.file;
            let title=file.name.replace(/\.[^.]+$/,''),artist='';
            try{const tags=(await (await parser())(file,{skipCovers:true})).common;title=tags.title || title;artist=tags.artist || '';}catch{}
            const byName=candidates.filter(track=>normalized(track.title)===normalized(title) && (!artist || normalized(track.artist)===normalized(artist)));
            const byFile=candidates.filter(track=>track.fileName===file.name && (!track.fileSize || track.fileSize===file.size));
            const matches=byName.length===1?byName:byFile.length===1?byFile:[];
            const duplicate=[];
            for(const {playlist:source,refs} of prior){
                if(refs.fileName!==file.name || refs.fileSize!==file.size)continue;
                const chosen=handles.get(file);
                if(chosen && refs.audio?.isSameEntry){try{if(!(await chosen.isSameEntry(refs.audio)))continue;}catch{}}
                duplicate.push(source);
            }
            const row=document.createElement('tr');
            const name=document.createElement('td');name.textContent=filePaths.get(file) || file.webkitRelativePath || file.name;
            const choice=document.createElement('td');const select=document.createElement('select');
            select.append(new Option('暂不关联',''));
            for(const track of candidates)select.append(new Option(`${track.title} · ${track.artist || '未知歌手'}`,String(track.id)));
            if(matches.length===1)select.value=String(matches[0].id);
            choice.append(select);
            const warning=document.createElement('td');
            if(duplicate.length){
                const label=document.createElement('label'),allow=document.createElement('input');allow.type='checkbox';
                label.append(allow,document.createTextNode(` 疑似已用于 ${[...new Set(duplicate)].join('、')}；勾选后复用`));warning.append(label);
            }else warning.textContent='未发现跨歌单重复';
            row.append(name,choice,warning);linkRows.append(row);linkGroups.push({group,row,select,duplicate,matchKey:`${normalized(title)}:${normalized(artist)}`});
        }
        const candidateCounts=new Map();
        for(const item of linkGroups)candidateCounts.set(item.matchKey,(candidateCounts.get(item.matchKey)||0)+1);
        for(const item of linkGroups)if(candidateCounts.get(item.matchKey)>1){
            item.row.lastElementChild.append(document.createElement('br'),document.createTextNode(`本次文件夹有 ${candidateCounts.get(item.matchKey)} 份同名候选，请检查是否重复下载`));
        }
        linkPreview.hidden=!linkGroups.length;
        status.textContent=`已检查 ${linkGroups.length} 组音视频；请逐项核对“网站歌曲”和重复提示，再确认关联。此时尚未保存。`;
    }
    document.querySelector('#local-link-confirm').addEventListener('click',async()=>{
        if(String(linkPreviewPlaylist)!==linkPlaylist.value){status.textContent='目标歌单已改变，请重新选择本机文件夹。';return;}
        const chosen=linkGroups.filter(item=>item.select.value);
        if(!chosen.length){status.textContent='请先在预览中选择至少一首网站歌曲。';return;}
        if(chosen.some(item=>item.duplicate.length && !item.row.querySelector('input[type=checkbox]').checked)){
            status.textContent='有文件疑似已用于其他歌单。请取消该行关联，或勾选明确复用。';return;
        }
        const used=new Set();
        if(chosen.some(item=>{if(used.has(item.select.value))return true;used.add(item.select.value);return false;})){
            status.textContent='同一首网站歌曲本次只能关联一个文件，请调整预览选择。';return;
        }
        const button=document.querySelector('#local-link-confirm');button.disabled=true;
        try{
            playlistSelect.value=String(linkPreviewPlaylist);await loadBindings();
            for(const item of chosen){
                const track=tracks.find(t=>String(t.id)===item.select.value),{file,videoFile}=item.group;
                Object.assign(track,{file,handle:handles.get(file),videoFile,videoHandle:videoFile?handles.get(videoFile):null,
                    deviceFileName:file.name,deviceFileSize:file.size,coverHandle:handles.get(coverFiles.get(stem(file))) || track.coverHandle,
                    lyricHandle:lyricHandles.get(stem(file)),availability:'linked',ready:false});
                track.sidecar=sidecars.get(stem(file));
                await prepare(track);await persistBinding(track);await persistLyrics(track);
            }
            localStorage.setItem(`sekai.local.playlist.${account.id}`,playlistSelect.value);
            refreshOptions();linkPreview.hidden=true;
            status.textContent=`已为“${playlists.find(p=>String(p.id)===linkPlaylist.value).name}”关联 ${chosen.length} 首。其他歌单的本机文件关联未改变。`;
            void refreshPlaylistAudit();
        }catch(error){status.textContent=`关联未全部完成：${error.message}`;}
        finally{button.disabled=false;}
    });
    async function linkDirectory(root){
        await libraryReady;
        const files=[];sidecars.clear();coverFiles.clear();lyricHandles.clear();
        status.textContent='正在扫描所选文件夹及子文件夹，文件较多时请稍候…';
        await walk(root,`${root.name}/`,files);
        for(const file of files){if(/\.lrc$/i.test(file.name)){sidecars.set(stem(file),file);lyricHandles.set(stem(file),handles.get(file));}
            if(/\.(png|jpe?g|webp)$/i.test(file.name))coverFiles.set(stem(file),file);}
        await previewExistingFiles(files);
    }
    document.querySelector('#local-link-existing').addEventListener('click',async()=>{
        if(!account){status.textContent='请先登录并等待账户歌曲加载完成。';return;}
        if(!linkPlaylist.value){status.textContent='请先选择要关联的网站歌单。';linkPlaylist.focus();return;}
        if(!window.showDirectoryPicker){status.textContent='此浏览器不支持持久文件夹授权。请用最新版 Edge 或 Chrome 关联本机歌单。';return;}
        try{await linkDirectory(await showDirectoryPicker({mode:'read'}));}
        catch(error){status.textContent=error.name==='AbortError'?'已取消选择文件夹。':`预览失败：${error.message}`;}
    });
    document.querySelector('#local-link-folder').addEventListener('change',async event=>{
        try{throw new Error('此浏览器不支持持久文件夹授权。请用最新版 Edge 或 Chrome。');}
        catch(error){status.textContent=`预览失败：${error.message}`;}
        finally{event.target.value='';}
    });
    document.querySelector('#local-remember').addEventListener('click',async()=>{
        if(!window.showDirectoryPicker){document.querySelector('#local-folder').click();return;}
        try{const root=await showDirectoryPicker({mode:'read'});if(playbackPage){await linkDirectory(root);return;}const files=[];await walk(root,`${root.name}/`,files);await previewFiles(files);
            pendingFiles.root=root;
        }catch(error){if(error.name!=='AbortError')status.textContent='文件夹未获授权或匹配失败，请重试。';}
    });
    document.querySelector('#local-restore').addEventListener('click',async()=>{
        await libraryReady;
        try{const roots=await remembered(`user:${account?.id || 'guest'}:directories`)||[];
            for(const root of roots){if(await root.queryPermission({mode:'read'})!=='granted')await root.requestPermission({mode:'read'});}
            for(const track of tracks){if(!track.handle)continue;try{const permission=await track.handle.queryPermission({mode:'read'});if(permission==='granted' || await track.handle.requestPermission({mode:'read'})==='granted'){await track.handle.getFile();track.availability='linked';}else track.availability='permission';}catch{track.availability='missing';}}refreshOptions();
            document.querySelector('#local-restore').hidden=!tracks.some(track=>track.availability==='permission');
            const linked=tracks.filter(track=>track.availability==='linked').length;
            status.textContent=`已恢复${linked}首本机歌曲，无需重新扫描或匹配。${tracks.some(track=>track.availability==='permission')?'仍有文件未授权，请允许访问；浏览器提供选项时可选择“每次访问都允许”。':!linked?'此浏览器尚无可读取的关联，请使用关联文件夹功能保存授权。':''}`;
            if(playbackPage && current>=0)await select(current,true);
        }catch(error){status.textContent='本机文件不可用，请重新选择音乐文件夹。';}
    });
    let selectedFiles=[];
    const matchFiles=document.querySelector('#local-match-files');
    matchFiles.addEventListener('click',async()=>{
        try{await previewFiles(selectedFiles);}catch(error){status.textContent=error.message;}
    });
    for (const id of ['local-files','local-folder']) document.querySelector(`#${id}`).addEventListener('change',event=>{
        selectedFiles=[...event.target.files];matchFiles.disabled=!selectedFiles.length;
        status.textContent=selectedFiles.length?`已选择 ${selectedFiles.length} 个文件，请点“匹配歌名、封面和 LRC”查看结果。`:'请选择音频或视频文件。';
    });
    document.querySelector('#local-files').addEventListener('click',async event=>{
        if(!window.showOpenFilePicker)return;event.preventDefault();
        try{const entries=await showOpenFilePicker({multiple:true,types:[{description:'音视频、歌词和封面',accept:{'audio/mpeg':['.mp3','.flac','.m4a','.wav','.ogg','.aac','.opus'],'video/mp4':['.mp4','.mov'],'video/webm':['.webm'],'text/plain':['.lrc'],'image/jpeg':['.jpg','.jpeg','.png','.webp']}}]});
            const files=[];for(const entry of entries){const file=await entry.getFile();handles.set(file,entry);files.push(file);}selectedFiles=files;matchFiles.disabled=!files.length;status.textContent=`已选择 ${files.length} 个文件，请点“匹配歌名、封面和 LRC”查看结果。`;
        }catch(error){if(error.name!=='AbortError')status.textContent=error.message;}
    });
    async function previewFiles(files){
        await libraryReady;importConfirm.disabled=true;status.textContent='正在本机检查封面和歌词，不保存账户、不上传音频…';
        const target=requestedSongId?tracks.find(track=>String(track.id)===requestedSongId):null;
        if(requestedSongId && !target)throw new Error('目标歌曲不属于当前账户，请先登录正确账户。');
        if(target && mediaGroups(files).length!==1)throw new Error('关联本首歌曲时请选择一组同名音视频，可同时选择同名歌词和封面。');
        pendingBindingId=target?.id ?? null;
        for(const track of pendingTracks)if(track.cover?.startsWith('blob:'))URL.revokeObjectURL(track.cover);
        pendingFiles=files;pendingTracks=[];
        sidecars.clear();coverFiles.clear();lyricHandles.clear();
        for(const file of files){if(/\.lrc$/i.test(file.name))sidecars.set(stem(file),file);if(/\.(png|jpe?g|webp)$/i.test(file.name))coverFiles.set(stem(file),file);}
        const results=document.querySelector('#local-import-results');results.replaceChildren();
        for(const group of mediaGroups(files)){
            const file=group.file;
            const track={file,videoFile:group.videoFile,videoHandle:handles.get(group.videoFile),lyricHandle:handles.get(sidecars.get(stem(file)))};await prepare(track);
            const nameMatches=tracks.filter(item=>normalized(item.title)===normalized(track.title) && normalized(item.artist)===normalized(track.artist));
            const known=target || tracks.find(item=>(item.fileName===file.name && (!item.fileSize || item.fileSize===file.size)) || item.videoFileName===file.name) || (nameMatches.length===1?nameMatches[0]:null);
            if(known){track.title=known.title;track.artist=known.artist;track.album=known.album;if(!track.rows.length)track.rows=parseLyrics(known.lyrics || '');if(!track.cover)track.cover=known.coverUrl;}
            pendingTracks.push(track);
            const row=document.createElement('tr');
            for(const text of [track.title+(track.artist?` · ${track.artist}`:'')+(known?' · 已匹配站内歌曲':''),group.videoFile?'音频 + 视频':isVideo(file)?'视频 · 原画面':'音频',track.cover?'已匹配':'缺封面',isVideo(file)?'视频无需歌词':track.rows.length?`${track.rows.length}行已匹配`:'缺同步歌词']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}results.append(row);
        }
        importPanel.querySelector('h2').textContent=target?'确认关联本首歌曲':'检查匹配结果';
        importTarget.closest('label').hidden=!!target;
        importName.hidden=!!target || importTarget.value!=='new';
        importConfirm.textContent=target?'确认关联并播放':'确认导入';
        importPanel.hidden=!pendingTracks.length;
        importConfirm.disabled=!account || !pendingTracks.length;
        status.textContent=pendingTracks.length?`已检查${pendingTracks.length}首。${target?'确认后仅关联当前歌曲，不新增歌曲、不改变歌单。':account?'选择保存位置后确认导入。':'请先登录，再重新选择文件后保存到账户。'}${!window.showOpenFilePicker?'此浏览器下次播放可能需要重新选择文件。':''}`:'没有找到支持的音视频文件（音频或 MP4、WebM、MOV；实际播放取决于浏览器解码支持）。';
    }
    importTarget.addEventListener('change',()=>{importName.hidden=importTarget.value!=='new';});
    importConfirm.addEventListener('click',async()=>{
        if(!account || !pendingTracks.length)return;
        if(pendingBindingId==null && importTarget.value==='new' && !importName.value.trim()){status.textContent='请填写新歌单名称。';return;}
        importConfirm.disabled=true;
        try{
            if(pendingBindingId!=null){
                await addFiles(pendingFiles,true,true,pendingBindingId);
                importPanel.hidden=true;await select(tracks.findIndex(track=>track.id===pendingBindingId),true);return;
            }
            let playlistId=importTarget.value;
            if(playlistId==='new'){const created=await api('/playlists',{name:importName.value.trim()});playlistId=String(created.id);importTarget.append(new Option(importName.value.trim(),playlistId));importTarget.value=playlistId;}
            status.textContent='正在保存歌曲字段与歌单关系，音频不上传…';
            playlistSelect.value=playlistId==='library'?'all':playlistId;await loadBindings();
            const ids=await addFiles(pendingFiles,false,true);
            localStorage.setItem(`sekai.local.playlist.${account.id}`,playlistSelect.value);
            if(playlistId!=='library')for(const id of ids)await api(`/playlists/${playlistId}/songs/${id}`);
            if(pendingFiles.root){const key=`user:${account.id}:directories`,roots=await remembered(key)||[];let exists=false;for(const root of roots)if(await root.isSameEntry(pendingFiles.root))exists=true;if(!exists)roots.push(pendingFiles.root);await remembered(key,roots);}
            if(requestedSong){
                const index=tracks.findIndex(track=>String(track.id)===requestedSongId);
                if(index>=0 && tracks[index].availability==='linked'){importPanel.hidden=true;await select(index,true);return;}
            }
            location.href=playlistId==='library'?'/songs':`/playlists/${playlistId}`;
        }catch(error){status.textContent=`导入未全部完成：${error.message} 已保存的字段保留，重试不会重复添加同一文件。`;importConfirm.disabled=false;}
    });
    songSelect.addEventListener('change',()=>{if(songSelect.value!=='')select(Number(songSelect.value));});
    linkPlaylist.addEventListener('change',()=>{linkPreview.hidden=true;linkPreviewPlaylist=null;});
    playlistSelect.addEventListener('change',async()=>{if(account)localStorage.setItem(`sekai.local.playlist.${account.id}`,playlistSelect.value);frame.contentDocument?.querySelector('audio')?.pause();frame.hidden=true;current=-1;await loadBindings();status.textContent=bindingPlaylistId()?'已切换歌单；只显示这个歌单独立关联的本机文件。':'已切换到歌曲库关联。';});
    modeSelect.addEventListener('change',()=>changeMode(modeSelect.value));
    async function chooseLrc(file,handle){
        if (!file || current<0 || !tracks[current].file) return;
        const rows=parseLyrics(await readLocalLyric(file));
        if (!rows.length) {status.textContent='此歌词没有可识别的时间戳，不能做同步演出。';return;}
        tracks[current].rows=rows;render(snapshot());
        tracks[current].sidecar=file;tracks[current].lyricHandle=handle;await persistBinding(tracks[current]);
        await persistLyrics(tracks[current]);void refreshPlaylistAudit();
    }
    document.querySelector('#local-lrc').addEventListener('change',event=>chooseLrc(event.target.files[0]));
    document.querySelector('#local-favorite').addEventListener('click',async()=>{
        const track=tracks[current];if(!account || !track?.id){status.textContent='请登录并关联歌曲后收藏。';return;}
        try{await api(`/songs/${track.id}/favorite`);track.favorite=!track.favorite;refreshOptions();document.querySelector('#local-favorite').textContent=track.favorite?'取消收藏':'收藏当前歌曲';}catch(error){status.textContent=error.message;}
    });
    document.querySelector('#local-remove').addEventListener('click',async()=>{
        const track=tracks[current];if(!account || !track?.id)return;
        if(!confirm(`从账户和歌单删除“${track.title}”？不会删除你的本地文件。`))return;
        try{await api(`/songs/${track.id}`,undefined,'DELETE');frame.contentDocument?.querySelector('audio')?.pause();tracks.splice(current,1);current=-1;frame.hidden=true;refreshOptions();status.textContent='账户歌曲已删除，本地文件保留。';}catch(error){status.textContent=error.message;}
    });
    libraryReady=loadLibrary().catch(error=>{status.textContent=error.message;});
    setInterval(async()=>{const track=tracks[current];if(!track?.handle)return;try{await track.handle.getFile();}catch(error){unavailable(track,error);}},30000);
    async function chooseCover(file,handle){
        if (!file || current<0 || !tracks[current].file) return;
        if (tracks[current].cover) URL.revokeObjectURL(tracks[current].cover);
        tracks[current].cover=URL.createObjectURL(file);tracks[current].coverHandle=handle;tracks[current].coverBlob=handle?null:file;render(snapshot());await persistBinding(tracks[current]);void refreshPlaylistAudit();
    }
    document.querySelector('#local-cover').addEventListener('change',event=>chooseCover(event.target.files[0]));
    for(const [id,choose,accept] of [['local-lrc',chooseLrc,{'text/plain':['.lrc']}],['local-cover',chooseCover,{'image/jpeg':['.jpg','.jpeg'],'image/png':['.png'],'image/webp':['.webp']}]]){
        document.querySelector(`#${id}`).addEventListener('click',async event=>{if(!window.showOpenFilePicker)return;event.preventDefault();
            try{const [handle]=await showOpenFilePicker({types:[{description:id==='local-lrc'?'同步歌词':'封面',accept}]});await choose(await handle.getFile(),handle);}catch(error){if(error.name!=='AbortError')status.textContent='本地文件无法读取，请重新选择。';}
        });
    }
    document.querySelector('#local-cloud').addEventListener('click',async event=>{
        if (current<0) return;
        const track=tracks[current]; event.target.disabled=true;
        status.textContent='正在匹配歌词，只发送歌曲标题和歌手，不发送音频…';
        try {
            const response=await fetch(`/local-player/lyrics?${new URLSearchParams({title:track.title,artist:track.artist})}`);
            const result=await response.json(); if (!response.ok) throw new Error(result.message || '歌词查询失败');
            const rows=parseLyrics(result.lyrics); if (!rows.length) throw new Error('未找到同步歌词，请选择本地LRC。');
            track.rows=rows;await persistLyrics(track); if (tracks[current]===track) render(snapshot());
        } catch(error) {status.textContent=error.message;} finally {event.target.disabled=false;}
    });
    window.addEventListener('pagehide',()=>{for (const track of tracks) {if(track.url) URL.revokeObjectURL(track.url);if(track.cover) URL.revokeObjectURL(track.cover);}});
})();
