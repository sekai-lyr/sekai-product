// The compact rule layer used by every card source in the published client.
const effect = (type, value, description, target) => ({ trigger: "manual", type, value, ...(target ? { target } : {}), description });
const ENEMY_BEST = { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 };

const CARD_RULES = {
    water_007: { trigger: "onSummon", type: "buffSelfDefense", value: 300, description: "召唤成功时：自身守备力+300。" },
    water_008: { trigger: "onSummon", type: "debuffEnemyAttack", value: 400, description: "召唤成功时：对方攻击力最低的1只怪兽攻击力-400。" },
    water_009: { trigger: "onSummon", type: "healPlayer", value: 700, description: "召唤成功时：回复700LP。" },
    water_010: { trigger: "onSummon", type: "buffSelfAttack", value: 600, description: "召唤成功时：自身攻击力+600。" },
    water_011: { trigger: "onSummon", type: "drawCards", value: 1, description: "召唤成功时：抽1张卡。" },
    dark_006: { trigger: "onSummon", type: "returnToHand", value: 0, target: ENEMY_BEST, description: "召唤成功时：将对方攻击力最高的1只怪兽返回手牌。" },

    nc_sp_ur_001: effect("drawCards", 2, "抽2张卡。"),
    nc_sp_ur_002: effect("buffAllAlliesAttack", 800, "己方场上全部怪兽攻击力+800。"),
    nc_sp_ur_003: effect("temporaryBanish", 0, "选择对方攻击力最高的1只怪兽：将其暂时除外，回合结束时返回场上。"),
    nc_sp_ur_004: effect("healPlayer", 1800, "回复1800LP。"),
    nc_sp_ur_005: effect("destroyTarget", 0, "破坏对方场上1只怪兽。", ENEMY_BEST),
    nc_sp_ur_006: effect("directDamage", 1200, "给予对方1200点伤害。"),
    nc_sp_ur_007: effect("damageAllEnemyMonsters", 700, "对方场上全部怪兽守备力-700；守备力变为0的怪兽破坏。"),
    nc_sp_ur_008: effect("damageAndHeal", 900, "选择对方1只怪兽：其守备力-900；自己回复实际减少的数值。"),
    nc_sp_ur_009: effect("reviveToHand", 0, "选择己方墓地1只怪兽加入手牌。"),
    nc_sp_ur_010: effect("gameThroneDraw", 2, "抽2张卡；若其中同时有怪兽与魔法，再抽1张卡。本回合不能进行战斗。"),
    nc_sp_ur_011: [{ trigger: "field", type: "fieldOceanScene", value: 450, description: "场地魔法：己方水属性怪兽攻击力与守备力+450；对方守备表示时需弃1张手牌。" }],
    nc_sp_ur_012: effect("debuffAllEnemyAttack", 800, "对方场上全部怪兽攻击力-800。"),

    nc_sp_ss_001: effect("damageBothPlayers", 500, "双方各受到500点伤害。"),
    nc_sp_ss_002: effect("healPlayer", 1400, "回复1400LP。"),
    nc_sp_ss_003: effect("recycleSpellDraw", 1, "将己方墓地1张魔法卡放回卡组顶端，然后抽1张卡。"),
    nc_sp_ss_004: effect("temporaryBanish", 0, "选择对方攻击力最高的1只怪兽：将其暂时除外，回合结束时返回场上。"),
    nc_sp_ss_005: effect("drawCards", 2, "抽2张卡。"),
    nc_sp_ss_006: effect("searchWaterMonster", 4, "从卡组将1只4级以下水属性怪兽加入手牌。"),

    nc_tr_001: { trigger: "onAttacked", type: "cannotAttack", value: 0, description: "对方攻击宣言时发动：那次攻击无效，对方怪兽本回合不能攻击。" },
    nc_tr_002: { trigger: "onAttacked", type: "reduceDamage", value: 1800, description: "对方攻击宣言时发动：本次战斗伤害减少1800。" },
    nc_tr_003: { trigger: "onAttacked", type: "returnToHand", value: 0, description: "对方攻击宣言时发动：攻击怪兽返回手牌，那次攻击无效。" },
    nc_tr_004: { trigger: "onAttacked", type: "reflectDamage", value: 0, description: "对方攻击宣言时发动：那次攻击无效，并给予攻击方等同攻击力的伤害。" },
    nc_tr_005: { trigger: "onAttacked", type: "destroyAttacker", value: 0, description: "对方攻击宣言时发动：破坏攻击怪兽，那次攻击无效。" },
};

function fallbackEffect(card) {
    const stat = ({ N: 200, R: 300, SR: 450, SSR: 600, UR: 800 }[card.rarity] || 200);
    return card.type === "monster"
        ? { trigger: "onSummon", type: "buffSelfAttack", value: stat, description: `召唤成功时：自身攻击力+${stat}。` }
        : effect("buffAllAlliesAttack", stat, `己方场上全部怪兽攻击力+${stat}。`);
}

export function applyPlayableRules(card) {
    if (!card) return card;
    const normalized = { ...card, enabled: card.enabled !== false };
    const chosen = CARD_RULES[normalized.id] || fallbackEffect(normalized);
    normalized.effects = Array.isArray(chosen) ? chosen : [chosen];
    normalized.description = normalized.effects.map(item => item.description).filter(Boolean).join("\n");
    return normalized;
}

export function normalizeCardPool(cards) {
    return cards.map(applyPlayableRules);
}
