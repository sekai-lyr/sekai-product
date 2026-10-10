### 任务 2：灼烧 / 剧毒 + 回合末结算 + 回复减半

**文件：**
- 修改：`js/themed-effects.js`（DEFAULTS/TEMPLATES/canResolve/handler/`resolveThemedTurnEnd`）
- 修改：`js/model.js:153`（`Player.heal`）
- 测试：`test/status-effects.test.js` 追加

- [ ] **步骤 1：编写失败的测试（追加到 `test/status-effects.test.js`）**

```js
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
    assert.equal(o.lp, 7000 + 500);
    s.currentPlayerIndex = 1; e.endTurn();
    assert.equal(o.lp, 6600);
    assert.equal(target.themedState.statuses.venom, 2);
});

test("新动作都有卡面文字", () => {
    for (const action of ["ignite", "venom"]) assert.ok(ACTION_TEXT[action]?.length > 0);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL（`ACTION_TEXT.ignite` 为 undefined / handler 不结算）

- [ ] **步骤 3：实现**

`themed-effects.js` 顶部导入：

```js
import { AILMENTS, DOMAIN_DEFS, applyAilment, ailmentStacks, ailmentValue, removeAilment, cleanseAilments, tickAilments, activeDomain } from "./status-effects.js";
```

`ACTION_DEFAULTS` 追加：

```js
ignite: { stacks: 2, damage: 500 },
venom: { stacks: 2, damage: 450 },
```

`ACTION_TEMPLATES` 追加：

```js
ignite: p => `给对方攻击力最高的可取对象表侧怪兽放置${p.stacks}层灼烧；其控制者每个结束阶段受到${p.damage}×层数伤害，随后层数-1（上限3层）`,
venom: p => `给对方攻击力最高的可取对象表侧怪兽放置${p.stacks}层剧毒（上限3层）；剧毒怪兽的控制者每个结束阶段受到${p.damage}×层数伤害，且其所有回复减半；剧毒不会自然消失`,
```

`canResolveThemedEffect` 的 switch 追加：

```js
case "ignite": case "venom": return !!enemy(ctx);
```

`themedEffectHandlers.themedAction` 的 switch 追加：

```js
case "ignite": applyAilment(target, "burn", par.stacks, par.damage); break;
case "venom": applyAilment(target, "venom", par.stacks, par.damage); break;
```

`resolveThemedTurnEnd(engine)` 改名并接入 tick（签名改为 `(engine, endingPlayer)`）：

```js
export function resolveThemedTurnEnd(engine, endingPlayer) {
    if (endingPlayer) {
        tickAilments(engine, endingPlayer);
        resolveExileReturns(engine, endingPlayer);
    }
    // ……其余既有逻辑（毒印/爆破/sealedUntil/frozenUntil 等清理）保持原样不动……
}
```

`engine.endTurn()`（engine.js:1924）改为：

```js
resolveThemedTurnEnd(this, player);
```

`model.js` 的 `Player.heal`（第 153 行）在取整后追加：

```js
const poisoned = this.monsterZone.some(card => Number(card?.themedState?.statuses?.venom) > 0);
const heal = Math.max(0, Math.floor((Number(amount) || 0) / (poisoned ? 2 : 1)));
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS（全部用例；已有毒印/冻结等回路由既有测试保证）

- [ ] **检查点：** `node --test test/themed-gameplay.test.js test/status-effects.test.js` 全绿。

---