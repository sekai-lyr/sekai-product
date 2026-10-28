export function mountVideo({audio,track,stage}) {
    const video=document.createElement('video');
    video.src=track.url;
    video.muted=true;
    video.playsInline=true;
    video.preload='metadata';
    video.setAttribute('aria-label','本地视频原画面');
    video.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:3;pointer-events:none';
    stage.append(video);
    const sync=()=>{
        video.playbackRate=audio.playbackRate;
        if(Number.isFinite(video.duration) && Math.abs(video.currentTime-audio.currentTime)>.12)video.currentTime=audio.currentTime;
        if(audio.paused || audio.seeking)video.pause();else video.play().catch(()=>{});
    };
    for(const event of ['play','pause','seeking','seeked','timeupdate','ratechange','ended'])audio.addEventListener(event,sync);
    video.addEventListener('loadedmetadata',sync);
    video.addEventListener('error',()=>{
        window.parent.document.querySelector('#local-status').textContent='浏览器无法解码此视频，请使用 H.264/AAC MP4 或受支持的 WebM。';
    });
    window.addEventListener('pagehide',()=>video.pause(),{once:true});
    sync();
}
