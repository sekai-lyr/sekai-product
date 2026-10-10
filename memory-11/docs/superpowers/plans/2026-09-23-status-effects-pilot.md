# 30 张试点卡 · 状态异常引擎 + 领域 + 演出 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **注意：** 本项目不是 git 仓库（`git status` 报 not a git repository），因此所有"Commit"步骤替换为"检查点"：测试命令必须真实运行并获得预期输出后才能勾选。

**目标：** 为 Web 端 30 张代表卡新增状态异常系统（灼烧/剧毒/出血/诅咒/异界流放/麻痹/引爆/赌运/无下限/领域）与配套动作特效、领域展开演出、合成音效。

**架构：** 新状态逻辑集中在新模块 `js/status-effects.js`；动作定义/结算沿用 `js/themed-effects.js` 的"卡面=结算"三件套（DEFAULTS/TEMPLATES/handlers）；引擎在 `js/engine.js` 的事件点接入钩子；演出在 `js/effects.js`（rule-fx 体系 + 电影级运镜）与 `js/audio.js` 扩展；30 张卡的配方在 `js/authored-card-rules.js` + `js/signature-tuning.js` 声明。

**技术栈：** 原生 ES Modules（无构建步骤）、Node `node --test`、Spring Boot 静态资源打包（jar 重建 + 重启 8091）。

**规格：** `docs/superpowers/specs/2026-09-23-status-effects-pilot-design.md`（所有数值/文本以此为准）。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `js/status-effects.js` | 异常状态注册表、施加/清除/查询、回合末结算、领域定义表 | 新建 |
| `js/themed-effects.js` | 10 个新动作的默认参数/卡面模板/可发动门槛/结算 handler | 修改 |
| `js/engine.js` | 麻痹/诅咒/出血/领域/无下限的判定钩子、异界回归、硬币事件 | 修改 |
| `js/model.js` | `Player.heal` 剧毒减半钩子 | 修改 |
| `js/signature-tuning.js` | 新动作的参数候选池（每卡参数不同） | 修改 |
| `js/authored-card-rules.js` | 30 张卡 RECIPES + 技能名固定 | 修改 |
| `js/card-view.js` | 新状态标签与层数显示 | 修改 |
| `js/effects.js` | 动作特效映射、技能横幅、硬币/领域演出 | 修改 |
| `js/audio.js` | 10 个新合成音 | 修改 |
| `js/controller.js` | 订阅 `onCoinFlip` 事件触发演出 | 修改 |
| `css/style.css` | 新 keyframes、状态徽记、领域 overlay/chip 样式 | 追加 |
| `test/status-effects.test.js` | 状态引擎 + 演出数据断言 | 新建 |
| `src/test/js/pilot-roster.test.js` | 30 卡映射断言 | 新建 |
| `test/themed-gameplay.test.js` | 更新"死亡回归"用例 | 修改 |

`static` 目录为 `SekaiGame/src/main/resources/static`，下文相对路径均以它为根。测试命令均在 `static` 下执行，另注明的除外。

---

### 任务 1：状态模块 `status-effects.js`

**文件：**
- 创建：`js/status-effects.js`
- 测试：`test/status-effects.test.js`

- [ ] **步骤 1：编写失败的测试**

```js
// test/status-effects.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createCardInstance } from "../js/model.js";
import { AILMENTS, applyAilment, ailmentStacks, ailmentValue, cleanseAilments, removeAilment } from "../js/status-effects.js";

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
    applyAilment(c, "bleed", 2, 400);
    applyAilment(c, "curse", 1, 700);
    cleanseAilments(c);
    assert.equal(ailmentStacks(c, "bleed"), 0);
    assert.equal(ailmentStacks(c, "curse"), 0);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL，`Cannot find module '../js/status-effects.js'`

- [ ] **步骤 3：实现 `status-effects.js`**

```js
// js/status-effects.js
export const AILMENTS = {
    burn:  { label: "灼烧", max: 3, valueKey: "burnDamage",  decay: true },
    venom: { label: "剧毒", max: 3, valueKey: "venomDamage", decay: false },
    bleed: { label: "出血", max: 3, valueKey: "bleedDamage", decay: false },
    curse: { label: "诅咒", max: 3, valueKey: "curseDamage", decay: false },
};

export const DOMAIN_DEFS = {
    wuji:      { name: "无量空处", title: "領域展開 · 無量空處", cost: 1200, blocksEffects: true, color: "#cfd6ff", accent: "#0c0d1a" },
    za_warudo: { name: "白金之星·世界", title: "スタープラチナ・ザ・ワールド", cost: 1000, blocksAttacks: true, color: "#ffe06b", accent: "#2b1f00" },
    rojin:     { name: "破坏杀·罗针", title: "破壊殺・羅針", cost: 800, deflectHalf: true, color: "#ff5d67", accent: "#2a0a0c" },
    ongaku:    { name: "苍穹音浪", title: "苍穹音浪", cost: 600, allyAttack: 500, enemyAttack: -500, color: "#63ddff", accent: "#3a0b4f" },
};

