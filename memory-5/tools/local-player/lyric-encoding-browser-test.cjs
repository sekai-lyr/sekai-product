const {chromium}=require('../browser-qa-runtime/node_modules/playwright-core');
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
    const source=readFileSync('src/main/resources/static/js/local-player.js','utf8');
    const start=source.indexOf('    function parseLyrics(');
    const end=source.indexOf('    function parser()',start);
    assert(start>=0 && end>start);
    const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    try{
        const page=await browser.newPage();
        await page.route('https://sekaisong.com/__lyric_encoding_qa__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>LRC QA</title>'}));
        await page.goto('https://sekaisong.com/__lyric_encoding_qa__');
        await page.addScriptTag({content:source.slice(start,end)+'\nwindow.decodeLrc=readLocalLyric;window.parseLrc=parseLyrics;'});
        const bytes=[...readFileSync('C:/QQ音乐/gtp/BEYOND - 喜欢你_EM.lrc')];
        const result=await page.evaluate(async input=>{
            const file=new File([new Uint8Array(input)],'BEYOND - 喜欢你_EM.lrc');
            const text=await window.decodeLrc(file);
            return {title:text.match(/\[ti:([^\]]+)\]/)?.[1],rows:window.parseLrc(text),replacement:text.includes('\ufffd')};
        },bytes);
        assert.equal(result.title,'喜欢你');
        assert(result.rows.length>10);
        assert.equal(result.replacement,false);
        console.log(`PASS: Edge decoded ${result.rows.length} timed QQ lyrics without mojibake`);
    }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
