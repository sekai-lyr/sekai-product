/**
 * packs.js - 卡包配置与抽取逻辑
 * 支持：Nightcord主题卡池、单抽/十连、保底、UR保底
 */

import { rng } from "./rng.js";
import { ANIME_CARDS } from "./nightcord-cards.js";

// 概率与卡池构成对齐：旧表 62% 落在 N，而卡池里非入门 N 只有 1 张，
// 实际等于 62% 的抽卡必然转为碎片。新表把主要出率让给 SR/SSR/UR。
export const PACK_RATES = {
    N: 0.05, R: 0.1, SR: 0.45, SSR: 0.3, UR: 0.1,
};

export const PACK_GUARANTEE = {
    tenPack: { minRarity: "SR" },
};

export const NIGHTCORD_PACK = {
    id: "nightcord_pack_001",
    name: "世界回响",
    description: "包含当前全部可用卡牌。单抽300次元币，十连2700次元币并保底SR或以上。",
    cost: { duelCoins: 300 },
    tenCost: { duelCoins: 2700 },
    cardsPerPack: 1,
    image: "",
};

export const PACK_DEFINITIONS = [
    NIGHTCORD_PACK,
    { id: "standard_pack_001", name: "元素觉醒", description: "包含六种属性的基础卡牌。", image: "./assets/packs/standard_pack_001.webp", cardsPerPack: 5, cost: { duelPoints: 100 }, pool: { types: ["monster", "spell", "trap"] } },
];

export function getPackPool(packDef, cardDatabase) {
    let pool = cardDatabase.filter(c => c.enabled !== false
        && c.series !== "starter_n"
        && c.series !== "starter_ygo");
    if (packDef.series) {
        pool = pool.filter(c => c.series === packDef.series);
    }
    if (packDef.pool?.attribute) pool = pool.filter(c => c.attribute === packDef.pool.attribute);
    if (packDef.pool?.types?.length) pool = pool.filter(c => packDef.pool.types.includes(c.type));
    return pool;
}

const RARITY_ORDER = ["N", "R", "SR", "SSR", "UR"];

/**
 * 从池中抽取一张"至少 minRarity"的卡；该稀有度没有卡时向上取最近的可抽取稀有度。
 * 返回 null 表示池里没有任何 >= minRarity 的卡。
 */
function escalateRarityPick(pool, minRarity, randomSource) {
    let index = Math.max(0, RARITY_ORDER.indexOf(minRarity));
    while (index < RARITY_ORDER.length) {
        const candidates = pool.filter(c => c.rarity === RARITY_ORDER[index]);
        if (candidates.length > 0) return { ...randomSource.pick(candidates) };
        index++;
    }
    return null;
}

export function getEffectiveRates(pityCount) {
    if (pityCount >= 49) {
        // 第 50 抽由 openPack 直接保底 UR，概率表保持为上一抽的软保底水平。
        return getEffectiveRates(48);
    }
    if (pityCount >= 35) {
        const bonus = (pityCount - 34) * 0.0332;
        return {
            N: Math.max(0, PACK_RATES.N - bonus * PACK_RATES.N),
            R: Math.max(0, PACK_RATES.R - bonus * PACK_RATES.R),
            SR: Math.max(0, PACK_RATES.SR - bonus * PACK_RATES.SR),
            SSR: Math.max(0, PACK_RATES.SSR - bonus * PACK_RATES.SSR),
            UR: Math.min(1, PACK_RATES.UR + bonus * (PACK_RATES.N + PACK_RATES.R + PACK_RATES.SR + PACK_RATES.SSR)),
        };
    }
    return { ...PACK_RATES };
}

export function openPack(packDef, cardDatabase, randomSource = rng, pityCount = 0) {
    const pool = getPackPool(packDef, cardDatabase);
    if (pool.length === 0) return { success: false, reason: "卡池为空" };

    const results = [];
    const cardsPerPack = packDef.cardsPerPack || 1;
    const rates = getEffectiveRates(pityCount);
    // 已连续 49 抽未中时，本次（第 50 抽）直接保底 UR。
    const guaranteedURIndex = shouldGuaranteeUR(pityCount) ? randomSource.integer(0, cardsPerPack - 1) : -1;

    for (let i = 0; i < cardsPerPack; i++) {
        let rarity;
        if (i === guaranteedURIndex) {
            rarity = "UR";
        } else {
            rarity = randomSource.weightedPick([
                { value: "N", weight: rates.N },
                { value: "R", weight: rates.R },
                { value: "SR", weight: rates.SR },
                { value: "SSR", weight: rates.SSR },
                { value: "UR", weight: rates.UR },
            ]);
        }
        const rarityPool = pool.filter(c => c.rarity === rarity);
        if (rarityPool.length > 0) {
            results.push({ ...randomSource.pick(rarityPool) });
        } else {
            results.push({ ...randomSource.pick(pool) });
        }
    }
    return { success: true, cards: results };
}

