import test from "node:test";
import assert from "node:assert/strict";
import { createCardInstance } from "../js/model.js";
import { AILMENTS, DOMAIN_DEFS, applyAilment, ailmentStacks, ailmentValue, cleanseAilments, removeAilment, tickAilments, activeDomain } from "../js/status-effects.js";

const fixture = () => createCardInstance({ id: "fx", name: "测试", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });

test("异常状态按上限叠层并记录数值", () => {
    const c = fixture();
    applyAilment(c, "burn", 2, 500);
    applyAilment(c, "burn", 2, 500);
    assert.equal(ailmentStacks(c, "burn"), AILMENTS.burn.max);
    assert.equal(ailmentValue(c, "burn"), 500);
});

test("清除与净化移除状态", () => {
    const c = fixture();
    applyAilment(c, "venom", 1, 450);
    removeAilment(c, "venom");
    assert.equal(ailmentStacks(c, "venom"), 0);
    assert.equal(ailmentValue(c, "venom"), 0);
    applyAilment(c, "bleed", 2, 400);
    applyAilment(c, "curse", 1, 700);
    cleanseAilments(c);
    assert.equal(ailmentStacks(c, "bleed"), 0);
    assert.equal(ailmentStacks(c, "curse"), 0);
    assert.equal(ailmentValue(c, "curse"), 0);
});

const fakeEngine = (turn = 3) => ({ state: { turn }, emit() {} });
const fakePlayer = () => ({ lp: 8000, monsterZone: [], takeDamage(n) { this.lp -= n; } });

test("灼烧在结束阶段按数值×层数扣LP并逐层衰减", () => {
    const engine = fakeEngine();
    const p = fakePlayer();
    const c = fixture();
    applyAilment(c, "burn", 2, 500);
    p.monsterZone.push(c);
    tickAilments(engine, p);
    assert.equal(p.lp, 8000 - 500 * 2);
    assert.equal(ailmentStacks(c, "burn"), 1);
    tickAilments(engine, p);
    assert.equal(p.lp, 8000 - 500 * 3);
    assert.equal(ailmentStacks(c, "burn"), 0);
    assert.equal(ailmentValue(c, "burn"), 0);
});

test("剧毒在结束阶段扣LP且不衰减", () => {
    const engine = fakeEngine();
    const p = fakePlayer();
    const c = fixture();
    applyAilment(c, "venom", 2, 450);
    p.monsterZone.push(c);
    tickAilments(engine, p);
    tickAilments(engine, p);
    assert.equal(p.lp, 8000 - 450 * 2 * 2);
    assert.equal(ailmentStacks(c, "venom"), 2);
    assert.equal(ailmentValue(c, "venom"), 450);
});

test("activeDomain 按 until 与 key 过滤", () => {
    const engine = fakeEngine(5);
    const p = fakePlayer();
    const c = fixture();
    c.themedState = { domain: { id: "wuji", until: 5 } };
    p.monsterZone.push(c);
    const hit = activeDomain(engine, p);
    assert.equal(hit.card, c);
    assert.equal(hit.def, DOMAIN_DEFS.wuji);
    assert.equal(activeDomain(engine, p, "wuji").card, c);
    assert.equal(activeDomain(engine, p, "rojin"), null);
    c.themedState.domain.until = 4;
    assert.equal(activeDomain(engine, p), null);
    assert.equal(activeDomain(engine, p, "wuji"), null);
});

import { GameState, Player } from "../js/model.js";
import { GameEngine } from "../js/engine.js";
import { ACTION_TEXT, themedEffectHandlers, canResolveThemedEffect } from "../js/themed-effects.js";

function board() {
    const s = new GameState();
    s.players = [new Player("甲", []), new Player("乙", [])];
    s.turn = 3; s.firstTurn = false; s.phase = "main_1";
    const [p, o] = s.players;
    p.deck = []; o.deck = [];
    return { s, p, o, e: new GameEngine(s, () => 0.3) };
}
const enemyMonster = (attack = 1800) => createCardInstance({ id: `em_${attack}`, name: "敌怪", type: "monster", level: 4, attack, defense: 1200, effects: [] });

test("灼烧在控制者结束阶段按层数结算并衰减", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); o.monsterZone.push(target);
    const ctx = { engine: e, player: p, opponent: o, card: p, effect: { action: "ignite", params: { stacks: 2, damage: 500 }, skillName: "t" }, gameState: s };
    themedEffectHandlers.themedAction(ctx);
    assert.equal(o.lp, 8000);
    e.endTurn();                    // 对甲的结束阶段：只结算甲，不结算乙
    assert.equal(o.lp, 8000);
    s.currentPlayerIndex = 1; e.endTurn();  // 乙的结束阶段
    assert.equal(o.lp, 7000);
    assert.equal(target.themedState.statuses.burn, 1);
});

test("剧毒不衰减且中毒方回复减半", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); o.monsterZone.push(target);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "venom", params: { stacks: 2, damage: 450 }, skillName: "t" }, gameState: s });
    o.heal(1000);
    // 规格（设计文档 §4.2）：中毒方回复量减半。8000 起手 → 实际 +500。
    // 简报原文 7000+500 与规格/指定实现矛盾（8000 不会先变成 7000），故按规格修正预期值。
    assert.equal(o.lp, 8000 + 500);
    s.currentPlayerIndex = 1; e.endTurn();
    assert.equal(o.lp, 8000 + 500 - 450 * 2);
    assert.equal(target.themedState.statuses.venom, 2);
});

test("新动作都有卡面文字", () => {
    for (const action of ["ignite", "venom", "bleed", "curse", "paralyze", "infinity"]) assert.ok(ACTION_TEXT[action]?.length > 0);
    assert.ok(ACTION_TEXT.infinity.includes("直到下个回合结束"));
    assert.ok(ACTION_TEXT.paralyze.includes("麻痹"));
});

