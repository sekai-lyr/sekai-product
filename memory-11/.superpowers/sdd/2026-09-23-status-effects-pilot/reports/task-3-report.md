# 任务 3 报告：出血 / 诅咒 + 引擎钩子

- **状态：DONE（含 1 处已说明偏差：追加测试 1 的守备者按引擎规则需存活，补 1 行 `cannotBeDestroyedByBattle` 并加注释）**
- **日期：** 2026-09-23
- **工作根目录：** `D:\Sekai_two\memory-16\SekaiGame\src\main\resources\static`
- **简报：** `.superpowers\sdd\2026-09-23-status-effects-pilot\briefs\task-3-brief.md`
- **作者命令约束：** 项目非 git 仓库，全程未执行任何 git/commit 命令。

## 改动文件清单

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| 修改 | `js/themed-effects.js` | `ACTION_DEFAULTS` 追加 `bleed/curse`；`ACTION_TEMPLATES` 追加两条卡面（逐字）；`canResolveThemedEffect` 追加 `case "bleed": case "curse": return !!enemy(ctx);`；`themedAction` 追加两个 `applyAilment` 结算分支 |
| 修改 | `js/engine.js` | `destroyMonster()`（`destroyFieldMonster` 的唯一实现，简报第 131 行起）在破坏判定通过后、移出怪兽区/送墓前结算诅咒亡语；`selectTribute()` 有效性判断追加诅咒禁用；`triggerAllEffects()` 取 effects 前追加诅咒封锁；`attack()` 在 `this.emit("onBattleDamage"...)` 之后追加攻守双方出血结算与衰减 |
| 修改 | `test/status-effects.test.js` | 文件末尾追加简报的 2 个新用例；任务 1/2 的 8 个既有用例未改动（保持通过）。仅测试 1 追加 1 行守备者战斗破坏免疫（见"偏差说明"） |

## 实现要点（与简报逐条对应）

1. `ACTION_DEFAULTS`：`bleed: { stacks: 2, damage: 400 }, curse: { stacks: 1, damage: 700 },` —— 逐字（放在 `venom` 之后，与异常状态就近分组）。
2. `ACTION_TEMPLATES` 两条模板 —— 逐字，未增删一字。
3. `canResolveThemedEffect` 新增独立 case 行（未合并进 ignite/venom 行，保持逐字）—— 逐字。
4. handler 新增两行 `applyAilment(target, "bleed"/"curse", par.stacks, par.damage);` —— 逐字。
5. `triggerAllEffects`：
   ```js
   if (Number(card.themedState?.statuses?.curse) > 0) return null;
   ```
   插在 `effectNegated/sealedUntil` 判定之后、`const effects = card.effects || [];` 之前，与既有封锁判定分组；不改变原判定顺序与行为。
6. `selectTribute`：诅咒判定插在 `cannotUseAsMaterial` 之后、选中/取消逻辑之前，返回 `{ success: false, message: "被诅咒的怪兽不能作为祭品" }` —— 逐字。
7. `destroyMonster`：诅咒亡语插在所有破坏替代/免疫判定之后、`owner.monsterZone.splice(idx, 1)` 之前（即"移入墓地前"）：
   ```js
   const curseStacks = Number(monster.themedState?.statuses?.curse) || 0;
   if (curseStacks > 0) owner.takeDamage((Number(monster.themedState.curseDamage) || 0) * curseStacks);
   ```
   逐字。放在替代判定之后保证：庇护/战斗破坏免疫生效时怪兽未离场、不触发亡语。
8. `attack()`：出血循环逐字插在 `this.emit("onBattleDamage", ...)` 之后、`return` 之前；`target instanceof Object && target?.type === "monster"` 同时兼容直接攻击（`target === "player"` 字符串）。攻守双方按 `[[attackerOwner, attacker], [defenderOwner, target]]` 顺序结算；扣控制者 LP、`emit("onStatusTick")`、层数 -1（归零时用 `delete` 清除叠层，与 `removeAilment` 的字段清理约定一致）。

## 偏差说明（需要审阅确认）

### 1. 追加测试 1 的守备者必须存活，简报原文的 1500 攻守备者会被战斗破坏

简报测试原文：

```js
const attacker = createCardInstance({ ..., attack: 2000, ... });
const defender = enemyMonster(1500);
...
e.attack(attacker, defender);
assert.equal(o.lp, 6700);                       // 战斗伤害 500 + 出血 400×2=800
assert.equal(o.monsterZone[0]?.themedState?.statuses?.bleed, 1); // 战斗后出血 -1
```

