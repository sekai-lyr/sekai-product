# 30 张试点卡 · 状态异常与领域系统设计规格

- 日期：2026-09-23
- 状态：待用户审查
- 涉及项目：`D:\Sekai_two\memory-16`（SekaiGame Web 端；Godot 端明确不在范围内）

## 1. 背景与目标

现状：308 张自制卡各自从 37 个通用动作中取一项作为招牌技，参数错开但机制同质；
状态类只有毒印（一次性伤害）、延迟爆破、冻结、幻梦、蓄力这几种，玩家反馈"效果普通"。

目标（本规格只覆盖第一轮试点）：

1. 新增 10 个有状态/互动/领域机制的动作，形成"异常状态引擎"；
2. 30 张代表卡按**角色原作设定**换用新动作（名单见 §7，已获用户批准）；
3. 少量游戏王式运气效果（抛硬币，接入共享随机源）；
4. 保持既有约定：一卡一招牌技、技能名唯一、说明 ≤130 字、卡面文字与结算同源；
5. 其余 278 张自制卡与 60 张 starter 卡零改动。

## 2. 范围与不变量

- 改动端：仅 Web 端（`SekaiGame/src/main/resources/static/js`）。
- 不变量 1：`effect-diversity.test.js`（文本唯一、文本=参数、参数唯一）继续通过。
- 不变量 2：`premium-monster-rule-uniqueness.test.js`（一卡一效果、技能名唯一、≤130 字）继续通过。
- 不变量 3：`themed-gameplay.test.js` 中除"死亡回归"一条外全部原样通过；该条按 §7 更新预期。
- 不变量 4：所有新状态数据必须是纯 JSON，可被 `GameController._serializePvpState()` 序列化。
- 不变量 5：新动作可被 AI 尝试（`canResolveThemedEffect` 为唯一门槛），失败不得消耗发动次数。

## 3. 状态数据模型

```js
card.themedState = {
    statuses: {                 // 异常状态，层数为正整数
        burn: 2,                // 灼烧：结束阶段 伤害=damage×层数，随后 -1，上限 3
        venom: 1,               // 剧毒：结束阶段 伤害=damage×层数，不自然衰减，上限 3
        bleed: 3,               // 出血：每次参与战斗后 伤害=damage×层数，随后 -1
        curse: 1,               // 诅咒：效果无效 + 不可作祭品；被破坏时 伤害=damage×层数
    },
    burnDamage: 500,            // 每种状态的数值参数跟随来源卡记录（每次施加时更新，后来源覆盖）
    venomDamage: 500,
    bleedDamage: 400,
    curseDamage: 700,
    exile: { returnTurn: 12, penalty: 500, sealed: true },  // 异界区标记（在除外区期间保留）
    domain: { id: "wuji", until: 12, cost: 1200, applied: [] }, // 领域
    paralyzedUntil: 12,         // 麻痹（复用冻结式判定，但不改表示形式）
    infinityUntil: 12, infinityReduce: 1000, // 无下限
};
```

- `resetFieldCard` 清空 `themedState`（既有行为），因此异界回归时旧状态自然消失，回归后再施加攻-500。
- 状态标签文案由 `card-view.js` 的 `cardRuleStatusHtml` 输出，带层数（如 `灼烧×2`）。

## 4. 新增动作规范

通用约定：`ACTION_DEFAULTS` 提供默认参数，`ACTION_TEMPLATES` 渲染卡面（卡面=结算），
`canResolveThemedEffect` 给出可发动门槛，`themedEffectHandlers` 给出结算。

### 4.1 `ignite` 灼烧（鬼灭炎系/史尔特尔等）

