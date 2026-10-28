(() => {
    const video=/\.(mp4|webm|mov)$/i;
    const timed=/\[\d{1,3}:\d{2}(?:[.:]\d+)?\]/;
    const extension=name=>String(name || '').slice(String(name || '').lastIndexOf('.')).toLowerCase();
    let database;
    function open(){
        return database ||= new Promise((resolve,reject)=>{
            const request=indexedDB.open('sekai-local-file-handles',1);
            request.onupgradeneeded=()=>request.result.createObjectStore('references');
            request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });
    }
    async function reference(key){
        const db=await open();
        return new Promise((resolve,reject)=>{
            const request=db.transaction('references').objectStore('references').get(key);
            request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });
    }
    async function fileState(handle){
        if(!handle)return 'missing';
        try{
            if(await handle.queryPermission({mode:'read'})!=='granted')return 'permission';
            await handle.getFile();return 'ready';
        }catch{return 'missing';}
    }
    async function audit(library){
        const songs=new Map(library.songs.map(song=>[song.id,song]));
        const result=[];
        for(const playlist of library.playlists){
            const entries=[];
            for(const id of playlist.songIds){
                const song=songs.get(id);if(!song)continue;
                const refs=await reference(`user:${library.user.id}:playlist:${playlist.id}:song:${id}`);
                const global=await reference(`user:${library.user.id}:song:${id}`);
                const primary=refs?.audio;
                const audio=primary && !video.test(primary.name) ? await fileState(primary) : 'missing';
                const movie=refs?.video ? await fileState(refs.video) : primary && video.test(primary.name) ? await fileState(primary) : 'missing';
                const coverHandle=refs?.cover || global?.cover;
                const localCover=refs?.coverBlob instanceof Blob || global?.coverBlob instanceof Blob || await fileState(coverHandle)==='ready';
                const lyric=timed.test(song.lyrics || '') || await fileState(refs?.lyric)==='ready';
                const videoOnly=video.test(primary?.name) || video.test(song.fileName) || video.test(song.videoFileName)
                    || !!song.serverVideoUrl && !song.serverAudioUrl;
                entries.push({song,refs,global,audio,movie,localCover,cover:localCover || !!song.coverUrl,lyric,videoOnly,
                    artist:!!song.artist,album:!!song.album,
                    missing:[...(audio==='missing' && !videoOnly?['音频']:[]),...(movie==='missing'?['视频']:[]),...(!localCover && !song.coverUrl?['封面']:[]),...(!lyric && !videoOnly?['LRC']:[])]});
            }
            result.push({playlist,entries,counts:{total:entries.length,audio:entries.filter(e=>e.audio==='missing'&&!e.videoOnly).length,
                video:entries.filter(e=>e.movie==='missing').length,cover:entries.filter(e=>!e.cover).length,
                lyric:entries.filter(e=>!e.lyric&&!e.videoOnly).length,artist:entries.filter(e=>!e.artist).length,
                album:entries.filter(e=>!e.album).length,permission:entries.filter(e=>e.audio==='permission'||e.movie==='permission').length}});
        }
        return result;
    }
    function render(container,reports){
        container.replaceChildren();
        for(const report of reports){
            const {playlist,entries,counts}=report;
            const section=document.createElement('details');section.className='playlist-audit';
            const summary=document.createElement('summary');
            summary.textContent=`${playlist.name} · ${counts.total} 首｜缺音频 ${counts.audio}｜缺视频 ${counts.video}｜缺封面 ${counts.cover}｜缺 LRC ${counts.lyric}｜缺歌手 ${counts.artist}${counts.permission?`｜待授权 ${counts.permission}`:''}`;
            section.append(summary);
            const list=document.createElement('ul');
            for(const entry of entries){
                const row=document.createElement('li');
                const title=document.createElement('strong');title.textContent=entry.song.title || '未命名歌曲';
                const detail=document.createElement('span');
                detail.textContent=`音频：${entry.videoOnly?'视频歌曲无需':entry.audio==='ready'?'已关联':entry.audio==='permission'?'待授权':'缺少'} · 视频：${entry.movie==='ready'?'已关联':entry.movie==='permission'?'待授权':'缺少'} · 封面：${entry.localCover?'本机可用':entry.cover?'网站可用':'缺少'} · LRC：${entry.videoOnly?'视频无需':entry.lyric?'可用':'缺少'} · 歌手：${entry.artist?'已填写':'缺少'} · 专辑：${entry.album?'已填写':'缺少'}`;
                const link=document.createElement('a');link.href=`/player/${entry.song.id}?playlistId=${playlist.id}`;link.textContent='关联这首';
                row.append(title,detail,link);list.append(row);
            }
            section.append(list);container.append(section);
        }
        if(!reports.length)container.textContent='还没有网站歌单。可先导入歌单链接或新建歌单。';
    }
    window.SekaiPlaylistAudit={audit,render,extension};
})();
