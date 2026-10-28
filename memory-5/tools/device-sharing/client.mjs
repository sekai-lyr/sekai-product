import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {join} from 'node:path';
import {hostname} from 'node:os';
import {createIndex,saveIndex,loadIndex} from './files.mjs';
import {validSite,protectToken,unprotectToken,saveConfig,loadConfig} from './config.mjs';
import {startProvider} from './provider.mjs';

if(process.platform!=='win32')throw Error('此启动器目前支持 Windows。');
const directory=join(process.env.LOCALAPPDATA||process.env.APPDATA,'SekaiSong','DeviceSharing');
const configPath=join(directory,'device.json'),indexPath=join(directory,'index.json');
const terminal=createInterface({input:stdin,output:stdout});let provider,retry,quitting=false,localStopped=false;
async function request(site,path,body,credentials) {
    const headers={'Content-Type':'application/json'};
    if(credentials){headers['X-Device-Id']=credentials.deviceId;headers.Authorization='Bearer '+credentials.token;}
    const response=await fetch(site+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('服务器请求失败（'+response.status+'），请检查配对码、网络或设备是否被撤销。');
    return response.json();
}
try {
    console.log('Sekai 设备共享：只共享你选择的目录；音频经过网站中转，不存入网站。关闭此窗口停止供音。');
    let config;
    try{config=await loadConfig(configPath);}catch(error){if(error.code!=='ENOENT')throw error;}
    let credentials;
    if(!config) {
        const site=validSite((await terminal.question('网站地址（回车使用 https://sekaisong.com）：')).trim()||'https://sekaisong.com');
        const code=(await terminal.question('粘贴网站“设备共享”页生成的配对码：')).trim();
        const name=(await terminal.question('设备名称（回车使用本机名称）：')).trim()||hostname();
        credentials=await request(site,'/api/device-sharing/pair',{code,name});
        config={site,deviceId:credentials.deviceId,encryptedToken:await protectToken(credentials.token)};
        await saveConfig(configPath,config);console.log('设备已绑定到当前 Windows 用户。');
    }else credentials={deviceId:config.deviceId,token:await unprotectToken(config.encryptedToken)};
    let index;
    try{index=await loadIndex(indexPath);}catch(error){if(error.code!=='ENOENT')throw error;}
    async function scan() {
        const roots=[];console.log('输入真实文件夹路径，不要选择快捷方式。每行一个；空行结束。');
        while(roots.length<16){const root=(await terminal.question('文件夹：')).trim().replace(/^"|"$/g,'');if(!root)break;roots.push(root);}
        if(!roots.length)throw Error('未选择共享目录，未开启共享。');
        const {songs}=await request(config.site,'/api/device-sharing/device-library',null,credentials);
        console.log('正在本机匹配已有歌曲，媒体文件不上传…');
        const result=await createIndex(roots,songs);await saveIndex(indexPath,result.index);index=result.index;
        console.log(`已记住 ${index.files.filter(f=>f.kind==='audio').length} 首；重名冲突 ${result.ambiguous.length} 首，缺失 ${result.missing.length} 首。`);
        if(result.ambiguous.length)console.log('冲突歌曲 ID：'+result.ambiguous.join(', '));
    }
    if(!index)await scan();
    if(index.files.length>30000)throw Error('单设备索引超过 30000 项，请缩小共享范围。');
    function connect() {
        if(quitting)return;
        provider=startProvider({site:config.site,credentials,index,onStatus:message=>console.log(message)});
        provider.ready.then(()=>{if(localStopped)provider.stop();}).catch(()=>{});
        provider.ws.addEventListener('close',()=>{if(!quitting)retry=setTimeout(connect,5000);});
    }
    connect();console.log('命令：stop 停止共享；resume 允许网站再次开启；rescan 重新选择目录；quit 退出。');
    terminal.on('SIGINT',()=>{quitting=true;clearTimeout(retry);provider?.close();terminal.close();});
    while(!quitting) {
        const command=(await terminal.question('> ')).trim().toLowerCase();
        if(command==='quit'){quitting=true;clearTimeout(retry);provider?.close();break;}
        if(command==='stop'){localStopped=true;provider?.stop();console.log('已在本机禁止共享。');}
        else if(command==='resume'){localStopped=false;provider?.resume();console.log('已允许网站开启，共享尚未自动开启。');}
        else if(command==='rescan') {
            localStopped=true;quitting=true;clearTimeout(retry);provider?.close();
            await scan();quitting=false;localStopped=false;connect();
        }
    }
}catch(error){console.error(error.message?.includes('ENOENT')?'本机配置或文件不可用，请检查文件夹。':error.message);process.exitCode=1;}
finally{quitting=true;clearTimeout(retry);provider?.close();terminal.close();}