- 默认参数：`{ stacks: 2, damage: 500 }`
- 卡面：`给对方攻击力最高的可取对象表侧怪兽放置{stacks}层灼烧；其控制者每个结束阶段受到{damage}×层数伤害，随后层数-1（上限3层）`
- 门槛：对方存在可取对象表侧怪兽。
- 结算：`min(3, 已有+stacks)`；记录 `burnDamage`。
- 结束阶段：**在灼烧怪兽控制者的结束阶段**，该控制者受 `burnDamage×层数`，层数-1，为 0 时删除。
- 回合结算约定：`resolveThemedTurnEnd(engine, endingPlayer)` 只对 `endingPlayer` 场上怪兽结算 DoT / 异界回归 / 领域到期（即每个玩家只在自己回合的结束阶段结算自己的状态）。

### 4.2 `venom` 剧毒（蝴蝶忍）

- 默认参数：`{ stacks: 2, damage: 450 }`
- 卡面：`给对方攻击力最高的可取对象表侧怪兽放置{stacks}层剧毒（上限3层）；剧毒怪兽的控制者每个结束阶段受到{damage}×层数伤害，且其所有回复减半；剧毒不会自然消失`
- 结算：`min(3, 已有+stacks)`；记录 `venomDamage`。
- 钩子：`Player.heal()` 中若 `monsterZone` 存在 venom，回复量减半（向下取整）。
- 净化：`purify` 对己方怪兽额外清除全部异常状态。

### 4.3 `bleed` 出血（伊黑/宿傩斩击/能天使/煌/海铃）

- 默认参数：`{ stacks: 2, damage: 400 }`
- 卡面：`给对方攻击力最高的可取对象表侧怪兽放置{stacks}层出血；出血怪兽每次参与战斗后，其控制者受到{damage}×层数伤害，随后层数-1`
- 结算：`min(3, 已有+stacks)`；记录 `bleedDamage`。
- 钩子：`engine.attack()` 的战斗结算完成后（含被攻击方），对攻守双方中带出血的怪兽执行上述伤害；攻击取消/卷回时不计。

### 4.4 `curse` 诅咒（宿傩狱纹/若叶睦/阿米娅）

- 默认参数：`{ stacks: 1, damage: 700 }`
- 卡面：`给对方攻击力最高的可取对象表侧怪兽施加诅咒：其效果无效、不能作为上级召唤的祭品；被破坏时其控制者受到{damage}×层数伤害`
- 结算：层数累加（上限 3），记录 `curseDamage`。
- 钩子：
  - `triggerAllEffects` 对带 curse 的怪兽直接返回 null（与 `sealedUntil` 同级）。
  - `selectTribute` 拒绝带 curse 的怪兽。
  - `destroyFieldMonster` 时对控制者造成伤害（用事件总线 `onDestroyed` 实现）。
  - `purify` 对己方场清除。

### 4.5 `exile` 异界流放 / 异界归来（瓦伦泰/斯卡蒂/菜月昴）

- 参数：`{ turns: 2, penalty: 500, self: false }`
- 敌方版卡面：`将对方攻击力最高的可取对象表侧怪兽送入异界区；{turns}个结束阶段后回到场上（守备表示、攻击力下降{penalty}、效果封印1回合）`
- 自身版（`self:true`，触发时机 onDestroyed）卡面：`自己被破坏送入墓地时，支付800LP，改为进入异界区；下一个自己的结束阶段以守备表示回到场上（攻击力下降{penalty}，可累计）、效果封印1回合`（回合限制由通用包装文案给出，模板内不重复）
- 结算：
  - 敌方版：目标移入**其持有者的除外区**并标记 `exile:{returnTurn: 当前回合+turns, penalty}`；异界区中的卡不能被 `recall` 取对象（改为跳过带 `exile` 标记的卡），也无法被其他效果选取。
  - 自身版：`onDestroyed` 事件里支付 800LP（LP 不足则不发动），移入己方除外区并标记；`returnTurn = 当前回合+1`。
  - 结束阶段 tick：到达 `returnTurn` 且己方怪兽区有空位时回归：守备表示、`permanentBuffs` 记 `attack -penalty`、`sealedUntil = 当前回合`；无空位则顺延。
