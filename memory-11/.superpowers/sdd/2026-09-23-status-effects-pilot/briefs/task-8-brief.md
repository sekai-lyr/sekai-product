### 任务 8：赌运 + 硬币事件

**文件：**
- 修改：`js/themed-effects.js`（gamble、paralyze 赌运分支）
- 修改：`js/engine.js`（`onCoinFlip` 事件）
- 测试：`test/status-effects.test.js` 追加

- [ ] **步骤 1：编写失败的测试**

```js
test("赌运使用共享随机源且结果写入事件", () => {
    const { s, p, o, e } = board();
    const events = [];
    e.eventBus.on("onCoinFlip", data => events.push(data.result));
    themedEffectHandlers.themedAction({ engine: e, player: p, opponent: o, card: p, effect: { action: "gamble", params: { draw: 2, heal: 800 }, skillName: "t" }, gameState: s });
    assert.equal(events.length, 1);
    assert.ok(["heads", "tails"].includes(events[0]));
    const before = { hand: p.hand.length, lp: p.lp };
    const fixed = new GameEngine((() => { const st = new GameState(); st.players = [new Player("a", []), new Player("b", [])]; st.turn = 3; return st; })(), () => 0.1);
    themedEffectHandlers.themedAction({ engine: fixed, player: fixed.state.players[0], opponent: fixed.state.players[1], card: p, effect: { action: "gamble", params: { draw: 2, heal: 800 }, skillName: "t" }, gameState: fixed.state });
    assert.equal(fixed.state.players[0].hand.length, 2); // RNG<0.5 → 正面抽卡
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

```js
// DEFAULTS
gamble: { draw: 2, heal: 800 },
// TEMPLATES
gamble: p => `抛硬币：正面则抽${p.draw}张卡；反面则回复${p.heal}LP`,
// canResolve
case "gamble": return true;
// handler（先抛硬币，结果写给事件与 paralyze 赌运分支共用）
case "gamble": {
    const result = engine._random() < 0.5 ? "heads" : "tails";
    game.lastCoinResult = result;
    engine.emit("onCoinFlip", { card: c, result });
    if (result === "heads") { for (let i = 0; i < Math.max(1, par.draw); i++) p.drawCard(); }
    else p.heal(par.heal);
    break;
}
```

`paralyze` 赌运分支使用同一结果：

```js
if (par.gamble) {
    const result = game.lastCoinResult || (engine._random() < 0.5 ? "heads" : "tails");
    engine.emit("onCoinFlip", { card: c, result });
    if (result === "tails") { for (const x of targets) applyTempStat(o, x, "attack", -par.amount); }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** `npm run fuzz`（120 局）通过——新动作不得破坏不变量。

---