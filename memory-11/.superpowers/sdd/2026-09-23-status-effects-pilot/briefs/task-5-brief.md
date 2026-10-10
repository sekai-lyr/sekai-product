### 任务 5：异界流放 / 异界归来

**文件：**
- 修改：`js/themed-effects.js`（exile 分支、recall 跳过、回合末回归）
- 修改：`js/engine.js`（`endTurn` 调用回归）
- 测试：`test/status-effects.test.js` 追加

- [ ] **步骤 1：编写失败的测试**

```js
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

`themed-effects.js`：

```js
// DEFAULTS
exile: { turns: 2, penalty: 500, self: false },
// TEMPLATES
exile: p => p.self
    ? `自己被破坏送入墓地时，支付800LP，改为进入异界区；下一个自己的结束阶段以守备表示回到场上（攻击力下降${p.penalty}，可累计）、效果封印1回合`
    : `将对方攻击力最高的可取对象表侧怪兽送入异界区；${p.turns}个结束阶段后回到场上（守备表示、攻击力下降${p.penalty}、效果封印1回合）`,
// canResolve（放置于 returnSelf 旁）
case "exile":
    return par.self
        ? p.graveyard.includes(c) && p.lp > 800
        : !!enemy(ctx);
// handler
case "exile": {
    if (par.self) {
        p.takeDamage(800);
        move(c, p.graveyard, p.banished);
        c.themedState.exile = { pendingEndPhases: Math.max(1, par.turns), penalty: par.penalty };
    } else {
        move(target, o.monsterZone, o.banished);
        target.themedState.exile = { pendingEndPhases: Math.max(1, par.turns), penalty: par.penalty };
    }
    break;
}
```

`recall` 的 `lastN(p.banished, par.count)` 改为 `lastN(p.banished, par.count, x => !x.themedState?.exile)`。

回合末回归（在 `resolveThemedTurnEnd` 中，对 `endingPlayer` 的除外区扫描）。用"剩余结束阶段计数"而不是回合数，避免依赖 turn 计数器的增减时机：

```js
export function resolveExileReturns(engine, player) {
    for (const card of [...player.banished]) {
        const exile = card.themedState?.exile;
        if (!exile) continue;
        exile.pendingEndPhases = (Number(exile.pendingEndPhases) || 0) - 1;
        if (exile.pendingEndPhases > 0) continue;
        if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) { exile.pendingEndPhases = 1; continue; }
        engine.resetFieldCard(card);          // 清 themedState（含 exile 标记）
        card.position = MONSTER_POSITION.DEFENSE;
        card.setTurn = engine.state.turn;
        card.permanentBuffs = [...(card.permanentBuffs || []), { type: "attack", value: -exile.penalty, source: "exileReturn" }];
        card.themedState = { sealedUntil: engine.state.turn };
        player.monsterZone.push(card);
        engine._emitSpecialSummon?.(player, card);
    }
}
```

`resolveThemedTurnEnd(engine, endingPlayer)` 内 `if (endingPlayer) resolveExileReturns(engine, endingPlayer);`

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** `themed-gameplay.test.js` 中 `recall` 相关用例（若有）仍绿。

---