test("出血在战斗后结算并衰减", () => {
    const { s, p, o, e } = board();
    const attacker = createCardInstance({ id: "a1", name: "我", type: "monster", level: 4, attack: 2000, defense: 1000, effects: [] });
    const defender = enemyMonster(1500);
    // 简报原文直接用 1500 攻守备者承接 2000 攻攻击者：按引擎规则守备者会被战斗破坏，
    // 离场时 themedState 清空且不再位于怪兽区，两个断言（出血结算、层数-1）都无法成立。
    // 为保留"出血结算+衰减"的测试意图，给守备者加上战斗破坏免疫。
    defender.cannotBeDestroyedByBattle = true;
    p.monsterZone.push(attacker); o.monsterZone.push(defender);
    attacker.canAttack = true; s.phase = "battle";
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "bleed", params: { stacks: 2, damage: 400 }, skillName: "t" }, gameState: s });
    e.attack(attacker, defender);
    assert.equal(o.lp, 6700);                       // 战斗伤害 500 + 出血 400×2=800
    assert.equal(o.monsterZone[0]?.themedState?.statuses?.bleed, 1); // 战斗后出血 -1
});

test("诅咒封锁效果与祭品，被破坏时控制者受伤", () => {
    const { s, p, o, e } = board();
    const cursed = enemyMonster();
    cursed.effects = [{ type: "themedAction", action: "charge", trigger: "manual", oncePerTurn: true, hardOncePerTurn: true, skillName: "c" }];
    o.monsterZone.push(cursed);
    // 正向对照：o 为当前回合玩家时 charge 正常发动（非 null），证明调用路径可达。
    s.currentPlayerIndex = 1;
    assert.ok(e.triggerAllEffects(o, cursed, "manual"));
    // 清空已用记录，避免负向断言被 charge 的一回合一次拦截而空转。
    o.themedUses = {};
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "curse", params: { stacks: 1, damage: 700 }, skillName: "t" }, gameState: s });
    assert.equal(e.triggerAllEffects(o, cursed, "manual"), null);
    // 祭品拦截：必须设置 pendingTribute 才会走到诅咒守卫（否则在 2037 行提前返回）。
    s.pendingTribute = { player: o, needed: 1, selected: [], card: cursed };
    const tribute = e.selectTribute(cursed);
    assert.equal(tribute.success, false);
    assert.match(tribute.message, /诅咒/);
    e.destroyFieldMonster(o, cursed);
    assert.equal(o.lp, 7300);
});

test("出血在直接攻击后同样结算并衰减", () => {
    const { s, p, o, e } = board();
    const attacker = createCardInstance({ id: "a2", name: "我", type: "monster", level: 4, attack: 1500, defense: 1000, effects: [] });
    p.monsterZone.push(attacker);
    applyAilment(attacker, "bleed", 2, 400);
    attacker.canAttack = true; s.phase = "battle";
    const ticks = [];
    e.eventBus.on("onStatusTick", ev => ticks.push(ev));
    e.attack(attacker, "player");
    assert.equal(o.lp, 8000 - 1500);                // 直攻伤害由被攻击方乙承受
    assert.equal(p.lp, 8000 - 400 * 2);             // 出血伤害由出血怪兽控制者甲承受
    assert.equal(attacker.themedState.statuses.bleed, 1);
    assert.deepEqual(ticks.map(t => [t.status, t.damage]), [["bleed", 800]]);
});

test("出血怪兽被战斗破坏后仍结算出血", () => {
    const { s, p, o, e } = board();
    const attacker = createCardInstance({ id: "a4", name: "我", type: "monster", level: 4, attack: 2500, defense: 1000, effects: [] });
    const defender = enemyMonster(1500);
    p.monsterZone.push(attacker); o.monsterZone.push(defender);
    applyAilment(defender, "bleed", 2, 400);
    attacker.canAttack = true; s.phase = "battle";
    const ticks = [];
    e.eventBus.on("onStatusTick", ev => ticks.push(ev));
    e.attack(attacker, defender);
    assert.ok(o.graveyard.includes(defender));
    assert.equal(o.lp, 8000 - 1000 - 400 * 2);      // 战斗伤害 2500-1500=1000 + 破坏前快照的出血 400×2
    assert.equal(o.monsterZone.length, 0);          // 已破坏离场，无需衰减
    assert.deepEqual(ticks.map(t => [t.status, t.damage]), [["bleed", 800]]);
});

test("诅咒亡语仅在被破坏时触发，祭品离场不扣血", () => {
    const { s, p, o, e } = board();
    s.currentPlayerIndex = 1;
    const cursed = enemyMonster();
    applyAilment(cursed, "curse", 1, 700);
    const summonCard = createCardInstance({ id: "tribute_target", name: "上级召唤目标", type: "monster", level: 7, attack: 2400, defense: 2000, effects: [] });
    o.monsterZone.push(cursed); o.hand.push(summonCard);
    // 手工构造已选祭品，绕过 selectTribute 的诅咒拦截，直接走 confirmTribute 的 "tribute" 离场路径。
    s.pendingTribute = { player: o, needed: 1, selected: [cursed], card: summonCard };
    assert.equal(e.confirmTribute().success, true);
    assert.ok(o.graveyard.includes(cursed));
    assert.equal(o.lp, 8000);
});

test("被取消的攻击不结算出血", () => {
    const { s, p, o, e } = board();
    const attacker = createCardInstance({ id: "a3", name: "我", type: "monster", level: 4, attack: 1500, defense: 1000, effects: [] });
    p.monsterZone.push(attacker);
    applyAilment(attacker, "bleed", 2, 400);
    const trap = createCardInstance({ id: "tr_cancel", name: "拦截", type: "trap", effects: [{ type: "themedAction", action: "intercept", trigger: "onAttacked", skillName: "t" }] });
    trap.faceDown = true; trap.canActivate = true; trap.setTurn = 0;
    o.spellTrapZone.push(trap);
    attacker.canAttack = true; s.phase = "battle";
    assert.equal(e.attack(attacker, "player").attackCanceled, true);
    assert.equal(o.lp, 8000);
    assert.equal(attacker.themedState.statuses.bleed, 2);
});

