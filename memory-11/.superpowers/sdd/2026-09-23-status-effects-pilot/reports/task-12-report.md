# 任务 12 报告：领域展开演出 + 音效

## 状态

完成。`npm test` 全绿（357/357），`npm run check` 通过（exit 0）。领域演出、10 个新音效、CSS 与任务 11 遗留 Minor 均已落地；Node 下全部安全空操作。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `js/effects.js` | 顶部新增 `import { playSound } from "./audio.js?v=1.0.0"`；`playCoinFlip` 接线 `playSound("coin")`；`resolveRuleTargets` 的 `paralyze count:"all"` 分支改用 `:not(.face-down-set)` 过滤里侧槽位；`showStatusMark` 对 `params.gamble === true` 的 paralyze 显示「抛硬币」；`playRuleDrivenEffect` 领域调用去掉 `typeof` 守卫改为直接调用；文件末尾追加导出 `DOMAIN_CINEMATICS`（4 领域）与 `playDomainCinematic`（brief 原文） |
| `js/audio.js` | `playSound` switch 新增 10 个 case：ignite / venom / bleed / curse / exile / paralyze / detonate / domain / coin / statusTick（brief 原文，含 pitch 变调） |
| `css/style.css` | 末尾追加 `.domain-overlay`（information/clock/compass/stage 四种 vignette）/`.domain-chip`/`.domain-overlay.reduced` + `@keyframes domainIn`、`domainChipIn`（brief 原文） |
| `test/status-effects.test.js` | 末尾追加 brief 2 个用例（领域演出定义、10 新音效 Node 空操作）；既有 52 个用例未改动 |

## 测试结果

- 先追加测试运行 `node --test test/status-effects.test.js` → FAIL（`does not provide an export named 'DOMAIN_CINEMATICS'`，与预期一致）。
- 实现后 `node --test test/status-effects.test.js` → **54 tests / pass 54 / fail 0**（基线 52）。
- 全量 `npm test` → **357 tests / 64 suites / pass 357 / fail 0**（基线 355，+2）。
- `npm run check` → exit 0，无语法错误。

## 与 brief 的差异 / 实现备注

- `paralyze count:"all"` 的过滤未用 `enemySlots.filter(...)` 而是重查 `:not(.face-down-set)[data-instance-id]`（含 `querySelectorAll` 缺失时的单查回退），与任务要求写法一致；单目标 `gamble` 分支不受影响（引擎只取表侧目标）。
- 赌运麻痹的徽记选择「显示抛硬币」而非「不显示」：与 `ACTION_TEXT.paralyze`（gamble 文案以「抛硬币」开头）一致，且保留视觉反馈。
- `playRuleDrivenEffect` 的守卫按任务说明简化为直接调用；`playDomainCinematic` 为同模块函数声明，提升可见，浏览器无 ReferenceError 风险（harness 已验证）。
- `playDomainCinematic` 的 `cardName` / `ownerIndex` 形参按 brief 保留但当前未参与渲染（title/subtitle 来自 `DOMAIN_CINEMATICS`），未额外发挥。
- `playSound("domain")` 与 effects.js 的 audio 实例经 `?v=1.0.0` 与 controller/main 共享开关状态。

## 浏览器路径验证（假 DOM harness）

`http://127.0.0.1:8091` 仍由旧 jar 提供静态资源（任务 11 报告已记录），无法直接浏览器实测；改用临时 harness `%TEMP%\opencode\task12-smoke.mjs`（未入库、无新依赖）加载真实 `effects.js` + 假 `AudioContext`（记录振荡器次数），11 项全过：

- 四领域 `DOMAIN_CINEMATICS` title/color 齐备；wuji 创建 overlay（`domain-information`、`--domain-color=#cfd6ff`）+ chip 且 domain 音效产生 2 个振荡器；
- clock 追加色差爆发、stage 追加粒子雨；`prefers-reduced-motion: reduce` 时 overlay 加 `reduced` 类；未知 fieldId 回退 wuji；
- domain 卡经 `playRuleDrivenEffect` 直接调用成功（无守卫）；`paralyze count:"all"` 里侧槽位 0 徽记、表侧获「麻痹」；gamble 麻痹徽记为「抛硬币」；`playCoinFlip` 触发 coin 音效（3 振荡器）。

## 疑问

- 无阻塞疑问。浏览器端四张领域卡的全屏演出 + chip 建议在任务 13 重新打包重启后做最终肉眼验收（本任务已用 harness 覆盖 DOM 结构与 no-throw）。

---

## 审查修复记录（2026-09-23 追加）

### I1：新音效调用点（已修复）

- `js/effects.js` 新增 `THEMED_ACTION_SOUNDS`（ignite/venom/bleed/curse/exile/paralyze/detonate/domain → 同名音效）；`playRuleDrivenEffect` 在 `targets.length` 检查与技能横幅之后、领域演出之前派发 `playSound(effect.action)`，即一次结算恰好播一次、无目标（返回 false）不发声。
- 避免双重发声的取舍：
  - domain 音效从 `playDomainCinematic` 移出（原 `playSound("domain")` 删除），统一由 `playRuleDrivenEffect` 派发；`playDomainCinematic` 的直接调用路径不再自行发声（全库无其他调用点）。
  - `paralyze + params.gamble === true` 跳过 `paralyze` 音：其硬币音由 `onCoinFlip → playCoinFlip → playSound("coin")` 覆盖，与徽记显示「抛硬币」的取舍一致。
  - `gamble` 不入 map（coin 已有）；`infinity` 不播（无专属音，`statusTick` 属伤害跳字语义，错配；比 hardcode 播一声更符合卡面观感）。
- `playMonsterEffect` 单次调用路径确认：其对 `card.effects` 逐条 `setTimeout(playRuleDrivenEffect, i*420)`，每条效果恰播一次；`playSpellEffectV2`/`playTrapEffectV2` 各自也只调用一次 `playRuleDrivenEffect`，三者为互斥结算路径，无重复入口。（既有行为备注：手动发动单效果时 `playMonsterEffect` 仍会遍历该卡全部 effects 逐条演出/发声，属任务 11 之前已存在的行为，本次未改。）
- `js/controller.js` 在任务 11 的 `onCoinFlip` 订阅同处新增 `onStatusTick → playSound("statusTick")`（burn/venom 结束阶段、bleed 战斗结算均 emit 该事件；Node 下安全空操作）。

### Minor：reduced-motion 完整降级（已修复）

- `playDomainCinematic` 命中 `prefers-reduced-motion: reduce` 时跳过 `playTimeSlowEffect`、clock 色差爆发、stage 粒子雨，仅保留领域 overlay/chip + `playEnergyPulse` 单次脉冲 + `reduced` 类；非 reduced 时行为与任务 12 原实现一致。

### 修复后验证

- 假 DOM + 假 `AudioContext` harness（`%TEMP%\opencode\task12-smoke.mjs`，未入库）24 项全过：8 个 action 音效逐一计数吻合（osc/noise：ignite 1/1、venom 3/1、bleed 0/1、curse 1/0、exile 1/1、paralyze 3/0、detonate 1/1、domain 2/0）、domain 恰播一次（osc=2 无翻倍）、gamble/infinity/无目标静默、`playMonsterEffect` 单效果路径恰 1 声、controller `onStatusTick` 触发 1 声、reduced-motion 无 timeSlow/chroma/particleRain 且保留 energyPulse。
- `npm test` → **357 tests / 64 suites / pass 357 / fail 0**；`npm run check` → exit 0。
- 未执行 git 命令、未引入新依赖，既有测试用例未改动。
