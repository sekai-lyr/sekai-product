import test from "node:test";
import assert from "node:assert/strict";
import { GameState, Player, createCardInstance } from "../js/model.js";
import { GameEngine } from "../js/engine.js";
import { ALL_CARDS, getCardById } from "../js/catalog.js";

// 第七轮·魔法卡代价可玩性：
// 1) 卡池约束——魔法不再以"随机弃牌"收税；少数禁术只收可预期的 LP，且金额分档；
// 2) 引擎约束——付不起就不发动、不消耗这张卡；代价真实扣除并写进发动消息；
//    弃牌代价（历史机制）不能把正在发动的卡自己丢进墓地，墓地不能出现 undefined。

const SPELLS = ALL_CARDS.filter(card => card.type === "spell");
const costsOf = card => (card.effects || []).filter(effect => effect.cost).map(effect => effect.cost);

function duel({ lp = 8000 } = {}) {
    const s = new GameState();
    s.players = [new Player("甲", []), new Player("乙", [])];
    s.turn = 3; s.firstTurn = false; s.phase = "main_1";
    s.players[0].lp = lp; s.players[1].lp = lp;
    return { s, p: s.players[0], o: s.players[1], e: new GameEngine(s, () => .3) };
}

function bombTarget() {
    return createCardInstance({ id: "cost_target", name: "靶子怪兽", type: "monster", level: 4, attack: 1600, defense: 1200, attribute: "dark", faceUp: true, effects: [] });
}

test("全卡池魔法卡不再以随机弃牌作为代价", () => {
    const discardSpells = SPELLS.filter(card => costsOf(card).some(cost => cost.type === "discard"));
    assert.equal(discardSpells.length, 0,
        `仍有魔法要求随机弃牌：${discardSpells.map(card => card.name).join("、")}；随机弃牌不可控，是最劝退新人的代价`);
});

test("带代价的魔法全部是低额 LP，且金额至少分 3 档", () => {
    const paid = SPELLS.filter(card => costsOf(card).length > 0);
    assert.ok(paid.length >= 2, "应该保留少量有代价的禁术，全部免费会让高稀有度卡缺少重量感");
    assert.ok(paid.length <= 12, `付费魔法 ${paid.length} 张：多数魔法应保持免费，否则大众玩家抽到 UR 反而不敢用`);
    for (const card of paid) {
        for (const cost of costsOf(card)) {
            assert.equal(cost.type, "payLife", `${card.name}的代价必须可预期（LP），不能是随机损失`);
            assert.ok(cost.value <= 800, `${card.name}的LP代价 ${cost.value} 过高，付不起就成了废卡`);
        }
    }
    const tiers = new Set(paid.flatMap(costsOf).map(cost => cost.value));
    assert.ok(tiers.size >= 3, `代价金额必须分档，当前只有 ${[...tiers].join("/")} 一档`);
});

test("绝大多数魔法保持免费（≥ 90%）", () => {
    const free = SPELLS.filter(card => costsOf(card).length === 0).length;
    assert.ok(free / SPELLS.length >= .9, `免费魔法只占 ${(free / SPELLS.length * 100).toFixed(1)}%`);
});

test("卡面文字与代价一致（卡面即结算）", () => {
    for (const card of SPELLS) {
        for (const cost of costsOf(card)) {
            const text = cost.type === "payLife" ? `支付${cost.value}LP` : `丢弃${cost.value}张手牌`;
            assert.ok(card.description.includes(text), `${card.name}卡面没有写明代价「${text}」`);
        }
    }
});

test("LP不足时魔法不发动、不消耗、LP不变", () => {
    const { e, p, o } = duel({ lp: 400 });
    o.monsterZone.push(bombTarget());
    const card = createCardInstance(getCardById("nc_sp_ur_005")); // 碎穹：500 LP
    p.hand.push(card);

    const result = e.activateSpell(p, 0);
    assert.equal(result.success, false);
    assert.match(result.message, /LP不足/);
    assert.ok(p.hand.includes(card), "付不起代价时卡必须留在手里");
    assert.equal(p.graveyard.length, 0, "失败时不应有任何卡进入墓地");
    assert.equal(p.lp, 400);
});

test("付得起时 LP 真实扣除，并写进发动消息", () => {
    const { e, p, o } = duel();
    const target = bombTarget();
    o.monsterZone.push(target);
    const card = createCardInstance(getCardById("nc_sp_ur_005"));
    p.hand.push(card);

    const result = e.activateSpell(p, 0, target);
    assert.equal(result.success, true, result.message);
    assert.equal(p.lp, 7500);
    assert.match(result.message, /支付500LP/);
    assert.ok(p.graveyard.includes(card), "发动成功后魔法进入墓地");
});

test("盖放魔法的翻开发动走同一条代价规则", () => {
    const { e, p, o } = duel({ lp: 400 });
    const target = bombTarget();
    o.monsterZone.push(target);
    const set = createCardInstance(getCardById("nc_sp_ur_005"));
    set.faceDown = true; set.canActivate = true; set.setTurn = 0;
    p.spellTrapZone.push(set);

    const check = e.canActivateSetSpell(p, set, target);
    assert.equal(check.canActivate, false);
    assert.match(check.reason, /LP不足/);
    assert.equal(e.activateSetSpell(p, set, target).success, false);
    assert.ok(p.spellTrapZone.includes(set), "付不起时盖放的卡必须留场");

    p.lp = 5000;
    const result = e.activateSetSpell(p, set, target);
    assert.equal(result.success, true, result.message);
    assert.equal(p.lp, 4500);
    assert.match(result.message, /支付500LP/);
});

test("弃牌代价回归：不能丢掉发动中的卡自己，墓地不能出现 undefined", () => {
    const make = () => createCardInstance({
        id: "fixture_discard_cost", name: "弃牌代价测试", type: "spell", rarity: "R", rulesVersion: "test",
        effects: [{ trigger: "manual", type: "themedAction", action: "dice", cost: { type: "discard", value: 1 }, oncePerTurn: true, skillName: "测试" }],
        description: "测试用弃牌代价卡。",
    });

    // 手牌只有这张卡：不能自己丢自己，应判定为手牌不足。
    const alone = duel();
    const lonely = make();
    alone.p.hand.push(lonely);
    const denied = alone.e.activateSpell(alone.p, 0);
    assert.equal(denied.success, false);
    assert.match(denied.message, /手牌不足/);
    assert.ok(alone.p.hand.includes(lonely));
    assert.equal(alone.p.graveyard.length, 0);

    // 手牌还有别的卡：代价丢弃的是另一张，墓地不允许出现 undefined。
    const { e, p } = duel();
    const card = make();
    const fodder = createCardInstance({ id: "fixture_fodder", name: "弃牌素材", type: "monster", level: 4, attack: 1000, defense: 1000, attribute: "light", effects: [] });
    p.hand.push(card, fodder);
    const paid = e.activateSpell(p, 0);
    assert.equal(paid.success, true, paid.message);
    assert.ok(p.graveyard.includes(fodder), "代价应丢弃另一张手牌");
    assert.ok(p.graveyard.every(Boolean), "墓地不能出现 undefined");
    assert.ok(p.graveyard.includes(card), "发动后的魔法自身进入墓地");
});
