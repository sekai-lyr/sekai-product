(() => {
    'use strict';
    let cache=[],updated=0;
    async function sources(force=false) {
        if(!force && Date.now()-updated<10000)return cache;
        try{const response=await fetch('/api/device-sharing/sources');cache=response.ok?await response.json():[];updated=Date.now();}catch{cache=[];}
        return cache;
    }
    async function prepare(track,parseLyrics) {
        const source=(await sources(true)).find(item=>String(item.songId)===String(track.id)
            && (track.playlistId ? String(item.playlistId)===String(track.playlistId) : item.playlistId==null));if(!source)return false;
        const base=`/api/device-sharing/media/${encodeURIComponent(source.deviceId)}/${encodeURIComponent(track.id)}`;
        const response=await fetch(base+'/audio',{method:'HEAD'});if(!response.ok)return false;
        const rows=parseLyrics(track.lyrics||'');
        if(!rows.length) {
            try{const lrc=await fetch(base+'/lyric');if(lrc.ok && Number(lrc.headers.get('Content-Length'))<=262144)rows.push(...parseLyrics(await lrc.text()));}catch{}
        }
        let cover=track.coverUrl||null;
        if(!cover){
            try{
                const picture=await fetch(base+'/cover');
                const size=Number(picture.headers.get('Content-Length'));
                if(picture.ok && Number.isSafeInteger(size) && size>0 && size<=8388608){
                    const blob=await picture.blob();if(blob.size<=8388608)cover=URL.createObjectURL(blob);
                }
            }catch{}
        }
        if(track.cover?.startsWith('blob:'))URL.revokeObjectURL(track.cover);
        if(track.url?.startsWith('blob:'))URL.revokeObjectURL(track.url);
        Object.assign(track,{remote:true,remoteSource:source,url:base+'/audio',remoteVideoUrl:source.videoExtension?base+'/video':null,
            rows,ready:true,cover,remoteFileName:'remote'+source.extension,availability:'remote'});
        return true;
    }
    window.SekaiDeviceSources={sources,prepare};
})();