- PvP：标记随卡序列化，回归由服务器双方共享的回合数驱动，无需额外协议。

### 4.6 `paralyze` 麻痹（THE WORLD / 祥子 / 善逸）

- 参数：`{ count: 1, amount: 0, gamble: false }`（`count: "all"` 表示全体）
- 单体卡面：`将对方攻击力最高的可取对象表侧怪兽麻痹：直到下个回合结束不能攻击或改变表示形式`
- 全体卡面：`对方全部表侧怪兽麻痹：直到下个回合结束不能攻击或改变表示形式`
- 赌运版（善逸）：`抛硬币：正面则麻痹对方攻击力最高的可取对象表侧怪兽（直到下个回合结束不能攻击或改变表示形式）；反面则其攻击力下降{amount}直到回合结束`
- 结算：`paralyzedUntil = game.turn + 1`、`canAttack = false`；不改表示、不降攻（赌运反面才降攻）。
- `attack()`、`changePosition()` 增加 `paralyzedUntil` 判定。
- 赌运使用 `engine._random()`（PvP 下为共享种子 RNG），结果与卡面文字两种走向一一对应。

### 4.7 `domain` 领域（无量空处 / 白金之星 / 罗针 / 苍穹音浪）

- 参数：`{ field: "<domainId>", cost: <LP> }`
- 门槛：`p.lp > cost`；`card` 在场上。
- 结算：支付 LP；写入 `card.themedState.domain = { id, until: 当前回合+1, applied: [] }`；
  领域跟随源卡，源卡离场即失效（`resetFieldCard` 清空自然实现）。
- 领域定义表 `DOMAIN_DEFS`：

| id | 卡 | 效果 |
|---|---|---|
| `wuji` 无量空处 | 五条悟·无量空处 | 直到对方回合结束，对方怪兽不能发动效果（`triggerAllEffects` 拒绝） |
| `za_warudo` 白金之星·世界 | 空条承太郎 | 直到对方回合结束，对方全部怪兽不能攻击（`attack()` 拒绝） |
| `rojin` 罗针 | 猗窝座·罗针 | 直到对方回合结束，自己每次受到战斗伤害减半，另一半反弹给攻击者（向上取整给攻击者） |
| `ongaku` 苍穹音浪 | 初音未来 | 直到对方回合结束，己方场上怪兽攻+500、对方场上怪兽攻-500（记入 `applied`，到期逐一回退） |

- 到期（结束阶段 tick）：回退 `applied` 的攻防增量，删除 `domain`。
- 文本由 `DOMAIN_DEFS[field].text` 渲染（含支付 LP），保证"写的=结算的"。

### 4.8 `gamble` 赌运（要乐奈）

- 默认参数：`{ draw: 2, heal: 800 }`
- 卡面：`抛硬币：正面则抽{draw}张卡；反面则回复{heal}LP`
- 结算：`engine._random() < 0.5` 走正面；PvP 共享种子下双方可复现。
- 文本与结算两种走向一一对应，无隐藏分支。

### 4.9 `detonate` 引爆（杀手皇后/祢豆子/W/虚式茈）

- 默认参数：`{ stacks: 2, damage: 600 }`
- 卡面：`给对方攻击力最高的可取对象表侧怪兽放置{stacks}层灼烧（至少1层），然后立即引爆其身上全部灼烧层数：每层使其控制者受到{damage}点伤害；若其带有剧毒，同时引爆剧毒：每层给对方全体表侧怪兽的守备力下降300，守备力变为0的破坏`
- 门槛：对方存在可取对象表侧怪兽（自身不带层数也能发动，即"放炸弹→引爆"）。
- 结算：先施加灼烧，取总层数结算单体爆发；有剧毒则清空剧毒并按层数对对方全体造成伤害；最后清空灼烧。

### 4.10 `infinity` 无下限（五条悟·无下限）

