import assert from 'node:assert/strict';
import { createStarSky } from '../../src/main/resources/static/js/star-trails.js';

// Record projected star heads without needing a GPU or a production account.
let heads = new Map();
const gradient = { addColorStop() {} };
globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, {
    get(target, key) {
        if (key === 'arc') return (x, y, radius) => heads.set(`${target.fillStyle}:${radius}`, [x, y]);
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
        return target[key] ?? (() => {});
    },
    set(target, key, value) { target[key] = value; return true; }
}) }) };
const config = { sky: 'night', motion: .7, density: 28, trail: .8 };
const frame = (time, options = config, reduced = false) => {
    heads = new Map();
    createStarSky()({ drawImage() {} }, 1440, 900, time, options, reduced);
    return heads;
};
const first = frame(24), next = frame(25);
const distances = [...first].filter(([key]) => next.has(key)).map(([key, point]) =>
    Math.hypot(point[0] - next.get(key)[0], point[1] - next.get(key)[1])).sort((a, b) => a - b);
const median = distances[Math.floor(distances.length / 2)];
assert.ok(distances.length > 100, 'Enough common visible stars to measure');
assert.ok(median > 12, `Visible movement too slow: ${median}px per audio second`);
assert.deepEqual(frame(24), first, 'Seeking back must restore exactly the same sky');
assert.deepEqual(frame(26, { ...config, motion: 0 }), frame(27, { ...config, motion: 0 }), 'Zero speed freezes the sky');
assert.deepEqual(frame(30, config, true), frame(31, config, true), 'Reduced motion remains stationary');
const early = frame(0, { ...config, sky: 'auto' });
assert.ok([...early.keys()].some(key => Number(key.match(/,([\d.]+)\)/)?.[1]) > .3), 'Stars are visible immediately');
console.log(JSON.stringify({ matchedStars: distances.length, medianPixelsPerSecond: median, checks: 5 }));
