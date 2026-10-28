import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('src/main/resources/static/js/local-player.js','utf8');
const start=source.indexOf('    function parseLyrics(');
const end=source.indexOf('    function parser()',start);
assert(start>=0 && end>start);
const context=vm.createContext({TextDecoder,Uint8Array});
vm.runInContext(source.slice(start,end)+'\nglobalThis.decode=readLocalLyric;globalThis.parse=parseLyrics;',context);
const asFile=bytes=>({arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});

const gbk=readFileSync('C:/QQ音乐/gtp/BEYOND - 喜欢你_EM.lrc');
const lyric=await context.decode(asFile(gbk));
assert(lyric.includes('[ti:喜欢你]'));
assert(lyric.includes('喜欢你 - BEYOND'));
assert(!lyric.includes('\ufffd'));
assert(context.parse(lyric).length>10);

for(const [text,encoding] of [['[00:01.00]测试 UTF-8','utf-8'],['[00:01.00]测试 UTF-16','utf-16le']]){
    const bytes=encoding==='utf-8'?Buffer.from(text,'utf8'):Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(text,'utf16le')]);
    assert.equal(await context.decode(asFile(bytes)),text);
}
console.log('PASS: QQ GB18030 LRC, UTF-8 and UTF-16 decode to readable timed lyrics');