test("麻痹阻止攻击与改变表示", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); o.monsterZone.push(target);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "paralyze", params: { count: 1 }, skillName: "t" }, gameState: s });
    target.canAttack = true; s.phase = "battle"; s.currentPlayerIndex = 1;
    assert.equal(e.attack(target, "player").success, false);
    s.phase = "main_1";
    assert.equal(e.changePosition(o, target).success, false);
});

test("无下限减伤且不可取对象", () => {
    const { s, p, o, e } = board();
    const guard = createCardInstance({ id: "g1", name: "无下限", type: "monster", level: 4, attack: 1000, defense: 2000, effects: [] });
    guard.position = "defense";
    p.monsterZone.push(guard);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: guard, effect: { action: "infinity", params: { reduce: 1000 }, skillName: "t" }, gameState: s });
    assert.equal(guard.cannotBeTargeted, true);
    const attacker = createCardInstance({ id: "a2", name: "敌", type: "monster", level: 4, attack: 2500, defense: 1000, effects: [] });
    attacker.canAttack = true; o.monsterZone.push(attacker); s.currentPlayerIndex = 1; s.phase = "battle";
    e.attack(attacker, guard);
    assert.equal(p.lp, 8000); // 2500-1000 减伤后低于守备 2000，无战伤
});

test("无下限作为守备方承受战斗伤害时按数值减伤", () => {
    const { s, p, o, e } = board();
    const guard = createCardInstance({ id: "g2", name: "无下限", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    p.monsterZone.push(guard);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: guard, effect: { action: "infinity", params: { reduce: 1000 }, skillName: "t" }, gameState: s });
    const attacker = createCardInstance({ id: "a3", name: "敌", type: "monster", level: 4, attack: 2500, defense: 1000, effects: [] });
    attacker.canAttack = true; o.monsterZone.push(attacker); s.currentPlayerIndex = 1; s.phase = "battle";
    e.attack(attacker, guard);
    assert.equal(p.lp, 7500); // 战斗伤害 2500-1000=1500，无下限减免 1000
    assert.ok(p.graveyard.includes(guard));
});

test("无下限作为攻击方承受战斗伤害时按数值减伤", () => {
    const { s, p, o, e } = board();
    const attacker = createCardInstance({ id: "a4", name: "我", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    p.monsterZone.push(attacker);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: attacker, effect: { action: "infinity", params: { reduce: 1000 }, skillName: "t" }, gameState: s });
    const defender = enemyMonster(2500);
    o.monsterZone.push(defender);
    attacker.canAttack = true; s.phase = "battle";
    e.attack(attacker, defender);
    assert.equal(p.lp, 7500); // 战斗伤害 2500-1000=1500，无下限减免 1000
});

test("麻痹与无下限到期后清理状态", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); o.monsterZone.push(target);
    const guard = createCardInstance({ id: "g3", name: "无下限", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    p.monsterZone.push(guard);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "paralyze", params: { count: 1 }, skillName: "t" }, gameState: s });
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: guard, effect: { action: "infinity", params: { reduce: 1000 }, skillName: "t" }, gameState: s });
    // 让"对方"（乙）结束自己的回合触发到期清理；不经过控制者的 startTurn，
    // 避免 resetTurnState 提前清掉 cannotBeTargeted 而让断言失去鉴别力。
    s.turn = 4; s.currentPlayerIndex = 1;
    e.endTurn();
    assert.equal(target.themedState.paralyzedUntil, undefined);
    assert.equal(guard.themedState.infinityUntil, undefined);
    assert.equal(guard.cannotBeTargeted, false);
});

test("敌方异界流放：N 个结束阶段后守备回归、攻降、封效", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); o.monsterZone.push(target);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "exile", params: { turns: 1, penalty: 500 }, skillName: "t" }, gameState: s });
    assert.equal(o.monsterZone.length, 0);
    assert.ok(o.banished.includes(target));
    s.currentPlayerIndex = 1; e.endTurn();               // 乙的结束阶段 → 回归
    assert.ok(o.monsterZone.includes(target));
    assert.equal(target.position, "defense");
    assert.equal(target.currentAttack, Math.max(0, 1800 - 500));
});

test("自身异界归来（死亡回归式）与回收跳过异界卡", () => {
    const { s, p, o, e } = board();
    const subaru = createCardInstance({ id: "subaru", name: "昴", type: "monster", level: 4, attack: 1200, defense: 1000, effects: [] });
    p.monsterZone.push(subaru);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: subaru, effect: { action: "exile", params: { self: true, turns: 1, penalty: 500 }, skillName: "t" }, gameState: s });
    assert.ok(p.banished.includes(subaru));
    assert.equal(p.lp, 7200);
    // 回收类效果不会把异界卡拿回
    const recalled = themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "recall", params: { count: 1, draw: 0 } }, gameState: s });
    assert.equal(p.hand.length, 0);
    e.endTurn();                                          // 甲的结束阶段 → 回归
    assert.ok(p.monsterZone.includes(subaru));
});

test("敌方异界回归后离开除外区并封印到下一回合", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); o.monsterZone.push(target);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "exile", params: { turns: 1, penalty: 500 }, skillName: "t" }, gameState: s });
    assert.ok(o.banished.includes(target));
    s.currentPlayerIndex = 1; e.endTurn();
    assert.ok(o.monsterZone.includes(target));
    assert.ok(!o.banished.includes(target));                    // 回归必须离开除外区，防止跨区域重复
    assert.equal(target.themedState.sealedUntil, s.turn + 1);   // 封印覆盖下一个回合
});

test("自身异界在 LP≤800 时不发动", () => {
    const { s, p, o, e } = board();
    const subaru = createCardInstance({ id: "subaru_poor", name: "昴", type: "monster", level: 4, attack: 1200, defense: 1000, effects: [] });
    p.graveyard.push(subaru); p.lp = 800;
    const result = themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: subaru, effect: { type: "themedAction", action: "exile", params: { self: true, turns: 1, penalty: 500 }, skillName: "t" }, gameState: s });
    assert.equal(result, null);
    assert.ok(p.graveyard.includes(subaru));
    assert.ok(!p.banished.includes(subaru));
    assert.equal(p.lp, 800);
});

