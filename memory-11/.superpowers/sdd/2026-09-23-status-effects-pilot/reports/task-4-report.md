# 任务 4 报告：麻痹 / 无下限

## 状态

完成。新增测试先行（实现前确认失败，其中"麻痹阻止攻击与改变表示"在 canResolve 缺省为 false 时攻击/改姿态成功；"无下限减伤且不可取对象"首断言 cannotBeTargeted=false；减伤用例 6500 !== 7500；清理用例因 themedState 未建立抛 TypeError），实现后全绿。

## 改动文件

### js/themed-effects.js
- `ACTION_DEFAULTS`：新增 `paralyze: { count: 1, amount: 0, gamble: false }`、`infinity: { reduce: 1000 }`（28-29 行）。
- `ACTION_TEMPLATES`：新增 paralyze（含 gamble/count:all/单体三分支文案）与 infinity 文案（72-77 行）。
- `canResolveThemedEffect`：新增 `case "paralyze": return !!enemy(ctx);`、`case "infinity": return p.monsterZone.includes(c);`（197-198 行）。
- handler：`paralyze` 写入 `paralyzedUntil = game.turn + 1` 并置 `canAttack = false`（count:"all" 作用于对方全部表侧怪兽，否则取 `enemy(ctx)` 最高攻可取对象）；`infinity` 写入 `infinityUntil`/`infinityReduce` 并置 `cannotBeTargeted = true`（307-317 行）。
- `resolveThemedTurnEnd` 到期清理 key 列表追加 `paralyzedUntil`、`infinityUntil`，`infinityUntil` 到期恢复 `cannotBeTargeted = false`（422-423 行）。
- 赌运（gamble）分支未实现，仅保留文案与参数，待任务 8 接入 `game.lastCoinResult`。

### js/engine.js
- 新增模块级 `infinityReduction(card, turn)`：状态未到期时返回 `infinityReduce`，否则 0（127-130 行）。
- `attack()`：不可攻击判定追加 `attacker.themedState?.paralyzedUntil >= this.state.turn`（2770 行）。
- `changePosition()`：冻结判定追加 `card.themedState?.paralyzedUntil >= this.state.turn`，提示改为"冻结或麻痹期间不能改变表示形式"（2351 行）。
- 战斗伤害四处减免：
  - 守备表示被贯穿（2872/2879 行，破坏前快照 `infinityGuard`）；
  - 守备方攻击力低于守备力、攻击方受伤（2889 行）；
  - 攻击表示对攻、守备方受伤（2898 行，破坏前计算）；
  - 攻击方战败受伤（2916 行，`destroyMonster` 清空 themedState 前快照 `attackerInfinity`）。
  - 直攻与同值互击无控制者战斗伤害，不涉及减免。
- 既有冻结/封印语义未改动。

### test/status-effects.test.js（仅追加，旧用例零改动）
简报两个用例原文追加，另补 3 个用例：
- 「无下限作为守备方承受战斗伤害时按数值减伤」2500 攻 vs 1000 攻无下限 → p.lp 7500；
- 「无下限作为攻击方承受战斗伤害时按数值减伤」1000 攻无下限 vs 2500 攻 → p.lp 7500；
- 「麻痹与无下限到期后清理状态」第 4 回合结束清理两个 Until 并恢复 cannotBeTargeted。
补测原因见疑虑 1。

## 命令与真实输出

1. `node --test test/status-effects.test.js`（实现前，预期 FAIL）
   - 观察到 `6500 !== 7500`（减伤未生效）、清理用例 `TypeError: Cannot read properties of undefined (reading 'paralyzedUntil')` 等断言失败。

2. `node --test test/status-effects.test.js test/themed-gameplay.test.js`
   - `tests 39 / pass 39 / fail 0 / cancelled 0 / skipped 0 / todo 0`
   - 既有冻结/封印用例「封印阻止主动发动，冻结持续到对方结束阶段」通过。

3. `npm test`
   - `suites 64 / pass 315 / fail 0 / cancelled 0 / skipped 0 / todo 0`
   - （stderr 仅 npm 新版提示，无用例失败。）

4. `npm run check`
   - 无语法错误输出，`EXIT=0`。

## 疑虑

