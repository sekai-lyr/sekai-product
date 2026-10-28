import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ALL_CARDS } from '../src/main/resources/static/js/catalog.js';
const snapshot = JSON.parse(fs.readFileSync(new URL('../reports/card-art/baseline.json', import.meta.url), 'utf8'));
assert.deepEqual(JSON.parse(JSON.stringify(ALL_CARDS)), snapshot, 'Runtime cards must exactly match the pre-rating snapshot');
fs.writeFileSync(new URL('../src/main/resources/full-card-pool.json', import.meta.url), JSON.stringify(ALL_CARDS, null, 2) + '\n');
console.log(`Restored ${ALL_CARDS.length} original cards; all fields match the pre-rating snapshot.`);