test("异界回归遇满场顺延到下一个结束阶段", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); o.monsterZone.push(target);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "exile", params: { turns: 1, penalty: 500 }, skillName: "t" }, gameState: s });
    while (o.monsterZone.length < 5) o.monsterZone.push(enemyMonster(100 + o.monsterZone.length));
    s.currentPlayerIndex = 1; e.endTurn();
    assert.ok(o.banished.includes(target));
    assert.ok(!o.monsterZone.includes(target));
    assert.equal(target.themedState.exile.pendingEndPhases, 1); // 无空位：保留 1 个结束阶段余额
    o.monsterZone.splice(0, 1);                                 // 腾出空位
    s.currentPlayerIndex = 1; e.endTurn();
    assert.ok(o.monsterZone.includes(target));
    assert.ok(!o.banished.includes(target));
});

test("异界二次回归累计攻减", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); o.monsterZone.push(target);
    const exile = () => themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "exile", params: { turns: 1, penalty: 500 }, skillName: "t" }, gameState: s });
    exile();
    s.currentPlayerIndex = 1; e.endTurn();
    assert.equal(target.currentAttack, 1800 - 500);
    exile();
    s.currentPlayerIndex = 1; e.endTurn();
    assert.equal(target.currentAttack, 1800 - 1000);
    assert.ok(!o.banished.includes(target));
});

test("引爆消耗灼烧层数造成单体爆发", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); o.monsterZone.push(target);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "detonate", params: { stacks: 2, damage: 650 }, skillName: "t" }, gameState: s });
    assert.equal(o.lp, 8000 - 1300);
    assert.equal(target.themedState.statuses?.burn || 0, 0);
});

test("引爆剧毒扩散为对方全体怪兽伤害", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster(); const other = enemyMonster(900);
    o.monsterZone.push(target, other);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "venom", params: { stacks: 2, damage: 450 }, skillName: "t" }, gameState: s });
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "detonate", params: { stacks: 0, damage: 600 }, skillName: "t" }, gameState: s });
    // 简报预期 8000 与简报自身实现冲突：detonate 必须先施加至少 1 层灼烧
    // （Math.max(1, par.stacks)），1 层×600 的单体爆发必然扣 LP；扩散部分只打守备。
    assert.equal(o.lp, 8000 - 600);
    assert.equal(target.currentDefense, 600);
    assert.equal(other.currentDefense, 600);
    assert.equal(target.themedState?.statuses?.venom || 0, 0);
});

test("净化清除己方全部异常状态", () => {
    const { s, p, o, e } = board();
    const ally = createCardInstance({ id: "ally", name: "我", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    p.monsterZone.push(ally);
    applyAilment(ally, "burn", 2, 500);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "purify", params: { count: 1 }, skillName: "t" }, gameState: s });
    assert.equal(ailmentStacks(ally, "burn"), 0);
});

test("净化保留除外对方墓地并同时净化己方", () => {
    const { s, p, o, e } = board();
    const ally = createCardInstance({ id: "ally_pure", name: "我", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    p.monsterZone.push(ally);
    applyAilment(ally, "venom", 2, 450);
    const grave1 = createCardInstance({ id: "gv1", name: "墓1", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    const grave2 = createCardInstance({ id: "gv2", name: "墓2", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    o.graveyard.push(grave1, grave2);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "purify", params: { count: 1 }, skillName: "t" }, gameState: s });
    assert.ok(o.banished.includes(grave2));
    assert.deepEqual(o.graveyard, [grave1]);
    assert.equal(ailmentStacks(ally, "venom"), 0);
});

test("引爆扩散击破守备归零的对方怪兽", () => {
    const { s, p, o, e } = board();
    const target = enemyMonster();
    const fragile = createCardInstance({ id: "fragile", name: "脆", type: "monster", level: 4, attack: 500, defense: 500, effects: [] });
    o.monsterZone.push(target, fragile);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "venom", params: { stacks: 2, damage: 450 }, skillName: "t" }, gameState: s });
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "detonate", params: { stacks: 0, damage: 600 }, skillName: "t" }, gameState: s });
    assert.ok(o.graveyard.includes(fragile));
    assert.ok(o.monsterZone.includes(target));
    assert.equal(target.currentDefense, 600);
});

test("净化在对方墓地为空时因己方异常状态仍可发动", () => {
    const { s, p, o, e } = board();
    const ally = createCardInstance({ id: "ally_gate", name: "我", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    p.monsterZone.push(ally);
    applyAilment(ally, "curse", 1, 600);
    const effect = { type: "themedAction", action: "purify", params: { count: 1 }, skillName: "t" };
    assert.equal(canResolveThemedEffect({ engine: e, player: p, opponent: o, card: p, effect, gameState: s }), true);
    assert.ok(themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect, gameState: s }));
    assert.equal(ailmentStacks(ally, "curse"), 0);
});

test("对方与己方都无目标时净化不可发动", () => {
    const { s, p, o, e } = board();
    const effect = { type: "themedAction", action: "purify", params: { count: 1 }, skillName: "t" };
    assert.equal(canResolveThemedEffect({ engine: e, player: p, opponent: o, card: p, effect, gameState: s }), false);
});

test("无量空处封锁对方效果发动", () => {
    const { s, p, o, e } = board();
    const user = createCardInstance({ id: "u1", name: "五条", type: "monster", level: 8, attack: 3000, defense: 2000, effects: [] });
    p.monsterZone.push(user);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: user, effect: { action: "domain", params: { field: "wuji", cost: 1200 }, skillName: "t" }, gameState: s });
    assert.equal(p.lp, 6800);
    const enemy = enemyMonster();
    enemy.effects = [{ type: "themedAction", action: "charge", trigger: "onSummon", oncePerTurn: true, hardOncePerTurn: true, skillName: "c" }];
    o.monsterZone.push(enemy);
    assert.equal(e.triggerAllEffects(o, enemy, "onSummon"), null);
});

