# 任务 6 报告：引爆 + 净化互动

## 状态

完成。测试先行：实现前 `node --test test/status-effects.test.js` 为 `tests 32 / pass 26 / fail 6`（6 个新增用例按预期失败）；实现后 `32 / 32` 全绿。

注：简报与任务描述说"现 45 个既有用例"，实为 **test/status-effects.test.js 25 个 + test/themed-gameplay.test.js 20 个 = 45**；本次只向 status-effects.test.js 末尾追加 7 个用例（3 个简报原文 + 4 个补充），既有 25 个零改动。

## 改动文件

### js/themed-effects.js

- `ACTION_DEFAULTS`：新增 `detonate: { stacks: 2, damage: 600 }`（28 行）。
- `ACTION_TEMPLATES`：新增 detonate 文案（74 行，简报原文）；purify 文案补上净化语义："将对方墓地最后 N 张卡除外，**并清除己方场上怪兽的全部异常状态**"（91 行，见偏离 4）。
- 新增模块内助手 `hasAilments(card)`（133 行，复用已导入的 `AILMENTS`/`ailmentStacks`）。
- `canResolveThemedEffect`：`case "detonate": return !!enemy(ctx)`（205 行）；`case "purify": return ctx.opponent.graveyard.length > 0 || p.monsterZone.some(hasAilments)`（217 行，见偏离 3）。
- handler `case "detonate"`（301 行）：先 `applyAilment(target, "burn", Math.max(1, par.stacks), par.damage)`；取总层数 `o.takeDamage(par.damage * burnStacks)` 后 `removeAilment(target, "burn")`；若带剧毒，`300 × venomStacks` 对 `o.monsterZone` 全部表侧怪兽扣守备，守备归零用 `ctx.engine.destroyFieldMonster(o, x)` 破坏，随后 `removeAilment(target, "venom")`。
- handler `case "purify"`（383 行）：保留 `lastN(o.graveyard, par.count)` 除外对方的原有行为；追加 `for (const card of p.monsterZone) cleanseAilments(card);`。

### test/status-effects.test.js（仅追加，旧 25 用例零改动）

追加 7 个用例（文件末尾）：

1. 「引爆消耗灼烧层数造成单体爆发」（简报原文）：stacks 2 × 650 = 1300 LP，灼烧清零。
2. 「引爆剧毒扩散为对方全体怪兽伤害」（简报原文，仅修正 LP 预期，见偏离 1）：守备 1200→600/600，剧毒清零。
3. 「净化清除己方全部异常状态」（简报原文）：burn 2 → 0。
4. 「净化保留除外对方墓地并同时净化己方」：对方墓地最后 1 张入除外区、己方 venom 清零（覆盖简报检查点"既有除外墓地行为"）。
5. 「引爆扩散击破守备归零的对方怪兽」：守备 500 的怪兽被 2 层剧毒扩散（600）破坏，另一只存活（覆盖 `destroyFieldMonster` 分支）。
6. 「净化在对方墓地为空时因己方异常状态仍可发动」：带 `type: "themedAction"` 真正走 canResolve 门槛，断言可发动且 curse 被清除。
7. 「对方与己方都无目标时净化不可发动」：负向对照，防止 canResolve 被放宽为恒真。

## 命令与真实输出

1. 实现前 `node --test test/status-effects.test.js` → `tests 32 / pass 26 / fail 6`（新用例预期失败）。
2. 实现后 `node --test test/status-effects.test.js` → `tests 32 / pass 32 / fail 0`。
3. `node --test test/status-effects.test.js test/themed-gameplay.test.js` → `tests 52 / pass 52 / fail 0`。
4. `npm test` → `tests 333 / suites 64 / pass 333 / fail 0`。
5. `npm run check` → `CHECK_EXIT=0`。
6. 变异验证（临时改坏后恢复，恢复文件 SHA256 与备份一致）：
   - 删除 `ctx.engine.destroyFieldMonster(o, x)` 调用 → `31/1`（用例 5 失败）；
   - 回退 purify 的 canResolve 扩展 → `31/1`（用例 6 失败）；
   - 删除 `cleanseAilments` 循环 → `29/3`（用例 3/4/6 失败）。

## 疑虑与简报偏离

1. **简报用例 2 的 LP 预期自相矛盾（已修正为 8000-600）**：简报实现 `Math.max(1, par.stacks)` 与 `status-effects.js` 里 `applyAilment` 自身的 `Math.max(1, ...)` 双重保证"至少 1 层灼烧"；因此 `stacks: 0` 必然先挂 1 层 ×600 = 600 单体爆发，`o.lp` 不可能保持 8000。用例保留"剧毒扩散只打守备"的原意，仅把 LP 预期修正为 7400 并加注释说明。
2. **简报伪代码作用域错误（已修）**：handler 里没有解构出 `engine`，`engine.destroyFieldMonster` 会 TypeError；改用仓库 handler 内既有写法 `ctx.engine.destroyFieldMonster(o, x)`。
3. **purify 门槛扩展（超出简报一行改动）**：简报只要求分支里追加 `cleanseAilments`。但真实卡效果都带 `type: "themedAction"`，若 canResolve 仍只认"对方墓地非空"，则设计 §5.3「净化 × 诅咒」在对方墓地为空时永远无法发动，净化增强不可达。故放宽为"对方墓地非空 **或** 己方场上有异常状态"。简报用例 3 因不带 `type` 本来就不经过门槛，另加用例 6/7 正负向覆盖。
4. **purify 卡面文字同步更新（超出简报）**：仓库原则是"卡面文字由 ACTION_TEXT 生成，改配方=改卡面，不会出现文字与结算不一致"（authored-card-rules.js 228 行注释）与"写的=结算的"（themed-effects.js 头部注释）。增强结算后若不改模板，所有 purify 卡会"少写"净化语义。故模板补"，并清除己方场上怪兽的全部异常状态"。副作用：所有 purify 卡卡面文字变化（无测试按旧文本断言，全绿）。
5. **新增 4 个补充用例**：简报 3 例不覆盖"除外墓地行为保留"「扩散破坏」与 canResolve 门槛正负向，按检查点与前序任务惯例补齐。
6. `par.stacks` 的 `Math.max(1, ...)` 与 `applyAilment` 内部下限重复，属防御性冗余，按简报保留。
