# 任务 5 报告：异界流放 / 异界归来

## 状态

完成。测试先行：实现前 `node --test test/status-effects.test.js` 为 `tests 21 / pass 19 / fail 2`（两个新用例分别因 `o.monsterZone.length !== 0` 与 `p.banished` 不含卡而失败）；实现后全绿。

## 改动文件

### js/themed-effects.js
- `ACTION_DEFAULTS`：新增 `exile: { turns: 2, penalty: 500, self: false }`（47 行）。
- `ACTION_TEMPLATES`：新增 exile 文案（self 版"支付800LP…攻击力下降${penalty}，可累计、效果封印1回合"，敌方版"${turns}个结束阶段后回到场上（守备表示、攻击力下降${penalty}、效果封印1回合）"）（98-100 行）。
- `canResolveThemedEffect`：`case "exile"`（置于 returnSelf 旁）：self 版要求卡在己方怪兽区或墓地且 `p.lp > 800`；敌方版复用 `!!enemy(ctx)`（216-219 行）。
- handler `case "exile"`（returnSelf 后）：self 版 `takeDamage(800)` 后优先从怪兽区、否则从墓地移入 `p.banished`；敌方版将 `enemy(ctx)` 目标移入其持有者除外区；两版都写 `state(card).exile = { pendingEndPhases: max(1, turns), penalty }`（375-386 行）。
- `recall`：`lastN(p.banished, par.count)` 改为 `lastN(p.banished, par.count, x => !x.themedState?.exile)`（266 行）。
- 新增导出 `resolveExileReturns(engine, player)`（433-451 行）：只扫描 `endingPlayer` 的除外区；`pendingEndPhases` 递减，>0 或怪兽区满（余额回置 1 顺延）则跳过；回归时先取出 exile 标记，`resetFieldCard` 后写守备、`setTurn`、`permanentBuffs` 攻减、`themedState = { sealedUntil }`、`_recalcCardStats`，入怪兽区并 `_emitSpecialSummon`。
- `resolveThemedTurnEnd`：在既有 DoT/时限清理之后调用 `resolveExileReturns(engine, endingPlayer)`（472-473 行），回归卡刚写的 sealedUntil 不会被同一轮清理误删。

### js/engine.js
- 未改动。`endTurn()` 第 1934 行已经 `resolveThemedTurnEnd(this, player)`，回归按简报要求挂在该函数内部即可，无需额外接线。

### test/status-effects.test.js（仅追加，旧 19 个用例零改动）
- 简报两个用例原文追加（敌方异界回归、自身异界归来 + recall 跳过），追加后该文件 21 个用例。

## 命令与真实输出

1. 实现前 `node --test test/status-effects.test.js` → `tests 21 / pass 19 / fail 2`（新增两例预期失败）。
2. 实现后 `node --test test/status-effects.test.js` → `tests 21 / pass 21 / fail 0`。
3. `node --test test/status-effects.test.js test/themed-gameplay.test.js` → `tests 41 / pass 41 / fail 0`（themed-gameplay 的 recall 相关检查点无回归）。
4. `npm test` → `tests 322 / suites 64 / pass 322 / fail 0`。
5. `npm run check` → 无语法错误输出，`CHECK_EXIT=0`。
6. 变异验证：
   - 临时移除 `resolveExileReturns` 调用 → 两个新用例 `pass 0 / fail 2`；
   - 临时把 recall 过滤器改为恒真 → 自身异界用例 `pass 0 / fail 1`；
   - 均已恢复，复跑组合命令 `41/41` 通过。

## 疑虑与简报偏离

1. **self 版取卡区域**：简报 canResolve 只认 `p.graveyard.includes(c)`，但简报测试把 subaru 先放进 `monsterZone` 再调用，两者互相矛盾。实现改为"怪兽区或墓地任一"，handler 对应先场上后墓地，测试原文未改。实际卡以 onDestroyed 触发时卡已在墓地，语义不变。
2. **`themedState` 直写会抛错**：简报 `target.themedState.exile = ...` 对 `createCardInstance` 造的卡（无 themedState）会 TypeError；改用仓库既有的 `state(card)` 助手，行为一致。
3. **sealedUntil 取值**：简报写 `engine.state.turn`，但回归发生在结束阶段，该值在任何后续回合都不满足 `sealedUntil >= turn`，且会被下一次时限清理删掉，"效果封印1回合"实际不生效。按卡面语义改为 `engine.state.turn + 1`（下一回合整回合封锁，该回合结束阶段清理）。新用例未断言封印判定，建议审查确认此修正。
4. **"可累计"攻减**：简报回归代码在 reset 后只写一条 `-penalty`，重置会抹掉上次回归的攻减，与模板文案"可累计"矛盾。为符合"写的=结算"原则，回归前保留 `source === "exileReturn"` 的历史攻减并叠加；新用例未覆盖多次回归。
5. **必须重算攻防**：回归写 `permanentBuffs` 后简报未调用 `_recalcCardStats`，`currentAttack` 会停留在基础值（测试断言 1300 直接要求）；实现补了 `player._recalcCardStats?.(card)`。
6. **满场顺延**：`pendingEndPhases = 1` 的顺延逻辑按简报实现，无新增覆盖用例。

## 修复记录（2026-09-23 审查 Critical + Important）

### Critical：回归未把卡移出除外区
- 原实现 `player.monsterZone.push(card)` 导致同一实例同时存在于 `banished` 与 `monsterZone`（`checkStateIntegrity` 跨区域重复、PvP 快照双份、recall 幽灵取卡）。
- 改为模块内 `move(card, player.banished, player.monsterZone)`（themed-effects.js 453 行），保证区域互斥。
- 变异验证：临时改回 `push` → 新增用例「敌方异界回归后离开除外区并封印到下一回合」`pass 0 / fail 1`；已恢复。

### Important：补 5 项测试（追加到 test/status-effects.test.js 末尾，既有用例零改动）
1. 「敌方异界回归后离开除外区并封印到下一回合」：回归后 `!o.banished.includes(target)`，且 `target.themedState.sealedUntil === s.turn + 1`（覆盖 1、2）。
2. 「自身异界在 LP≤800 时不发动」：effect 带 `type: "themedAction"` 以真正走 canResolve 门槛（无 type 时 `canResolveThemedEffect` 按旧约定直接放行，起不到门槛作用）；断言返回 null、卡留墓地、不扣 LP（覆盖 3）。
3. 「异界回归遇满场顺延到下一个结束阶段」：满 5 位时计数归零仍留在除外区且 `pendingEndPhases === 1`，腾位后第二个结束阶段回归（覆盖 4）。
4. 「异界二次回归累计攻减」：同一卡两轮流放回归后 `currentAttack === 800`（覆盖 5）。

### 顺手：敌方 exile 入异界前 resetFieldCard
- 入异界前先 `resetFieldCard(target)` 清掉旧 statuses/domain，避免脏状态进除外区快照；`source === "exileReturn"` 的累计攻减在 reset 前取出、reset 后写回，保证二次回归累计不被重置抹掉。

### 已裁定不改
- `sealedUntil = turn + 1` 语义保持不变。
- self 文案固定"下一个自己的结束阶段"（当前 `turns: 1`）保持不变。

### 验证
- `node --test test/status-effects.test.js test/themed-gameplay.test.js` → `tests 45 / pass 45 / fail 0`。
- `npm test` → `tests 326 / suites 64 / pass 326 / fail 0`。
- `npm run check` → `CHECK_EXIT=0`。
