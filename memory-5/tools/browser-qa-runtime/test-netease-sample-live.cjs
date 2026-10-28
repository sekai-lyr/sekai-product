const {request}=require('playwright-core');const {randomUUID}=require('crypto');const fs=require('fs');const assert=require('assert/strict');
(async()=>{const base='https://sekaisong.com',user='codex_smoke_'+randomUUID().replace(/-/g,'').slice(0,16),pass='QAtest!'+randomUUID().replace(/-/g,'');fs.writeFileSync('../../target/netease-smoke-user.txt',user);const ctx=await request.newContext();try{
 const register=await ctx.post(base+'/user/register',{form:{userName:user,nickName:'QA',password:pass,confirmPassword:pass},maxRedirects:0});assert.equal(register.status(),302);
 const login=await ctx.post(base+'/user/login',{form:{userName:user,password:pass},maxRedirects:0});assert.equal(login.status(),302);
 const url='https://music.163.com/playlist?id=17772772798&uct2=U2FsdGVkX1+a9ZcCIftZ+9CraFxr9w89spqYf7bEqpM=';
 const result=await ctx.post(base+'/netease/import',{form:{songIds:url},maxRedirects:0,timeout:180000});
 const location=result.headers().location||'';const lib=await (await ctx.get(base+'/local-player/library')).json();
 console.log(JSON.stringify({user,status:result.status(),location,tracks:lib.songs.length,playlists:lib.playlists.map(p=>({id:p.id,name:p.name,count:p.songIds.length})),bound:lib.songs.filter(s=>s.fileName).length}));
 assert.equal(result.status(),302);assert.match(location,/playlists\/\d+/);assert.ok(lib.songs.length>0);assert.equal(lib.songs.filter(s=>s.fileName).length,0,'metadata import must not bind files');
 }finally{await ctx.dispose();}})().catch(e=>{console.error('NETEASE SMOKE FAILED',e.message);process.exit(1)});
