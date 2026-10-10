# 任务 7 报告：领域系统（4 种）

## 状态

完成。测试先行：实现前 `node --test test/status-effects.test.js` 为 `tests 39 / pass 33 / fail 6`（7 个新增用例中 6 个按预期失败；简报的「白金之星·世界封锁对方攻击」在实现前也"通过"，因为它用直接攻击断言，而领域持有者场上有怪兽本身就挡住了直攻，见疑虑 2）；实现后 `39 / 39` 全绿。

## 改动文件

### js/themed-effects.js

- 新增模块内 `DOMAIN_RULES_TEXT`（wuji/za_warudo/rojin/ongaku 四条规则文案，与引擎判定一一对应，6-12 行）。
- `ACTION_DEFAULTS`：新增 `domain: { field: "wuji", cost: 1200 }`（53 行）。
- `ACTION_TEMPLATES`：新增 domain 文案，名称取 `DOMAIN_DEFS`、规则取 `DOMAIN_RULES_TEXT`（107-110 行）。
- `canResolveThemedEffect`：`case "domain": return p.monsterZone.includes(c) && p.lp > (par.cost || DOMAIN_DEFS[par.field]?.cost || 0);`（240 行）。
- handler `case "domain"`（446-462 行）：按 `DOMAIN_DEFS` 扣 LP，源卡 `themedState.domain = { id, until: turn + 1, applied }`；ongaku 的 `allyAttack`/`enemyAttack` 以 `permanentBuffs`（source 固定 `"domainOngaku"`）+ `_recalcCardStats` 应用到双方怪兽，并把 `{ card, owner }` 记录进 `domain.applied`。
- `resolveThemedTurnEnd` 末尾追加领域到期段（534-545 行）：遍历 `engine.state.players` 双方，`until <= turn` 时按 `applied` 移除所有 `domainOngaku` 修正并重算，再 `delete card.themedState.domain`。既有清理循环与 `resolveExileReturns` 零改动。

### js/engine.js

- 新增 `import { activeDomain } from "./status-effects.js";`。
- 新增模块级纯函数 `rojinHalved(damage)`（137 行）：`damage - Math.ceil(damage / 2)`，供预览与结算共用同一取整规则。
- `triggerAllEffects` 诅咒判定后追加 wuji 封锁（2400-2402 行）：按 **player 的对手**（`player === currentPlayer ? opponentPlayer : currentPlayer`）是否持有激活 wuji 决定 `return null`（持有者自身不受影响）。
- `attack()` 不可攻击判定追加 `activeDomain(this, this.state.opponentPlayer, "za_warudo")`（2791 行）。
- `attack()` 罗针（受击方战斗伤害减半、另一半反弹）：
  - 攻击表示守方受伤分支（2927-2932 行）；
  - 守备贯穿分支（2894-2909 行）：罗针源卡可能被这次攻击破坏、`destroyMonster` 会清空 `themedState`，故在破坏前先取 `rojinShield` 快照。
  - 反弹值 `Math.ceil` 给攻击方、守方承受余数；`battleDamage` 同步为守方实际承受值，返回值/提示与 LP 一致。
- `predictBattle()` 同步罗针：守备贯穿与攻击表示破防两个"守方受伤"分支在 `infinityReduction` 之后按同一 `rojinHalved` 口径扣减（2713、2731 行）。攻击方受伤/同归于尽/直攻不涉及罗针（有激活罗针时守方必有怪兽，直攻不可达），与 `attack()` 一致。

### test/status-effects.test.js（仅追加，旧 32 个用例零改动，现 39）

追加 7 个用例（文件末尾）：

1. 「无量空处封锁对方效果发动」（简报原文）：扣 1200 LP，非当前回合方 `onSummon` 被封锁返回 `null`。
2. 「无量空处只封锁对手，不封锁持有者自身」：持有者 `manual` 效果照常发动，对方 `onSummon` 返回 `null`（覆盖方向要求）。
3. 「白金之星·世界封锁对方攻击」（简报原文）。
4. 「白金之星·世界未展开时对方攻击照常成立」：先验证攻击成立，展开领域后同一攻击被拒（补足简报用例的鉴别力）。
5. 「苍穹音浪在到期后回退攻防修正」（简报原文）：turn 3 展开 → turn 4 乙结束阶段到期回退 1000；领域挂在甲（非结束方）怪兽上也按时到期。
6. 「苍穹音浪同时削减对方攻击力到领域到期」：敌方 1800 → 1300，到期回 1800（覆盖 `enemyAttack`/`domain.applied` 的对方侧回退）。
7. 「罗针减半守方战斗伤害并将另一半反弹给攻击者」：2000 攻 vs 1500 攻，`result.damage = 250`，守方 LP -250、攻击方 LP -250。