function statuses(card) {
    if (!card) return null;
    card.themedState ||= {};
    card.themedState.statuses ||= {};
    return card.themedState.statuses;
}

export function applyAilment(card, id, stacks = 1, value = 0) {
    const def = AILMENTS[id];
    const map = statuses(card);
    if (!def || !map) return 0;
    map[id] = Math.min(def.max, (Number(map[id]) || 0) + Math.max(1, Number(stacks) || 1));
    if (value) card.themedState[def.valueKey] = Number(value) || 0;
    return map[id];
}

export function ailmentStacks(card, id) {
    return Number(card?.themedState?.statuses?.[id]) || 0;
}

export function ailmentValue(card, id) {
    const def = AILMENTS[id];
    return def ? Number(card?.themedState?.[def.valueKey]) || 0 : 0;
}

export function removeAilment(card, id) {
    if (card?.themedState?.statuses) delete card.themedState.statuses[id];
}

export function cleanseAilments(card) {
    if (card?.themedState) delete card.themedState.statuses;
}

/** 结束阶段：结算 endingPlayer 场上灼烧/剧毒（伤害+衰减）。返回演出事件数组。 */
export function tickAilments(engine, endingPlayer) {
    const events = [];
    for (const card of [...endingPlayer.monsterZone]) {
        const burn = ailmentStacks(card, "burn");
        if (burn > 0) {
            const damage = ailmentValue(card, "burn") * burn;
            endingPlayer.takeDamage(damage);
            events.push({ card, status: "burn", damage });
            engine.emit("onStatusTick", { card, status: "burn", damage });
            if (AILMENTS.burn.decay) {
                const next = burn - 1;
                if (next > 0) card.themedState.statuses.burn = next;
                else removeAilment(card, "burn");
            }
        }
        const venom = ailmentStacks(card, "venom");
        if (venom > 0) {
            const damage = ailmentValue(card, "venom") * venom;
            endingPlayer.takeDamage(damage);
            events.push({ card, status: "venom", damage });
            engine.emit("onStatusTick", { card, status: "venom", damage });
        }
    }
    return events;
}

