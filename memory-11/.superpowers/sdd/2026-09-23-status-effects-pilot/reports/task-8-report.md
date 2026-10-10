# 任务 8 报告：赌运 + 硬币事件

## 状态

完成。测试先行：实现前两个新增用例失败（`gamble` 动作未注册 → 事件 0 次；`paralyze` 赌运分支未接入硬币事件）；实现后 `test/status-effects.test.js` 45/45 全绿，双文件 65/65，`npm test` 347/347，`npm run check`、`npm run fuzz`（120 局）均通过。

## 改动文件

### js/themed-effects.js

- `ACTION_DEFAULTS`：新增 `gamble: { draw: 2, heal: 800 }`（38 行）。
- `ACTION_TEMPLATES`：新增 `gamble: p => \`抛硬币：正面则抽${p.draw}张卡；反面则回复${p.heal}LP\``（90 行），与结算两种走向一一对应。
- `canResolveThemedEffect`：`case "gamble": return true;`（222 行）。
- handler 顶部新增作用域清理（261 行）：`if (e.action !== "gamble" && !(e.action === "paralyze" && par.gamble)) game.lastCoinResult = null;`——硬币结果只在同一结算的连续硬币动作之间共享。
- `case "paralyze"` 赌运分支（359-377 行）：`const result = game.lastCoinResult || (ctx.engine._random() < 0.5 ? "heads" : "tails")`，读取后 `game.lastCoinResult = null` 消费；`ctx.engine.emit("onCoinFlip", { card: c, result })`；正面对目标写 `paralyzedUntil = game.turn + 1`、`canAttack = false`，反面 `applyTempStat(o, x, "attack", -par.amount)`。非赌运分支零改动。
- `case "gamble"`（378-386 行）：`ctx.engine._random() < 0.5` 定正反；结果写入 `game.lastCoinResult` 并广播 `onCoinFlip`；正面抽 `Math.max(1, par.draw)` 张，反面 `p.heal(par.heal)`。
- 事件负载满足约束：`{ card, result }`，`result ∈ {"heads","tails"}`（`emit` 另附引擎/状态字段）。

### js/engine.js

- 未改动。`emit(event, data)`（engine.js:1824）本身就是通用事件总线并自动附加 `engine/gameState`，`onCoinFlip` 无需引擎侧新增代码；任务 11 通过 `eventBus.on("onCoinFlip", ...)` 订阅即可。

### test/status-effects.test.js（仅追加 2 例，旧 43 例零改动，现 45）

1. 「赌运使用共享随机源且结果写入事件」（596 行，简报原文）：唯一修正——简报固定引擎的两名玩家卡组为空，`drawCard` 无牌可抽时不入手牌，`hand.length === 2` 永远不可能成立；给甲补 2 张卡组以保留该断言的鉴别力（RNG 仍注入 0.1）。附加断言 `lastCoinResult === "heads"`。
2. 「麻痹赌运两走向与卡面一致且复用同一硬币结果」（617 行）：预置 `lastCoinResult = "heads"` → 事件回传 heads、随机源零消耗、目标麻痹且不降攻；预置 `"tails"` → 目标降攻 600、不麻痹。

## 命令与真实输出

1. 实现前 `node --test test/status-effects.test.js` → 2 个新用例 fail（`actual 0 / expected 1`；`deepEqual [] vs ['heads']`）。
2. 实现后 `node --test test/status-effects.test.js` → `tests 45 / pass 45 / fail 0`。
3. `node --test test/status-effects.test.js test/themed-gameplay.test.js` → `tests 65 / pass 65 / fail 0`。
4. `npm test` → `tests 347 / suites 64 / pass 347 / fail 0`（stderr 仅 npm 新版提示）。
5. `npm run check` → `CHECK_EXIT=0`。
6. `npm run fuzz` → `压测 120 局：正常结束 120 局，异常 0 局，平均 49.4 回合`（`FUZZ_EXIT=0`）。
7. 变异验证（临时改坏后恢复）：
   - paralyze 正面分支条件改为 `"heads_NOMATCH"` → 「麻痹赌运两走向」fail（正面不麻痹）；恢复后通过。
   - gamble 抽卡循环上界 `-1` → 「赌运使用共享随机源」fail（手牌 1 ≠ 2）；恢复后 65/65 复绿。

## 疑虑与简报偏离

