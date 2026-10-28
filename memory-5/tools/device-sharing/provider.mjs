import {openIndexedFile} from './files.mjs';
import {mediaRange} from './range.mjs';
import {extname} from 'node:path';

export function startProvider({site,credentials,index,onStatus=()=>{},WebSocketImpl=WebSocket}) {
    const ws=new WebSocketImpl(site.replace(/^http/,'ws')+'/api/device-sharing/channel');
    const reads=new Map(),waiting=new Map();let enabled=false,blocked=false,closed=false,heartbeat;
    const ready=new Promise((resolve,reject)=>{waiting.set('ready',{resolve,reject});});
    // The caller may attach later while connecting; avoid an unhandled rejection on early failure.
    ready.catch(()=>{});
    function send(message){if(ws.readyState!==1)throw Error('连接已断开');ws.send(JSON.stringify(message));}
    function until(type,action) {
        return new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>{waiting.delete(type);reject(Error('设备连接超时'));},10000);
            waiting.set(type,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
            try{action();}catch(error){clearTimeout(timer);waiting.delete(type);reject(error);}
        });
    }
    function cancel(state) {state.cancelled=true;state.ack?.reject(Error('传输取消'));}
    function cancelAll(){enabled=false;for(const state of reads.values())cancel(state);}
    async function read(message) {
        const id=message.requestId;
        if(typeof id!=='string' || !/^[0-9a-f-]{36}$/.test(id) || reads.has(id))throw Error('无效请求');
        if(!enabled || blocked || reads.size>=2){send({type:'meta',requestId:id,status:503});return;}
        const state={cancelled:false};reads.set(id,state);let file;
        try {
            if(!Number.isSafeInteger(message.songId) || !['audio','lyric','cover'].includes(message.kind) || !['GET','HEAD'].includes(message.method))throw Error('无效请求');
            file=await openIndexedFile(index,message.songId,message.kind);
            if(state.cancelled || !enabled)throw Error('共享已停止');
            const range=mediaRange(message.range,file.size);
            send({type:'meta',requestId:id,status:range.status,size:file.size,start:range.start||0,length:range.length||0,extension:file.extension});
            if(range.status===416 || message.method==='HEAD'){send({type:'end',requestId:id});return;}
            let offset=range.start,remaining=range.length;
            while(remaining>0) {
                if(state.cancelled || !enabled)throw Error('共享已停止');
                const data=Buffer.allocUnsafe(Math.min(65536,remaining));
                const {bytesRead}=await file.handle.read(data,0,data.length,offset);
                if(bytesRead!==data.length)throw Error('源文件已改变');
                if(state.cancelled || !enabled)throw Error('共享已停止');
                await new Promise((resolve,reject)=>{
                    const timer=setTimeout(()=>{state.ack=null;reject(Error('传输超时'));},30000);
                    state.ack={resolve:()=>{clearTimeout(timer);state.ack=null;resolve();},reject:error=>{clearTimeout(timer);state.ack=null;reject(error);}};
                    try{ws.send(Buffer.concat([Buffer.from(id,'ascii'),data]));}catch(error){state.ack.reject(error);}
                });
                offset+=bytesRead;remaining-=bytesRead;
            }
            if(!state.cancelled)send({type:'end',requestId:id});
        }catch(error) {
            if(ws.readyState===1 && !state.cancelled)send(file?{type:'error',requestId:id}:{type:'meta',requestId:id,status:404});
        }finally{if(file)await file.handle.close();reads.delete(id);}
    }
    ws.addEventListener('open',async()=>{
        try {
            await until('welcome',()=>send({type:'hello',...credentials}));
            heartbeat=setInterval(()=>{try{send({type:'heartbeat'});}catch{}},10000);
            for(let start=0;start<index.files.length;start+=256) {
                const files=index.files.slice(start,start+256).map(f=>({songId:f.songId,kind:f.kind,size:f.size,extension:extname(f.path).toLowerCase()}));
                await until('catalog-ack',()=>send({type:'catalog',files}));
            }
            send({type:'catalog-end'});
        }catch(error){onStatus('连接或目录登记失败；请检查网站设置及设备是否被撤销。');ws.close();}
    });
    ws.addEventListener('message',event=>{
        try {
            if(typeof event.data!=='string' || event.data.length>65536)throw Error('无效消息');
            const message=JSON.parse(event.data),wait=waiting.get(message.type);
            if(wait){waiting.delete(message.type);wait.resolve(message);if(message.type==='ready')onStatus('设备在线，共享关闭。请到网站开启共享。');return;}
            if(message.type==='sharing') {
                if(!Number.isSafeInteger(message.version) || typeof message.enabled!=='boolean')throw Error('无效开关');
                if(!message.enabled)cancelAll();enabled=message.enabled && !blocked;
                send({type:'sharing',enabled,version:message.version});onStatus(enabled?'共享中；输入 stop 可随时停止。':'共享已关闭。');
            }else if(message.type==='read')void read(message).catch(()=>ws.close());
            else if(message.type==='ack')reads.get(message.requestId)?.ack?.resolve();
            else if(message.type==='cancel'){const state=reads.get(message.requestId);if(state)cancel(state);}
            else if(message.type!=='heartbeat')throw Error('未知消息');
        }catch{ws.close();}
    });
    ws.addEventListener('close',()=>{closed=true;clearInterval(heartbeat);cancelAll();for(const wait of waiting.values())wait.reject(Error('设备断线'));waiting.clear();onStatus('设备已断线，共享已停止。');});
    ws.addEventListener('error',()=>onStatus('网络连接失败，未开放文件。'));
    return {ready,ws,get closed(){return closed;},get activeStreams(){return reads.size;},
        stop(){blocked=true;cancelAll();if(ws.readyState===1)send({type:'local-stop'});},
        resume(){blocked=false;if(ws.readyState===1)send({type:'local-resume'});},
        close(){blocked=true;cancelAll();ws.close();}};
}
