/** 对比"有/无重复保护"的收藏进度曲线。 */
import { ALL_CARDS } from "../SekaiGame/src/main/resources/static/js/catalog.js";
import { getPackPool, openPack, applyDuplicateProtection, NIGHTCORD_PACK } from "../SekaiGame/src/main/resources/static/js/packs.js";

const pool = getPackPool(NIGHTCORD_PACK, ALL_CARDS);
const rng = {
    next: Math.random,
    integer: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
    pick(list) { return list[this.integer(0, list.length - 1)]; },
    weightedPick(entries) { let t = entries.reduce((s, e) => s + e.weight, 0), r = this.next() * t; for (const e of entries) { r -= e.weight; if (r <= 0) return e.value; } return entries[entries.length - 1].value; },
};

function run(useProtection) {
    const collection = { cards: {} };
    const marks = [];
    let emptyPacks = 0;
    for (let pack = 1; pack <= 120; pack++) {
        const opened = openPack(NIGHTCORD_PACK, pool, rng, 0);
        const cards = useProtection
            ? applyDuplicateProtection(opened.cards, pool, collection).cards
            : opened.cards;
        let fresh = 0;
        for (const card of cards) {
            if (!collection.cards[card.id]) fresh++;
            collection.cards[card.id] = (collection.cards[card.id] || 0) + 1;
        }
        if (fresh === 0) emptyPacks++;
        if ([10, 30, 60, 120].includes(pack)) marks.push({ pack, fresh, collected: Object.keys(collection.cards).length });
    }
    return { marks, emptyPacks, collected: Object.keys(collection.cards).length };
}

const off = run(false);
const on = run(true);
console.log(`卡池 ${pool.length} 张，各开 120 包（1000 币/包）：\n`);
console.log("包数   无保护累计   有保护累计   差额");
for (let i = 0; i < off.marks.length; i++) {
    const a = off.marks[i], b = on.marks[i];
    console.log(`${String(a.pack).padStart(4)}   ${String(a.collected).padStart(10)}   ${String(b.collected).padStart(10)}   +${b.collected - a.collected}`);
}
console.log(`\n"整包 0 张新卡"出现次数：无保护 ${off.emptyPacks} 次 → 有保护 ${on.emptyPacks} 次`);
console.log(`120 包后收集率：无保护 ${(off.collected / pool.length * 100).toFixed(1)}% → 有保护 ${(on.collected / pool.length * 100).toFixed(1)}%`);
