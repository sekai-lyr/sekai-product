/** Product/content metrics for a market-readiness assessment. */
import { ALL_CARDS } from "../SekaiGame/src/main/resources/static/js/catalog.js";
import { hasEffectHandler } from "../SekaiGame/src/main/resources/static/js/engine.js";
import { AI_STAGES } from "../SekaiGame/src/main/resources/static/js/stages.js";
import { NIGHTCORD_PACK, PACK_RATES, getPackPool } from "../SekaiGame/src/main/resources/static/js/packs.js";
import { CRAFT_COSTS, SHARD_VALUES } from "../SekaiGame/src/main/resources/static/js/collection.js";
import { REWARD_TABLE, PVP_REWARD_TABLE } from "../SekaiGame/src/main/resources/static/js/rewards.js";
import { readdirSync } from "node:fs";

const packPool = getPackPool(NIGHTCORD_PACK, ALL_CARDS);
const byType = {};
const byRarity = {};
const bySeries = {};
const byLevel = {};
const effectsUsed = new Set();
let effectCount = 0;
let withEffects = 0;
let targetSpecs = 0;
const onAttacked = [];

for (const c of ALL_CARDS) {
    byType[c.type] = (byType[c.type] || 0) + 1;
    byRarity[c.rarity] = (byRarity[c.rarity] || 0) + 1;
    bySeries[c.series] = (bySeries[c.series] || 0) + 1;
    if (c.type === "monster") byLevel[c.level] = (byLevel[c.level] || 0) + 1;
    const effs = c.effects || [];
    if (effs.length) withEffects++;
    effectCount += effs.length;
    for (const e of effs) {
        if (e?.type) effectsUsed.add(e.type);
        if (e?.target) targetSpecs++;
        if (e?.trigger === "onAttacked") onAttacked.push(c);
    }
}

const attackers = ALL_CARDS.filter(c => c.type === "monster" && (c.attack || 0) >= 1500).length;
const bigMonsters = ALL_CARDS.filter(c => c.type === "monster" && (c.attack || 0) >= 2500).length;
const genericMonsters = ALL_CARDS.filter(c => c.type === "monster" && !(c.effects || []).length).length;

console.log("=== 卡池构成 ===");
console.log("总卡数:", ALL_CARDS.length, "| 可抽卡池:", packPool.length);
console.log("按类型:", JSON.stringify(byType));
console.log("按稀有度:", JSON.stringify(byRarity));
console.log("按系列:", JSON.stringify(bySeries));
console.log("怪兽等级分布:", JSON.stringify(byLevel));
console.log("ATK>=1500:", attackers, "| ATK>=2500:", bigMonsters, "| 无效果怪兽:", genericMonsters);
console.log("有效果的卡:", withEffects, "| 效果条目总数:", effectCount, "| 平均每卡:", (effectCount / ALL_CARDS.length).toFixed(2));
console.log("不同效果类型:", effectsUsed.size);
console.log("显式声明选靶规则的卡:", targetSpecs);
console.log("可响应攻击的卡(onAttacked):", onAttacked.length);

const stageRewards = AI_STAGES.map(s => Number(s.reward || 0));
console.log("\n=== 关卡与经济 ===");
console.log("关卡数:", AI_STAGES.length, "| 奖励范围:", Math.min(...stageRewards), "-", Math.max(...stageRewards));
console.log("关卡奖励总和:", stageRewards.reduce((a, b) => a + b, 0));
console.log("单包:", NIGHTCORD_PACK.cost.duelCoins, "币/", NIGHTCORD_PACK.cardsPerPack, "张 | 十连:", NIGHTCORD_PACK.tenCost.duelCoins, "币/80张");
console.log("每张卡均价:", (NIGHTCORD_PACK.tenCost.duelCoins / 80).toFixed(1), "币");
console.log("AI胜/负:", REWARD_TABLE.win, "/", REWARD_TABLE.loss, "| PvP胜/负:", PVP_REWARD_TABLE.win, "/", PVP_REWARD_TABLE.loss);
console.log("UR概率:", PACK_RATES.UR * 100 + "%", "| 50包保底UR");
console.log("制作成本:", JSON.stringify(CRAFT_COSTS), "| 分解收益:", JSON.stringify(SHARD_VALUES));

// 组一副 40 张卡组需要多少包 / 多少钱（期望）
const perPack = NIGHTCORD_PACK.cardsPerPack;
const needed = 40;
const packsForDeck = Math.ceil(needed / perPack);
console.log(`\n组卡最低消耗(按每包全是新卡上限): ${packsForDeck} 包 = ${packsForDeck * NIGHTCORD_PACK.cost.duelCoins} 币`);
console.log(`按 AI 胜场(120/场)计算需要: ${Math.ceil(packsForDeck * NIGHTCORD_PACK.cost.duelCoins / REWARD_TABLE.win)} 场胜利`);

// 资产
try {
    const full = readdirSync("SekaiGame/src/main/resources/static/assets/cards/nightcord/full").length;
    const thumb = readdirSync("SekaiGame/src/main/resources/static/assets/cards/nightcord/thumb").length;
    console.log("\n=== 资产 ===");
    console.log("nightcord full 大图:", full, "| thumb 缩略图:", thumb);
} catch (e) { console.log("assets 目录读取失败:", e.message); }
try {
    const ygo = readdirSync("SekaiGame/src/main/resources/static/assets/cards/ygo-starter").length;
    console.log("ygo-starter 卡图:", ygo);
} catch { }

const withImage = ALL_CARDS.filter(c => c.image).length;
console.log("声明 image 字段的卡:", withImage, "/", ALL_CARDS.length);