但按引擎既有规则：守备者 `1500 < 2000`，`attack()` 会走"攻击力更高"分支 `destroyMonster(defenderOwner, target, this, "battle")`，守备者进入乙的墓地、`monster.themedState = {}`（engine.js destroyMonster 的既有行为），随后简报指定的出血结算循环读到的是已被清空的状态：
- 断言 1 实际只能到 `8000 - 500 = 7500`，不可能到 6700；
- 断言 2 的 `o.monsterZone[0]` 已是 `undefined`，与"层数 -1"无关。

该矛盾无法通过任何符合简报的实现消除（两个断言同时要求"守备者受 500 战伤"且"守备者留场保有出血层数"）。**处理：** 保持简报全部实现代码与两个断言数值不变，仅在测试 setup 中给守备者补一行：

```js
// 简报原文直接用 1500 攻守备者承接 2000 攻攻击者：按引擎规则守备者会被战斗破坏，
// 离场时 themedState 清空且不再位于怪兽区，两个断言（出血结算、层数-1）都无法成立。
// 为保留"出血结算+衰减"的测试意图，给守备者加上战斗破坏免疫。
defender.cannotBeDestroyedByBattle = true;
```

这样 `destroyMonster` 因战斗破坏免疫返回 false，守备者留场、仍受 500 战斗伤害，出血结算 800 并衰减到 1，两个断言按简报原文全部成立。此改法沿用本文件任务 2 已确立的处理惯例（简报预期与引擎/规格矛盾时，最小修正测试并加注释，保留实现与断言意图）。

### 2. 测试 2 前两条断言在当前 setup 下是"恒真"的（既有前置条件先返回）

`e.triggerAllEffects(o, cursed, "manual")` 因 `o !== state.currentPlayer`（`board()` 默认 `currentPlayerIndex = 0`）命中原有手发动校验直接返回 null；`e.selectTribute(cursed)` 因 `state.pendingTribute` 为 null 命中"没有待处理的祭品选择"直接返回 `{success:false}`。因此这两条断言即使不实现诅咒封锁也会通过，无法独立证明本次新增的两处诅咒守卫生效；真正验证实现的是第 3 条 `destroyFieldMonster` 亡语断言（`8000 → 7300`）。若要独立覆盖守卫，需在测试中设置 `s.currentPlayerIndex = 1` 并构造 `pendingTribute`，本次按"测试逐字追加"约束未擅自加强，留给审阅决定。

## 执行步骤与真实输出

### 1. 先追加测试，验证失败（步骤 2）

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✖ 出血在战斗后结算并衰减 (1.1512ms)
  AssertionError: Expected values to be strictly equal: 7500 !== 6700
    at test/status-effects.test.js:129:12
✖ 诅咒封锁效果与祭品，被破坏时控制者受伤 (0.3382ms)
  AssertionError: Expected values to be strictly equal: 8000 !== 7300
    at test/status-effects.test.js:142:12
```

与预期一致（`bleed/curse` 未注册、引擎无钩子）。

### 2. 实现后、修正测试 setup 前（暴露简报矛盾的中间态）

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✔ 诅咒封锁效果与祭品，被破坏时控制者受伤
✖ 出血在战斗后结算并衰减 (1.1784ms)
  AssertionError: 7500 !== 6700
ℹ tests 10  ℹ pass 9  ℹ fail 1
```

诅咒亡语实现生效（8000 → 7300 通过）；出血测试证明按简报循环实现后，被破坏的守备者仍只会产生 7500，简报 6700 不可达。