test("无量空处只封锁对手，不封锁持有者自身", () => {
    const { s, p, o, e } = board();
    const user = createCardInstance({ id: "u2", name: "五条", type: "monster", level: 8, attack: 3000, defense: 2000, effects: [{ type: "themedAction", action: "charge", trigger: "manual", oncePerTurn: true, hardOncePerTurn: true, skillName: "c" }] });
    p.monsterZone.push(user);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: user, effect: { action: "domain", params: { field: "wuji", cost: 1200 }, skillName: "t" }, gameState: s });
    assert.ok(e.triggerAllEffects(p, user, "manual"));
    const enemy = enemyMonster();
    enemy.effects = [{ type: "themedAction", action: "charge", trigger: "onSummon", oncePerTurn: true, hardOncePerTurn: true, skillName: "c" }];
    o.monsterZone.push(enemy);
    assert.equal(e.triggerAllEffects(o, enemy, "onSummon"), null);
});

test("白金之星·世界封锁对方攻击", () => {
    const { s, p, o, e } = board();
    const jotaro = createCardInstance({ id: "j1", name: "承太郎", type: "monster", level: 8, attack: 2800, defense: 2000, effects: [] });
    p.monsterZone.push(jotaro);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: jotaro, effect: { action: "domain", params: { field: "za_warudo", cost: 1000 }, skillName: "t" }, gameState: s });
    const enemy = enemyMonster(); enemy.canAttack = true; o.monsterZone.push(enemy);
    s.currentPlayerIndex = 1; s.phase = "battle";
    assert.equal(e.attack(enemy, "player").success, false);
});

test("白金之星·世界未展开时对方攻击照常成立", () => {
    const { s, p, o, e } = board();
    const jotaro = createCardInstance({ id: "j2", name: "承太郎", type: "monster", level: 8, attack: 2800, defense: 2000, effects: [] });
    p.monsterZone.push(jotaro);
    const weak = enemyMonster(100); weak.canAttack = true;
    o.monsterZone.push(weak);
    s.currentPlayerIndex = 1; s.phase = "battle";
    assert.equal(e.attack(weak, jotaro).success, true);
    const brave = enemyMonster(1200); brave.canAttack = true;
    o.monsterZone.push(brave);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: jotaro, effect: { action: "domain", params: { field: "za_warudo", cost: 1000 }, skillName: "t" }, gameState: s });
    assert.equal(e.attack(brave, jotaro).success, false);
});

test("苍穹音浪在到期后回退攻防修正", () => {
    const { s, p, o, e } = board();
    const miku = createCardInstance({ id: "m1", name: "初音", type: "monster", level: 6, attack: 2000, defense: 1500, effects: [] });
    const buddy = createCardInstance({ id: "b1", name: "伙伴", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    p.monsterZone.push(miku, buddy);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: miku, effect: { action: "domain", params: { field: "ongaku", cost: 600 }, skillName: "t" }, gameState: s });
    assert.equal(buddy.currentAttack, 1500);
    e.endTurn();                                   // 甲的结束阶段（turn 3）：领域仍在
    assert.equal(buddy.currentAttack, 1500);
    s.currentPlayerIndex = 1;
    e.startTurn({ skipDraw: true });               // 进入乙的回合（turn 4）：领域仍生效
    assert.equal(buddy.currentAttack, 1500);
    e.endTurn();                                   // 乙的结束阶段（turn 4）→ 到期回退
    assert.equal(buddy.currentAttack, 1000);
});

test("苍穹音浪同时削减对方攻击力到领域到期", () => {
    const { s, p, o, e } = board();
    const miku = createCardInstance({ id: "m2", name: "初音", type: "monster", level: 6, attack: 2000, defense: 1500, effects: [] });
    const enemy = enemyMonster(1800);
    p.monsterZone.push(miku); o.monsterZone.push(enemy);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: miku, effect: { action: "domain", params: { field: "ongaku", cost: 600 }, skillName: "t" }, gameState: s });
    assert.equal(enemy.currentAttack, 1300);
    e.endTurn();                              // 甲的结束阶段（turn 3）：领域仍在
    e.startTurn({ skipDraw: true });          // 进入乙的回合（turn 4）
    assert.equal(enemy.currentAttack, 1300);
    e.endTurn();                              // 乙的结束阶段（turn 4）→ 到期回退
    assert.equal(enemy.currentAttack, 1800);
});

test("罗针减半守方战斗伤害并将另一半反弹给攻击者", () => {
    const { s, p, o, e } = board();
    const attacker = createCardInstance({ id: "r_atk", name: "攻", type: "monster", level: 4, attack: 2000, defense: 1000, effects: [] });
    const defender = createCardInstance({ id: "r_def", name: "守", type: "monster", level: 4, attack: 1500, defense: 1000, effects: [] });
    p.monsterZone.push(attacker); o.monsterZone.push(defender);
    themedEffectHandlers.themedAction({ engine: e, player: o, opponent: p, card: defender, effect: { action: "domain", params: { field: "rojin", cost: 800 }, skillName: "t" }, gameState: s });
    assert.equal(o.lp, 7200);
    attacker.canAttack = true; s.phase = "battle";
    const result = e.attack(attacker, defender);
    assert.equal(result.damage, 250);
    assert.equal(o.lp, 7200 - 250);   // 守方只受一半
    assert.equal(p.lp, 8000 - 250);   // 另一半反弹给攻击方
    assert.ok(o.graveyard.includes(defender));
});

import { GameController } from "../js/controller.js";

