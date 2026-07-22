/**
 * cards.js
 * 卡牌数据 —— 次元决斗：元素召唤
 * 50张现有卡牌 + 新字段支持 + 自动校验
 */

export const cardDatabase = [
    // ===== 火属性 · 怪兽 (6张) =====
    { id: "fire_001", name: "", type: "monster", attribute: "fire", race: "dragon_knight", level: 5, attack: 2400, defense: 1800, rarity: "SR", effects: [{ trigger: "onSummon", type: "damageAllEnemyMonsters", value: 300 }], description: "", image: "", series: null, tags: [], aiHints: { role: "attacker", priority: 70 }, lore: "", enabled: true },
    { id: "fire_002", name: "", type: "monster", attribute: "fire", race: "warrior", level: 3, attack: 1600, defense: 1200, rarity: "R", effects: [{ trigger: "onSummon", type: "buffSelfAttack", value: 300 }], description: "", image: "", series: null, tags: [], aiHints: { role: "attacker", priority: 50 }, lore: "", enabled: true },
    { id: "fire_003", name: "", type: "monster", attribute: "fire", race: "dragon_knight", level: 7, attack: 2800, defense: 2200, rarity: "SSR", effects: [{ trigger: "onDestroyed", type: "reviveToHand", value: 0 }], description: "", image: "", series: null, tags: [], aiHints: { role: "finisher", priority: 85, saveForThreat: true }, lore: "", enabled: true },
    { id: "fire_004", name: "", type: "monster", attribute: "fire", race: "beast", level: 2, attack: 1200, defense: 800, rarity: "N", effects: [], description: "", image: "", series: null, tags: [], aiHints: { role: "attacker", priority: 20 }, lore: "", enabled: true },
    { id: "fire_005", name: "", type: "monster", attribute: "fire", race: "rock", level: 6, attack: 2000, defense: 2400, rarity: "SR", effects: [{ trigger: "onSummon", type: "damageAllEnemyMonsters", value: 200 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 65 }, lore: "", enabled: true },
    { id: "fire_006", name: "", type: "monster", attribute: "fire", race: "warrior", level: 4, attack: 1800, defense: 1200, rarity: "R", effects: [{ trigger: "onSummon", type: "buffSelfAttack", value: 500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "attacker", priority: 55 }, lore: "", enabled: true },
    // ===== 水属性 · 怪兽 (6张) =====
    { id: "water_001", name: "", type: "monster", attribute: "water", race: "dragon", level: 4, attack: 1600, defense: 2000, rarity: "R", effects: [{ trigger: "onSummon", type: "buffSelfDefense", value: 500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 45 }, lore: "", enabled: true },
    { id: "water_002", name: "", type: "monster", attribute: "water", race: "spellcaster", level: 4, attack: 1400, defense: 1600, rarity: "R", effects: [{ trigger: "onSummon", type: "debuffEnemyAttack", value: 300 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 50 }, lore: "", enabled: true },
    { id: "water_003", name: "", type: "monster", attribute: "water", race: "aqua", level: 8, attack: 2800, defense: 2600, rarity: "SSR", effects: [{ trigger: "onSummon", type: "destroyAllEnemyMonsters", value: 0 }], description: "", image: "", series: null, tags: [], aiHints: { role: "finisher", priority: 90, saveForThreat: true }, lore: "", enabled: true },
    { id: "water_004", name: "", type: "monster", attribute: "water", race: "aqua", level: 2, attack: 800, defense: 1200, rarity: "N", effects: [{ trigger: "onSummon", type: "healPlayer", value: 500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "recovery", priority: 30 }, lore: "", enabled: true },
    { id: "water_005", name: "", type: "monster", attribute: "water", race: "warrior", level: 5, attack: 1800, defense: 2000, rarity: "SR", effects: [{ trigger: "onSummon", type: "debuffAllEnemyAttack", value: 500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 65 }, lore: "", enabled: true },
    { id: "water_006", name: "", type: "monster", attribute: "water", race: "rock", level: 3, attack: 1000, defense: 1800, rarity: "N", effects: [{ trigger: "onSummon", type: "buffSelfDefense", value: 400 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 25 }, lore: "", enabled: true },
    // ===== 风属性 · 怪兽 (6张) =====
    { id: "wind_001", name: "", type: "monster", attribute: "wind", race: "warrior", level: 3, attack: 1400, defense: 1000, rarity: "N", effects: [{ trigger: "onSummon", type: "drawCards", value: 1 }], description: "", image: "", series: null, tags: [], aiHints: { role: "draw", priority: 40 }, lore: "", enabled: true },
    { id: "wind_002", name: "", type: "monster", attribute: "wind", race: "winged_beast", level: 5, attack: 2000, defense: 1400, rarity: "SR", effects: [{ trigger: "onSummon", type: "drawCards", value: 1 }], description: "", image: "", series: null, tags: [], aiHints: { role: "draw", priority: 60 }, lore: "", enabled: true },
    { id: "wind_003", name: "", type: "monster", attribute: "wind", race: "dragon", level: 6, attack: 2200, defense: 1600, rarity: "SR", effects: [{ trigger: "onSummon", type: "damageAllEnemyMonsters", value: 500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "attacker", priority: 75 }, lore: "", enabled: true },
    { id: "wind_004", name: "", type: "monster", attribute: "wind", race: "fairy", level: 1, attack: 400, defense: 300, rarity: "N", effects: [{ trigger: "onSummon", type: "drawCards", value: 1 }], description: "", image: "", series: null, tags: [], aiHints: { role: "comboStarter", priority: 35 }, lore: "", enabled: true },
    { id: "wind_005", name: "", type: "monster", attribute: "wind", race: "dragon", level: 6, attack: 2400, defense: 1800, rarity: "SR", effects: [{ trigger: "onSummon", type: "drawCards", value: 2 }], description: "", image: "", series: null, tags: [], aiHints: { role: "draw", priority: 80, saveForThreat: true }, lore: "", enabled: true },
    { id: "wind_006", name: "", type: "monster", attribute: "wind", race: "warrior", level: 2, attack: 1100, defense: 700, rarity: "N", effects: [{ trigger: "onSummon", type: "drawCards", value: 1 }], description: "", image: "", series: null, tags: [], aiHints: { role: "comboStarter", priority: 30 }, lore: "", enabled: true },
    // ===== 地属性 · 怪兽 (6张) =====
    { id: "earth_001", name: "", type: "monster", attribute: "earth", race: "rock", level: 6, attack: 1800, defense: 2800, rarity: "SR", effects: [{ trigger: "onSummon", type: "buffSelfDefense", value: 800 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 60 }, lore: "", enabled: true },
    { id: "earth_002", name: "", type: "monster", attribute: "earth", race: "rock", level: 7, attack: 2000, defense: 3200, rarity: "SSR", effects: [{ trigger: "onSummon", type: "buffSelfDefense", value: 1000 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 70, saveForThreat: true }, lore: "", enabled: true },
    { id: "earth_003", name: "", type: "monster", attribute: "earth", race: "machine", level: 4, attack: 1200, defense: 2000, rarity: "R", effects: [{ trigger: "onSummon", type: "buffSelfDefense", value: 500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 40 }, lore: "", enabled: true },
    { id: "earth_004", name: "", type: "monster", attribute: "earth", race: "insect", level: 2, attack: 600, defense: 1400, rarity: "N", effects: [{ trigger: "onSummon", type: "buffSelfDefense", value: 300 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 15 }, lore: "", enabled: true },
    { id: "earth_005", name: "", type: "monster", attribute: "earth", race: "rock", level: 5, attack: 1500, defense: 2400, rarity: "SR", effects: [{ trigger: "afterDamage", type: "reflectDamage", value: 500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 55 }, lore: "", enabled: true },
    { id: "earth_006", name: "", type: "monster", attribute: "earth", race: "rock", level: 3, attack: 900, defense: 1600, rarity: "N", effects: [{ trigger: "afterDamage", type: "reflectDamage", value: 300 }], description: "", image: "", series: null, tags: [], aiHints: { role: "defender", priority: 20 }, lore: "", enabled: true },
    // ===== 光属性 · 怪兽 (6张) =====
    { id: "light_001", name: "", type: "monster", attribute: "light", race: "warrior", level: 4, attack: 1600, defense: 1400, rarity: "R", effects: [{ trigger: "onSummon", type: "healPlayer", value: 800 }], description: "", image: "", series: null, tags: [], aiHints: { role: "recovery", priority: 45 }, lore: "", enabled: true },
    { id: "light_002", name: "", type: "monster", attribute: "light", race: "dragon", level: 7, attack: 2600, defense: 2200, rarity: "SSR", effects: [{ trigger: "onSummon", type: "healPlayer", value: 1500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "finisher", priority: 75 }, lore: "", enabled: true },
    { id: "light_003", name: "", type: "monster", attribute: "light", race: "fairy", level: 2, attack: 800, defense: 1000, rarity: "N", effects: [{ trigger: "onSummon", type: "healPlayer", value: 500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "recovery", priority: 25 }, lore: "", enabled: true },
    { id: "light_004", name: "", type: "monster", attribute: "light", race: "fairy", level: 5, attack: 1700, defense: 1800, rarity: "SR", effects: [{ trigger: "onSummon", type: "healPlayer", value: 1000 }], description: "", image: "", series: null, tags: [], aiHints: { role: "recovery", priority: 55 }, lore: "", enabled: true },
    { id: "light_005", name: "", type: "monster", attribute: "light", race: "dragon_knight", level: 8, attack: 3000, defense: 2500, rarity: "SSR", effects: [{ trigger: "onSummon", type: "healAllAllies", value: 800 }], description: "", image: "", series: null, tags: [], aiHints: { role: "finisher", priority: 95, saveForThreat: true }, lore: "", enabled: true },
    { id: "light_006", name: "", type: "monster", attribute: "light", race: "fairy", level: 3, attack: 1200, defense: 1000, rarity: "N", effects: [{ trigger: "onSummon", type: "healPlayer", value: 400 }], description: "", image: "", series: null, tags: [], aiHints: { role: "recovery", priority: 20 }, lore: "", enabled: true },
    // ===== 暗属性 · 怪兽 (5张) =====
    { id: "dark_001", name: "", type: "monster", attribute: "dark", race: "warrior", level: 3, attack: 1500, defense: 800, rarity: "R", effects: [{ trigger: "onSummon", type: "directDamage", value: 500 }], description: "", image: "", series: null, tags: [], aiHints: { role: "finisher", priority: 60 }, lore: "", enabled: true },
    { id: "dark_002", name: "", type: "monster", attribute: "dark", race: "warrior", level: 5, attack: 2000, defense: 1500, rarity: "SR", effects: [{ trigger: "onSummon", type: "destroyTarget", value: 0 }], description: "", image: "", series: null, tags: [], aiHints: { role: "removal", priority: 75 }, lore: "", enabled: true },
    { id: "dark_003", name: "", type: "monster", attribute: "dark", race: "fiend", level: 7, attack: 2800, defense: 2000, rarity: "SSR", effects: [{ trigger: "onSummon", type: "destroyTarget", value: 0 }], description: "", image: "", series: null, tags: [], aiHints: { role: "removal", priority: 85, saveForThreat: true }, lore: "", enabled: true },
    { id: "dark_004", name: "", type: "monster", attribute: "dark", race: "fiend", level: 1, attack: 600, defense: 400, rarity: "N", effects: [{ trigger: "afterDamage", type: "lifesteal", value: 0 }], description: "", image: "", series: null, tags: [], aiHints: { role: "attacker", priority: 15 }, lore: "", enabled: true },
    { id: "dark_005", name: "", type: "monster", attribute: "dark", race: "beast", level: 4, attack: 1600, defense: 1000, rarity: "R", effects: [{ trigger: "afterDamage", type: "lifesteal", value: 0 }], description: "", image: "", series: null, tags: [], aiHints: { role: "attacker", priority: 45 }, lore: "", enabled: true },
];

// ======================== 常量导出 ========================
export const ELEMENT_ICONS = { fire: "🔥", water: "💧", wind: "🌬️", earth: "🌍", light: "✨", dark: "🌑", none: "-" };
export const ELEMENT_NAMES = { fire: "火", water: "水", wind: "风", earth: "地", light: "光", dark: "暗", none: "无" };
export const ELEMENT_STRONG = { fire: "wind", wind: "earth", earth: "water", water: "fire", light: "dark", dark: "light" };
export const RACE_NAMES = { dragon: "龙族", warrior: "战士族", spellcaster: "魔法师族", beast: "兽族", machine: "机械族", fiend: "恶魔族", fairy: "天使族", rock: "岩石族", aqua: "水族", winged_beast: "鸟兽族", insect: "昆虫族", zombie: "不死族", dragon_knight: "龙骑士族", plant: "植物族", psychic: "超能力族", sea_serpent: "海龙族", thunder: "雷族", reptile: "爬虫族", beast_warrior: "兽战士族", cyberse: "电子界族", divine_beast: "幻神兽族" };

// ======================== 自动校验 ========================
export function validateCardData(card, index) {
    const issues = [];
    if (!card.id) issues.push(`卡牌#${index}: 缺少id`);
    if (!card.name) issues.push(`卡牌#${card.id}: 缺少名称`);
    if (!["monster", "spell", "trap"].includes(card.type)) issues.push(`卡牌#${card.id}: 类型无效 ${card.type}`);
    if (!card.attribute) issues.push(`卡牌#${card.id}: 缺少属性`);
    if (!card.rarity || !["N", "R", "SR", "SSR", "UR"].includes(card.rarity)) issues.push(`卡牌#${card.id}: 稀有度无效`);
    if (card.type === "monster") {
        if (typeof card.attack !== "number") issues.push(`卡牌#${card.id}: 缺少攻击力`);
        if (typeof card.defense !== "number") issues.push(`卡牌#${card.id}: 缺少守备力`);
        if (typeof card.level !== "number") issues.push(`卡牌#${card.id}: 缺少等级`);
    }
    if (!card.description) issues.push(`卡牌#${card.id}: 缺少描述`);
    if (issues.length > 0) console.warn("[卡牌校验]", issues.join("; "));
    return issues;
}

export function validateCardDatabase() {
    const issues = [];
    const ids = cardDatabase.map(c => c.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) issues.push(`重复ID: ${dupes.join(", ")}`);

    cardDatabase.forEach((card, i) => {
        issues.push(...validateCardData(card, i));
    });

    if (issues.length > 0) {
        console.warn(`[数据库校验] 发现${issues.length}个问题`);
    } else {
        console.log(`[数据库校验] ${cardDatabase.length}张卡牌全部通过`);
    }
    return issues;
}

// 启动时自动校验
if (typeof window === "undefined") {
    // Node.js 环境（测试时）不自动校验
} else {
    validateCardDatabase();
}
