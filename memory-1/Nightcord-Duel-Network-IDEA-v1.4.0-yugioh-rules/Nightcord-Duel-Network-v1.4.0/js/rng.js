/**
 * rng.js - 可注入的随机数工具
 */

export class RandomSource {
    next() { return Math.random(); }
    integer(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
    pick(items) { return items.length > 0 ? items[this.integer(0, items.length - 1)] : null; }
    weightedPick(entries) {
        let total = entries.reduce((s, e) => s + (e.weight || 1), 0);
        let roll = this.next() * total;
        for (const e of entries) { roll -= (e.weight || 1); if (roll <= 0) return e.value; }
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

export class SequenceRandom extends RandomSource {
    constructor(seq) { super(); this.seq = [...seq]; this.idx = 0; }
    next() { const v = this.seq[this.idx % this.seq.length]; this.idx++; return v; }
}

export const rng = new RandomSource();
