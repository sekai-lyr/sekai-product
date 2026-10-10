### 任务 3：出血 / 诅咒 + 引擎钩子

**文件：**
- 修改：`js/themed-effects.js`
- 修改：`js/engine.js`（`attack()`、`triggerAllEffects()`:1989、`selectTribute()`:2032、`destroyFieldMonster()`:131）
- 测试：`test/status-effects.test.js` 追加

- [ ] **步骤 1：编写失败的测试**

```js
test("出血在战斗后结算并衰减", () => {
    const { s, p, o, e } = board();
    const attacker = createCardInstance({ id: "a1", name: "我", type: "monster", level: 4, attack: 2000, defense: 1000, effects: [] });
    const defender = enemyMonster(1500);
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
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "curse", params: { stacks: 1, damage: 700 }, skillName: "t" }, gameState: s });
    assert.equal(e.triggerAllEffects(o, cursed, "manual"), null);
    assert.equal(e.selectTribute(cursed).success ?? false, false);
    e.destroyFieldMonster(o, cursed);
    assert.equal(o.lp, 7300);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

`themed-effects.js` 追加：

```js
// DEFAULTS
bleed: { stacks: 2, damage: 400 },
curse: { stacks: 1, damage: 700 },
// TEMPLATES
bleed: p => `给对方攻击力最高的可取对象表侧怪兽放置${p.stacks}层出血；出血怪兽每次参与战斗后，其控制者受到${p.damage}×层数伤害，随后层数-1`,
curse: p => `给对方攻击力最高的可取对象表侧怪兽施加诅咒：其效果无效、不能作为上级召唤的祭品；被破坏时其控制者受到${p.damage}×层数伤害`,
// canResolve
case "bleed": case "curse": return !!enemy(ctx);
// handler
case "bleed": applyAilment(target, "bleed", par.stacks, par.damage); break;
case "curse": applyAilment(target, "curse", par.stacks, par.damage); break;
```

`engine.js`：

1. `triggerAllEffects`（第 2372 行起）在取 effects 前追加：

```js
if (Number(card.themedState?.statuses?.curse) > 0) return null;
```

2. `selectTribute`（第 2032 行）在有效性判断中加入：

```js
if (Number(card?.themedState?.statuses?.curse) > 0) return { success: false, message: "被诅咒的怪兽不能作为祭品" };
```

3. `attack()` 在战斗伤害结算完成处（约 2888 行 `this.emit("onBattleDamage"...)` 之后）追加出血结算：

```js
for (const [owner, monster] of [[attackerOwner, attacker], [defenderOwner, target instanceof Object && target?.type === "monster" ? target : null]]) {
    const stacks = Number(monster?.themedState?.statuses?.bleed) || 0;
    if (!monster || stacks <= 0) continue;
    const damage = (Number(monster.themedState.bleedDamage) || 0) * stacks;
    owner.takeDamage(damage);
    this.emit("onStatusTick", { card: monster, status: "bleed", damage });
    const next = stacks - 1;
    if (next > 0) monster.themedState.statuses.bleed = next;
    else delete monster.themedState.statuses.bleed;
}
```

4. `destroyFieldMonster`（第 131 行起）在把怪兽移入墓地前结算诅咒亡语：

```js
const curseStacks = Number(monster.themedState?.statuses?.curse) || 0;
if (curseStacks > 0) owner.takeDamage((Number(monster.themedState.curseDamage) || 0) * curseStacks);
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** `node --test test/*.test.js`（static）全绿，重点确认既有战斗用例无回归。

---