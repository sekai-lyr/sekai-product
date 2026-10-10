# 任务 2 报告：灼烧 / 剧毒 + 回合末结算 + 回复减半

- **状态：DONE（含 1 处已说明偏差：追加测试的 2 个预期数值按规格修正）**
- **日期：** 2026-09-23
- **工作根目录：** `D:\Sekai_two\memory-16\SekaiGame\src\main\resources\static`
- **简报：** `.superpowers\sdd\2026-09-23-status-effects-pilot\briefs\task-2-brief.md`
- **作者命令约束：** 项目非 git 仓库，全程未执行任何 git/commit 命令。

## 改动文件清单

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| 修改 | `js/themed-effects.js` | 顶部按简报逐字新增 status-effects 导入；`ACTION_DEFAULTS` 追加 `ignite/venom`；`ACTION_TEMPLATES` 追加两条卡面（逐字）；`canResolveThemedEffect` 追加 `case "ignite": case "venom": return !!enemy(ctx);`；`themedAction` 追加两个 `applyAilment` 结算分支；`resolveThemedTurnEnd` 签名改为 `(engine, endingPlayer)` 并只新增 `tickAilments` 调用，其余既有清理逻辑原样保留 |
| 修改 | `js/engine.js` | `endTurn()` 第 1924 行改为 `resolveThemedTurnEnd(this, player);` |
| 修改 | `js/model.js` | `Player.heal` 接入剧毒减半钩子（逐字使用简报的两行代码，保留原有 `this.lp + heal`） |
| 修改 | `test/status-effects.test.js` | 在文件末尾追加简报的 3 个新用例（逐字），仅 2 个预期数值按规格修正（见下"偏差说明"）；任务 1 的 5 个既有用例未改动 |

## 实现要点（与简报逐条对应）

1. `import { AILMENTS, DOMAIN_DEFS, applyAilment, ailmentStacks, ailmentValue, removeAilment, cleanseAilments, tickAilments, activeDomain } from "./status-effects.js";` —— 逐字。
2. `ACTION_DEFAULTS` 追加 `ignite: { stacks: 2, damage: 500 }, venom: { stacks: 2, damage: 450 },` —— 逐字（放在 `bomb` 之后，与毒印/爆破就近分组）。
3. `ACTION_TEMPLATES` 两条模板 —— 逐字，未增删一字。
4. `canResolveThemedEffect` 新增独立 case 行 —— 逐字。
5. handler 新增两行 —— 逐字。
6. `resolveThemedTurnEnd(engine, endingPlayer)`：
   ```js
   if (endingPlayer) tickAilments(engine, endingPlayer);
   ```
   仅此一处新增，毒印/爆破/sealedUntil/frozenUntil/shelterUntil/piercingUntil/wardUntil 等既有清理原样保留。
7. `Player.heal`：
   ```js
   heal(amount) {
       const poisoned = this.monsterZone.some(card => Number(card?.themedState?.statuses?.venom) > 0);
       const heal = Math.max(0, Math.floor((Number(amount) || 0) / (poisoned ? 2 : 1)));
       this.lp = Math.min(this.maxLp, this.lp + heal);
   }
   ```
   与规格 §4.2"回复量减半（向下取整）"一致；未中毒时行为与原实现完全等价。

## 偏差说明（需要审阅确认）

### 1. 追加测试的 2 个预期数值：简报原文与规格/指定实现自相矛盾

简报测试原文：

```js
o.heal(1000);
assert.equal(o.lp, 7000 + 500);   // = 7500
...
assert.equal(o.lp, 6600);
```

但按简报指定的实现：乙起手 8000 LP，中毒后 `heal(1000)` 减半为 `+500` → **8500**；随后结束阶段 tick 剧毒 `450×2=900` → **7600**。原文的 7500 意味着"治疗 1000 反而净扣 500"，只有在把既有 `this.lp = ... + heal` 改成 `- heal` 时才成立，而这与：
- 设计规格 `docs/superpowers/specs/2026-09-23-status-effects-pilot-design.md` §4.2"钩子：`Player.heal()` 中若 `monsterZone` 存在 venom，回复量减半（向下取整）"；
- 卡面文字"其所有回复减半"；
- 简报自身的实现代码（计算出的 `heal` 是正数回复量）

均矛盾；且会导致"中毒玩家使用治愈效果反而掉 LP"的实际运行缺陷。经全库检索，项目中不存在可佐证该数值的参考实现（`snapshots/base` 为任务 1 基线，`temp_restore` 为旧版无此功能）。

