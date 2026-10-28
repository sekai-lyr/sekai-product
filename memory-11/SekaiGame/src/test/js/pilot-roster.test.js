import assert from "node:assert/strict";
import test from "node:test";
import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { ACTION_DEFAULTS } from "../../main/resources/static/js/themed-effects.js";

const ROSTER = {
    picture_ex_030: "ignite", picture_ex_037: "venom", picture_ex_020: "bleed",
    picture_ex_048: "paralyze", picture_ex_027: "combust", picture_ex_056: "domain",
    picture_ex_011: "domain", picture_ex_012: "detonate", picture_ex_013: "paralyze",
    picture_ex_014: "bleed", picture_ex_018: "exile",
    source_monster_015: "domain", source_monster_010: "infinity", source_monster_012: "bleed",
    source_monster_014: "ignite", source_monster_013: "detonate", source_monster_008: "curse",
    picture_ex_072: "exile",
    picture_ssr7_032: "curse", picture_ssr7_036: "gamble", picture_ssr7_043: "paralyze",
    picture_ssr7_026: "ignite", picture_ssr7_049: "bleed", picture_ex_107: "domain",
    picture_ssr7_007: "ignite", picture_ssr7_016: "detonate", picture_ssr7_003: "exile",
    picture_ssr7_013: "bleed", picture_ssr7_014: "curse", picture_ssr7_015: "bleed",
};

test("30 张试点卡动作映射正确且卡面可渲染", () => {
    assert.equal(Object.keys(ROSTER).length, 30);
    for (const [id, action] of Object.entries(ROSTER)) {
        const card = ALL_CARDS.find(item => item.id === id);
        assert.ok(card, `缺少卡：${id}`);
        assert.equal(card.effects[0].action, action, `${id} 动作不符`);
        assert.ok(card.effects[0].skillName?.length > 0, `${id} 缺技能名`);
        assert.ok((card.description || "").includes(card.effects[0].description.replace(/^.*?：/u, "")), `${id} 卡面与效果不一致`);
    }
});

test("30 张试点卡参数互不相同（同动作内）", () => {
    const groups = new Map();
    for (const id of Object.keys(ROSTER)) {
        const card = ALL_CARDS.find(item => item.id === id);
        const e = card.effects[0];
        const key = `${e.trigger}|${e.action}`;
        const params = JSON.stringify(e.params || {});
        if (!groups.has(key)) groups.set(key, new Map());
        assert.equal(groups.get(key).has(params), false, `${id} 参数重复`);
        groups.get(key).set(params, id);
    }
});

// 设计规格 §7 表（第二阶段的点燃、引爆和剧毒按 strategy-phase-two.md 更新）逐张的触发时机与有效参数（ACTION_DEFAULTS 与 effect.params 合并后的全量键）。
// 候选池发放顺序或数值一旦漂移会在这里直接失败，而不是被唯一性用例静默放过。
const EXPECTED_SIGNATURES = {
    picture_ex_030: {"trigger":"manual","action":"ignite","params":{"stacks":2,"damage":250}},
    picture_ex_037: {"trigger":"manual","action":"venom","params":{"stacks":1,"damage":250}},
    picture_ex_020: {"trigger":"manual","action":"bleed","params":{"stacks":2,"damage":400}},
    picture_ex_048: {"trigger":"manual","action":"paralyze","params":{"count":1,"amount":600,"gamble":true}},
    picture_ex_027: {"trigger":"manual","action":"combust","params":{"damage":600}},
    picture_ex_056: {"trigger":"manual","action":"domain","params":{"field":"rojin","cost":800}},
    picture_ex_011: {"trigger":"manual","action":"domain","params":{"field":"za_warudo","cost":1000}},
    picture_ex_012: {"trigger":"manual","action":"detonate","params":{"stacks":1,"damage":800}},
    picture_ex_013: {"trigger":"manual","action":"paralyze","params":{"count":"all","amount":0,"gamble":false}},
    picture_ex_014: {"trigger":"manual","action":"bleed","params":{"stacks":3,"damage":300}},
    picture_ex_018: {"trigger":"manual","action":"exile","params":{"turns":2,"penalty":500,"self":false}},
    source_monster_015: {"trigger":"manual","action":"domain","params":{"field":"wuji","cost":1200}},
    source_monster_010: {"trigger":"onSummon","action":"infinity","params":{"reduce":1000}},
    source_monster_012: {"trigger":"manual","action":"bleed","params":{"stacks":2,"damage":600}},
    source_monster_014: {"trigger":"manual","action":"ignite","params":{"stacks":1,"damage":800}},
    source_monster_013: {"trigger":"manual","action":"detonate","params":{"stacks":3,"damage":500}},
    source_monster_008: {"trigger":"manual","action":"curse","params":{"stacks":1,"damage":800}},
    picture_ex_072: {"trigger":"onDestroyed","action":"exile","params":{"turns":1,"penalty":500,"self":true}},
    picture_ssr7_032: {"trigger":"onSummon","action":"curse","params":{"stacks":1,"damage":600}},
    picture_ssr7_036: {"trigger":"onSummon","action":"gamble","params":{"draw":2,"heal":800}},
    picture_ssr7_043: {"trigger":"onSummon","action":"paralyze","params":{"count":1,"amount":0,"gamble":false}},
    picture_ssr7_026: {"trigger":"onSummon","action":"ignite","params":{"stacks":1,"damage":700}},
    picture_ssr7_049: {"trigger":"manual","action":"bleed","params":{"stacks":1,"damage":650}},
    picture_ex_107: {"trigger":"manual","action":"domain","params":{"field":"ongaku","cost":600}},
    picture_ssr7_007: {"trigger":"manual","action":"ignite","params":{"stacks":3,"damage":400}},
    picture_ssr7_016: {"trigger":"manual","action":"detonate","params":{"stacks":1,"damage":750}},
    picture_ssr7_003: {"trigger":"manual","action":"exile","params":{"turns":1,"penalty":300,"self":false}},
    picture_ssr7_013: {"trigger":"manual","action":"bleed","params":{"stacks":2,"damage":500}},
    picture_ssr7_014: {"trigger":"manual","action":"curse","params":{"stacks":2,"damage":500}},
    picture_ssr7_015: {"trigger":"manual","action":"bleed","params":{"stacks":1,"damage":700}},
};

test("30 张试点卡的触发时机与有效参数逐张锁定 §7 表", () => {
    assert.equal(Object.keys(EXPECTED_SIGNATURES).length, 30);
    for (const [id, expected] of Object.entries(EXPECTED_SIGNATURES)) {
        const card = ALL_CARDS.find(item => item.id === id);
        assert.ok(card, `缺少卡：${id}`);
        const [effect] = card.effects;
        assert.equal(effect.trigger, expected.trigger, `${id} 触发时机不符`);
        assert.equal(effect.action, expected.action, `${id} 动作不符`);
        const effective = { ...ACTION_DEFAULTS[effect.action], ...(effect.params || {}) };
        assert.deepEqual(effective, expected.params, `${id} 有效参数与 §7 不一致`);
        assert.equal(JSON.stringify(effective), JSON.stringify(expected.params), `${id} 有效参数 JSON 非全等（键序或缺省键不一致）`);
    }
});
