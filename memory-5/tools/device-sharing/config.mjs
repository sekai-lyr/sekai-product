import {spawn} from 'node:child_process';
import {mkdir,open,rename,readFile,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';

export function validSite(value,development=false) {
    const url=new URL(value);
    if(url.username || url.password || url.search || url.hash || url.pathname!=='/' ||
        (url.protocol!=='https:' && !(development && url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw Error('网站必须使用 HTTPS；只有明确的本机开发模式允许 HTTP。');
    return url.origin;
}
function dpapi(value,decrypt) {
    if(process.platform!=='win32')throw Error('设备凭证保护目前只支持 Windows。');
    const script=decrypt?
        "$v=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString $v; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}":
        "$v=[Console]::In.ReadToEnd(); [Console]::Write((ConvertTo-SecureString $v -AsPlainText -Force | ConvertFrom-SecureString))";
    return new Promise((resolve,reject)=>{
        const env={...process.env};delete env.PSModulePath;
        const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
        let output='';const timer=setTimeout(()=>{child.kill();reject(Error('凭证保护超时'));},15000);
        child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{output+=chunk;if(output.length>32768)child.kill();});
        child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(Error('无法启动 Windows 凭证保护'));});
        child.on('exit',code=>{clearTimeout(timer);code===0?resolve(output.trim()):reject(Error('Windows 凭证保护失败'));});
        child.stdin.on('error',()=>{});child.stdin.end(value);
    });
}
export const protectToken=value=>dpapi(value,false);
export const unprotectToken=value=>dpapi(value,true);
export async function saveConfig(path,config) {
    await mkdir(dirname(path),{recursive:true,mode:0o700});
    const temporary=join(dirname(path),`.config-${randomUUID()}.tmp`),content=JSON.stringify(config);
    try {
        const file=await open(temporary,'wx',0o600);
        try{await file.writeFile(content);await file.sync();}finally{await file.close();}
        await rename(temporary,path);if(await readFile(path,'utf8')!==content)throw Error('配置保存失败');
    }finally{await rm(temporary,{force:true});}
}
export async function loadConfig(path) {
    const text=await readFile(path,'utf8');if(text.length>65536)throw Error('设备配置无效');
    const config=JSON.parse(text);validSite(config.site);
    if(typeof config.deviceId!=='string' || !/^[0-9a-f-]{36}$/.test(config.deviceId) || typeof config.encryptedToken!=='string')throw Error('设备配置无效');
    return config;
}
