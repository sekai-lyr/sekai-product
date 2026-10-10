import test from "node:test";
import assert from "node:assert/strict";
import { GameState, Player, createCardInstance } from "../js/model.js";
import { GameEngine } from "../js/engine.js";

let serial = 0;
function monster(overrides = {}) {
    return createCardInstance({ id: `target_fixture_${serial++}`, name: "测试怪兽", type: "monster", level: 4, attack: 1800, defense: 1400, attribute: "water", effects: [], ...overrides });
}
function setup() {
    const s = new GameState();
    s.players = [new Player("A", []), new Player("B", [])];
    s.turn = 3; s.firstTurn = false; s.phase = "main_1";
    const [p, o] = s.players;
    p.deck = Array.from({ length: 12 }, () => monster());
    o.deck = Array.from({ length: 12 }, () => monster());
    return { s, p, o, e: new GameEngine(s, () => .3) };
}
function skill(action, trigger = "manual") {
    return { type: "themedAction", action, trigger, oncePerTurn: true, skillName: action };
}
function source(p, actions) {
    const c = monster({ rulesVersion: "test", effects: actions.map(x => typeof x === "string" ? skill(x) : x) });
    p.monsterZone.push(c); return c;
}

test("主题单体控制可以由玩家指定目标（不再固定打最高攻）", () => {
    const { e, p, o } = setup();
    const c = source(p, ["freeze"]);
    const weak = monster({ attack: 1200 }); const strong = monster({ attack: 2800 });
    o.monsterZone.push(weak, strong);
    const result = e.triggerAllEffects(p, c, "manual", { selectedTarget: weak });
    assert.ok(result, "效果应正常结算");
    assert.ok(weak.themedState?.frozenUntil >= e.state.turn, "被选中的目标应被冻结");
    assert.ok(!(strong.themedState?.frozenUntil >= e.state.turn), "未被选中的最高攻怪兽不应被冻结");
});

test("未指定目标时保持默认：攻击力最高的可取对象", () => {
    const { e, p, o } = setup();
    const c = source(p, ["freeze"]);
    const weak = monster({ attack: 1200 }); const strong = monster({ attack: 2800 });
    o.monsterZone.push(weak, strong);
    assert.ok(e.triggerAllEffects(p, c, "manual"));
    assert.ok(strong.themedState?.frozenUntil >= e.state.turn);
    assert.ok(!(weak.themedState?.frozenUntil >= e.state.turn));
});

test("不可被对象化的怪兽不能作为手动目标（选择后仍按默认解析）", () => {
    const { e, p, o } = setup();
    const c = source(p, ["freeze"]);
    const hidden = monster({ attack: 2800 });
    hidden.cannotBeTargeted = true;
    const weak = monster({ attack: 1200 });
    o.monsterZone.push(hidden, weak);
    assert.ok(e.triggerAllEffects(p, c, "manual", { selectedTarget: hidden }));
    assert.ok(weak.themedState?.frozenUntil >= e.state.turn, "非法目标应回退到默认最高攻可取对象");
    assert.ok(!hidden.themedState?.frozenUntil, "不可对象怪兽不应被冻结");
});

test("getEffectTargetType 对可手选动作返回目标类型", () => {
    const engine = new GameEngine(new GameState(), () => .3);
    assert.equal(engine.getEffectTargetType(skill("freeze")), "enemy_monster");
    assert.equal(engine.getEffectTargetType(skill("shelter")), "self_monster");
    assert.equal(engine.getEffectTargetType(skill("exchange")), "self_monster");
    assert.equal(engine.getEffectTargetType({ ...skill("paralyze"), params: { count: "all" } }), "none");
    assert.equal(engine.getEffectTargetType(skill("charge")), "none");
});