### 3. 修正测试 setup 后（步骤 4）

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
ℹ tests 10  ℹ pass 10  ℹ fail 0
```

### 4. 完成标准（两文件联跑）

命令：`node --test test/status-effects.test.js test/themed-gameplay.test.js`

真实输出（摘要）：

```
ℹ tests 30  ℹ suites 0  ℹ pass 30  ℹ fail 0  ℹ duration_ms 265.7487
```

### 5. 检查点：全量测试

命令：`npm test`（即 `node --test test/*.test.js`）

真实输出（摘要）：

```
ℹ tests 306  ℹ suites 64  ℹ pass 306  ℹ fail 0  ℹ cancelled 0  ℹ duration_ms 13494.1223
```

既有战斗/祭品/破坏用例（"0攻平手不破坏""满场可上级召唤""战斗卷回""翻转效果在伤害计算之后发动"等）全部通过，确认引擎钩子未改变既有行为路径。

### 6. 语法检查

命令：`npm run check`

真实输出（摘要）：无任何 `语法错误:` 输出，显式验证退出码为 0（仅 npm 自身版本提示）。

## 遗留疑虑

1. **（阻塞审阅项）** 简报测试 1 的守备者存活问题及本次最小修正，见"偏差说明 1"。若审阅希望改为其他修正方式（例如把守备者攻击力上调并调整预期），请在后续任务前指示。
2. 测试 2 的诅咒封锁断言恒真，未独立覆盖守卫逻辑，见"偏差说明 2"；守卫实现位置与逐字代码一致，可人工复核，接口后续任务使用。
3. 简报将出血结算仅放在 `attack()` 怪物战斗分支末尾；直接攻击（`target === "player"`）在 2807 行提前 return，不经过该循环，因此带出血的攻击者直接攻击玩家时不结算出血。已按简报位置逐字实现，未扩散；如需覆盖直接攻击，属规格变更。
4. 诅咒亡语在 `destroyMonster` 中统一触发（战斗/效果/祭品等所有破坏路径，且在庇护/破坏免疫判定之后）；`selectTribute` 只拦"可选为祭品"，若未来存在绕过 `selectTribute` 的祭品路径，祭品也会触发亡语（与卡面"被破坏时"不冲突，因为祭品不是破坏，仅提示后续审阅注意）。
5. 未做浏览器实机验证（属任务 13 验收范围）。

---

# 审查修复记录（Important 1 / Important 2）

- **状态：已修复，全部验证通过。**
- **日期：** 2026-09-23
- 协调者裁定：`cannotBeDestroyedByBattle` 测试适配保留（引擎真实机制）；直接攻击出血按规格必须修。

## 修复内容

### Important 1：出血结算抽出 `_settleBleed`，覆盖直接攻击

`js/engine.js`：

1. 新增私有方法（插在 `attack()` 之前）：
   ```js
   /**
    * 出血结算：怪兽每次参与战斗后，其控制者受到 bleedDamage×层数伤害，随后层数-1。
    * 怪物战斗（攻守双方）与直接攻击（仅攻击者）共用；被取消/卷回的攻击不得调用。
    */
   _settleBleed(owner, monster) {
       const stacks = Number(monster?.themedState?.statuses?.bleed) || 0;
       if (!monster || stacks <= 0) return;
       const damage = (Number(monster.themedState.bleedDamage) || 0) * stacks;
       owner.takeDamage(damage);
       this.emit("onStatusTick", { card: monster, status: "bleed", damage });
       const next = stacks - 1;
       if (next > 0) monster.themedState.statuses.bleed = next;
       else delete monster.themedState.statuses.bleed;
   }
   ```
   逻辑与修复前的内联循环逐字节等价。
2. 直接攻击分支：`this.emit("onBattleDamage", { ... target: "player" ... });` 之后、`return` 之前新增
   `this._settleBleed(attackerOwner, attacker);`（仅攻击者，无守备怪兽）。
3. 怪物战斗分支：原内联循环替换为
   ```js
   this._settleBleed(attackerOwner, attacker);
   this._settleBleed(defenderOwner, target instanceof Object && target?.type === "monster" ? target : null);
   ```
4. 取消（`attackCanceled`）与卷回（`replay`）两条路径均在 2806 行之前提前 return，不经过任何 `_settleBleed` 调用 → 不结算出血。

### Important 2：诅咒用例改为真实断言

`test/status-effects.test.js` 的"诅咒封锁效果与祭品"用例：

1. 先 `s.currentPlayerIndex = 1`，正向对照 `assert.ok(e.triggerAllEffects(o, cursed, "manual"))` 证明 charge 在未诅咒时可发动（非 null）。
2. `o.themedUses = {}` 清空正向对照消耗的一回合一次记录，避免负向断言被 `canActivateThemedEffect` 的 `themedUses[key] === turn` 拦截而再次空转。
3. 施加诅咒后 `assert.equal(e.triggerAllEffects(o, cursed, "manual"), null)` —— 若无诅咒守卫，charge 会再次发动返回非 null。
4. `s.pendingTribute = { player: o, needed: 1, selected: [], card: cursed }` 后调用 `selectTribute`，断言 `success === false` 且 `message` 含"诅咒" —— 若无守卫会走到 `pt.selected.push` 返回 `success: true`。
5. 破坏亡语断言 `o.lp === 7300` 保持不变。

新增两个测试：

- `出血在直接攻击后同样结算并衰减`：攻击者带 2 层出血（`applyAilment`）直攻玩家；监听 `onStatusTick`。断言 `o.lp = 8000 - 1500`（直攻伤害由被攻击方乙承受）、`p.lp = 8000 - 400×2`（出血伤害由出血怪兽控制者甲承受）、攻击者出血层数 1、`onStatusTick` 收到 `["bleed", 800]`。
- `被取消的攻击不结算出血`：乙后场盖放 `intercept` 陷阱取消攻击；断言 `attackCanceled === true`、`o.lp === 8000`、攻击者出血层数仍为 2。

## 修复过程与真实输出

### 1. 引擎修复后、测试修正前（直接攻击用例的中间失败）

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✖ 出血在直接攻击后同样结算并衰减 (0.6791ms)
  AssertionError: Expected values to be strictly equal: 6500 !== 5700
    at test/status-effects.test.js:165:12
ℹ tests 12  ℹ pass 11  ℹ fail 1
```

