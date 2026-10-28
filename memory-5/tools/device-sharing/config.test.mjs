import test from 'node:test';
import assert from 'node:assert/strict';
import {validSite,protectToken,unprotectToken} from './config.mjs';
test('credentials can only target HTTPS or explicit loopback development',()=>{
    assert.equal(validSite('https://sekaisong.com/'),'https://sekaisong.com');
    for(const value of ['http://example.com','https://a:b@example.com','https://example.com/path','file:///etc/passwd'])assert.throws(()=>validSite(value));
    assert.equal(validSite('http://127.0.0.1:9999',true),'http://127.0.0.1:9999');
});
test('Windows credentials survive restart without plaintext in stored ciphertext',{skip:process.platform!=='win32'},async()=>{
    const token='test-device-token-never-log';const encrypted=await protectToken(token);
    assert.notEqual(encrypted,token);assert.ok(!encrypted.includes(token));assert.equal(await unprotectToken(encrypted),token);
});