test("PvP快照可序列化并保留 ongaku 领域应用记录", () => {
    const { s, p, o, e } = board();
    const miku = createCardInstance({ id: "m_pvp", name: "初音", type: "monster", level: 6, attack: 2000, defense: 1500, effects: [] });
    const buddy = createCardInstance({ id: "b_pvp", name: "伙伴", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    p.monsterZone.push(miku, buddy);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: miku, effect: { action: "domain", params: { field: "ongaku", cost: 600 }, skillName: "t" }, gameState: s });
    // applied 必须是纯 JSON：此前存 {card, owner} 活对象，源卡 buff 自身会循环引用导致 stringify 抛错。
    const snapshot = JSON.parse(JSON.stringify(new GameController(s, e, {})._serializePvpState()));
    const zone = snapshot.players[0].monsterZone;
    assert.equal(zone[0].themedState.domain.id, "ongaku");
    assert.equal(zone[0].themedState.domain.sourceId, miku.instanceId);
    assert.deepEqual(zone[0].themedState.domain.applied, [
        { instanceId: miku.instanceId, ownerIndex: 0 },
        { instanceId: buddy.instanceId, ownerIndex: 0 },
    ]);
    assert.equal(zone[1].currentAttack, 1500);
});

test("苍穹音浪源卡离场后攻防修立即回退", () => {
    const { s, p, o, e } = board();
    const miku = createCardInstance({ id: "m_src", name: "初音", type: "monster", level: 6, attack: 2000, defense: 1500, effects: [] });
    const buddy = createCardInstance({ id: "b_src", name: "伙伴", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    const enemy = enemyMonster(1800);
    p.monsterZone.push(miku, buddy); o.monsterZone.push(enemy);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: miku, effect: { action: "domain", params: { field: "ongaku", cost: 600 }, skillName: "t" }, gameState: s });
    assert.equal(buddy.currentAttack, 1500);
    assert.equal(enemy.currentAttack, 1300);
    e.destroyFieldMonster(p, miku);                 // 源卡提前被破坏，不等到期
    assert.ok(p.graveyard.includes(miku));
    assert.equal(buddy.currentAttack, 1000);
    assert.equal(enemy.currentAttack, 1800);
});

test("多份苍穹音浪叠加时按来源分别回退", () => {
    const { s, p, o, e } = board();
    const miku = createCardInstance({ id: "m2_src", name: "初音", type: "monster", level: 6, attack: 2000, defense: 1500, effects: [] });
    const rin = createCardInstance({ id: "r2_src", name: "铃", type: "monster", level: 6, attack: 2000, defense: 1500, effects: [] });
    const buddy = createCardInstance({ id: "b2_src", name: "伙伴", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    const enemy = enemyMonster(1800);
    p.monsterZone.push(miku, rin, buddy); o.monsterZone.push(enemy);
    const cast = card => themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card, effect: { action: "domain", params: { field: "ongaku", cost: 600 }, skillName: "t" }, gameState: s });
    cast(miku); cast(rin);
    assert.equal(buddy.currentAttack, 2000);        // 1000 + 两份 +500
    assert.equal(enemy.currentAttack, 800);
    e.destroyFieldMonster(p, miku);                 // 只回退 miku 那份
    assert.equal(buddy.currentAttack, 1500);
    assert.equal(enemy.currentAttack, 1300);
    e.destroyFieldMonster(p, rin);                  // 两份都离场后回到基础值
    assert.equal(buddy.currentAttack, 1000);
    assert.equal(enemy.currentAttack, 1800);
});

test("无量空处只封锁怪兽效果，不封锁对方魔法发动", () => {
    const { s, p, o, e } = board();
    const user = createCardInstance({ id: "u3", name: "五条", type: "monster", level: 8, attack: 3000, defense: 2000, effects: [] });
    p.monsterZone.push(user);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: user, effect: { action: "domain", params: { field: "wuji", cost: 1200 }, skillName: "t" }, gameState: s });
    s.currentPlayerIndex = 1; s.phase = "main_1";   // 轮到乙，乙是领域持有者的对手
    const enemy = enemyMonster();
    enemy.effects = [{ type: "themedAction", action: "charge", trigger: "manual", oncePerTurn: true, hardOncePerTurn: true, skillName: "c" }];
    o.monsterZone.push(enemy);
    assert.equal(e.triggerAllEffects(o, enemy, "manual"), null);   // 怪兽效果被锁
    const spell = createCardInstance({ id: "sp_token", name: "替身魔法", type: "spell", effects: [{ type: "themedAction", action: "token", trigger: "manual", params: { attack: 0, defense: 1000 }, skillName: "s" }] });
    o.hand.push(spell);
    const result = e.activateSpell(o, 0);
    assert.equal(result.success, true);                            // 魔法照常发动
    assert.equal(o.monsterZone.length, 2);                         // 原有的敌怪 + 衍生物
});

test("赌运使用共享随机源且结果写入事件", () => {
    const { s, p, o, e } = board();
    const events = [];
    e.eventBus.on("onCoinFlip", data => events.push(data.result));
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "gamble", params: { draw: 2, heal: 800 }, skillName: "t" }, gameState: s });
    assert.equal(events.length, 1);
    assert.ok(["heads", "tails"].includes(events[0]));
    // 简报固定引擎两名玩家的卡组为空，drawCard 无牌可抽时不入手牌，
    // "RNG<0.5 → 正面抽卡"无法被证明；给甲补 2 张卡组以保留该断言的鉴别力（RNG 仍注入 0.1）。
    let rolls = 0;
    const fixed = new GameEngine((() => {
        const st = new GameState();
        st.players = [new Player("a", []), new Player("b", [])];
        st.players[0].deck = [fixture(), fixture()];
        st.turn = 3;
        return st;
    })(), () => { rolls++; return 0.1; });
    themedEffectHandlers.themedAction({ engine: fixed, player: fixed.state.players[0], opponent: fixed.state.players[1], card: p, effect: { action: "gamble", params: { draw: 2, heal: 800 }, skillName: "t" }, gameState: fixed.state });
    assert.equal(fixed.state.players[0].hand.length, 2);  // RNG<0.5 → 正面抽卡
    assert.equal(rolls, 1);                               // 恰好掷一次
    assert.equal(fixed.state.lastCoinResult, undefined);  // 不写跨结算共享状态
});

