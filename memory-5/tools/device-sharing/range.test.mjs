import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaRange} from './range.mjs';

test('whole-file, explicit, open-ended and suffix reads have exact lengths',()=>{
    assert.deepEqual(mediaRange(undefined,100),{status:200,start:0,end:99,length:100});
    assert.deepEqual(mediaRange('bytes=10-19',100),{status:206,start:10,end:19,length:10});
    assert.deepEqual(mediaRange('bytes=90-',100),{status:206,start:90,end:99,length:10});
    assert.deepEqual(mediaRange('bytes=-8',100),{status:206,start:92,end:99,length:8});
    assert.deepEqual(mediaRange('bytes=90-999',100),{status:206,start:90,end:99,length:10});
    assert.deepEqual(mediaRange(undefined,0),{status:200,start:0,end:-1,length:0});
});
test('multi-range, invalid bounds, zero suffix, invalid size and overlong headers fail',()=>{
    for(const header of ['bytes=100-','bytes=30-10','bytes=-0','bytes=1-2,4-5','bytes=x-y','bytes=','bytes=9007199254740992-','x'.repeat(130)])
        assert.equal(mediaRange(header,100).status,416,header);
    assert.equal(mediaRange('bytes=0-',0).status,416);
    assert.throws(()=>mediaRange(undefined,-1));
});
