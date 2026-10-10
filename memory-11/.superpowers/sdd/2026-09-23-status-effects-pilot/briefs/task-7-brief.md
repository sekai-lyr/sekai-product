### 任务 7：领域系统（4 种）

**文件：**
- 修改：`js/themed-effects.js`（domain 分支、回合末到期回退）
- 修改：`js/engine.js`（wuji 封效果、za_warudo 封攻击、rojin 反弹）
- 测试：`test/status-effects.test.js` 追加

- [ ] **步骤 1：编写失败的测试**

```js
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

test("白金之星·世界封锁对方攻击", () => {
    const { s, p, o, e } = board();
    const jotaro = createCardInstance({ id: "j1", name: "承太郎", type: "monster", level: 8, attack: 2800, defense: 2000, effects: [] });
    p.monsterZone.push(jotaro);
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: jotaro, effect: { action: "domain", params: { field: "za_warudo", cost: 1000 }, skillName: "t" }, gameState: s });
    const enemy = enemyMonster(); enemy.canAttack = true; o.monsterZone.push(enemy);
    s.currentPlayerIndex = 1; s.phase = "battle";
    assert.equal(e.attack(enemy, "player").success, false);
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

`themed-effects.js`：

```js
// DEFAULTS
domain: { field: "wuji", cost: 1200 },
// TEMPLATES（文本从 DOMAIN_DEFS 取，保证写的=结算的）
domain: p => {
    const def = DOMAIN_DEFS[p.field] || DOMAIN_DEFS.wuji;
    return `支付${p.cost}LP，展开领域「${def.name}」：${DOMAIN_RULES_TEXT[p.field] || ""}`;
},
// 规则文案常量（与引擎判定一一对应）
const DOMAIN_RULES_TEXT = {
    wuji: "直到对方回合结束，对方怪兽不能发动效果",
    za_warudo: "直到对方回合结束，对方全部怪兽不能攻击",
    rojin: "直到对方回合结束，自己受到的战斗伤害减半，另一半反弹给攻击者",
    ongaku: "直到对方回合结束，己方场上怪兽攻击力+500、对方场上怪兽攻击力-500",
};
// canResolve
case "domain": return p.monsterZone.includes(c) && p.lp > (par.cost || DOMAIN_DEFS[par.field]?.cost || 0);
// handler
case "domain": {
    const def = DOMAIN_DEFS[par.field] || DOMAIN_DEFS.wuji;
    const cost = Number(par.cost ?? def.cost);
    p.takeDamage(cost);
    const domain = { id: par.field, until: game.turn + 1, applied: [] };
    state(c).domain = domain;
    const buff = (owner, value) => {
        for (const x of owner.monsterZone) {
            x.permanentBuffs = [...(x.permanentBuffs || []), { type: "attack", value, source: "domainOngaku" }];
            owner._recalcCardStats(x);
            domain.applied.push({ card: x, owner });
        }
    };
    if (def.allyAttack) buff(p, def.allyAttack);
    if (def.enemyAttack) buff(o, def.enemyAttack);
    break;
}
```

回合末到期（在 `resolveThemedTurnEnd(engine, endingPlayer)` 内，遍历双方——领域按回合数到期）：

```js
for (const owner of engine.state.players) {
    for (const card of owner.monsterZone) {
        const domain = card.themedState?.domain;
        if (!domain || domain.until > engine.state.turn) continue;
        for (const entry of domain.applied) {
            entry.card.permanentBuffs = (entry.card.permanentBuffs || []).filter(buff => buff.source !== "domainOngaku");
            entry.owner._recalcCardStats(entry.card);
        }
        delete card.themedState.domain;
    }
}
```

到期判定为 `until <= turn`（`game.turn + 1` 的领域在对方回合结束时到期；在对方回合进行中仍生效）。

`engine.js`：

1. `triggerAllEffects` 开头（与 curse 判定同处）：

```js
if (activeDomain(this, this.state.opponentPlayer, "wuji")) return null;  // 敌方的无量空处封锁本方效果
```

> 注意方向：`triggerAllEffects(player, ...)` 中若 **对手** 场上有 wuji 领域且玩家不是领域持有者，则封锁。

2. `attack()` 的不可攻击判定追加：

```js
|| activeDomain(this, this.state.opponentPlayer, "za_warudo")
```

3. 战斗伤害结算后（与出血同处）追加罗针反弹：

```js
const rojin = activeDomain(this, defenderOwner, "rojin");
if (rojin && battleDamage > 0) {
    const bounced = Math.ceil(battleDamage / 2);
    attackerOwner.takeDamage(bounced);
    battleDamage -= bounced;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** `node --test test/*.test.js` 全绿。

---