test("赌运反面回复LP且不抽卡", () => {
    const { s, p, o } = board();
    p.lp = 5000;
    p.deck = [fixture(), fixture()];
    let rolls = 0;
    const e = new GameEngine(s, () => { rolls++; return 0.9; });
    const coins = [];
    e.eventBus.on("onCoinFlip", data => coins.push(data.result));
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "gamble", params: { draw: 2, heal: 800 }, skillName: "t" }, gameState: s });
    assert.equal(p.lp, 5800);         // 反面：回复 800
    assert.equal(p.hand.length, 0);   // 反面不抽卡（两种走向互斥）
    assert.equal(p.deck.length, 2);
    assert.deepEqual(coins, ["tails"]);
    assert.equal(rolls, 1);           // 恰好掷一次
});

test("高风险赌运反面承受伤害而不是获得保底回复", () => {
    const { s, p, o } = board();
    p.lp = 5000;
    p.deck = [fixture(), fixture()];
    const e = new GameEngine(s, () => 0.9);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "gamble", params: { draw: 2, tailsDamage: 600 }, skillName: "风险下注" }, gameState: s });
    assert.equal(p.lp, 4400);
    assert.equal(p.hand.length, 0);
});

test("情报侦察用共享随机源展示手牌但不移动卡牌", () => {
    const { s, p, o } = board();
    o.hand = [
        createCardInstance({ id: "h1", name: "甲", type: "spell", effects: [] }),
        createCardInstance({ id: "h2", name: "乙", type: "trap", effects: [] }),
        createCardInstance({ id: "h3", name: "丙", type: "monster", level: 4, attack: 1, defense: 1, effects: [] }),
    ];
    const revealed = [];
    const e = new GameEngine(s, () => 0);
    e.eventBus.on("onHandReveal", data => revealed.push(data.cards.map(card => card.name)));
    const message = themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "recon", params: { count: 2 }, skillName: "洞察" }, gameState: s });
    assert.deepEqual(revealed, [["甲", "乙"]]);
    assert.equal(o.hand.length, 3);
    assert.match(message, /甲.*乙/);
});

test("骰子命运覆盖失败、普通收益与大奖分支", () => {
    for (const [random, expectedLp, expectedHand] of [[0, 4500, 0], [0.34, 5600, 0], [0.99, 5000, 2]]) {
        const { s, p, o } = board();
        p.lp = 5000; p.deck = [fixture(), fixture(), fixture()];
        const e = new GameEngine(s, () => random);
        themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "dice", params: { selfDamage: 500, heal: 600, highDraw: 1, jackpotDraw: 2 }, skillName: "命运骰" }, gameState: s });
        assert.equal(p.lp, expectedLp);
        assert.equal(p.hand.length, expectedHand);
    }
});

test("观星只重排卡组顶且保留全部卡牌", () => {
    const { s, p, o } = board();
    p.deck = [
        createCardInstance({ id: "t", name: "陷阱", type: "trap", effects: [] }),
        createCardInstance({ id: "s", name: "魔法", type: "spell", effects: [] }),
        createCardInstance({ id: "m", name: "怪兽", type: "monster", level: 4, attack: 1, defense: 1, effects: [] }),
    ];
    const e = new GameEngine(s, () => 0);
    let reveal;
    e.eventBus.on("onDeckReveal", event => { reveal = event; });
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "scry", params: { count: 3 }, skillName: "观星" }, gameState: s });
    assert.deepEqual(p.deck.map(card => card.name), ["怪兽", "魔法", "陷阱"]);
    assert.equal(typeof reveal.reorder, "function");
    assert.equal(reveal.reorder([reveal.cards[2], reveal.cards[0], reveal.cards[1]]), true);
    assert.deepEqual(p.deck.map(card => card.name), ["陷阱", "怪兽", "魔法"]);
    assert.equal(reveal.reorder(reveal.cards), false, "牌库已变化后旧弹窗不能再次覆盖牌库");
});

test("心理博弈根据展示牌类型结算猜中与猜错", () => {
    const hit = board();
    hit.p.deck = [fixture()];
    hit.o.hand = [createCardInstance({ id: "hm", name: "目标怪兽", type: "monster", level: 4, attack: 1, defense: 1, effects: [] })];
    themedEffectHandlers.themedAction({ engine: new GameEngine(hit.s, () => 0), player: hit.p, opponent: hit.o, card: hit.p, effect: { action: "mindgame", params: { declaredType: "monster", draw: 1, missHeal: 400 }, skillName: "猜心" }, gameState: hit.s });
    assert.equal(hit.p.hand.length, 1);

    const miss = board();
    miss.o.lp = 5000;
    miss.o.hand = [createCardInstance({ id: "hs", name: "目标魔法", type: "spell", effects: [] })];
    themedEffectHandlers.themedAction({ engine: new GameEngine(miss.s, () => 0), player: miss.p, opponent: miss.o, card: miss.p, effect: { action: "mindgame", params: { declaredType: "monster", draw: 1, missHeal: 400 }, skillName: "猜心" }, gameState: miss.s });
    assert.equal(miss.o.lp, 5400);
});

test("情绪觉醒满足低LP条件后抽牌并永久强化自身", () => {
    const { s, p, o } = board();
    p.lp = 3000; p.deck = [fixture()];
    const user = createCardInstance({ id: "emo", name: "觉醒者", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
    p.monsterZone.push(user);
    const e = new GameEngine(s, () => 0);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: user, effect: { action: "emotion", params: { lpThreshold: 4000, graveyardCount: 5, draw: 1, amount: 500 }, skillName: "觉醒" }, gameState: s });
    assert.equal(p.hand.length, 1);
    assert.equal(user.currentAttack, 1500);
});