### test/bugfix-regression.test.js（仅追加 1 条场景，旧 86 用例零改动，现 87）

场景表追加：`{ name: "罗针领域：受击方伤害减半并反弹", atk: 2000, targetAtk: 1500, targetFlags: { themedState: { domain: { id: "rojin", until: 10 } } } }`。断言 `predictBattle().damage === attack().damage === 250`、`damageTo === "defender"`，且守方 LP 变化恰为预测值。

## 命令与真实输出

1. 实现前 `node --test test/status-effects.test.js` → `tests 39 / pass 33 / fail 6`
   - 观察到 `8000 !== 7200`（domain 未结算）、`1000 !== 1500`（ongaku 未加攻）、`1800 !== 1300`（enemyAttack 未生效）、`actual 8000` 等断言失败。
2. 实现后 `node --test test/status-effects.test.js` → `tests 39 / pass 39 / fail 0`
3. `node --test test/status-effects.test.js test/themed-gameplay.test.js test/bugfix-regression.test.js` → `tests 146 / suites 25 / pass 146 / fail 0`
4. `npm test` → `tests 341 / pass 341 / fail 0`（stderr 仅 npm 新版提示）
5. `npm run check` → `CHECK_OK`（exit 0）
6. 变异验证（临时改坏后恢复）：仅移除 `predictBattle` 攻击表示破防分支的罗针同步行 → `node --test --test-name-pattern "罗针" test/bugfix-regression.test.js` → `actual 500 / expected 250` 失败；恢复后该场景通过（证明场景表能抓住"预览≠结算"）。

## 疑虑与简报偏离

1. **wuji 方向的简报伪代码会挂掉简报自己的用例（已按注释修正）**：简报写 `if (activeDomain(this, this.state.opponentPlayer, "wuji")) return null;`，但 `state.opponentPlayer` 是"当前回合玩家的对手"；简报用例里 `triggerAllEffects(o, enemy, "onSummon")` 的 `o` 是非当前回合方，此时 `state.opponentPlayer === o`，检查的是 o 自己（无 wuji），封锁不生效、用例失败。已按简报注释"若**对手**场上有 wuji 且玩家不是持有者"改为对给定 `player` 求对手：`player === currentPlayer ? opponentPlayer : currentPlayer`。副作用：防守方陷阱响应 `onAttacked` 时也会被其对手的 wuji 封锁（`triggerAllEffects` 顶层统一拦截），与"对方怪兽不能发动效果"的字面扩到全部发动入口，按简报"与 curse 判定同处"执行。
2. **简报的「白金之星」用例实现前也通过**：它断言 `attack(enemy, "player").success === false`，但领域持有者 `p` 场上有 `jotaro`，直攻本来就被"对方场上有怪兽"拒绝。已保留原文，另补用例 4 先证攻击可成立、展开后同一攻击被拒。
3. **罗针简报伪代码不产生"减半"（已按卡面语义修正）**：简报片段放在伤害结算后只把 `battleDamage` 变量减半并给攻击方加伤，守方 LP 实际已承受全额，与文案"自己受到的战斗伤害减半"矛盾。本实现改为在伤害落账前拆分：守方承受 `floor(B/2)`、攻击方承受 `ceil(B/2)`；`predictBattle` 用同一 `rojinHalved` 口径，返回的 `damage` 即守方实际受伤，场景表才能成立。直攻不涉及（罗针源卡在场 ⇒ 守方必有怪兽）。
4. **领域到期采用"遍历双方"**（额外要求 2）：领域挂在非结束方怪兽上也会按时到期（用例 5 的甲在乙结束阶段到期）；`applied` 为空时同样删除 `themedState.domain`。
5. **已知边界（未实现，超出简报与本任务范围）**：若领域源卡在到期前离场（被破坏/弹回等），`destroyMonster`/`resetFieldCard` 会清空其 `themedState.domain`，`domain.applied` 随之丢失，ongaku 的攻防修正不会被回退，残留在被修正怪兽的 `permanentBuffs` 上（直到该怪兽自身离场重置）。按简报未引入全局领域登记表，若需要请后续任务裁定。
6. `domain` 动作目前无任何卡牌数据引用（`authored-card-rules.js` 配方未使用），本次仅提供动作与规则实现；`ACTION_TEXT` 默认渲染为 wuji 文案。
7. 原疑虑 5（源卡提前离场导致 ongaku 攻防修残留）已在审查修复轮解决，见下方修复记录。

