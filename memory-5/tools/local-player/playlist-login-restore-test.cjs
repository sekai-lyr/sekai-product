const {chromium}=require('../browser-qa-runtime/node_modules/playwright-core');
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
    const source=readFileSync('src/main/resources/static/js/local-player.js','utf8');
    const requested=source.match(/const requestedPlaylist=document\.body\.dataset\.playlistId[^\n]+/)[0];
    const restore=source.match(/if\(playlists\.some\(p=>String\(p\.id\)===requestedPlaylist\)\)playlistSelect\.value=requestedPlaylist;/)[0];
    const save=source.match(/localStorage\.setItem\(`sekai\.local\.playlist\.\$\{account\.id\}`,playlistSelect\.value\);/)[0];
    const dbFunctions=source.slice(source.indexOf('    let databasePromise;'),source.indexOf('    const bindingPlaylistId='));
    const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    try{
        const page=await browser.newPage();
        await page.route('https://sekaisong.com/__playlist_login_qa__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><select id="playlist"><option value="all">全部歌曲</option><option value="42">歌单 42</option></select>'}));
        await page.goto('https://sekaisong.com/__playlist_login_qa__');
        await page.evaluate(({save})=>{
            const account={id:7},playlistSelect=document.querySelector('#playlist');
            playlistSelect.value='42';eval(save);
        },{save});
        await page.reload();
        const selected=await page.evaluate(async ({requested,restore,functions})=>{
            eval(`${functions}\nwindow.lookupOldPlaylist=rememberedPlaylist;`);
            const account={id:7},playlistSelect=document.querySelector('#playlist'),playlists=[{id:42}];
            return await eval(`(async()=>{${requested}\n${restore}\nreturn playlistSelect.value;})()`);
        },{requested,restore,functions:dbFunctions});
        assert.equal(selected,'42');
        await page.evaluate(async functions=>{
            localStorage.removeItem('sekai.local.playlist.7');
            eval(`${functions}\nwindow.lookupOldPlaylist=rememberedPlaylist;window.saveOldBinding=remembered;`);
            await window.saveOldBinding('user:7:playlist:42:song:9',{audio:{name:'song.flac'}});
        },dbFunctions);
        await page.reload();
        const oldSelected=await page.evaluate(async ({functions,requested,restore})=>{
            eval(`${functions}\nwindow.lookupOldPlaylist=rememberedPlaylist;`);
            const account={id:7},playlistSelect=document.querySelector('#playlist'),playlists=[{id:42}];
            return await eval(`(async()=>{${requested}\n${restore}\nreturn playlistSelect.value;})()`);
        },{functions:dbFunctions,requested,restore});
        assert.equal(oldSelected,'42');
        console.log('PASS: Edge restores the saved playlist after page reload');
    }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
