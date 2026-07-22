/**
 * A deliberately small ruleset.  Every generated effect is handled by
 * engine.js; card flavour (name/art/attribute) only chooses between them.
 */
const RARITY = {
    N: { stat: 200, draw: 1, heal: 500, damage: 300 },
    R: { stat: 300, draw: 1, heal: 700, damage: 500 },
    SR: { stat: 450, draw: 1, heal: 1000, damage: 700 },
    SSR: { stat: 600, draw: 2, heal: 1400, damage: 900 },
    UR: { stat: 800, draw: 2, heal: 1800, damage: 1200 },
};

function tier(card) { return RARITY[card.rarity] || RARITY.N; }
function has(card, words) {
    const text = `${card.name || ""} ${card.image || ""}`;
    return words.some(word => text.includes(word));
}
function effect(type, value, description, target) {
    return { trigger: "manual", type, value, ...(target ? { target } : {}), description };
}

const ENEMY_BEST = { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 };

// These are deliberately authored card rules, not text parsing.  The title,
// rarity and illustration theme decide the effect; every type below has a
// concrete handler in engine.js and is therefore playable in a duel.
const CARD_RULES = {
    water_007: { trigger: "onSummon", type: "buffSelfDefense", value: 300, description: "召唤成功时：自身守备力+300。" },
    water_008: { trigger: "onSummon", type: "returnToHand", value: 0, target: ENEMY_BEST, description: "召唤成功时：将对方攻击力最高的1只怪兽返回手牌。" },
    water_009: { trigger: "onSummon", type: "healPlayer", value: 700, description: "召唤成功时：回复700LP。" },
    water_010: { trigger: "onSummon", type: "buffSelfAttack", value: 600, description: "召唤成功时：自身攻击力+600。" },
    water_011: { trigger: "onSummon", type: "drawCards", value: 1, description: "召唤成功时：抽1张卡。" },
    dark_006: { trigger: "onSummon", type: "debuffEnemyAttack", value: 800, description: "召唤成功时：对方攻击力最低的1只怪兽攻击力-800。" },

    nc_sp_ur_001: effect("buffAllAlliesAttack", 800, "己方场上全部怪兽攻击力+800。"),
    nc_sp_ur_002: effect("drawCards", 2, "抽2张卡。"),
    nc_sp_ur_003: effect("returnToHand", 0, "将对方攻击力最高的1只怪兽返回手牌。", ENEMY_BEST),
    nc_sp_ur_004: effect("healPlayer", 1800, "回复1800LP。"),
    nc_sp_ur_005: effect("destroyTarget", 0, "破坏对方场上1只怪兽。", ENEMY_BEST),
    nc_sp_ur_006: effect("debuffAllEnemyAttack", 800, "对方场上全部怪兽攻击力-800。"),
    nc_sp_ur_007: effect("debuffAllEnemyAttack", 800, "对方场上全部怪兽攻击力-800。"),
    nc_sp_ur_008: effect("drawCards", 2, "抽2张卡。"),
    nc_sp_ur_009: effect("buffAllAlliesAttack", 800, "己方场上全部怪兽攻击力+800。"),
    nc_sp_ur_010: effect("drawCards", 2, "抽2张卡。"),
    nc_sp_ur_011: effect("returnToHand", 0, "将对方攻击力最高的1只怪兽返回手牌。", ENEMY_BEST),
    nc_sp_ur_012: effect("healPlayer", 1800, "回复1800LP。"),

    nc_sp_ss_001: effect("buffAllAlliesAttack", 600, "己方场上全部怪兽攻击力+600。"),
    nc_sp_ss_002: effect("healPlayer", 1400, "回复1400LP。"),
    nc_sp_ss_003: effect("drawCards", 2, "抽2张卡。"),
    nc_sp_ss_004: effect("debuffAllEnemyAttack", 600, "对方场上全部怪兽攻击力-600。"),
    nc_sp_ss_005: effect("drawCards", 2, "抽2张卡。"),
    nc_sp_ss_006: effect("returnToHand", 0, "将对方攻击力最高的1只怪兽返回手牌。", ENEMY_BEST),

    nc_tr_001: effect("debuffAllEnemyAttack", 800, "对方场上全部怪兽攻击力-800。"),
    nc_tr_002: effect("healPlayer", 1800, "回复1800LP。"),
    nc_tr_003: effect("returnToHand", 0, "将对方攻击力最高的1只怪兽返回手牌。", ENEMY_BEST),
    nc_tr_004: effect("buffAllAlliesAttack", 800, "己方场上全部怪兽攻击力+800。"),
    nc_tr_005: effect("drawCards", 2, "抽2张卡。"),
};

function fallbackEffect(card) {
    const p = tier(card);
    if (card.type === "monster") return { trigger: "onSummon", type: "buffSelfAttack", value: p.stat, description: `召唤成功时：自身攻击力+${p.stat}。` };
    return effect("buffAllAlliesAttack", p.stat, `己方场上全部怪兽攻击力+${p.stat}。`);
}

export function applyPlayableRules(card) {
    if (!card) return card;
    const normalized = { ...card, enabled: card.enabled !== false };
    const chosen = CARD_RULES[normalized.id] || fallbackEffect(normalized);
    normalized.effects = [chosen];
    normalized.description = chosen.description;
    return normalized;
}

export function normalizeCardPool(cards) {
    return cards.map(applyPlayableRules);
}