test("麻痹赌运两走向与卡面一致且各掷一次", () => {
    const headsBoard = board();
    const headsTarget = enemyMonster(1800); headsBoard.o.monsterZone.push(headsTarget);
    let headsRolls = 0;
    const headsEngine = new GameEngine(headsBoard.s, () => { headsRolls++; return 0.1; });
    const headsCoins = [];
    headsEngine.eventBus.on("onCoinFlip", data => headsCoins.push(data.result));
    themedEffectHandlers.themedAction({ engine: headsEngine, player: headsBoard.p, opponent: headsBoard.o, card: headsBoard.p, effect: { action: "paralyze", params: { gamble: true, amount: 600 }, skillName: "t" }, gameState: headsBoard.s });
    assert.deepEqual(headsCoins, ["heads"]);
    assert.equal(headsRolls, 1);                                    // 恰好掷一次
    assert.equal(headsTarget.canAttack, false);                     // 正面：麻痹
    assert.equal(headsTarget.themedState.paralyzedUntil, headsBoard.s.turn + 1);
    assert.equal(headsTarget.currentAttack, 1800);                  // 正面：不降攻
    const tailsBoard = board();
    const tailsTarget = enemyMonster(1800); tailsTarget.canAttack = true; tailsBoard.o.monsterZone.push(tailsTarget);
    let tailsRolls = 0;
    const tailsEngine = new GameEngine(tailsBoard.s, () => { tailsRolls++; return 0.9; });
    const tailsCoins = [];
    tailsEngine.eventBus.on("onCoinFlip", data => tailsCoins.push(data.result));
    themedEffectHandlers.themedAction({ engine: tailsEngine, player: tailsBoard.p, opponent: tailsBoard.o, card: tailsBoard.p, effect: { action: "paralyze", params: { gamble: true, amount: 600 }, skillName: "t" }, gameState: tailsBoard.s });
    assert.deepEqual(tailsCoins, ["tails"]);
    assert.equal(tailsRolls, 1);                                    // 恰好掷一次
    assert.equal(tailsTarget.currentAttack, 1200);                  // 反面：降攻 600
    assert.ok(tailsTarget.tempEffects.some(t => t.type === "attack" && t.value === -600 && t.duration === "untilEndTurn"));
    assert.equal(tailsTarget.canAttack, true);                      // 反面：不麻痹
    assert.equal(tailsTarget.themedState?.paralyzedUntil, undefined);
});

import { cardRuleStatusHtml } from "../js/card-view.js";

test("状态标签显示层数与异界/领域标记", () => {
    const c = createCardInstance({ id: "ui", name: "UI", type: "monster", level: 4, attack: 1, defense: 1, effects: [] });
    applyAilment(c, "burn", 2, 500);
    applyAilment(c, "venom", 1, 450);
    c.themedState.exile = { returnTurn: 5 };
    const html = cardRuleStatusHtml(c);
    assert.match(html, /灼烧×2/);
    assert.match(html, /剧毒×1/);
    assert.match(html, /异界归来/);
});

test("麻痹阻止翻转召唤，解除后可翻转", () => {
    const { s, p, e } = board();
    const target = createCardInstance({ id: "flip1", name: "盖怪", type: "monster", level: 4, attack: 1500, defense: 1200, effects: [] });
    target.faceUp = false; target.faceDown = true; target.position = "defense";
    target.themedState = { paralyzedUntil: s.turn + 1 };
    p.monsterZone.push(target);
    const blocked = e.flipSummon(p, target);
    assert.equal(blocked.success, false);
    assert.match(blocked.message, /麻痹/);
    delete target.themedState.paralyzedUntil;   // 同一张卡去掉麻痹后可翻转
    assert.equal(e.flipSummon(p, target).success, true);
    assert.equal(target.faceUp, true);
    assert.equal(target.position, "attack");
});

test("pendingActions 不把麻痹怪兽算作可攻击", () => {
    const { s, p, e } = board();
    const c = createCardInstance({ id: "para_ui", name: "麻痹者", type: "monster", level: 4, attack: 1500, defense: 1000, effects: [] });
    p.monsterZone.push(c);
    c.canAttack = true;
    c.themedState = { paralyzedUntil: s.turn + 1 };
    const reasons = new GameController(s, e, {}).pendingActions(p);
    assert.ok(!reasons.some(reason => reason.id === "attack"));
});

import { THEMED_ACTION_VISUALS, themedVisualKey, showSkillBanner, playCoinFlip } from "../js/effects.js";

test("10 个新动作都有特效映射且键唯一", () => {
    const actions = ["ignite", "venom", "bleed", "curse", "exile", "paralyze", "detonate", "infinity", "domain", "gamble"];
    const visuals = actions.map(a => THEMED_ACTION_VISUALS[a]);
    for (const v of visuals) assert.ok(v && v.motion && v.color, "缺少视觉定义");
    assert.equal(new Set(visuals.map(v => v.motion + v.color)).size, actions.length);
});

test("未知 themed action 回退旧视觉键且不抛错", () => {
    assert.equal(themedVisualKey({ type: "themedAction", action: "ignite" }), "ignite");
    assert.equal(themedVisualKey({ type: "themedAction", action: "not-a-real-action" }), "effect");
    assert.equal(themedVisualKey({ type: "damage" }), "damage");
    assert.equal(themedVisualKey(null), "effect");
});

test("Node 环境下横幅与硬币演出是安全空操作", () => {
    assert.doesNotThrow(() => showSkillBanner("测试技", "主动技", "ignite"));
    assert.doesNotThrow(() => showSkillBanner());
    assert.doesNotThrow(() => playCoinFlip("heads"));
    assert.doesNotThrow(() => playCoinFlip("tails"));
    assert.doesNotThrow(() => playCoinFlip());
});

import { DOMAIN_CINEMATICS } from "../js/effects.js";
import { playSound, _resetAudioForTests } from "../js/audio.js";

test("四个领域都有演出定义", () => {
    for (const id of ["wuji", "za_warudo", "rojin", "ongaku"]) {
        assert.ok(DOMAIN_CINEMATICS[id], `缺少领域演出：${id}`);
        assert.ok(DOMAIN_CINEMATICS[id].title?.length > 0);
        assert.ok(DOMAIN_CINEMATICS[id].color?.length > 0);
    }
});

test("Node 环境下新音效是安全空操作", () => {
    _resetAudioForTests();
    for (const name of ["ignite", "venom", "bleed", "curse", "exile", "paralyze", "detonate", "domain", "coin", "statusTick"]) {
        assert.doesNotThrow(() => playSound(name));
    }
});