1. **简报 paralyze 赌运伪代码漏了正面分支**：`if (result === "tails") { 降攻 }` 之外没有正面处理，而卡面与规格 §4.6 是"正面麻痹、反面降攻"（写的=结算的）。已补正面 `paralyzedUntil/canAttack=false`，否则该动作正面走势永远不结算。
2. **`lastCoinResult` 需要作用域（轻微偏离简报）**：简报只写不消费，会让后续任何 paralyze 赌运复用很久以前抛出的硬币，卡面"抛硬币"退化为确定性结果，违反"两种走向一一对应"。实现改为：读取后置 `null` 消费，且其他动作开始结算时清空——只有同一结算内相邻的 `gamble → paralyze` 才共享。对简报用例无影响（它只断言 gamble 后字段为 heads）。
3. **简报固定引擎用例无法自证**（见上）：空卡组抽牌失败不入手牌。已补 2 张卡组，断言意图（RNG<0.5 走正面抽牌）保留，并经变异验证具备鉴别力。
4. **engine.js 未改动**：通用 `emit` 已满足 `onCoinFlip` 广播；若后续任务期望引擎承担硬币判定/状态清理，请在任务 11/13 提出。
5. `gamble` 目前无卡牌数据引用（任务 9 的 `picture_ssr7_036` 尚未接线），本次仅提供动作、卡面、结算与事件。

---

## 修复记录（2026-09-23 审查 Important 1 / Important 2）

### Important 1：删除 `game.lastCoinResult` 共享状态（已修）

- 审查结论成立：该字段无生命周期边界，会在没有任何主题动作的回合/玩家之间残留，使后续 paralyze 赌运复用旧硬币、`engine._random()` 0 次调用。
- 现实现（`js/themed-effects.js`）：
  - `case "gamble"`：`const result = ctx.engine._random() < 0.5 ? "heads" : "tails"` → `emit("onCoinFlip", { card: c, result })` → 正面抽 `Math.max(1, par.draw)` 张 / 反面 `p.heal(par.heal)`。不写任何状态。
  - `case "paralyze"` 赌运分支：同样恰好一次 `ctx.engine._random()` 判定并 `emit`；正面麻痹（`paralyzedUntil = game.turn + 1`、`canAttack = false`），反面 `applyTempStat(o, x, "attack", -par.amount)`。不读、不清、不复用任何跨结算状态。
  - 删除 handler 顶部的非硬币动作清空逻辑。
- 全仓库 `lastCoinResult` 仅剩测试中的负向断言（`assert.equal(fixed.state.lastCoinResult, undefined)`），无死代码。
- 上文「疑虑与简报偏离 2」的消费式折中实现已被本次修复取代：按 YAGNI，将来 paralyze 若确需与 gamble 共享一枚硬币，再引入有界机制。

### Important 2：补齐硬币两走向与"恰好掷一次"测试（已修）

`test/status-effects.test.js` 追加/改写 3 例（旧 43 例零改动，任务 8 原有 2 例被本次审查要求改写）：

1. 「赌运使用共享随机源且结果写入事件」（596 行，简报原文改写）：heads 抽 2 张；计数 RNG 断言 `rolls === 1`；断言 `fixed.state.lastCoinResult === undefined`（不写跨结算状态）。
2. 「赌运反面回复LP且不抽卡」（新增）：LP 5000、卡组 2 张、RNG>0.5 → LP 5800、手牌 0、卡组不变、事件 "tails"、`rolls === 1`（两种走向互斥）。
3. 「麻痹赌运两走向与卡面一致且各掷一次」（改写）：heads 局 → 事件 "heads"、`rolls === 1`、`canAttack === false`、`paralyzedUntil === turn + 1`、攻不变；tails 局 → 事件 "tails"、`rolls === 1`、攻 1800→1200 且 `tempEffects` 记录 `-600/untilEndTurn`、不麻痹。

### 修复后验证

1. 修复前 `node --test --test-name-pattern "赌运|麻痹赌运" test/status-effects.test.js` → `tests 3 / pass 2 / fail 1`（`lastCoinResult === undefined` 断言失败，暴露旧共享状态）；修复后 → 3/3。
2. `node --test test/status-effects.test.js` → `tests 46 / pass 46 / fail 0`。
3. `node --test test/status-effects.test.js test/themed-gameplay.test.js` → `tests 66 / pass 66 / fail 0`。
4. `npm test` → `tests 348 / suites 64 / pass 348 / fail 0`（`TEST_EXIT=0`）。
5. `npm run check` → `CHECK_EXIT=0`。
6. `npm run fuzz` → `压测 120 局：正常结束 120 局，异常 0 局，平均 49.6 回合`（`FUZZ_EXIT=0`）。

