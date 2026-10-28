import test from 'node:test';
import assert from 'node:assert/strict';
import { rateCardArt } from './card-art-policy.mjs';

const row = { id: 'fixture', animeScore: 2, generalScore: 7, technicalScore: 8, width: 800, height: 800, sharpnessVariance: 500 };
test('风景魔法和陷阱不受人物审美分影响', () => {
    for (const type of ['spell', 'trap']) {
        assert.deepEqual(rateCardArt({ ...row, type, animeScore: 0 }), rateCardArt({ ...row, type, animeScore: 10 }));
    }
    assert.notEqual(rateCardArt({ ...row, type: 'monster', animeScore: 0 }).score, rateCardArt({ ...row, type: 'monster', animeScore: 10 }).score);
});
test('分类规则不依赖卡池数量，并拒绝错误分类', () => {
    assert.equal(rateCardArt({ ...row, type: 'trap' }).category, 'trap');
    assert.throws(() => rateCardArt({ ...row, type: 'unknown' }), /category/);
});