- 默认参数：`{ reduce: 1000 }`
- 卡面：`直到下个回合结束，自身不会成为对方效果的对象，且受到的战斗伤害减少{reduce}`（与 ward/freeze 同语义：`until = 当前回合+1`，在对方回合结束阶段到期）
- 结算：`cannotBeTargeted = true`、`infinityUntil = game.turn + 1`、`infinityReduce`；到期恢复 `cannotBeTargeted`（与 `wardUntil` 同模式）。
- `attack()` 战斗伤害计算中读取减伤。

## 5. 互动链（方案 C 精华）

1. 引爆 × 灼烧：`detonate` 消耗全部灼烧层，`层数×damage` 单体爆发。
2. 引爆 × 剧毒：`detonate` 消耗剧毒层，`层数×300` 对方全体伤害。
3. 净化 × 诅咒：`purify` 清除己方全部异常状态（burn/venom/bleed/curse）。
4. 剧毒 × 回复：中毒方所有回复减半（蝴蝶忍压制治疗体系）。
5. 异界 × 回收：`recall` 不再能拿回异界区的卡（被放逐的卡必须等回归倒计时）。

## 6. 引擎接入点（现状文件）

| 位置 | 改动 |
|---|---|
| `js/themed-effects.js` | 新动作的 DEFAULTS/TEMPLATES/canResolve/handler；`resolveThemedTurnEnd(engine, endingPlayer)` 增加状态 tick、异界回归、领域到期（由 `engine.endTurn()` 传入回合玩家） |
| `js/status-effects.js`（新建） | 状态施加/清除/查询/tick、DOMAIN_DEFS、赌运随机封装 |
| `js/engine.js` | `triggerAllEffects`（curse/domain 拒绝）、`attack()`（麻痹判定、出血钩子、域减伤/反弹、infinity 减伤）、`changePosition`（麻痹）、`selectTribute`（诅咒）、`destroyFieldMonster`/事件总线（诅咒亡语、自身异界）、`Player.heal`（剧毒减半，位于 model.js） |
| `js/card-view.js` | `cardRuleStatusHtml` 新标签与层数 |
| `js/model.js` | `Player.heal` 钩子；`resetFieldCard` 已满足需求 |
| `js/authored-card-rules.js` | 30 张卡 RECIPES 改为新动作；CHARACTER_SKILLS 固定技能名 |
| `js/signature-rules.js` | 如个别卡签名选择受影响，补 SIGNATURE_PICKS 指向新动作 |

## 7. 30 张卡变更表（现动作 → 新动作）

触发沿用：S=onSummon / M=manual / D=onDestroyed / E=onTurnEnd。参数为初稿，实现时可微调但必须满足"同动作参数互不相同"。

