### 任务 4：麻痹 / 无下限

**文件：**
- 修改：`js/themed-effects.js`、`js/engine.js`（`attack()`:2731、`changePosition()`:2340、战斗伤害计算）
- 测试：`test/status-effects.test.js` 追加

- [ ] **步骤 1：编写失败的测试**

```js
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

`themed-effects.js` 追加：

```js
paralyze: { count: 1, amount: 0, gamble: false },
infinity: { reduce: 1000 },
paralyze: p => p.gamble
    ? `抛硬币：正面则麻痹对方攻击力最高的可取对象表侧怪兽（直到下个回合结束不能攻击或改变表示形式）；反面则其攻击力下降${p.amount}直到回合结束`
    : p.count === "all"
        ? "对方全部表侧怪兽麻痹：直到下个回合结束不能攻击或改变表示形式"
        : "将对方攻击力最高的可取对象表侧怪兽麻痹：直到下个回合结束不能攻击或改变表示形式",
infinity: p => `直到下个自己的回合结束，自身不会成为对方效果的对象，且受到的战斗伤害减少${p.reduce}`,
// canResolve
case "paralyze": return !!enemy(ctx);
case "infinity": return p.monsterZone.includes(c);
// handler（赌运分支在任务 8 接入，本任务先实现非赌运路径）
case "paralyze": {
    const targets = par.count === "all" ? o.monsterZone.filter(x => x.faceUp) : [target].filter(Boolean);
    for (const x of targets) { state(x).paralyzedUntil = game.turn + 1; x.canAttack = false; }
    break;
}
case "infinity":
    state(c).infinityUntil = game.turn + 1;
    state(c).infinityReduce = par.reduce;
    c.cannotBeTargeted = true;
    break;
```

> 实现者注意：抛硬币分支在任务 8 中改为 `game.lastCoinResult`（由 handler 在调用前抛硬币并写入）。本任务先实现非赌运分支。

`engine.js`：

1. `attack()` 的不可攻击判定（第 2731 行）追加 `|| attacker.themedState?.paralyzedUntil >= this.state.turn`。
2. `changePosition()`（第 2340 行）追加 `|| card.themedState?.paralyzedUntil >= this.state.turn`。
3. 战斗伤害计算处（约 2825-2888 行 `battleDamage` 求得后）追加：

```js
const infinity = Number(defender?.themedState?.infinityUntil) >= this.state.turn
    ? Number(defender.themedState.infinityReduce) || 0 : 0;
if (infinity) battleDamage = Math.max(0, battleDamage - infinity);
```

4. `resolveThemedTurnEnd` 到期清理里追加 `paralyzedUntil`、`infinityUntil`（后者到期时 `c.cannotBeTargeted = false`）。

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** 既有 `themed-gameplay.test.js` 的冻结/封印用例仍绿。

---