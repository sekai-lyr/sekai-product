import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_CARDS } from '../js/catalog.js';

test('撤销审美评级后，前后端卡池完整恢复评分前快照', () => {
    const snapshot = JSON.parse(readFileSync(new URL('../../../../../reports/card-art/baseline.json', import.meta.url)));
    const backend = JSON.parse(readFileSync(new URL('../../full-card-pool.json', import.meta.url)));
    assert.deepEqual(JSON.parse(JSON.stringify(ALL_CARDS)), snapshot);
    assert.deepEqual(backend, snapshot);
});
