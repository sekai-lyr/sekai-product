### 任务 6：引爆 + 净化互动

**文件：**
- 修改：`js/themed-effects.js`（detonate 分支、purify 增强）
- 测试：`test/status-effects.test.js` 追加

- [ ] **步骤 1：编写失败的测试**

```js
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
    assert.equal(o.lp, 8000);                              // 扩散伤的是怪兽守备，不掉 LP
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

```js
// DEFAULTS
detonate: { stacks: 2, damage: 600 },
// TEMPLATES
detonate: p => `给对方攻击力最高的可取对象表侧怪兽放置${p.stacks}层灼烧，然后立即引爆其身上全部灼烧层数：每层使其控制者受到${p.damage}点伤害；若其带有剧毒，同时引爆剧毒：每层给对方全体怪兽造成300点伤害`,
// canResolve
case "detonate": return !!enemy(ctx);
// handler
case "detonate": {
    applyAilment(target, "burn", Math.max(1, par.stacks), par.damage);
    const burnStacks = ailmentStacks(target, "burn");
    if (burnStacks > 0) {
        o.takeDamage(par.damage * burnStacks);
        removeAilment(target, "burn");
    }
    const venomStacks = ailmentStacks(target, "venom");
    if (venomStacks > 0) {
        const splash = 300 * venomStacks;
        for (const x of o.monsterZone.filter(x => x.faceUp)) {
            x.currentDefense = Math.max(0, (x.currentDefense || 0) - splash);
            if (x.currentDefense <= 0) engine.destroyFieldMonster(o, x);
        }
        removeAilment(target, "venom");
    }
    break;
}
// purify 现有分支循环里追加：cleanseAilments(x)
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** 既有 `purify` 用例（除外墓地）仍绿。

---