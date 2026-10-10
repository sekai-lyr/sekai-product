# 任务 11 报告：动作特效映射 + 技能横幅 + 状态徽记 + 硬币演出

## 状态

完成。`npm test` 全绿（355/355），`npm run check` 通过（exit 0）。浏览器验收受限于 8091 上运行的是旧 jar（见下文「浏览器检查点」）。审查修复见文末「审查修复记录」。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `js/effects.js` | 新增导出 `THEMED_ACTION_VISUALS`（10 动作）与 `themedVisualKey`；`resolveRuleTargets` 改用 `themedVisualKey`；`playRuleDrivenEffect` 视觉查表回退到新表、循环前发横幅/领域演出；新增导出 `showSkillBanner`、`playCoinFlip`（审查修复另见文末） |
| `js/controller.js` | 顶部 import 追加 `playCoinFlip`；构造函数订阅 `onCoinFlip` → `playCoinFlip(result)` |
| `js/ui.js` | 怪兽槽位 `attrs` 增加 `data-atk`（审查修复，见文末） |
| `css/style.css` | 文件末尾追加 `.skill-banner` / `.coin-flip` / 两个 keyframes（brief 原文） |
| `test/status-effects.test.js` | 末尾追加 brief 用例 1 个；既有 49 个用例未改动 |

## 测试结果

- 先追加测试后运行：FAIL（`does not provide an export named 'THEMED_ACTION_VISUALS'`，与预期一致）。
- 实现后 `node --test test/status-effects.test.js` → **50 tests / pass 50 / fail 0**（基线 49）。
- 全量 `npm test` → **353 tests / 64 suites / pass 353 / fail 0**。
- `npm run check` → exit 0，无语法错误。

## 实现细节备注

- `THEMED_ACTION_VISUALS` 严格按 brief 原文（label/motion/color/accent）；键唯一性由新增用例覆盖（10 个 `motion+color` 全部不同）。
- `themedVisualKey(effect)`：仅 `type === "themedAction"` 且动作在映射表中时返回动作名，否则回退 `ruleVisualKey(effect?.type)`。未映射的旧主题动作（scout/study 等）仍解析为 `effect`，与改动前完全一致；旧效果类型（power/damage/...）继续走 `RULE_VISUALS` 原分支，未被新映射抢占。
- `playRuleDrivenEffect` 兼容三种入参：卡对象（`effects[0]`）、单效果对象、`{effect}` 包装。单效果对象时 `cardOrEffect?.name` 缺失由可选链兜底，横幅只依赖 `skillName`。
- `skillLabel` 缺失时 `showSkillBanner` 的默认参数落为「主动技」，与 `authored-card-rules.js` 的 `skillLabel` 字段一致。
- `showSkillBanner` / `playCoinFlip` 自带 `isBrowser` 守卫，Node/无 DOM 下均为安全空操作；`playRuleDrivenEffect` 本身在 Node 下提前 return。
- 硬币监听挂在 `GameController` 构造函数，`this.engine?.eventBus?.on?.()` 对缺少 eventBus 的测试替身安全；事件由引擎 `emit("onCoinFlip", { card, result, engine, gameState })` 广播，监听只取 `result`。

## 领域调用与任务 12 的衔接（与 brief 的一处防御性差异）

- brief 指定在 `playRuleDrivenEffect` 内直接调用 `playDomainCinematic(effect.params?.field, cardOrEffect?.name, ownerIndex)`，但该函数由任务 12 新增到 `effects.js`。任务 11 先于任务 12 实现时，domian 动作在浏览器会抛 `ReferenceError`，违反“控制台无报错”检查点。
- 处理：调用点加 `typeof playDomainCinematic === "function"` 守卫（同模块函数声明在任务 12 落地后会被提升可见）。任务 12 完成后领域演出自动生效，无需再改本行；未落地期间 domain 仍会走 `THEMED_ACTION_VISUALS.domain` 的 wave 特效与技能横幅，只是没有全屏领域演出。

## 浏览器检查点说明（未在本任务完成）

