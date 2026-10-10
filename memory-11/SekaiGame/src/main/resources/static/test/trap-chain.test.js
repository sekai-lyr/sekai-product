import test from "node:test";
import assert from "node:assert/strict";
import { GameState, Player, createCardInstance } from "../js/model.js";
import { GameEngine } from "../js/engine.js";

let serial = 0;
function card(overrides = {}) {
    return createCardInstance({ id: `trap_fixture_${serial++}`, name: "测试卡", type: "monster", level: 4, attack: 1500, defense: 1200, attribute: "water", effects: [], ...overrides });
}
function trap(trigger, type, value, overrides = {}) {
    return card({ type: "trap", name: `测试陷阱${serial}`, effects: [{ trigger, type, value }], ...overrides });
}
function setup() {
    const s = new GameState();
    s.players = [new Player("A", []), new Player("B", [])];
    s.turn = 3; s.firstTurn = false; s.phase = "main_1";
    const [p, o] = s.players;
    p.deck = Array.from({ length: 8 }, () => card());
    o.deck = Array.from({ length: 8 }, () => card());
    return { s, p, o, e: new GameEngine(s, () => .3) };
}
function setTrap(owner, item, setTurn = 1) {
    item.faceDown = true;
    item.canActivate = true;
    item.setTurn = setTurn;
    owner.spellTrapZone.push(item);
    return item;
}

test("同一响应窗口最多连锁两张陷阱（原来只结算第一张）", () => {
    const { e, p, o } = setup();
    setTrap(o, trap("onOpponentEffect", "healPlayer", 300));
    setTrap(o, trap("onOpponentEffect", "healPlayer", 500));
    const source = card({ name: "对手卡" });
    const before = o.lp;
    const result = e._resolveReactiveTraps(o, "onOpponentEffect", { activatedCard: source, sourceCard: source, sourcePlayer: p });
    assert.match(result, /测试陷阱/);
    assert.equal(o.lp, before + 800, "两张陷阱都应结算");
    assert.equal(o.spellTrapZone.length, 0);
});

test("陷阱被发动时对方可以连锁响应陷阱（陷阱响应陷阱）", () => {
    const { e, p, o } = setup();
    setTrap(p, trap("manual", "healPlayer", 400));
    const counter = trap("onOpponentEffect", "healPlayer", 300);
    setTrap(o, counter);
    const result = e.activateSetTrap(p, p.spellTrapZone[0]);
    assert.equal(result.success, true, result.message);
    assert.equal(p.lp, 8400, "自己主动翻开的陷阱应结算");
    assert.equal(o.lp, 8300, "对方的连锁陷阱应结算");
    assert.ok(o.graveyard.includes(counter), "连锁陷阱应进入墓地");
});

test("盖放的回合不能主动翻开，下回合才能发动", () => {
    const { e, p } = setup();
    const late = setTrap(p, trap("manual", "healPlayer", 400), 3);
    assert.equal(e.canActivateTrapManually(p, late).canActivate, false);
    assert.match(e.activateSetTrap(p, late).message, /盖放的回合不能发动/);
    p.spellTrapZone.splice(0, 1); // 模拟进入下回合后重新检查
    const ready = setTrap(p, trap("manual", "healPlayer", 400), 2);
    assert.equal(e.canActivateTrapManually(p, ready).canActivate, true);
    const result = e.activateSetTrap(p, ready);
    assert.equal(result.success, true);
    assert.equal(p.lp, 8400);
});

test("条件不满足的陷阱不会被主动翻开消耗", () => {
    const { e, p, o } = setup();
    const battleTrap = setTrap(p, trap("onAttacked", "reduceDamage", 500), 1);
    const result = e.activateSetTrap(p, battleTrap);
    assert.equal(result.success, false);
    assert.match(result.message, /不满足/);
    assert.ok(p.spellTrapZone.includes(battleTrap), "失败时陷阱必须留在场上");
    void o;
});