| # | 卡 ID | 名称 | 现动作 | 新动作 | 触发 | 参数初稿 | 技能名 |
|---|---|---|---|---|---|---|---|
| 1 | picture_ex_030 | 炼狱杏寿郎·炎之呼吸 | charge | ignite | S | {stacks:2,damage:500} | 炎之呼吸·不知火 |
| 2 | picture_ex_037 | 蝴蝶忍·紫藤毒 | poison | venom | M | {stacks:2,damage:450} | 虫之呼吸·毒刃·紫藤毒 |
| 3 | picture_ex_020 | 伊黑小芭内·蛇之呼吸 | poison | bleed | M | {stacks:2,damage:400} | 蛇之呼吸·委蛇斩 |
| 4 | picture_ex_048 | 我妻善逸·火雷神 | burst | paralyze | M | {gamble:true,amount:600} | 霹雳一闪·火雷神 |
| 5 | picture_ex_027 | 灶门祢豆子·爆血 | prepare | detonate | S | {stacks:2,damage:650} | 血鬼术·爆血 |
| 6 | picture_ex_056 | 猗窝座·罗针 | seal | domain | M | {field:"rojin",cost:800} | 破坏杀·罗针 |
| 7 | picture_ex_011 | 空条承太郎·白金之星 | timeStop | domain | M | {field:"za_warudo",cost:1000} | 白金之星·世界 |
| 8 | picture_ex_012 | 吉良吉影·杀手皇后 | bomb | detonate | M | {stacks:1,damage:800} | 第一炸弹 |
| 9 | picture_ex_013 | 迪亚哥·THE WORLD | timeStop | paralyze | M | {count:"all"} | 世界·时停突袭·THE WORLD |
| 10 | picture_ex_014 | 盖多·米斯达·性感手枪 | twin | bleed | M | {stacks:3,damage:300} | 性感手枪·弹道折射 |
| 11 | picture_ex_018 | 法尼·瓦伦泰·爱之列车 | revive | exile | M | {turns:2,penalty:500} | D4C·爱之列车 |
| 12 | source_monster_015 | 五条悟·无量空处 | freeze | domain | M | {field:"wuji",cost:1200} | 领域展开·无量空处 |
| 13 | source_monster_010 | 五条悟·无下限 | ward | infinity | S | {reduce:1000} | 无下限 |
| 14 | source_monster_012 | 两面宿傩·伏魔御厨子 | bomb | bleed | M | {stacks:2,damage:600} | 伏魔御厨子·解 |
| 15 | source_monster_014 | 宿傩·炎矢 | bomb | ignite | M | {stacks:1,damage:800} | 开·炎矢 |
| 16 | source_monster_013 | 五条悟·虚式茈 | burst | detonate | M | {stacks:3,damage:500} | 虚式茈 |
| 17 | source_monster_008 | 两面宿傩·狱纹 | devour | curse | M | {stacks:1,damage:800} | 解·空间斩·狱纹 |
| 18 | picture_ex_072 | 菜月昴·死亡回归 | returnSelf | exile | D | {self:true,turns:1,penalty:500} | 死亡回归 |
| 19 | picture_ssr7_032 | 若叶睦·沉默枷锁 | seal | curse | S | {stacks:1,damage:600} | 沉默琴弦·沉默枷锁 |
| 20 | picture_ssr7_036 | 要乐奈·自由即兴 | study | gamble | S | {draw:2,heal:800} | 自由即兴·即兴曲 |
| 21 | picture_ssr7_043 | 丰川祥子·雪夜独奏 | freeze | paralyze | S | {count:1} | 人偶键盘·雪夜独奏 |
| 22 | picture_ssr7_026 | 千早爱音·粉色和弦 | scout | ignite | S | {stacks:1,damage:700} | 粉色和弦·点燃全场 |
| 23 | picture_ssr7_049 | 八幡海铃·暗潮低音 | revive | bleed | M | {stacks:1,damage:650} | 暗潮低音 |
| 24 | picture_ex_107 | 初音未来·苍穹音浪 | chorus | domain | M | {field:"ongaku",cost:600} | 未来音浪·苍穹音浪 |
| 25 | picture_ssr7_007 | 史尔特尔·熔核烈歌 | burst | ignite | M | {stacks:3,damage:400} | 莱万汀·熔核烈歌 |
| 26 | picture_ssr7_016 | W·赤痕爆破 | bomb | detonate | M | {stacks:1,damage:750} | D12·赤痕爆破 |
| 27 | picture_ssr7_003 | 浊心斯卡蒂·深海夜宴 | revive | exile | M | {turns:1,penalty:300} | 深海潮歌·深海夜宴 |
| 28 | picture_ssr7_013 | 能天使·红莲铳火 | burst | bleed | M | {stacks:2,damage:500} | 过载模式·红莲铳火 |
| 29 | picture_ssr7_014 | 阿米娅·星屑天幕 | seal | curse | M | {stacks:2,damage:500} | 奇美拉·星屑天幕 |
| 30 | picture_ssr7_015 | 煌·炎锯镇岳 | pierce | bleed | M | {stacks:1,damage:700} | 沸腾爆裂·炎锯镇岳 |

