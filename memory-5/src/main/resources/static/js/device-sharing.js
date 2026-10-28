import {connectBrowser,readSource} from './browser-sharing.mjs?v=20261026-playlist';

const notice=document.querySelector('#device-notice'),list=document.querySelector('#device-list');
const summary=document.querySelector('#browser-summary'),choose=document.querySelector('#browser-choose');
const start=document.querySelector('#browser-start'),stop=document.querySelector('#browser-stop');
const playlistSelect=document.querySelector('#sharing-playlist'),playlistStatus=document.querySelector('#sharing-playlist-status');
let account,csrf='',songs=[],playlists=[],record={roots:[],index:{files:[]}},provider,busy=false,ended=false,timer,releaseLock;
let databasePromise;
function database(){return databasePromise ||=new Promise((resolve,reject)=>{
    const request=indexedDB.open('sekai-browser-sharing',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('devices');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
async function saved(value){const db=await database();return new Promise((resolve,reject)=>{
    const tx=db.transaction('devices',value?'readwrite':'readonly'),request=value?tx.objectStore('devices').put(value,account):tx.objectStore('devices').get(account);
    tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
async function api(path,body){
    const response=await fetch('/api/device-sharing'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Local-Library-CSRF':csrf},body:body?JSON.stringify(body):undefined});
    if(!response.ok){const e=Error(response.status===401?'登录已过期，请重新登录。':response.status===409?'设备离线或共享被阻止，请重新开始共享。':'操作未完成（'+response.status+'）');e.status=response.status;throw e;}
    return response.json();
}
function show(){
    const count=record.index.files.filter(f=>f.kind==='audio').length;
    const chosen=playlists.find(p=>String(p.id)===playlistSelect.value);
    summary.textContent=chosen?`已选“${chosen.name}”，当前可共享 ${count}/${chosen.songIds.length} 首。缺少文件请先到本地导入页关联。`:'请先选择要共享的网站歌单。';
    start.disabled=busy||!account||!chosen||!!provider;choose.disabled=busy||!chosen||!!provider;stop.disabled=!provider;
    playlistSelect.disabled=busy||!!provider;
}
async function refreshAudit(){
    const reports=await window.SekaiPlaylistAudit.audit({user:{id:account},songs,playlists});
    window.SekaiPlaylistAudit.render(document.querySelector('#sharing-playlist-audit'),reports);
    const chosen=reports.find(p=>String(p.playlist.id)===playlistSelect.value);
    playlistStatus.textContent=chosen?`此歌单 ${chosen.counts.total} 首；缺音频 ${chosen.counts.audio}、缺视频 ${chosen.counts.video}、缺本机封面 ${chosen.counts.cover}、缺 LRC ${chosen.counts.lyric}，待授权 ${chosen.counts.permission}。`:'选择歌单后查看缺失情况。';
    document.querySelector('#sharing-link-playlist').href=chosen?`/local-player?playlistId=${chosen.playlist.id}`:'/local-player';
    return chosen;
}
function finish(){provider?.close();provider=null;releaseLock?.();releaseLock=null;show();}
async function refresh(){
    if(ended||!account)return;
    try{
        const check=await fetch('/user/keep-alive');if(!check.ok){finish();throw Error('登录已失效，共享已停止。');}
        const devices=await api('/devices');list.replaceChildren();
        if(provider && !devices.some(device=>device.id===record.deviceId&&!device.revoked)){finish();throw Error('账号已变化或设备已撤销，共享已停止。');}
        if(provider&&devices.some(device=>device.id===record.deviceId&&device.sharing))notice.textContent='共享中，请保持此网页打开。';
        if(!devices.length){list.textContent='选择文件夹后点击“开始共享”，将自动连接，无需配对码。';return;}
        for(const device of devices){
            const row=document.createElement('article');row.className='shared-device';
            const info=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('p');
            name.textContent=device.name+(record.deviceId===device.id?' · 此浏览器':'');
            detail.textContent=`${device.revoked?'已撤销':device.pending?'正在确认':!device.online?'离线':device.sharing?'共享中':'在线 · 已停止'} · ${device.activeStreams} 路播放 · ${(device.bytesSent/1048576).toFixed(1)} MB`;
            info.append(name,detail);row.append(info);
            if(device.sharing){const remoteStop=document.createElement('button');remoteStop.type='button';remoteStop.textContent='停止共享';
                remoteStop.onclick=async()=>{try{await api(`/devices/${device.id}/sharing`,{enabled:false});await refresh();}catch(e){notice.textContent=e.message;}};row.append(remoteStop);}
            if(!device.revoked){const revoke=document.createElement('button');revoke.type='button';revoke.textContent='取消绑定';
                revoke.onclick=async()=>{if(!confirm('取消这台设备的绑定并停止共享？歌曲和歌单不会删除。'))return;
                    try{await api(`/devices/${device.id}/revoke`,{});if(record.deviceId===device.id){finish();delete record.deviceId;await saved(record);}await refresh();}catch(e){notice.textContent=e.message;}};row.append(revoke);}
            list.append(row);
        }
    }catch(e){notice.textContent=e.message;}
}
async function scan(requestAccess=false){
    const report=await refreshAudit();
    if(!report)throw Error('请先选择要共享的网站歌单。');
    const files=[];
    async function add(songId,kind,handle){
        if(!handle)return;
        let permission=await handle.queryPermission({mode:'read'});
        if(permission!=='granted' && requestAccess)permission=await handle.requestPermission({mode:'read'});
        if(permission!=='granted')return;
        try{const file=await handle.getFile();files.push({songId,kind,handle,size:file.size,lastModified:file.lastModified,
            extension:window.SekaiPlaylistAudit.extension(file.name),playlistId:report.playlist.id});}catch{}
    }
    for(const entry of report.entries){
        await add(entry.song.id,'audio',entry.refs?.audio);
        if(!files.some(file=>file.songId===entry.song.id && file.kind==='audio'))continue;
        await add(entry.song.id,'video',entry.refs?.video);
        await add(entry.song.id,'lyric',entry.refs?.lyric);
        await add(entry.song.id,'cover',entry.refs?.cover || entry.global?.cover);
        const coverBlob=entry.refs?.coverBlob || entry.global?.coverBlob;
        if(!entry.refs?.cover && !entry.global?.cover && coverBlob instanceof File){
            const file=coverBlob;
            files.push({songId:entry.song.id,kind:'cover',file,size:file.size,lastModified:file.lastModified,
                extension:window.SekaiPlaylistAudit.extension(file.name),playlistId:report.playlist.id});
        }
    }
    record.index={files};record.scope=report.playlist.id;
    await saved({...record,index:{files:files.filter(f=>f.handle)}});
    show();
}
playlistSelect.onchange=async()=>{
    record.index={files:[]};record.scope=playlistSelect.value || null;
    try{await refreshAudit();if(record.scope)await scan();notice.textContent='已切换歌单。共享前会再次核对本机文件授权。';}
    catch(e){notice.textContent=e.message;}show();
};
choose.onclick=()=>{if(playlistSelect.value)location.href=`/local-player?playlistId=${playlistSelect.value}`;};
start.onclick=async()=>{
    busy=true;show();
    try{
        // Permission prompts occur only after the user clicks Start.
        notice.textContent='正在核对这个歌单的本机文件…';await scan(true);
        if(!record.index.files.some(file=>file.kind==='audio'))throw Error('此歌单没有可读取的本机音视频。请先关联文件或恢复浏览器授权。');
        if(navigator.locks){await new Promise((resolve,reject)=>{
            navigator.locks.request('sekai-browser-sharing-'+account,{ifAvailable:true},async lock=>{
                if(!lock){reject(Error('此浏览器另一个标签页正在共享，请先在那边停止。'));return;}
                await new Promise(release=>{releaseLock=release;resolve();});
            }).catch(reject);
        });}
        if(ended){releaseLock?.();return;}
        // Read metadata only; do not load complete audio files into memory.
        for(const file of record.index.files.filter(f=>f.kind==='audio'))await readSource(file);
        let credentials;
        try{credentials=await api('/browser-device',record.deviceId?{deviceId:record.deviceId}:{});}
        catch(e){if(e.status!==404)throw e;delete record.deviceId;credentials=await api('/browser-device',{});}
        record.deviceId=credentials.deviceId;
        await saved({...record,index:{files:record.index.files.filter(f=>f.handle)}});
        const connection=connectBrowser({site:location.origin,credentials,index:record.index,onStatus:(message,enabled)=>{if(enabled===false)finish();notice.textContent=message;},onClose:()=>{
            if(provider===connection){provider=null;releaseLock?.();releaseLock=null;notice.textContent='共享连接已断开；请检查网络后点击“开始共享”。';show();}
        }});provider=connection;await connection.ready;
        if(ended||provider!==connection)return;
        await api(`/devices/${credentials.deviceId}/sharing`,{enabled:true});
        notice.textContent='正在确认共享；显示“共享中”后其他设备即可播放。';await refresh();
    }catch(e){finish();notice.textContent=e.message;}
    finally{busy=false;show();}
};
stop.onclick=async()=>{const id=record.deviceId;provider?.stop();finish();notice.textContent='已停止共享，文件夹关联仍然保留。';try{if(id)await api(`/devices/${id}/sharing`,{enabled:false});}catch{}await refresh();};
(async()=>{
    try{
        const response=await fetch('/local-player/library');if(!response.ok)throw Error('请先登录。');
        const library=await response.json();account=library.user.id;csrf=library.csrf;songs=library.songs;playlists=library.playlists;
        record=await saved()||record;delete record.token;record.index={files:[]};
        playlistSelect.append(...playlists.map(p=>new Option(p.name,String(p.id))));
        if(playlists.some(p=>String(p.id)===String(record.scope)))playlistSelect.value=String(record.scope);
        await refreshAudit();if(playlistSelect.value)await scan();
        // Discard credentials from any legacy/foreign record: only IDs and handles are durable.
        delete record.token;show();await refresh();timer=setInterval(refresh,10000);
    }catch(e){notice.textContent=e.message;}
})();
window.addEventListener('pagehide',()=>{ended=true;clearInterval(timer);finish();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