1. 简报用例「无下限减伤且不可取对象」的守备位场景（2500 攻打 2000 守、无贯穿）本身不产生战伤，减伤分支实际未被该用例覆盖。已按简报原文保留该用例，另补守备方/攻击方两个真实减伤用例兜底；实现中贯穿与攻击方战败两处因 `destroyMonster` 会清空 `themedState`，采用破坏前快照减免值。
2. `infinityUntil = game.turn + 1` 与卡面"直到下个自己的回合结束"存在语义差（实际按冻结语义在下一回合结束到期）。若后续任务要求严格"下个自己回合"，需改为按控制者回合计数；另 `model.js:184` 的 `resetTurnState` 会在无下限控制者回合开始时把 `cannotBeTargeted` 重置为仅由 `wardUntil` 决定，若在对方回合通过陷阱发动 infinity，该重置会提前丢失不可取对象——本任务按简报未改 model.js，建议任务 8 一并处理。
3. gamble 分支按要求未实现，当前 `gamble:true` 的 paralyze 会走普通单体路径；任务 8 接入硬币结果时需替换该路径。

## 修复记录（2026-09-23 协调者裁定）

裁定：按"写的=结算"原则，infinity 卡面时长应与 `infinityUntil = game.turn + 1` 的实际语义（直到下个回合结束，与 ward/freeze 同）一致；原"直到下个自己的回合结束"文案不可靠。

改动：
- `js/themed-effects.js` infinity 模板改为 `直到下个回合结束，自身不会成为对方效果的对象，且受到的战斗伤害减少${p.reduce}`。
- `test/status-effects.test.js` 「新动作都有卡面文字」升级为渲染断言：动作列表加入 paralyze/infinity，并断言 `ACTION_TEXT.infinity` 含"直到下个回合结束"、`ACTION_TEXT.paralyze` 含"麻痹"。其余实现未动。

验证：
- `node --test test/status-effects.test.js test/themed-gameplay.test.js` → `tests 39 / pass 39 / fail 0`。
- `npm run check` → `EXIT=0`。
- 上一轮报告的疑虑 2 中"文案与时长不一致"部分已由此裁定消除；`model.js:184` 跨回合 cannotBeTargeted 重置问题仍保留，待任务 8 处理。

## 修复记录（2026-09-23 审查 Important 1/2）

### Important 1：predictBattle 同步无下限减伤
- `js/engine.js` `predictBattle` 四个伤害分支与 `attack()` 同规则扣减 `infinityReduction`（守备方贯穿、守备方撞墙时攻击方受伤、攻击表示破防、攻击表示战败），统一 `Math.max(0, ...)` 不为负；直攻分支不减免（控制者不承受战伤），与 `attack()` 一致。
- `test/bugfix-regression.test.js`「战斗预览与实际结算一致」场景表新增 5 条：攻击表示被破防（target 无下限 300）、攻击方战败（attacker 无下限 300）、贯穿破防（target 无下限 300）、攻击方撞墙（attacker 无下限 300）、减伤不低于 0（reduce 1000 > 伤害 500）。交叉验证断言 predicted.damage/damageTo/destroyed 与实际 LP 变化一致，5 条均通过。
- 自检：`node --test --test-name-pattern="无下限" test/bugfix-regression.test.js` → pass 5 / fail 0；predicted damage 与 attack() 实际 LP 变化相等。
- 变异验证：临时移除 predictBattle 攻击表示破防分支的减伤行后，该过滤运行 → pass 3 / fail 2（伤害预测不符），已恢复。

### Important 2：到期清理测试鉴别力
- `test/status-effects.test.js`「麻痹与无下限到期后清理状态」改为 `s.turn = 4; s.currentPlayerIndex = 1; e.endTurn();`，由对方（乙）结束回合触发清理，不再走控制者 `startTurn`，排除了 `resetTurnState` 提前清 `cannotBeTargeted` 的干扰。
- 修正后断言仍通过，原因是到期清理已真实删除 `paralyzedUntil`/`infinityUntil` 并将 `cannotBeTargeted` 复位；断言此时只可能由清理路径满足。
- 变异验证：临时把 `paralyzedUntil`/`infinityUntil` 从清理 key 列表移除后，该用例 → pass 0 / fail 1，证明测试具备鉴别力；已恢复。

### 验证
- `node --test test/status-effects.test.js test/themed-gameplay.test.js test/bugfix-regression.test.js` → `tests 125 / pass 125 / fail 0`。
- `npm test` → `tests 320 / suites 64 / pass 320 / fail 0`。
- `npm run check` → `CHECK_EXIT=0`。