**需更新的既有测试**：`static/test/themed-gameplay.test.js` 的"死亡回归支付LP且同名每回合只能一次"改为：
被破坏时支付 800LP → 卡进入除外区（带异界标记）→ 下一个结束阶段回归（守备表示、攻-500、封印1回合）；
LP 不足时不发动、卡进墓地；同名每回合 1 次。

## 8. 平衡初稿与风险

- DoT 总量控制：灼烧/剧毒单层 400-800、上限 3 层；出血 300-700/次；引爆总爆发 = 层数×500-800。
- 领域费用 600-1200LP，无量空处（封锁效果）与白金之星（封锁攻击）为最强控制，费用最高。
- 主要风险：剧毒+回复减半对治疗流可能过强；无量空处先手压制。缓解：两者均为每回合 1 次、离场即失效；
  以 `npm run balance` 改动前后对比确认无卡组胜率异常。
- 数值可调，但"卡面文字=结算"必须保持：调参数即调卡面，二者同源。

## 9. 测试计划

1. 新增 `static/test/status-effects.test.js`：
   - 每个新动作的施加/结算/到期；
   - 引爆×灼烧、引爆×剧毒、净化×诅咒、剧毒×回复减半、异界×回收 五条互动；
   - PvP 快照序列化往返（含领域、麻痹、异界标记）；
   - 赌运在固定种子下可复现。
2. 新增 `src/test/js/pilot-roster.test.js`：
   - 30 张卡的 action/trigger 与 §7 表一致；卡面包含渲染文本；
   - 参数由 `signature-tuning.js` 候选池按 §7 数值顺序供给（平衡期调整数值时，必须同步更新 §7 表与候选池顺序），同动作参数唯一性由 effect-diversity 覆盖；
   - 技能名唯一沿用既有断言。
3. 更新 `themed-gameplay.test.js` 死亡回归用例（§7 末）。
4. 回归：`static` 下 `npm run check && npm test`，`src/test/js` 下全量 node --test；
5. 冒烟：`npm run fuzz`、`npm run selftest`、`npm run balance`（40 局）对比改动前后。
6. 验收：重新打包 jar 并重启 8091，用户试玩：状态标签可见、按角色不同、互动可复现、无崩溃。

## 10. 演出层：动作特效与领域展开（用户追加要求："卡牌动作更新成最新的，比如领域展开的特效"）

### 10.1 动作特效映射（effects.js）

- `ruleVisualKey` / `resolveRuleTargets` 扩展为识别 `effect.type === "themedAction"`：按 `effect.action` 取视觉键
  （新增 `THEMED_ACTION_VISUALS` 表），不再落入通用 `effect` 键。
- 新增 10 个动作的视觉定义（沿用 `.rule-fx-*` 体系，新增 keyframes 追加到 `css/style.css` 末尾）：

| action | 视觉 | 配色 |
|---|---|---|
| ignite | 橙红火焰粒子 + 目标卡火苗残留 | #ff7a3c / #ffd36b |
| venom | 紫绿毒雾 + 滴落 | #9d6bff / #7dffa8 |
| bleed | 绯红斩痕 + 血滴 | #ff4f70 / #ff9b8a |
| curse | 黑紫符纹环绕 | #8c5cff / #2a1740 |
| exile | 目标被吸入紫色裂隙（portal 圈缩小） | #7b5cff / #1b1035 |
| paralyze | 金色电弧 + 短暂定格 | #ffe06b / #70dcff |
| detonate | 多层冲击环 + 屏幕轻震（复用 rule-camera-impact） | #ff5d67 / #ffb04a |
| infinity | 透明屏障波纹 | #d7e6ff / #8fb8ff |
| domain | 走 10.2 专属演出 | 各领域定义 |
| gamble | 走 10.3 硬币演出 | 金色 |

- 状态施加/层数变化时在目标卡上方显示状态徽记（`.status-mark`，含层数，脉冲一次）。

### 10.2 领域展开专属演出（新增 `playDomainCinematic`）

