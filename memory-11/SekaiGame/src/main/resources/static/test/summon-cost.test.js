import test from "node:test";
import assert from "node:assert/strict";
import { GameState, Player, createCardInstance } from "../js/model.js";
import { GameEngine } from "../js/engine.js";

let serial = 0;
function monster(overrides = {}) {
    return createCardInstance({ id: `summon_cost_${serial++}`, name: "测试怪兽", type: "monster", level: 4, attack: 1800, defense: 1400, attribute: "water", effects: [], ...overrides });
}
function setup(lp = 8000) {
    const s = new GameState();
    s.players = [new Player("A", []), new Player("B", [])];
    s.turn = 3; s.firstTurn = false; s.phase = "main_1";
    const [p, o] = s.players;
    p.lp = lp; o.lp = lp;
    p.deck = Array.from({ length: 8 }, () => monster());
    o.deck = Array.from({ length: 8 }, () => monster());
    return { s, p, o, e: new GameEngine(s, () => .3) };
}
function summonCard(p, overrides = {}) {
    const cost = overrides.cost === undefined ? { type: "payLife", value: 500 } : overrides.cost;
    const c = monster({
        rulesVersion: "test",
        effects: [{ type: "themedAction", action: "freeze", trigger: "onSummon", oncePerTurn: true, skillName: "测试登场技", ...(cost ? { cost } : {}) }],
        ...overrides.card,
    });
    p.monsterZone.push(c);
    return c;
}

test("登场强控按卡面支付LP代价", () => {
    const { e, p, o } = setup();
    const target = monster({ attack: 2000 });
    o.monsterZone.push(target);
    const c = summonCard(p);
    const result = e.triggerAllEffects(p, c, "onSummon");
    assert.ok(result, "效果应正常结算");
    assert.equal(p.lp, 7500, "登场技应支付500LP");
    assert.match(result, /支付500LP/);
    assert.ok(target.themedState?.frozenUntil >= e.state.turn, "目标应被冻结");
});

test("LP不足时登场强控不发动也不扣血", () => {
    const { e, p, o } = setup(300);
    const target = monster({ attack: 2000 });
    o.monsterZone.push(target);
    const c = summonCard(p);
    const result = e.triggerAllEffects(p, c, "onSummon");
    assert.ok(!result, "LP不足时不应结算");
    assert.equal(p.lp, 300, "LP 不应被扣除");
    assert.ok(!target.themedState?.frozenUntil, "LP不足时目标不应被冻结");
});

test("没有代价的登场效果不受影响", () => {
    const { e, p, o } = setup();
    const target = monster({ attack: 2000 });
    o.monsterZone.push(target);
    const c = summonCard(p, { cost: null });
    const result = e.triggerAllEffects(p, c, "onSummon");
    assert.ok(result);
    assert.equal(p.lp, 8000);
    assert.ok(target.themedState?.frozenUntil >= e.state.turn);
});
