(() => {
    'use strict';
    const player=window.parent !== window ? window.parent.__sekaiLocalPlayer : null;
    const track=player?.track;
    window.__sekaiBrowserLocal=true;
    if (!track) {
        document.querySelector('main').replaceChildren(Object.assign(document.createElement('p'),{textContent:'请从“打开本地音乐”页面选择文件。'}));
        return;
    }
    const finder=document.querySelector('[data-asset-finder]');
    if(track.id && finder){finder.href=`/songs/${encodeURIComponent(track.id)}/assets`;finder.hidden=false;}
    const serverMedia=document.querySelector('[data-server-media]');
    if(serverMedia && (track.file && track.videoFile || !track.file && track.serverAudioUrl && track.serverVideoUrl || track.remoteVideoUrl)){
        serverMedia.hidden=false;
        serverMedia.textContent=track.serverMedia==='video'?'切换到音频':'切换到视频';
        serverMedia.addEventListener('click',()=>player.toggleServerMedia());
    }
    const style=document.createElement('style');
    style.textContent='.sidebar{display:none!important}.app-shell{display:block!important}.content{margin:0!important;width:100%!important;max-width:none!important}.player-layout{padding:0!important}.stage-tools form{display:none!important}.content>p.empty{display:none}';
    document.head.append(style);
    const stage=document.querySelector('.now-playing');
    stage.dataset.songId=track.key; stage.dataset.songTitle=track.title; stage.dataset.songArtist=track.artist;
    stage.dataset.songUrl='/local-player';
    document.querySelectorAll('h1,.lyric-track-mini strong').forEach(node=>node.textContent=track.title);
    document.querySelectorAll('.stage-copy-sub,.lyric-song-meta>p:last-child,.lyric-track-mini span').forEach(node=>node.textContent=[track.artist,track.album].filter(Boolean).join(' · '));
    document.querySelectorAll('.stage-bg-img,.cover-large,.stage-disc-cover,.lyric-backdrop img,.lyric-track-mini img').forEach(node=>node.src=track.cover || '/images/login-music-room.png');
    const videoPlaying=/\.(mp4|webm|mov)$/i.test(track.activeMediaFileName || track.remoteFileName || track.fileName || '');
    const lyrics=document.querySelector('#lyrics'); lyrics.replaceChildren();
    for (const row of videoPlaying?[]:track.rows) {
        const p=document.createElement('p'); p.dataset.time=String(row.seconds);
        const text=document.createElement('b');text.textContent=row.text;p.append(text);lyrics.append(p);
    }
    if (!videoPlaying && !track.rows.length) {const p=document.createElement('p');p.className='empty';p.textContent='请选择含时间戳的LRC歌词，或在上方匹配云端歌词。';lyrics.append(p);}
    const queue=document.querySelector('.queue-list');queue.replaceChildren();
    for (const item of player.queue) {
        const link=document.createElement('a');link.href='#';link.textContent=item.title;link.classList.toggle('active',item.index===track.index);
        link.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();player.select(item.index);},true);queue.append(link);
    }
    document.querySelectorAll('.stage-queue-badge').forEach(node=>node.textContent=player.queue.length);
    document.querySelector('[data-stage-drawer] .stage-drawer-head span').textContent=`${player.queue.length}首本地音乐`;
    const audio=document.querySelector('audio'); audio.src=track.url;audio.preload='metadata';
    if (videoPlaying) {
        import('/js/local-video.js?v=20261026-video-only').then(({mountVideo})=>mountVideo({audio,track,stage})).catch(()=>{
            window.parent.document.querySelector('#local-status').textContent='视频组件加载失败，请刷新重试。';
        });
    }
    window.parent.__sekaiListening?.attach(audio,track,stage.dataset.stageMode);
    audio.addEventListener('loadedmetadata',()=>{
        if(player.track!==track)return;
        const saved=Number(track.restore.time);
        audio.currentTime=Number.isFinite(saved) && saved>0 && saved<audio.duration-3?saved:0;
        window.__sekaiLocalRestoreReady=true;
        if(track.restore.playing) audio.play().catch(()=>{});
    },{once:true});
    audio.addEventListener('pause',()=>player.savePreferences());
    audio.addEventListener('volumechange',()=>player.savePreferences());
    audio.addEventListener('ratechange',()=>player.savePreferences());
    let savedAt=0;audio.addEventListener('timeupdate',()=>{if(Date.now()-savedAt>10000){savedAt=Date.now();player.savePreferences();}});
    document.addEventListener('click',event=>{if(event.target.closest('[data-player-action="mode"],[data-add-bookmark],[data-bookmark-delete],[data-loop-action]'))setTimeout(()=>player.savePreferences(),0);});
    audio.addEventListener('error',()=>{if(player.track?.key!==track.key)return;if(audio.error?.code===2)player.markUnavailable(track.key);else window.parent.document.querySelector('#local-status').textContent='浏览器无法解码此音频，请选择受支持的MP3、FLAC、M4A或WAV文件。';});
    audio.addEventListener('ended',event=>{
        event.stopImmediatePropagation();
        if(player.track!==track)return;
        if(localStorage.getItem('sekai.player.playMode')==='repeat-one'){audio.currentTime=0;audio.play().catch(()=>{});} else player.next();
    },true);
    for(const [action,handler] of [['previous',player.previous],['next',player.next]]) {
        document.querySelectorAll(`[data-player-action="${action}"]`).forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();handler();},true));
    }
})();