export function openTenPacks(packDef, cardDatabase, randomSource = rng, pityCount = 0) {
    const allCards = [];
    let hasHighRarity = false;
    let packsSinceUR = pityCount;

    for (let i = 0; i < 10; i++) {
        const pCount = packsSinceUR;
        const result = openPack(packDef, cardDatabase, randomSource, pCount);
        if (!result.success) return result;
        allCards.push(...result.cards);

        // Track UR
        const hasUR = result.cards.some(c => c.rarity === "UR");
        if (hasUR) {
            packsSinceUR = 0;
        } else {
            packsSinceUR++;
        }

        if (result.cards.some(c => ["SR", "SSR", "UR"].includes(c.rarity))) hasHighRarity = true;
    }

    // 十连保底：至少一张 SR 或以上。
    if (!hasHighRarity && allCards.length > 0) {
        const guaranteed = escalateRarityPick(getPackPool(packDef, cardDatabase), PACK_GUARANTEE.tenPack.minRarity, randomSource);
        if (guaranteed) {
            // 优先替换最低稀有度的槽位，尽量不影响已抽到的SR以上卡牌。
            let target = allCards.findIndex(c => c.rarity === "N");
            if (target < 0) target = allCards.findIndex(c => c.rarity === "R");
            if (target < 0) target = allCards.findIndex(c => c.rarity === "SR");
            allCards[target >= 0 ? target : allCards.length - 1] = guaranteed;
        }
    }

    return { success: true, cards: allCards, packsSinceUR };
}

// ---- 保底计算 ----
export function calculatePity(packsSinceUR, gotUR) {
    if (gotUR) return 0;
    return packsSinceUR + 1;
}

export function shouldGuaranteeUR(packsSinceUR) {
    // 计数表示此前连续未出 UR 的抽数；已有 49 次未中时，本次就是第 50 抽。
    return packsSinceUR >= 49;
}

/**
 * 重复保护：整包全是已拥有的卡时，把其中一张换成"尚未拥有"的卡。
 * 实测不带保护时第 30 包就会开出 0 张新卡，集齐 308 张需要约 221 包，
 * 玩家几乎永远看不到收藏进度，开包也失去意义。
 * 优先用同稀有度的未拥有卡替换，避免凭空提高稀有度分布。
 * @returns {{cards: object[], replaced: object|null, tradedRarity: string|null}}
 */
export function applyDuplicateProtection(cards, pool, collection, randomSource = rng) {
    if (!Array.isArray(cards) || cards.length === 0) return { cards, replaced: null, tradedRarity: null };
    const ownedCount = card => Number(collection?.cards?.[card.id] || 0);
    if (cards.some(card => ownedCount(card) === 0)) return { cards, replaced: null, tradedRarity: null };

    const fresh = pool.filter(card => ownedCount(card) === 0);
    if (fresh.length === 0) return { cards, replaced: null, tradedRarity: null }; // 已集齐，无需保护

    // 换掉本包中稀有度最低的一张，尽量不影响已抽到的高稀有度卡
    let worstIndex = 0;
    cards.forEach((card, index) => {
        const rank = RARITY_ORDER.indexOf(card.rarity);
        const worstRank = RARITY_ORDER.indexOf(cards[worstIndex].rarity);
        if (rank >= 0 && (worstRank < 0 || rank < worstRank)) worstIndex = index;
    });

    const tradedRarity = cards[worstIndex].rarity;
    const sameRarity = fresh.filter(card => card.rarity === tradedRarity);
    const replacement = { ...randomSource.pick(sameRarity.length > 0 ? sameRarity : fresh) };
    const next = [...cards];
    next[worstIndex] = replacement;
    return { cards: next, replaced: replacement, tradedRarity };
}
