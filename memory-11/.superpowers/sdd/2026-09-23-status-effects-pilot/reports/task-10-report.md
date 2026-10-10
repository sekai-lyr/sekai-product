# 任务 10 报告：状态标签 UI + 麻痹判定跨任务缺口修复

## 状态

完成。`npm test` 全绿（351/351），`npm run check` 通过（exit 0）。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `js/card-view.js` | `cardRuleStatusHtml` 循环前追加异常状态层数、异界归来、领域、麻痹、无下限标签；新标签带 `status-*` class，旧标签行为不变 |
| `css/style.css` | `.card-rule-status` 块后追加 6 条状态色规则（brief 原文） |
| `js/controller.js` | 4 处 `frozenUntil` 判定并列加 `paralyzedUntil`（见下表） |
| `js/ui.js` | 3 处 `frozenUntil` 判定并列加 `paralyzedUntil`（见下表） |
| `test/status-effects.test.js` | 末尾追加 brief 用例 1 个 + 麻痹回归用例 1 个；既有 47 个用例未改动 |

## 测试结果

- 追加后先跑失败：48 tests / pass 46 / fail 2（与预期一致）。
- 实现后：`node --test test/status-effects.test.js` → 48/48。
- 全量：`node --test test/*.test.js` → **351 tests / 64 suites / pass 351 / fail 0**（基线 349）。
- `npm run check` → exit 0，无语法错误。

## `frozenUntil` 全部点位与处理结果

### js/controller.js（已并列加 `paralyzedUntil`）

| 行 | 位置 | 作用 | 处理 |
| --- | --- | --- | --- |
| 918 | `selectAttacker` | 人类点击怪兽选攻击手的前置校验（防止推进阶段） | 已加：麻痹期间点击被拒绝并提示 |
| 1177 | `pendingActions` | 结束回合二次确认的"还有可以攻击的怪兽" | 已加：麻痹怪不再触发确认噪音 |
| 2024 | `_runAiBattleStep` | AI 攻击手候选筛选 | 已加：AI 不再派麻痹怪攻击（否则引擎拒绝后 `_skipAiAttack`） |
| 2227 | `_chooseAiPlayAction` | AI 翻身/表示变更候选（`readyMonster`） | 已加：AI 不再尝试麻痹怪的翻/变表示 |

### js/ui.js（已并列加 `paralyzedUntil`）

| 行 | 位置 | 作用 | 处理 |
| --- | --- | --- | --- |
| 857 | `_renderMonsterSlots` `canAtk` | 高亮、`data-attacker`、拖拽属性 | 已加：麻痹怪不再显示为可攻击/可拖 |
| 889 | `_renderMonsterSlots` `showPosBtn` | 攻击/守备切换按钮 | 已加：麻痹期间不渲染该按钮 |
| 1075 | 字段点击处理器攻击窗口分支 | 主阶段点击自动进战斗并选攻击手 | 已加：麻痹怪点击不再走攻击分支 |

### 其他文件（未改，均有理由）

| 位置 | 说明 |
| --- | --- |
| `js/engine.js:2333`（翻转召唤）、`2365`（表示变更）、`2795-2796`（攻击） | 引擎规则判定，任务明确要求不改；2365/2796 已含麻痹判断 |
| `js/themed-effects.js:309/353/464/554` | 冻结/麻痹的施加、清理与目标筛选，非"能否攻击/改变表示"的控制层判定；554 已同时清理 `paralyzedUntil` |
| `js/card-view.js:89`（循环内 `frozenUntil` → "冻结"标签） | 标签展示，非可操作判定；本次新增 `paralyzedUntil` 标签在循环前独立展示 |
| `js/ui.js:449-455` `_showCardActions` 面板的"变为X表示/翻转召唤" | 该处对冻结与麻痹均无判定（冻结时期同样可点、由引擎拒绝）。不在本任务指定的 857/889/1075 三处内，属另一处既有缺口，未扩大改动范围 |

## 实现细节备注

- 标签顺序与文案严格按 brief：蓄力 → 灼烧 → 剧毒 → 出血 → 诅咒 → 异界归来 → 领域 → 麻痹 → 无下限 → 毒印/延迟爆破/效果无效/冻结/庇护1次/不可取对象/贯穿。
- 为使 brief 指定的 `status-*` 状态色 CSS 生效，新标签渲染为 `<span class="status-xxx">文本</span>`；brief 中旧标签的 `escapeHtml` 改为在入列时转义，转义策略不变。
- 回归用例（自行追加）：`pendingActions 不把麻痹怪兽算作可攻击`。首版因 `createCardInstance` 不初始化 `themedState` 报错，已改为显式赋值；brief 用例原文未动。
- 未引入依赖，未执行 git 命令。

## 疑问

1. `engine.js:2333` 翻转召唤只查 `frozenUntil` 不查 `paralyzedUntil`，而 `changePosition`（2365）两者都查。麻痹是否应阻止翻转召唤属引擎规则问题，本次按要求未动，建议 engine 负责人确认。
2. `ui.js` 右键操作面板（`_showCardActions`）在冻结/麻痹时仍显示表示变更按钮（引擎会拒绝），是否纳入后续 UI 收口任务。

## 审查修复记录（2026-09-23 追加）

### Important：engine 翻转召唤漏查麻痹（已修复）

- `js/engine.js:2333` `flipSummon`：判定追加 `|| card.themedState?.paralyzedUntil >= this.state.turn`，提示文案改为"本回合盖放、冻结或麻痹的怪兽不能翻转召唤"。
- 追加 engine 级测试 `麻痹阻止翻转召唤，解除后可翻转`：`faceDown:true, position:"defense", paralyzedUntil = turn+1` → 失败且含"麻痹"；同一张卡删除 `paralyzedUntil` 后翻转成功（faceUp=true、position=attack）。修复前该用例必失败（setTurn=0、无 frozen 会直接成功），具备鉴别力。

### Minor 1：层数格式对齐（已修复）

- `js/card-view.js` 异常状态标签改为 `灼烧×2` 格式；对应测试正则同步改为 `/灼烧×2/`、`/剧毒×1/`。

### Minor 2：领域标签查表（已修复）

- `js/card-view.js` 顶部 `import { DOMAIN_DEFS } from "./status-effects.js"`；领域标签改为 `DOMAIN_DEFS[state.domain.id]?.name`，已知 id 输出 `领域·<规格名>`（如 `领域·白金之星·世界`），未知 id 回退为 `领域`，移除原三层三元。

### 修复后验证

- `node --test test/status-effects.test.js` → 49/49（新增 flip 用例 1 个）。
- 全量 `node --test test/*.test.js` → **352 tests / 64 suites / pass 352 / fail 0**。
- `npm run check` → exit 0。
- 未改动延后项：`ui.js` 右键面板、`twin` 的 frozen 检查。