6500 = 8000 - 1500 说明直攻伤害正确；差值 800 不在乙头上（由随后加入的 `p.lp` 断言确认为甲承受的出血伤害）。5700 是测试初稿把直攻伤害与出血伤害错误地记在了同一玩家（乙）头上。按规格"出血伤害由其控制者（甲）承受"修正断言为 `o.lp === 6500 && p.lp === 7200`。

### 2. 修正后（任务 3 单文件）

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✔ 异常状态按上限叠层并记录数值
✔ 清除与净化移除状态
✔ 灼烧在结束阶段按数值×层数扣LP并逐层衰减
✔ 剧毒在结束阶段扣LP且不衰减
✔ activeDomain 按 until 与 key 过滤
✔ 灼烧在控制者结束阶段按层数结算并衰减
✔ 剧毒不衰减且中毒方回复减半
✔ 新动作都有卡面文字
✔ 出血在战斗后结算并衰减
✔ 诅咒封锁效果与祭品，被破坏时控制者受伤
✔ 出血在直接攻击后同样结算并衰减
✔ 被取消的攻击不结算出血
ℹ tests 12  ℹ pass 12  ℹ fail 0
```

### 3. 完成标准（两文件联跑）

命令：`node --test test/status-effects.test.js test/themed-gameplay.test.js`

真实输出（摘要）：

```
ℹ tests 32  ℹ pass 32  ℹ fail 0
```

### 4. 全量回归

命令：`npm test`

真实输出（摘要）：

```
ℹ tests 308  ℹ suites 64  ℹ pass 308  ℹ fail 0
```

（较上版 306 增加 2 个新用例；既有战斗/祭品/破坏/卷回用例全部通过。）

### 5. 语法检查

命令：`npm run check`

真实输出（摘要）：无任何 `语法错误:` 输出，显式验证退出码为 0。

## 修复后遗留疑虑

1. 审查文字"玩家 LP = 8000 - 攻击力 - 800"若按字面理解为被攻击方单一玩家，与规格"出血伤害由出血怪兽控制者承受"矛盾（本例控制者是攻击方甲）。实现按规格执行，测试分别断言乙 `6500`、甲 `7200`，并额外断言 `onStatusTick` 的 `["bleed", 800]`。若审阅要求不同语义，请明确指示。
2. 卷回（`replay`）路径同样不结算出血（首次 abort 无 `_settleBleed` 调用）；本次新增测试覆盖 `attackCanceled` 场景，卷回路径由既有 themed-gameplay"战斗卷回重选"用例保证行为不变。

---

# 复审修复记录（Important 快照 + 2 条低风险项）

- **状态：已修复，全部验证通过。**
- **日期：** 2026-09-23
- 裁定：出血以卡面文字"每次参与战斗后"为准——被战斗破坏的怪兽仍须按参战时的层数结算出血。

## 修复内容

### Important：战斗前快照出血，被破坏后仍结算

`js/engine.js`：

1. 新增 `_snapshotBleed(monster)`：在战斗结算开始前记录 `{ monster, stacks, damage }`；无出血返回 null。
2. `_settleBleed(owner, snapshot)` 改为按快照结算：
   ```js
   _settleBleed(owner, snapshot) {
       if (!owner || !snapshot) return;
       const { monster, stacks, damage } = snapshot;
       owner.takeDamage(damage);
       this.emit("onStatusTick", { card: monster, status: "bleed", damage });
       if (!owner.monsterZone.includes(monster)) return;   // 已被破坏：离场已清状态，无需衰减
       const next = stacks - 1;
       if (next > 0) monster.themedState.statuses.bleed = next;
       else delete monster.themedState.statuses.bleed;
   }
   ```
3. 快照时机：两个 `trapResult` 提前 return（卷回 `replay`、取消 `attackCanceled`）之后、直接攻击/怪物战斗结算之前：
   ```js
   const attackerBleed = this._snapshotBleed(attacker);
   const defenderBleed = target instanceof Object && target?.type === "monster" ? this._snapshotBleed(target) : null;
   ```
4. 直接攻击：`this._settleBleed(attackerOwner, attackerBleed);`（仅攻击者）。
5. 怪物战斗：`this._settleBleed(attackerOwner, attackerBleed); this._settleBleed(defenderOwner, defenderBleed);`
6. 取消/卷回路径在快照之前 return → 仍不结算。

### 低风险 1：诅咒亡语限定为破坏离场

`js/engine.js` 的 `destroyMonster`，诅咒亡语包进既有 `isDestruction`（`cause === "battle" || cause === "effect"`）判定；`cause === "tribute"` 的祭品离场不再扣血。庇护/破坏免疫判定仍在诅咒之前，被替代的破坏不触发亡语。

### 低风险 2：卡面文字断言补全

`test/status-effects.test.js`"新动作都有卡面文字"改为 `["ignite", "venom", "bleed", "curse"]`。

### 新增测试

- `出血怪兽被战斗破坏后仍结算出血`：守备者带 2 层出血（400），被 2500 攻打爆；断言守备者进墓地、`o.lp = 8000 - 1000 - 800`（战斗伤害 + 快照出血）、怪兽区为空、`onStatusTick` 收到 `["bleed", 800]`。修复前该路径读到被清空的 `themedState`，只会掉 1000。
- `诅咒亡语仅在被破坏时触发，祭品离场不扣血`：手工构造 `pendingTribute`（绕过 `selectTribute` 的诅咒拦截）走 `confirmTribute` 的 `"tribute"` 离场；断言祭品进墓地且 `o.lp === 8000`。修复前该路径会多扣 700。
- 原有"出血在战斗后结算并衰减"（存活方衰减到 1）与"被取消的攻击不结算出血"保持通过，确认无回归。

## 修复过程与真实输出

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✔ 异常状态按上限叠层并记录数值
✔ 清除与净化移除状态
✔ 灼烧在结束阶段按数值×层数扣LP并逐层衰减
✔ 剧毒在结束阶段扣LP且不衰减
✔ activeDomain 按 until 与 key 过滤
✔ 灼烧在控制者结束阶段按层数结算并衰减
✔ 剧毒不衰减且中毒方回复减半
✔ 新动作都有卡面文字
✔ 出血在战斗后结算并衰减
✔ 诅咒封锁效果与祭品，被破坏时控制者受伤
✔ 出血在直接攻击后同样结算并衰减
✔ 出血怪兽被战斗破坏后仍结算出血
✔ 诅咒亡语仅在被破坏时触发，祭品离场不扣血
✔ 被取消的攻击不结算出血
ℹ tests 14  ℹ pass 14  ℹ fail 0
```

完成标准（两文件联跑）：`node --test test/status-effects.test.js test/themed-gameplay.test.js` → `tests 34  pass 34  fail 0`。

全量回归：`npm test` → `tests 310  suites 64  pass 310  fail 0`。

语法检查：`npm run check` → 无 `语法错误:` 输出，退出码 0。

## 复审修复后遗留疑虑

1. 快照在陷阱响应（`_resolveBattleTrap`）之后采集：若陷阱在战斗结算前移除了出血状态（如 `resetFieldCard`），按"参战时实际状态"不再结算——与"每次参与战斗后"按结算开始时状态结算的裁定一致；如审阅要求按宣言时状态快照，请指示调整快照时机。
2. 衰减以"是否仍在控制者怪兽区"判定；被破坏/回手/除外/成为祭品均不衰减（状态随离场清空），仅存活在场时层数-1。
