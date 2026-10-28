import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { minimumMonsterStatTotal } from "../../main/resources/static/js/card-rules.js";

const monsters = ALL_CARDS.filter(card => card.type === "monster" && card.rarity !== "N" && card.series !== "starter_ygo");

// 决斗强度阶级：稀有度 rank + 星级修正，与卡面数据里的 duelPowerTier 独立计算，避免自证。
const RARITY_RANK = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };
function tierOf(card) {
    return Math.min(7, RARITY_RANK[card.rarity] + Math.floor(((Number(card.level) || 1) - 1) / 3));
}

// 越级禁止能力：低于 minTier 的怪兽不得拥有对应机制（主题动作与旧式效果两套命名都覆盖）。
const CAPABILITIES = [
    { minTier: 5, name: "全后场破坏", match: effect => effect.action === "disarm" && Number(effect.params?.count) >= 2 },
    { minTier: 4, name: "群体控制", match: effect => ["paralyze", "sleep", "freeze", "seal", "curse", "bomb"].includes(effect.action) && effect.params?.count === "all" },
    { minTier: 3, name: "放逐", match: effect => effect.action === "exile" || effect.type === "temporaryBanish" },
    { minTier: 3, name: "连击", match: effect => effect.action === "twin" || effect.type === "doubleAttack" },
    { minTier: 3, name: "复活", match: effect => effect.action === "revive" || effect.type === "reviveRecentGraveyard" },
    { minTier: 3, name: "定点破坏", match: effect => ["bomb", "detonate"].includes(effect.action) || ["destroyWeakest", "destroyTarget"].includes(effect.type) },
    { minTier: 2, name: "保护", match: effect => ["shelter", "ward"].includes(effect.action) || effect.type === "protectAllies" },
];

test("基础身材按星级与稀有度设上限，避免低星效果怪兽数值膨胀", () => {
    for (const card of monsters) {
        const rank = { R: 1, SR: 2, SSR: 3, UR: 4 }[card.rarity];
        const cap = card.level <= 4 ? 1900 + rank * 50 : card.level <= 6 ? 2400 + rank * 50 : 2800 + rank * 100;
        assert.ok(card.attack > 0 && card.attack <= cap, `${card.name}攻击力超出身材预算`);
        assert.ok(card.defense >= 0 && card.defense <= cap + 200, `${card.name}守备力超出身材预算`);
    }
});

test("data 层 duelPowerTier 与独立计算的强度阶级一致", () => {
    for (const card of monsters) {
        assert.equal(card.duelPowerTier, tierOf(card), `${card.name}的 duelPowerTier 缺失或与阶级公式不符`);
    }
});

test("低稀有低星怪兽不会越级取得高阶机制（含主题动作）", () => {
    for (const card of monsters) {
        const tier = tierOf(card);
        for (const effect of card.effects || []) {
            for (const capability of CAPABILITIES) {
                if (tier < capability.minTier) {
                    assert.ok(!capability.match(effect), `${card.name}（T${tier}）越级拥有${capability.name}`);
                }
            }
        }
    }
});

test("技能目标数量、代价和发动条件随决斗强度阶级变化", () => {
    for (const card of monsters) {
        for (const effect of card.effects) {
            assert.ok(effect.oncePerTurn && effect.hardOncePerTurn, `${card.name}缺少同名发动限制`);
            if (effect.action === "burst" || effect.action === "timeStop" || effect.action === "devour") {
                assert.match(effect.description, /支付\d+LP；/u, `${card.name}缺少LP代价`);
            }
            if (effect.action === "twin") assert.match(effect.description, /支付\d+LP/);
            if (effect.action === "disarm") {
                const minCount = tierOf(card) >= 5 ? 2 : 1;
                assert.ok(Number(effect.params?.count || 1) >= minCount, `${card.name}后场破坏数量与阶级不符`);
            }
            assert.ok(!effect.description.includes("结算角色专属能力"), `${card.name}仍使用空泛效果说明`);
        }
    }
});

test("同稀有度的攻守下限随星级严格上升", () => {
    for (const rarity of ["R", "SR", "SSR", "UR"]) {
        const levels = [...new Set(monsters.filter(card => card.rarity === rarity).map(card => card.level))].sort((a, b) => a - b);
        for (let index = 1; index < levels.length; index++) {
            assert.ok(
                minimumMonsterStatTotal({ rarity, level: levels[index] }) > minimumMonsterStatTotal({ rarity, level: levels[index - 1] }),
                `${rarity}星级曲线没有递增`,
            );
        }
    }
});