- 触发：动作 `domain` 结算时。结构：全屏暗化 → 领域名横幅（大字+出典副标题）→ 领域专属视觉 → 低强度氛围残留至领域结束。
- 四个领域差异化（组合使用现有 `playTimeSlowEffect / playChromaticBurst / playParticleRain / playCameraSwoop / playEnergyPulse` + 自有 overlay）：
  - `wuji` 无量空处：黑白反相闪 + 下落信息流（文字/数字雨）+ 强暗角；横幅「領域展開 · 無量空處」
  - `za_warudo` 白金之星·世界：时间减速 + 钟表刻度环 + 金色脉动；横幅「スタープラチナ・ザ・ワールド」
  - `rojin` 破坏杀·罗针：红色罗盘旋转 + 指针定身；横幅「破壊殺・羅針」
  - `ongaku` 苍穹音浪：舞台追光 + 霓虹声波涟漪 + 音符粒子；横幅「苍穹音浪」
- 时长 1.2–1.6s；异步播放、不 await、不阻塞结算；`prefers-reduced-motion` 降级为横幅 + 单次脉冲。
- 领域存续期间战场显示小徽记 `.domain-chip`（含领域名），到期消失。

### 10.3 赌运硬币演出（新增 `playCoinFlip`）

- 全屏硬币翻转 0.9s，定格「正面/反面」后接对应效果粒子。
- 结果由引擎在结算时写入 `engine.emit("onCoinFlip", { result })`；演出只读取事件结果，不自行随机（演出即结算）。

### 10.4 技能横幅（新增 `showSkillBanner`）

- 主题动作发动时屏幕上方横幅 `【主动技】技能名`（0.9s），配色随属性/稀有度；复用现有 banner 样式与 z-index 规范，不阻塞操作。

### 10.5 音效（audio.js 新增合成音）

- `ignite` 火起、`venom` 毒滴、`bleed` 斩击、`curse` 诅咒下行音、`exile` 异界扫频、`paralyze` 电击、
  `detonate` 爆炸、`domain` 领域低鸣、`coin` 硬币三连击、`statusTick` 状态结算脉冲。
- 统一走 `playSound(name, { pitch })`；无 WebAudio / Node 环境安全空操作。

### 10.6 演出测试与不变式

- 新演出函数在 Node 下安全空操作（沿用 `isBrowser` / audio 守卫）。
- 新增静态测试：10 个新动作在 `THEMED_ACTION_VISUALS` 均有映射且键唯一；4 个领域在 `DOMAIN_CINEMATICS` 均有定义（纯数据断言，无浏览器依赖）。
- CI 的 `node --check` 覆盖全部新代码。



## 11. 明确不做（YAGNI）

- 不做其余 278 张自制卡；不做 Godot 端；不做抽卡/经济/UI 大改；
- 不做领域互斥/叠加的通用系统（同场多领域各记在源卡上，规则即各自生效）；
- 不做新状态的热更（改动走 jar 重建 + 重启，与现有流程一致）；
- 不做演出跳过/开关（沿用系统 `prefers-reduced-motion` 降级）。

## 12. 已确认决策记录

| 决策 | 结论 | 来源 |
|---|---|---|
| 试点范围 | 30 张代表卡 | 用户选择 |
| 作品分布 | 各作品均衡（鬼灭6/JoJo5/咒术6/Re:Zero1/MyGO初音6/方舟6） | 用户选择 |
| 端 | 仅 Web | 用户选择 |
| 随机性 | 允许少量抛硬币（共享随机源） | 用户选择 |
| 骨架 | 状态异常引擎 + 领域 + 互动链 | 用户选择 |
| 名单 | 按角色原作设定对齐（本文件 §7） | 用户批准 |
| 菜月昴 072 | 改为异界归来，同步更新旧测试 | 用户批准 |
| 演出层 | 机制与最新特效一起做（含领域展开专属演出、硬币演出、技能横幅、合成音效），见 §10 | 用户追加要求 |
