/**
 * rng.js - 可注入的随机数工具
 */

export class RandomSource {
    next() { return Math.random(); }
    integer(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
    pick(items) { return items.length > 0 ? items[this.integer(0, items.length - 1)] : null; }
    weightedPick(entries) {
        // 权重为 0 必须表示"不会被抽中"。原来的 `e.weight || 1` 会把 0 变成 1，
        // 于是保底期间被压到 0 的稀有度仍然各占 1 份权重（例如 pity>=50 时
        // 本该只出 UR，实际变成 5 种稀有度均等）。
        const weightOf = entry => {
            const weight = Number(entry?.weight);
            return Number.isFinite(weight) && weight > 0 ? weight : 0;
        };
        const total = entries.reduce((sum, entry) => sum + weightOf(entry), 0);
        if (total <= 0) return entries.length > 0 ? entries[entries.length - 1].value : null;
        let roll = this.next() * total;
        for (const entry of entries) {
            roll -= weightOf(entry);
            if (roll <= 0) return entry.value;
        }
        return entries[entries.length - 1].value;
    }
    shuffle(items) {
        const a = [...items];
        for (let i = a.length - 1; i > 0; i--) {
            const j = this.integer(0, i);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
}

/**
 * 种子随机数生成器 (xoshiro128**)
 * PvP 模式下两端使用相同种子确保随机结果一致
 */
export class SeededRandom extends RandomSource {
    constructor(seed) {
        super();
        // 将种子转为4个32位状态。注意不能用 `seed || Date.now()`：
        // 种子 0 或 "" 是合法种子，会被误判为"没有种子"而变成不确定的随机结果，
        // 破坏"相同种子结果一致"的契约。
        const effectiveSeed = seed === undefined || seed === null ? Date.now() : seed;
        this._s = new Uint32Array(this._hashSeed(effectiveSeed));
    }

    _hashSeed(seed) {
        const str = String(seed);
        // FNV-1a hash
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        // 用 hash 派生4个状态
        const s = [h, h ^ 0xdeadbeef, Math.imul(h, 0x9e3779b9), Math.imul(h, 0x85ebca6b)];
        // 跑 12 轮 warmup
        this._s = new Uint32Array(s);
        for (let i = 0; i < 12; i++) this._nextUint32();
        return Array.from(this._s);
    }

    _rotl(x, k) { return (x << k) | (x >>> (32 - k)); }

    _nextUint32() {
        const s = this._s;
        const result = Math.imul(this._rotl(Math.imul(s[1], 5), 7), 9);
        const t = s[1] << 9;
        s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
        s[2] ^= t; s[3] = this._rotl(s[3], 11);
        return result >>> 0;
    }

    next() { return this._nextUint32() / 0x100000000; }
}

export class SequenceRandom extends RandomSource {
    constructor(seq) { super(); this.seq = [...seq]; this.idx = 0; }
    next() { const v = this.seq[this.idx % this.seq.length]; this.idx++; return v; }
}

export const rng = new RandomSource();
