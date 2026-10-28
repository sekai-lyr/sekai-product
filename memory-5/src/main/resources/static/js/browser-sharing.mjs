const media=/\.(mp3|flac|m4a|wav|ogg|aac|opus|mp4|webm|mov)$/i;
const extension=name=>name.slice(name.lastIndexOf('.')).toLowerCase();
const stem=path=>path.replace(/\.[^/.]+$/,'').toLowerCase();
const limit=kind=>kind==='lyric'?262144:kind==='cover'?8388608:1099511627776;

export async function readSource(entry){
    if(entry.handle && await entry.handle.queryPermission({mode:'read'})!=='granted')throw Error('文件夹需要重新授权');
    const file=entry.handle?await entry.handle.getFile():entry.file;
    if(!file || file.size!==entry.size || file.lastModified!==entry.lastModified)throw Error('文件已删除或改变');
    return file;
}
export async function buildIndex({roots=[],files=[],songs}){
    const selected=[...files];let count=selected.length;
    async function walk(root,prefix=''){
        for await(const [name,handle] of root.entries()){
            if(++count>100000)throw Error('目录过大，请选择实际的音乐文件夹');
            if(handle.kind==='directory')await walk(handle,prefix+name+'/');
            else if(/\.(mp3|flac|m4a|wav|ogg|aac|opus|mp4|webm|mov|lrc|png|jpe?g|webp)$/i.test(name))
                selected.push({handle,file:await handle.getFile(),path:prefix+name});
        }
    }
    for(let n=0;n<roots.length;n++)await walk(roots[n],n+'/');
    const names=new Map(),sidecars=new Map();
    for(const entry of selected){
        const name=entry.file.name.toLowerCase();
        if(media.test(name)){if(!names.has(name))names.set(name,[]);names.get(name).push(entry);}
        else {const key=stem(entry.path||name);if(!sidecars.has(key))sidecars.set(key,[]);sidecars.get(key).push(entry);}
    }
    const index={files:[]},missing=[],ambiguous=[];
    function add(songId,kind,entry){
        const file=entry.file;if(file.size>limit(kind))return;
        index.files.push({songId,kind,size:file.size,lastModified:file.lastModified,extension:extension(file.name),
            ...(entry.handle?{handle:entry.handle}:{file})});
        if(index.files.length>30000)throw Error('共享项目超过 30000 项，请缩小目录范围');
    }
    for(const song of songs){
        let matches=(names.get(String(song.fileName||'').toLowerCase())||[]).filter(e=>!song.fileSize || e.file.size===song.fileSize);
        if(!matches.length && song.videoFileName)matches=names.get(song.videoFileName.toLowerCase())||[];
        if(matches.length>1){ambiguous.push(song.id);continue;}
        if(!matches.length){missing.push(song.id);continue;}
        const entry=matches[0];add(song.id,'audio',entry);
        const sides=sidecars.get(stem(entry.path||entry.file.name))||[];
        const lyric=sides.find(e=>/\.lrc$/i.test(e.file.name));
        const cover=sides.find(e=>/\.(png|jpe?g|webp)$/i.test(e.file.name));
        if(lyric)add(song.id,'lyric',lyric);if(cover)add(song.id,'cover',cover);
    }
    return {index,missing,ambiguous};
}
function bounds(header,size){
    if(!header)return {status:200,start:0,length:size};
    const invalid={status:416,start:0,length:0};
    if(!/^bytes=\d*-\d*$/.test(header) || header.length>128 || !size)return invalid;
    const [a,b]=header.slice(6).split('-');let start,end;
    if(!a){const suffix=Number(b);if(!Number.isSafeInteger(suffix)||suffix<=0)return invalid;start=Math.max(0,size-suffix);end=size-1;}
    else {start=Number(a);end=b?Number(b):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return invalid;end=Math.min(end,size-1);}
    return {status:206,start,length:end-start+1};
}
export function connectBrowser({site,credentials,index,onStatus=()=>{},onClose=()=>{}}){
    const socket=new WebSocket(site.replace(/^http/,'ws')+'/api/device-sharing/channel');
    const reads=new Map(),waiting=new Map();let enabled=false,closed=false,heartbeat;
    const files=new Map(index.files.map(f=>[f.songId+':'+f.kind,f]));
    function send(message){if(socket.readyState!==1)throw Error('共享连接已断开');socket.send(JSON.stringify(message));}
    function wait(type,action){return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{waiting.delete(type);reject(Error('共享连接超时'));},type==='ready'?120000:10000);
        waiting.set(type,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
        try{action();}catch(e){waiting.delete(type);clearTimeout(timer);reject(e);}
    });}
    const ready=wait('ready',()=>{});ready.catch(()=>{});
    function cancel(state){state.cancelled=true;state.ack?.reject(Error('共享已停止'));}
    function stop(){enabled=false;for(const state of reads.values())cancel(state);}
    async function read(message){
        const id=message.requestId;if(!/^[0-9a-f-]{36}$/.test(id)||reads.has(id))throw Error('无效请求');
        if(!enabled||reads.size>=2){send({type:'meta',requestId:id,status:503});return;}
        const state={cancelled:false};reads.set(id,state);let file;
        try{
            const entry=files.get(message.songId+':'+message.kind);
            if(!entry || !['GET','HEAD'].includes(message.method)){send({type:'meta',requestId:id,status:404});return;}
            file=await readSource(entry);if(state.cancelled||!enabled)return;
            const range=bounds(message.range,file.size);
            send({type:'meta',requestId:id,...range,size:file.size,extension:entry.extension});
            if(range.status===416||message.method==='HEAD'){send({type:'end',requestId:id});return;}
            for(let offset=range.start;offset<range.start+range.length;){
                const length=Math.min(65536,range.start+range.length-offset);
                const chunk=await file.slice(offset,offset+length).arrayBuffer();
                if(state.cancelled||!enabled)return;
                await new Promise((resolve,reject)=>{
                    const timer=setTimeout(()=>{state.ack=null;reject(Error('传输超时'));},30000);
                    state.ack={resolve:()=>{clearTimeout(timer);state.ack=null;resolve();},reject:e=>{clearTimeout(timer);state.ack=null;reject(e);}};
                    try{socket.send(new Blob([new TextEncoder().encode(id),chunk]));}catch(e){state.ack.reject(e);}
                });offset+=length;
            }
            if(!state.cancelled)send({type:'end',requestId:id});
        }catch(e){if(socket.readyState===1&&!state.cancelled)send(file?{type:'error',requestId:id}:{type:'meta',requestId:id,status:404});}
        finally{reads.delete(id);}
    }
    socket.addEventListener('open',async()=>{
        try{
            await wait('welcome',()=>send({type:'hello',...credentials}));
            heartbeat=setInterval(()=>{try{send({type:'heartbeat'});}catch{}},10000);
            for(let n=0;n<index.files.length;n+=256)await wait('catalog-ack',()=>send({type:'catalog',files:index.files.slice(n,n+256).map(({songId,kind,size,extension,playlistId})=>({songId,kind,size,extension,playlistId}))}));
            send({type:'catalog-end'});
        }catch(e){onStatus(e.message);socket.close();}
    });
    socket.addEventListener('message',event=>{
        try{
            if(typeof event.data!=='string'||event.data.length>65536)throw Error();
            const message=JSON.parse(event.data),pending=waiting.get(message.type);
            if(pending){waiting.delete(message.type);pending.resolve(message);return;}
            if(message.type==='sharing'){
                if(typeof message.enabled!=='boolean'||!Number.isSafeInteger(message.version))throw Error();
                stop();enabled=message.enabled;send({type:'sharing',enabled,version:message.version});onStatus(enabled?'共享中，请保持此网页打开':'共享已停止',enabled);
            }else if(message.type==='read')void read(message).catch(()=>socket.close());
            else if(message.type==='ack')reads.get(message.requestId)?.ack?.resolve();
            else if(message.type==='cancel'){const state=reads.get(message.requestId);if(state)cancel(state);}
            else if(message.type!=='heartbeat')throw Error();
        }catch{socket.close();}
    });
    socket.addEventListener('close',()=>{closed=true;clearInterval(heartbeat);stop();for(const p of waiting.values())p.reject(Error('共享连接断开'));waiting.clear();onClose();});
    return {ready,get closed(){return closed;},stop(){stop();if(socket.readyState===1)send({type:'local-stop'});},close(){stop();socket.close();}};
}
