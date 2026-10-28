(() => {
    const retired=/^\/(?:songs\/(?:audio|video|cover)\/\d+|playlists\/\d+\/audio-folder|playlists\/local-audio-folder)$/;
    for (const form of document.querySelectorAll('form[enctype="multipart/form-data"]')) {
        if (!retired.test(new URL(form.action,location.href).pathname)) continue;
        const box=document.createElement('div');box.className='server-message';
        const message=document.createElement('p');message.textContent='音乐保留在你的设备上，选择文件即可播放并开启四种演出。';
        const link=document.createElement('a');link.href='/local-player';link.textContent='打开本地音乐';
        const video=new URL(form.action,location.href).pathname.match(/^\/songs\/video\/(\d+)$/);
        if(video){
            const params=new URLSearchParams({link:'1',media:'video'});
            const playlist=form.querySelector('[name="returnTo"]')?.value?.match(/^\/playlists\/(\d+)$/)?.[1];
            if(playlist)params.set('playlistId',playlist);
            link.href=`/player/${video[1]}?${params}`;link.textContent='关联本首本地视频';
            message.textContent='视频保留在你的设备。关联到当前歌曲后播放原画面和原声音轨，不新增歌曲、不改变歌单。';
        }
        box.append(message,link);form.replaceWith(box);
    }
})();