---

## 修复记录（2026-09-23 审查 C1 / I1 / M1 + M2）

### C1：ongaku.applied 活对象引用导致 PvP 快照循环引用（已修）

- `js/themed-effects.js` domain handler：`applied` 只存纯 JSON `{ instanceId, ownerIndex }`（`ownerIndex = game.players.indexOf(owner)`）；领域对象增加 `sourceId: c.instanceId`，每条 buff 也带 `sourceId`。
- 到期回退改为按 `applied` 记录 `players[ownerIndex].monsterZone` 中按 `instanceId` 反查卡，再按 `sourceId` 精确移除对应修正；`holder._recalcCardStats?.()` 对快照hydration 后的纯对象兼容。
- 测试：「PvP快照可序列化并保留 ongaku 领域应用记录」——`JSON.parse(JSON.stringify(new GameController(s, e, {})._serializePvpState()))` 不抛错，`domain.id/sourceId/applied` 完整往返，受影响怪兽 `currentAttack` 保留。
- 变异验证：临时把 `applied` 加回 `{ card, owner }` → 该用例 `TypeError: Converting circular structure to JSON ... property 'themedState' closes the circle` 失败；恢复后通过。

### I1：源卡提前离场时 ongaku 攻防修立即回退（已修）

- 新增导出 `purgeOrphanDomainBuffs(engine)`（`js/themed-effects.js`）：收集双方怪兽区中"未到期领域"的 `sourceId`，再把双方怪兽身上找不到同源激活领域的 `domainOngaku` buff 移除并重算；多份 ongaku 叠加时按 `sourceId` 只清对应一份（M2 顺带修复）。
- 调用点：`resolveThemedTurnEnd` 领域到期段之后（每次结束阶段兜底）、`engine.destroyFieldMonster()` 破坏后、`engine.attack()` 的直攻结算后 / 怪兽战斗结算后 / 陷阱取消攻击返回前。
- 测试：「苍穹音浪源卡离场后攻防修立即回退」（源卡被 `destroyFieldMonster` 破坏后，己方回 1000、敌方回 1800，不必等到期）、「多份苍穹音浪叠加时按来源分别回退」（1000→2000，破坏第一源卡→1500，再破坏第二源卡→1000）。原有「苍穹音浪在到期后回退攻防修正」保持通过。
- 变异验证：临时移除 `destroyFieldMonster` 内的 `purgeOrphanDomainBuffs(this)` → 「源卡离场」用例 `actual 1500 / expected 1000` 失败；恢复后通过。

### M1：wuji 只封锁怪兽效果（已按规格收紧）

- `engine.triggerAllEffects` 的 wuji 守卫改为 `card.type === "monster" && activeDomain(...)`；魔法/陷阱不再被误封，卡面"对方怪兽不能发动效果"与结算一致。
- 测试：「无量空处只封锁怪兽效果，不封锁对方魔法发动」——领域激活时乙的怪兽 `manual` 效果返回 `null`，同一回合乙用 `activateSpell` 发动带 `token` 动作的魔法成功并生出衍生物。
- 变异验证（设计上可鉴别）：若守卫恢复为无条件，`activateSpell` 不创建衍生物，`o.monsterZone.length` 断言（2）必失败。

### 验证

- `node --test test/status-effects.test.js test/themed-gameplay.test.js test/bugfix-regression.test.js` → `tests 150 / suites 25 / pass 150 / fail 0`（status-effects 43，新增 4 例）。
- `npm test` → `tests 345 / pass 345 / fail 0`。
- `npm run check` → `CHECK_OK`。
- `npm run fuzz` → 120 局全部正常结束、异常 0 局（战斗/破坏路径加了清算调用的额外验证）。