- `http://127.0.0.1:8091` 当前由旧 `target\sekai-game-1.0.0.jar` 提供（pid 664，java），返回的 `effects.js` 为 230167 字节旧版，不含 `THEMED_ACTION_VISUALS`；本地文件为 232627 字节。浏览器实测需任务 13 的重新打包 + 重启步骤。
- 作为替代验证，用临时假 DOM harness（`%TEMP%\opencode\task11-smoke.mjs`，未入库、无新依赖）加载真实 `effects.js` 并执行：`showSkillBanner`、`playCoinFlip`（heads/pending）、themedAction 卡对象/单效果对象/domain（无任务 12 时）/旧 `damage` 分支 —— 7 项全部 no-throw 且返回预期，确认无 ReferenceError 与旧分支回归。

## 疑问

- 无阻塞疑问。任务 12 的 `playDomainCinematic` 落地后，建议在任务 13 验收时确认 domain 卡的全屏演出 + 横幅同时出现（本任务已将两者调用点准备好）。

---

## 审查修复记录（2026-09-23 追加）

### Important 1：主题动作锚点改为目标卡（已修复）

- `js/ui.js`：怪兽槽位 `attrs` 增加 `data-atk`（表侧为 `Number(c.currentAttack) || 0`，里侧固定 0，避免泄底）；同一 `attrs` 变量同时用于表侧/里侧两个分支。
- `js/effects.js` `resolveRuleTargets` 新增 themed 分支（在敌方通用分支之前）：
  - `ignite/venom/bleed/curse/exile/detonate`：锚定敌方（相对 ownerIndex）怪兽槽中 `data-atk` 最大者；无槽位返回空数组（不播 FX）。
  - `paralyze`：`effect.params.count === "all"` 返回敌方全部怪兽槽，否则同"最高攻"单体；`gamble` 分支（params 无 count）自然走单体。
  - `infinity`、以及 `exile && params.self`（picture_ex_072 死亡回归）：锚定 `origin` 自身（审查未提 self 分支，按引擎 `par.self` 语义补正，避免自身异界打在敌怪上）。
  - `domain/gamble`：维持 `#battlefield` 锚点。
- 命中目标仍由原循环统一触发 `rule-target-pulse`，未绕开既有反馈。

### Important 2：`.status-mark` 状态徽记（已修复）

- `js/effects.js` 新增 `STATUS_MARK_META` 与 `showStatusMark(target, key, effect)`，在 `playRuleDrivenEffect` 循环中随 FX 一起插入目标槽位；层数用 `themedActionParams(effect).stacks`（引擎默认与卡面参数同源），如 `灼烧×3`、`诅咒×2`；无层数动作显示 `麻痹/异界/无下限/引爆`。徽记随 FX（1250ms）自动清理。
- `css/style.css` 追加 `.status-mark` + `@keyframes statusMarkPulse`（脉冲一次，颜色取 `THEMED_ACTION_VISUALS[key].color`，由 `--mark-color` 注入）；`.field-slot` 本身 `position:relative`，锚定在卡槽上方。

### Minor

1. `RULE_VISUALS[key] || THEMED_ACTION_VISUALS[key]` → `THEMED_ACTION_VISUALS[key] || RULE_VISUALS[key]`（已改）。
2. 测试追加 2 个（`test/status-effects.test.js` 共 52）：未知 themed action 回退 `themedVisualKey` 不抛错（含 null 与旧类型）；`showSkillBanner`/`playCoinFlip` 在 Node 安全空操作。为此 `themedVisualKey` 改为导出。
3. `.skill-banner`/`.coin-flip`/`.status-mark` 增加 `@media (prefers-reduced-motion: reduce) { animation-duration: .01ms !important; }`（沿用 `.rule-fx` 降级写法）。
4. `playCoinFlip` 未改 `audio.js`，`playSound("coin")` 接线留给任务 12。

### 修复后验证

- `node --test test/status-effects.test.js` → **52/52**（新增 2 用例）。
- 全量 `npm test` → **355 tests / 64 suites / pass 355 / fail 0**。
- `npm run check` → exit 0。
- 假 DOM harness 更新后 8 项全过：ignite 锚定 `data-atk` 最高的敌方槽并显示 `灼烧×2`（弱怪/里侧无徽记）、`paralyze count=all` 三个敌槽全部获 `麻痹`、`detonate` 显示 `引爆`（不显示层数）、`infinity` 锚定 origin 显示 `无下限`、domain 仍锚定 battlefield（`--rule-x` 取自 battlefield rect）、旧 `damage` 分支正常。
- 未执行 git 命令、未引入新依赖。
