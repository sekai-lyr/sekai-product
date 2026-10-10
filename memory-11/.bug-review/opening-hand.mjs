/** 起手质量模拟：随机组 40 张卡组，抽 5 张开局手牌，统计“无牌可出”的概率。 */
import { Player, GameState } from "../SekaiGame/src/main/resources/static/js/model.js";
import { GameEngine } from "../SekaiGame/src/main/resources/static/js/engine.js";
import { ALL_CARDS } from "../SekaiGame/src/main/resources/static/js/catalog.js";
import { getPackPool, NIGHTCORD_PACK } from "../SekaiGame/src/main/resources/static/js/packs.js";

const pool = getPackPool(NIGHTCORD_PACK, ALL_CARDS);
const TRIALS = 3000;

function randomDeck() {
    const deck = [];
    const counts = {};
    while (deck.length < 40) {
        const card = pool[Math.floor(Math.random() * pool.length)];
        counts[card.id] = (counts[card.id] || 0) + 1;
        if (counts[card.id] > 3) continue;
        deck.push(card);
    }
    return deck;
}

let noPlayable = 0;      // 5 张里没有任何“可立即使用”的卡（≤4 星怪兽 或 魔法）
let noMonster = 0;       // 5 张里没有怪兽
let onlyTribute = 0;     // 有怪兽但全部 5 星以上（需要祭品）
let handSizes = 0;
const playableCounts = {};

for (let t = 0; t < TRIALS; t++) {
    const p = new Player("t", randomDeck());
    const hand = p.deck.slice(0, 5);
    handSizes += hand.length;
    const freeMonster = hand.filter(c => c.type === "monster" && (c.level || 0) <= 4);
    const spells = hand.filter(c => c.type === "spell");
    const monsters = hand.filter(c => c.type === "monster");
    const playable = freeMonster.length + spells.length;
    playableCounts[Math.min(playable, 5)] = (playableCounts[Math.min(playable, 5)] || 0) + 1;
    if (playable === 0) noPlayable++;
    if (monsters.length === 0) noMonster++;
    if (monsters.length > 0 && freeMonster.length === 0) onlyTribute++;
}

const pct = n => (n / TRIALS * 100).toFixed(1) + "%";
console.log(`模拟 ${TRIALS} 副随机 40 张卡组，5 张开局手牌：`);
console.log(`  起手「无牌可出」（无 ≤4 星怪兽且无魔法）: ${pct(noPlayable)}`);
console.log(`  起手完全没有怪兽: ${pct(noMonster)}`);
console.log(`  起手只有需要祭品的怪兽（5 星以上）: ${pct(onlyTribute)}`);
console.log(`  起手可立即使用的卡数分布:`);
for (const k of Object.keys(playableCounts).sort((a, b) => a - b)) {
    console.log(`    ${k} 张: ${(playableCounts[k] / TRIALS * 100).toFixed(1)}%`);
}

// 卡组构成统计
let stat = { total: 0, lowMonster: 0, tributeMonster: 0, spell: 0, trap: 0, highAtk: 0 };
const sample = 200;
for (let i = 0; i < sample; i++) {
    for (const c of randomDeck()) {
        stat.total++;
        if (c.type === "monster") {
            if ((c.level || 0) <= 4) stat.lowMonster++;
            else stat.tributeMonster++;
            if ((c.attack || 0) >= 2500) stat.highAtk++;
        } else if (c.type === "spell") stat.spell++;
        else stat.trap++;
    }
}
console.log("\n随机卡组平均构成（基于卡池随机抽取）:");
console.log(`  低星怪兽(≤4星,免祭品): ${(stat.lowMonster / stat.total * 40).toFixed(1)} 张`);
console.log(`  需祭品怪兽(5星+): ${(stat.tributeMonster / stat.total * 40).toFixed(1)} 张`);
console.log(`  魔法: ${(stat.spell / stat.total * 40).toFixed(1)} 张 | 陷阱: ${(stat.trap / stat.total * 40).toFixed(1)} 张`);
console.log(`  ATK>=2500 的怪兽: ${(stat.highAtk / stat.total * 40).toFixed(1)} 张`);