**处理：** 保留简报的全部实现代码不变；把追加测试中仅有的 2 个预期值修正为规格值 `8000 + 500` 与 `8000 + 500 - 450 * 2`，并在测试内加 2 行中文注释说明原因。测试仍然严格验证"毒不衰减 + 回复减半 + 结束阶段按层数结算"这一意图（若未减半实现，断言 8500 会失败为 9000）。Diff 可见、可回退；若审阅坚持简报原文数值，请明确指示改为 `lp - heal` 语义，我再执行（但不建议）。

### 2. `resolveExileReturns(engine, endingPlayer)` 未接入

简报片段中包含 `resolveExileReturns(engine, endingPlayer);`，但该函数在整个 `static` 代码库中不存在（已全库 grep 确认）。按作者硬性约束 5"只新增 tick 调用，其余既有清理逻辑原样保留"处理；该函数属于后续"异界流放"任务（计划文档 line 599 明确由后续任务接入）。待该函数落地后，在 `if (endingPlayer)` 块内补一行即可。

### 3. 其他小项

- 底部 import 按简报逐字追加在测试文件中部（ESM 允许顶层 import 提升），任务 1 用例未受影响。
- 简报导入行中 `AILMENTS/DOMAIN_DEFS/ailmentStacks/ailmentValue/removeAilment/cleanseAilments/activeDomain` 在本任务中暂未使用，为后续任务预留；`npm run check` 仅做 `node --check` 语法检查，不受未使用导入影响。
- `Player.heal` 减半判定为"monsterZone 中任一怪兽 venom 层数 > 0"，不区分表侧/里侧，与规格文字一致。

## 执行步骤与真实输出

### 1. 先追加测试，验证失败（步骤 2）

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✔ 异常状态按上限叠层并记录数值
✔ 清除与净化移除状态
✔ 灼烧在结束阶段按数值×层数扣LP并逐层衰减
✔ 剧毒在结束阶段扣LP且不衰减
✔ activeDomain 按 until 与 key 过滤
✖ 灼烧在控制者结束阶段按层数结算并衰减  8000 !== 7000
✖ 剧毒不衰减且中毒方回复减半            9000 !== 7500
✖ 新动作都有卡面文字
ℹ tests 8  ℹ pass 5  ℹ fail 3
```

与预期一致（`ACTION_TEXT.ignite` undefined / handler 不结算）。

### 2. 实现后、修正测试预期值前（暴露简报矛盾的中间态）

命令：`node --test test/status-effects.test.js`

真实输出（摘要）：

```
✔ 灼烧在控制者结束阶段按层数结算并衰减
✖ 剧毒不衰减且中毒方回复减半 (0.6449ms)
  AssertionError: 8500 !== 7500
ℹ tests 8  ℹ pass 7  ℹ fail 1
```

即实现的 8500 是"回复减半"的正确结果，简报原文 7500 不可达。

### 3. 修正测试预期值后（步骤 4）

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
ℹ tests 8  ℹ pass 8  ℹ fail 0
```

### 4. 检查点（简报要求的两文件联跑）

命令：`node --test test/themed-gameplay.test.js test/status-effects.test.js`

真实输出（摘要）：

```
ℹ tests 28  ℹ pass 28  ℹ fail 0
```

### 5. 语法检查

命令：`npm run check`

真实输出（摘要）：无任何 `语法错误:` 输出，退出码 0（仅 npm 自身版本提示）。

### 6. 额外全量回归（非简报要求，为确认无回归主动执行）

命令：`npm test`

真实输出（摘要）：

```
ℹ tests 304  ℹ suites 64  ℹ pass 304  ℹ fail 0  ℹ cancelled 0
```

含"毒印和爆破只在结束阶段结算""冻结持续到对方结束阶段""庇护只替代一次破坏"等既有主题效果用例，全部通过，确认 `resolveThemedTurnEnd` 的既有清理逻辑未被 tick 接入破坏。

## 遗留疑虑

1. **（阻塞审阅项）** 简报测试 2 个预期值矛盾及本次修正，见"偏差说明 1"。若对语义有异议，需在后续任务前决定；目前实现与设计规格一致。
2. `resolveExileReturns` 待后续任务定义后接入本函数（见"偏差说明 2"）。
3. 全量回归中无其他失败；未做浏览器实机验证（属于任务 13 的验收范围）。