/** 某玩家场上是否存在指定领域（源卡在场即生效，直到 until 回合）。 */
export function activeDomain(engine, player, key = null) {
    const turn = engine?.state?.turn ?? 0;
    for (const card of player?.monsterZone || []) {
        const domain = card.themedState?.domain;
        if (!domain || domain.until < turn) continue;
        if (!key || domain.id === key) return { card, domain, def: DOMAIN_DEFS[domain.id] };
    }
    return null;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS（2 个用例）

- [ ] **检查点：** `npm run check` 语法检查通过。

---

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
    assert.equal(o.lp, 8000 + 500);        // 剧毒：回复减半 → +500
    s.currentPlayerIndex = 1; e.endTurn();
    assert.equal(o.lp, 8000 + 500 - 450 * 2); // 2 层剧毒 tick：-900
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

### 任务 9：30 张卡配方与技能名

**文件：**
- 修改：`js/signature-tuning.js`（新动作候选池）
- 修改：`js/authored-card-rules.js`（RECIPES + CHARACTER_SKILLS）
- 修改：`test/themed-gameplay.test.js`（死亡回归用例）
- 创建：`src/test/js/pilot-roster.test.js`

- [ ] **步骤 1：编写失败的测试**

```js
// src/test/js/pilot-roster.test.js
import assert from "node:assert/strict";
import test from "node:test";
import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";

const ROSTER = {
    picture_ex_030: "ignite", picture_ex_037: "venom", picture_ex_020: "bleed",
    picture_ex_048: "paralyze", picture_ex_027: "detonate", picture_ex_056: "domain",
    picture_ex_011: "domain", picture_ex_012: "detonate", picture_ex_013: "paralyze",
    picture_ex_014: "bleed", picture_ex_018: "exile",
    source_monster_015: "domain", source_monster_010: "infinity", source_monster_012: "bleed",
    source_monster_014: "ignite", source_monster_013: "detonate", source_monster_008: "curse",
    picture_ex_072: "exile",
    picture_ssr7_032: "curse", picture_ssr7_036: "gamble", picture_ssr7_043: "paralyze",
    picture_ssr7_026: "ignite", picture_ssr7_049: "bleed", picture_ex_107: "domain",
    picture_ssr7_007: "ignite", picture_ssr7_016: "detonate", picture_ssr7_003: "exile",
    picture_ssr7_013: "bleed", picture_ssr7_014: "curse", picture_ssr7_015: "bleed",
};

test("30 张试点卡动作映射正确且卡面可渲染", () => {
    assert.equal(Object.keys(ROSTER).length, 30);
    for (const [id, action] of Object.entries(ROSTER)) {
        const card = ALL_CARDS.find(item => item.id === id);
        assert.ok(card, `缺少卡：${id}`);
        assert.deepEqual(card.effects.map(e => e.action), [action], `${id} 动作不符`);
        assert.ok(card.effects[0].skillName?.length > 0, `${id} 缺技能名`);
        assert.ok((card.description || "").includes(card.effects[0].description.replace(/^.*?：/u, "")), `${id} 卡面与效果不一致`);
    }
});

test("30 张试点卡参数互不相同（同动作内）", () => {
    const groups = new Map();
    for (const id of Object.keys(ROSTER)) {
        const card = ALL_CARDS.find(item => item.id === id);
        const e = card.effects[0];
        const key = `${e.trigger}|${e.action}`;
        const params = JSON.stringify(e.params || {});
        if (!groups.has(key)) groups.set(key, new Map());
        assert.equal(groups.get(key).has(params), false, `${id} 参数重复`);
        groups.get(key).set(params, id);
    }
});
```

`themed-gameplay.test.js` 的死亡回归用例改为：

```js
test("死亡回归：破坏时支付800LP进入异界区并在结束阶段归来", () => {
    const { e, p } = setup(); const c = createCardInstance(getCardById("picture_ex_072"));
    p.monsterZone.push(c); e.destroyFieldMonster(p, c);
    assert.equal(p.lp, 7200);
    assert.ok(p.banished.includes(c));
    e.endTurn();
    assert.ok(p.monsterZone.includes(c));
    assert.equal(c.position, "defense");
});
```

- [ ] **步骤 2：运行测试验证失败**

运行（在 `SekaiGame` 目录）：`node --test src/test/js/pilot-roster.test.js`
预期：FAIL（多数卡动作仍是旧动作）
运行（在 `static`）：`node --test test/themed-gameplay.test.js`
预期：FAIL（死亡回归旧行为断言不成立）

- [ ] **步骤 3：实现**

1. `signature-tuning.js` 的 `PARAM_CANDIDATES` 追加（候选顺序需与 §7 数值一致；按 catalog 中同动作卡出现顺序排列）：

```js
ignite: [{ stacks: 2, damage: 500 }, { stacks: 1, damage: 800 }, { stacks: 1, damage: 700 }, { stacks: 3, damage: 400 }, { stacks: 2, damage: 600 }, { stacks: 2, damage: 450 }, { stacks: 3, damage: 500 }, { stacks: 1, damage: 900 }],
venom: [{ stacks: 2, damage: 450 }, { stacks: 1, damage: 600 }, { stacks: 3, damage: 400 }],
bleed: [{ stacks: 2, damage: 400 }, { stacks: 3, damage: 300 }, { stacks: 2, damage: 600 }, { stacks: 1, damage: 650 }, { stacks: 2, damage: 500 }, { stacks: 1, damage: 700 }, { stacks: 3, damage: 450 }],
curse: [{ stacks: 1, damage: 700 }, { stacks: 1, damage: 800 }, { stacks: 1, damage: 600 }, { stacks: 2, damage: 500 }],
paralyze: [{ count: 1, amount: 0, gamble: false }, { count: "all", amount: 0, gamble: false }, { gamble: true, amount: 600 }, { count: 1, amount: 400, gamble: false }],
domain: [{ field: "rojin", cost: 800 }, { field: "za_warudo", cost: 1000 }, { field: "wuji", cost: 1200 }, { field: "ongaku", cost: 600 }],
detonate: [{ stacks: 2, damage: 650 }, { stacks: 1, damage: 800 }, { stacks: 3, damage: 500 }, { stacks: 1, damage: 750 }],
exile: [{ turns: 2, penalty: 500, self: false }, { turns: 1, penalty: 300, self: false }, { turns: 1, penalty: 500, self: true }],
infinity: [{ reduce: 1000 }, { reduce: 1200 }, { reduce: 800 }],
gamble: [{ draw: 2, heal: 800 }, { draw: 3, heal: 1000 }, { draw: 1, heal: 600 }],
```

> 实现者注意：执行 `node -e` 脚本按 catalog 顺序打印每个动作分组的卡 id 顺序，对照 §7 调整候选数组顺序，使每张卡拿到表内数值；随后由 `pilot-roster` 的"参数互不相同"断言锁定唯一性。

2. `authored-card-rules.js` 的 RECIPES：把 30 张卡改为单动作配方（触发按 §7）。例如：

```js
Object.assign(RECIPES, {
    picture_ex_030: "S:ignite", picture_ex_037: "M:venom", picture_ex_020: "M:bleed",
    picture_ex_048: "M:paralyze", picture_ex_027: "S:detonate", picture_ex_056: "M:domain",
    picture_ex_011: "M:domain", picture_ex_012: "M:detonate", picture_ex_013: "M:paralyze",
    picture_ex_014: "M:bleed", picture_ex_018: "M:exile",
    source_monster_015: "M:domain", source_monster_010: "S:infinity", source_monster_012: "M:bleed",
    source_monster_014: "M:ignite", source_monster_013: "M:detonate", source_monster_008: "M:curse",
    picture_ex_072: "D:exile",
    picture_ssr7_032: "S:curse", picture_ssr7_036: "S:gamble", picture_ssr7_043: "S:paralyze",
    picture_ssr7_026: "S:ignite", picture_ssr7_049: "M:bleed", picture_ex_107: "M:domain",
    picture_ssr7_007: "M:ignite", picture_ssr7_016: "M:detonate", picture_ssr7_003: "M:exile",
    picture_ssr7_013: "M:bleed", picture_ssr7_014: "M:curse", picture_ssr7_015: "M:bleed",
});
```

3. `CHARACTER_SKILLS` 固定技能名（防止动作变化后名称漂移；均为 §7 表名）：

```js
Object.assign(CHARACTER_SKILLS, {
    picture_ex_030: { ignite: "炎之呼吸·不知火" },
    picture_ex_037: { venom: "虫之呼吸·毒刃·紫藤毒" },
    picture_ex_020: { bleed: "蛇之呼吸·委蛇斩" },
    picture_ex_048: { paralyze: "霹雳一闪·火雷神" },
    picture_ex_027: { detonate: "血鬼术·爆血" },
    picture_ex_056: { domain: "破坏杀·罗针" },
    picture_ex_011: { domain: "白金之星·世界" },
    picture_ex_012: { detonate: "第一炸弹" },
    picture_ex_013: { paralyze: "世界·时停突袭·THE WORLD" },
    picture_ex_014: { bleed: "性感手枪·弹道折射" },
    picture_ex_018: { exile: "D4C·爱之列车" },
    source_monster_015: { domain: "领域展开·无量空处" },
    source_monster_010: { infinity: "无下限" },
    source_monster_012: { bleed: "伏魔御厨子·解" },
    source_monster_014: { ignite: "开·炎矢" },
    source_monster_013: { detonate: "虚式茈" },
    source_monster_008: { curse: "解·空间斩·狱纹" },
    picture_ex_072: { exile: "死亡回归" },
    picture_ssr7_032: { curse: "沉默琴弦·沉默枷锁" },
    picture_ssr7_036: { gamble: "自由即兴·即兴曲" },
    picture_ssr7_043: { paralyze: "人偶键盘·雪夜独奏" },
    picture_ssr7_026: { ignite: "粉色和弦·点燃全场" },
    picture_ssr7_049: { bleed: "暗潮低音" },
    picture_ex_107: { domain: "未来音浪·苍穹音浪" },
    picture_ssr7_007: { ignite: "莱万汀·熔核烈歌" },
    picture_ssr7_016: { detonate: "D12·赤痕爆破" },
    picture_ssr7_003: { exile: "深海潮歌·深海夜宴" },
    picture_ssr7_013: { bleed: "过载模式·红莲铳火" },
    picture_ssr7_014: { curse: "奇美拉·星屑天幕" },
    picture_ssr7_015: { bleed: "沸腾爆裂·炎锯镇岳" },
});
```

- [ ] **步骤 4：运行测试验证通过**

运行（`SekaiGame`）：`node --test src/test/js/pilot-roster.test.js src/test/js/effect-diversity.test.js src/test/js/premium-monster-rule-uniqueness.test.js`
预期：PASS
运行（`static`）：`node --test test/themed-gameplay.test.js`
预期：PASS

- [ ] **检查点：** 运行（`SekaiGame`）`node --test src/test/js/*.test.js`，全部通过（包括既有 15 个测试文件）。

---

### 任务 10：状态标签 UI

**文件：**
- 修改：`js/card-view.js:71-79`（`cardRuleStatusHtml`）
- 修改：`css/style.css`（`.card-rule-status` 相关，追加状态色）
- 测试：`test/status-effects.test.js` 追加

- [ ] **步骤 1：编写失败的测试**

```js
import { cardRuleStatusHtml } from "../js/card-view.js";

test("状态标签显示层数与异界/领域标记", () => {
    const c = createCardInstance({ id: "ui", name: "UI", type: "monster", level: 4, attack: 1, defense: 1, effects: [] });
    applyAilment(c, "burn", 2, 500);
    applyAilment(c, "venom", 1, 450);
    c.themedState.exile = { returnTurn: 5 };
    const html = cardRuleStatusHtml(c);
    assert.match(html, /灼烧 2/);
    assert.match(html, /剧毒 1/);
    assert.match(html, /异界归来/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

`cardRuleStatusHtml` 的循环前追加：

```js
const statuses = state.statuses || {};
const ailmentNames = { burn: "灼烧", venom: "剧毒", bleed: "出血", curse: "诅咒" };
for (const [id, name] of Object.entries(ailmentNames)) {
    const stacks = Number(statuses[id]) || 0;
    if (stacks > 0) labels.push(`${name} ${stacks}`);
}
if (state.exile) labels.push("异界归来");
if (state.domain) labels.push(`领域·${state.domain.id === "wuji" ? "无量空处" : state.domain.id === "za_warudo" ? "白金之星" : state.domain.id === "rojin" ? "罗针" : "苍穹音浪"}`);
if (state.paralyzedUntil != null) labels.push("麻痹");
if (state.infinityUntil != null) labels.push("无下限");
```

`css/style.css` 在 `.card-rule-status`（6774 行）附近追加：

```css
.card-rule-status .status-burn { color:#ff8a4c; }
.card-rule-status .status-venom { color:#b07dff; }
.card-rule-status .status-bleed { color:#ff5d7a; }
.card-rule-status .status-curse { color:#a06bff; }
.card-rule-status .status-exile { color:#8fb8ff; }
.card-rule-status .status-domain { color:#63ddff; }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** `node --test test/*.test.js` 全绿。

---

### 任务 11：动作特效映射 + 技能横幅 + 状态徽记 + 硬币演出（effects.js / controller.js）

**文件：**
- 修改：`js/effects.js`（`THEMED_ACTION_VISUALS` 导出、`ruleVisualKey`、`resolveRuleTargets`、`playRuleDrivenEffect`、`showSkillBanner`、`playCoinFlip`）
- 修改：`js/controller.js:32`（构造函数订阅 `onCoinFlip`）
- 测试：`test/status-effects.test.js` 追加数据断言

- [ ] **步骤 1：编写失败的测试**

```js
import { THEMED_ACTION_VISUALS } from "../js/effects.js";

test("10 个新动作都有特效映射且键唯一", () => {
    const actions = ["ignite", "venom", "bleed", "curse", "exile", "paralyze", "detonate", "infinity", "domain", "gamble"];
    const visuals = actions.map(a => THEMED_ACTION_VISUALS[a]);
    for (const v of visuals) assert.ok(v && v.motion && v.color, "缺少视觉定义");
    assert.equal(new Set(visuals.map(v => v.motion + v.color)).size, actions.length);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL（`THEMED_ACTION_VISUALS` 未导出）

- [ ] **步骤 3：实现**

`effects.js` 追加（数据 + 行为）：

```js
export const THEMED_ACTION_VISUALS = {
    ignite:   { label: "IGNITE", motion: "rise", color: "#ff7a3c", accent: "#ffd36b" },
    venom:    { label: "VENOM", motion: "fall", color: "#9d6bff", accent: "#7dffa8" },
    bleed:    { label: "BLEED", motion: "sweep", color: "#ff4f70", accent: "#ff9b8a" },
    curse:    { label: "CURSE", motion: "shield", color: "#8c5cff", accent: "#2a1740" },
    exile:    { label: "EXILE", motion: "void", color: "#7b5cff", accent: "#1b1035" },
    paralyze: { label: "STUN", motion: "impact", color: "#ffe06b", accent: "#70dcff" },
    detonate: { label: "DETONATE", motion: "impact", color: "#ff5d67", accent: "#ffb04a" },
    infinity: { label: "INFINITY", motion: "shield", color: "#d7e6ff", accent: "#8fb8ff" },
    domain:   { label: "DOMAIN", motion: "wave", color: "#cfd6ff", accent: "#8f7cff" },
    gamble:   { label: "GAMBLE", motion: "spiral", color: "#ffd76b", accent: "#fff6c9" },
};

function themedVisualKey(effect) {
    if (effect?.type === "themedAction" && THEMED_ACTION_VISUALS[effect.action]) return effect.action;
    return ruleVisualKey(effect?.type);
}
```

`resolveRuleTargets(effect, origin, ownerIndex)` 第一行改为：

```js
const key = themedVisualKey(effect);
```

`playRuleDrivenEffect` 中：`RULE_VISUALS[key]` 改为 `RULE_VISUALS[key] || THEMED_ACTION_VISUALS[key]`；并在循环前追加：

```js
if (effect.type === "themedAction" && effect.skillName) showSkillBanner(effect.skillName, effect.skillLabel, effect.action);
if (effect.type === "themedAction" && effect.action === "domain") playDomainCinematic(effect.params?.field, cardOrEffect?.name, ownerIndex);
```

新增函数：

```js
export function showSkillBanner(skillName, label = "主动技", action = "") {
    if (!isBrowser || !skillName) return;
    const banner = document.createElement("div");
    banner.className = "skill-banner";
    banner.innerHTML = `<small>【${label}】</small><strong>${skillName}</strong>`;
    (document.querySelector(".battle-screen") || document.body).appendChild(banner);
    removeAfter(banner, 950);
}

export function playCoinFlip(result = "pending") {
    if (!isBrowser) return;
    const coin = document.createElement("div");
    coin.className = `coin-flip ${result}`;
    coin.innerHTML = `<div class="coin-face"></div><strong>${result === "heads" ? "正面" : result === "tails" ? "反面" : "抛硬币"}</strong>`;
    (document.querySelector(".battle-screen") || document.body).appendChild(coin);
    removeAfter(coin, 950);
}
```

`controller.js` 构造函数（第 32 行 `constructor(gameState, engine, ui) {` 内）追加：

```js
this.engine?.eventBus?.on?.("onCoinFlip", ({ result }) => playCoinFlip(result));
```

并在文件顶部 import 中补 `playCoinFlip`。

`css/style.css` 追加：

```css
.skill-banner { position:absolute; left:50%; top:12%; transform:translateX(-50%); z-index:206; display:grid; justify-items:center; pointer-events:none; animation:skillBannerIn .9s ease-out forwards; }
.skill-banner small { color:rgba(255,255,255,.75); letter-spacing:.4em; font-size:11px; }
.skill-banner strong { color:#fff; font-size:clamp(18px,2.6vw,32px); letter-spacing:.1em; text-shadow:0 0 18px rgba(255,215,107,.8); }
.coin-flip { position:fixed; left:50%; top:38%; transform:translate(-50%,-50%); z-index:272; display:grid; justify-items:center; gap:8px; pointer-events:none; animation:coinFlipSpin .9s ease-out forwards; }
.coin-face { width:74px; height:74px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #fff6c9, #d9a441 60%, #7a5a1a 100%); box-shadow:0 0 30px rgba(255,215,107,.85); }
.coin-flip.tails .coin-face { background:radial-gradient(circle at 35% 30%, #e8f1ff, #8fa8c9 60%, #40506b 100%); }
.coin-flip strong { color:#fff; letter-spacing:.3em; }
@keyframes skillBannerIn { 0%{opacity:0; transform:translateX(-50%) translateY(-14px);} 15%{opacity:1;} 80%{opacity:1;} 100%{opacity:0; transform:translateX(-50%) translateY(-4px);} }
@keyframes coinFlipSpin { 0%{opacity:0; transform:translate(-50%,-50%) rotateY(0) scale(.7);} 20%{opacity:1;} 70%{transform:translate(-50%,-50%) rotateY(720deg) scale(1);} 100%{opacity:0; transform:translate(-50%,-50%) rotateY(900deg) scale(1);} }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS

- [ ] **检查点：** 浏览器打开 `http://127.0.0.1:8091` 打一局，任一新动作能看到横幅与粒子；控制台无报错。

---

### 任务 12：领域展开演出 + 音效

**文件：**
- 修改：`js/effects.js`（`playDomainCinematic`、`DOMAIN_CINEMATICS` 导出）
- 修改：`js/audio.js`（10 个新音）
- 修改：`css/style.css`（领域 overlay / chip）
- 测试：`test/status-effects.test.js` 追加数据断言

- [ ] **步骤 1：编写失败的测试**

```js
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test test/status-effects.test.js`
预期：FAIL

- [ ] **步骤 3：实现**

`effects.js` 追加：

```js
export const DOMAIN_CINEMATICS = {
    wuji:      { title: "領域展開 · 無量空處", subtitle: "五条悟", color: "#cfd6ff", accent: "#0c0d1a", style: "information" },
    za_warudo: { title: "スタープラチナ・ザ・ワールド", subtitle: "空条承太郎", color: "#ffe06b", accent: "#2b1f00", style: "clock" },
    rojin:     { title: "破壊殺・羅針", subtitle: "猗窩座", color: "#ff5d67", accent: "#2a0a0c", style: "compass" },
    ongaku:    { title: "苍穹音浪", subtitle: "初音未来", color: "#63ddff", accent: "#3a0b4f", style: "stage" },
};

export function playDomainCinematic(fieldId, cardName = "", ownerIndex = 0) {
    if (!isBrowser) return;
    const def = DOMAIN_CINEMATICS[fieldId] || DOMAIN_CINEMATICS.wuji;
    playSound("domain");
    playTimeSlowEffect(700);
    playEnergyPulse(def.color, "rgba(255,255,255,.35)");
    const overlay = document.createElement("div");
    overlay.className = `domain-overlay domain-${def.style}`;
    overlay.style.setProperty("--domain-color", def.color);
    overlay.style.setProperty("--domain-accent", def.accent);
    overlay.innerHTML = `<div class="domain-vignette"></div><div class="domain-title"><small>${def.subtitle}</small><strong>${def.title}</strong></div>`;
    (document.querySelector(".battle-screen") || document.body).appendChild(overlay);
    removeAfter(overlay, 1700);
    if (def.style === "clock") playChromaticBurst();
    if (def.style === "stage") playParticleRain(def.color, 24);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) overlay.classList.add("reduced");
    // 领域存续徽记
    const chip = document.createElement("div");
    chip.className = "domain-chip";
    chip.textContent = def.title;
    chip.style.setProperty("--domain-color", def.color);
    document.getElementById("battle-screen")?.appendChild(chip);
    removeAfter(chip, 20000);
}
```

`audio.js` 的 `playSound` switch 追加：

```js
case "ignite": noise(ctx, { duration: 0.32, volume: 0.24, filterType: "bandpass", frequency: 900, sweepTo: 2400 }); tone(ctx, { type: "sawtooth", from: 160, to: 60, duration: 0.3, volume: 0.18 }); break;
case "venom": [0, 0.1, 0.2].forEach((offset, i) => tone(ctx, { type: "sine", from: (1400 - i * 260) * pitch, to: (700 - i * 120) * pitch, duration: 0.12, start: offset, volume: 0.14 })); noise(ctx, { duration: 0.3, volume: 0.12, filterType: "highpass", frequency: 1800 }); break;
case "bleed": noise(ctx, { duration: 0.14, volume: 0.28, filterType: "highpass", frequency: 2600, sweepTo: 800 }); break;
case "curse": tone(ctx, { type: "sawtooth", from: 420, to: 90, duration: 0.5, volume: 0.2 }); break;
case "exile": tone(ctx, { type: "sine", from: 180, to: 1100, duration: 0.45, volume: 0.2 }); noise(ctx, { duration: 0.4, volume: 0.16, filterType: "bandpass", frequency: 500, sweepTo: 2600 }); break;
case "paralyze": [0, 0.05, 0.1].forEach(offset => tone(ctx, { type: "square", from: 2200, to: 1500, duration: 0.06, start: offset, volume: 0.12 })); break;
case "detonate": noise(ctx, { duration: 0.5, volume: 0.34, filterType: "lowpass", frequency: 1600, sweepTo: 120 }); tone(ctx, { type: "sine", from: 180, to: 40, duration: 0.45, volume: 0.3 }); break;
case "domain": tone(ctx, { type: "sine", from: 110, to: 220, duration: 1.0, volume: 0.22 }); tone(ctx, { type: "triangle", from: 330, to: 440, duration: 1.0, start: 0.08, volume: 0.14 }); break;
case "coin": [0, 0.07, 0.14].forEach((offset, i) => tone(ctx, { type: "triangle", from: (1200 + i * 300) * pitch, to: (900 + i * 200) * pitch, duration: 0.1, start: offset, volume: 0.16 })); break;
case "statusTick": tone(ctx, { type: "square", from: 500 * pitch, to: 320 * pitch, duration: 0.09, volume: 0.1 }); break;
```

`css/style.css` 追加：

```css
.domain-overlay { position:fixed; inset:0; z-index:266; pointer-events:none; animation:domainIn 1.7s ease-out forwards; }
.domain-overlay .domain-vignette { position:absolute; inset:0; background:radial-gradient(ellipse at center, transparent 26%, var(--domain-accent) 100%); }
.domain-overlay .domain-title { position:absolute; left:50%; top:34%; transform:translate(-50%,-50%); display:grid; justify-items:center; gap:6px; text-align:center; }
.domain-overlay .domain-title small { color:var(--domain-color); letter-spacing:.5em; font-size:12px; }
.domain-overlay .domain-title strong { color:#fff; font-size:clamp(26px,4.6vw,58px); letter-spacing:.18em; text-shadow:0 0 26px var(--domain-color); }
.domain-overlay.reduced { animation-duration:.4s; }
.domain-overlay.reduced .domain-title strong { font-size:clamp(20px,3vw,36px); }
.domain-information .domain-vignette { background:linear-gradient(180deg, rgba(5,5,12,.85), rgba(5,5,12,.4)); }
.domain-clock .domain-vignette { background:repeating-conic-gradient(from 0deg, rgba(255,224,107,.08) 0deg 6deg, transparent 6deg 30deg); }
.domain-compass .domain-vignette { background:repeating-conic-gradient(from 0deg, rgba(255,93,103,.12) 0deg 4deg, transparent 4deg 24deg); }
.domain-stage .domain-vignette { background:linear-gradient(180deg, rgba(99,221,255,.18), transparent 55%, rgba(255,127,225,.16)); }
.domain-chip { position:absolute; right:14px; top:64px; z-index:206; padding:4px 10px; border:1px solid var(--domain-color); border-radius:999px; color:var(--domain-color); font-size:11px; letter-spacing:.18em; background:rgba(8,8,16,.55); pointer-events:none; animation:domainChipIn .5s ease-out; }
@keyframes domainIn { 0%{opacity:0;} 12%{opacity:1;} 78%{opacity:1;} 100%{opacity:0;} }
@keyframes domainChipIn { from{opacity:0; transform:translateY(-8px);} to{opacity:1; transform:none;} }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test test/status-effects.test.js`
预期：PASS
运行：`npm run check`
预期：全部模块语法通过

- [ ] **检查点：** 浏览器实测四张领域卡（五条悟无量空处 / 承太郎 / 猗窝座罗针 / 初音苍穹音浪），确认全屏演出与领域 chip；`onStatus` 相关控制台无错误。

---

### 任务 13：全量回归 + 平衡冒烟 + 打包重启验收

**文件：** 无代码改动（除非回归发现问题）

- [ ] **步骤 1：前端全量检查**

运行（`static`）：`npm run check && npm test`
预期：0 失败

- [ ] **步骤 2：规则测试与不变量**

运行（`SekaiGame`）：`node --test src/test/js/*.test.js`
预期：全部 PASS（含 pilot-roster、effect-diversity、premium 等）
运行（`static`）：`npm run fuzz && npm run selftest`
预期：无异常

- [ ] **步骤 3：平衡对比**

运行（`static`）：`npm run balance`
预期：输出各卡组胜率；与改动前对比无某个取向 >75% 或 <25%（若有，回调 §7 数值并同步规格/测试）。

- [ ] **步骤 4：重新打包并重启服务**

```powershell
# 停止占用 8091 的旧进程
$p = Get-NetTCPConnection -LocalPort 8091 -State Listen -ErrorAction SilentlyContinue
if ($p) { Stop-Process -Id $p.OwningProcess -Force }
# 编译（环境变量缺失会启动失败：生成临时 JWT 密钥）
$env:JAVA_HOME = "C:\Program Files\Java\latest\jdk-21"
Set-Location "D:\Sekai_two\memory-16\SekaiGame"
mvn clean package -DskipTests
```

启动（带 JWT 环境变量，后台）：

```powershell
$env:APP_JWT_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
Start-Process -FilePath "C:\Program Files\Java\latest\jdk-21\bin\java.exe" `
  -ArgumentList "-jar","target\sekai-game-1.0.0.jar" `
  -WorkingDirectory "D:\Sekai_two\memory-16\SekaiGame" -WindowStyle Hidden `
  -RedirectStandardOutput "target\server.out.log" -RedirectStandardError "target\server.err.log"
```

- [ ] **步骤 5：验证新资源已上线**

```powershell
$r = Invoke-WebRequest "http://127.0.0.1:8091/js/status-effects.js" -UseBasicParsing -TimeoutSec 10
"HTTP $($r.StatusCode) | $($r.RawContentLength) bytes"
```

预期：HTTP 200（新模块已打进 jar）；`themed-effects.js` 大小较旧版增加。

- [ ] **步骤 6：用户验收**

用户在 `http://127.0.0.1:8091`（或局域网 `192.168.101.13:8091`）试玩：
1. 30 张试点卡任意一张：技能横幅 + 对应特效 + 状态标签层数；
2. 灼烧→引爆连锁 / 剧毒→引爆扩散 / 净化清诅咒；
3. 四张领域卡的全屏领域演出；
4. 善逸/乐奈抛硬币两种结果都出现（多打几局）。

---

## 自检记录

- **规格覆盖：** §3 数据模型→任务 1；§4.1-4.10 动作→任务 2-8；§5 互动→任务 2/6；§7 名单→任务 9；§8 平衡→任务 13；§9 测试→任务 1-9/13；§10 演出→任务 11-12；§11 不做项已排除。
- **类型一致性：** `applyAilment/ailmentStacks/ailmentValue/removeAilment/cleanseAilments/tickAilments/activeDomain/DOMAIN_DEFS` 在任务 1 定义、后续任务引用一致；`resolveThemedTurnEnd(engine, endingPlayer)` 签名在任务 2 起统一。
- **已知风险：** 任务 9 的候选池顺序依赖 catalog 卡序，需按"实现者注意"的脚本核对；任务 13 的平衡若超标，只调数值并同步 §7 表与 pilot-roster 断言。
