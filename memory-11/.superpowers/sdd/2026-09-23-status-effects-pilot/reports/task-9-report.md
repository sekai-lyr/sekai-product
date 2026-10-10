# 任务 9 报告：30 张卡配方与技能名

- 状态：完成（全部命令真实执行，输出见下）
- 日期：2026-09-23
- 范围：`D:\Sekai_two\memory-16\SekaiGame\src\main\resources\static`（Web 端）与 `SekaiGame\src\test\js`

## 1. 改动文件

| 文件 | 改动 |
|---|---|
| `static/js/signature-tuning.js` | 追加 10 个试点动作候选池（`ignite/venom/bleed/curse/paralyze/domain/detonate/exile/infinity/gamble`）。候选按“同动作卡在 catalog 中的出现顺序”排列，前 N 项即 §7 目标数值（N=该动作试点卡数）。 |
| `static/js/authored-card-rules.js` | ① 30 张试点卡改为单动作 RECIPES（触发按 §7，`picture_ex_072: "D:exile"`）；② `Object.assign(CHARACTER_SKILLS, {...30 个技能名...})` 逐字采用简报；③ `prepareSignatureParams` 分两步发放：先用 `BASE_RECIPES`（试点改造前快照，含试点卡旧占位）按 `trigger\|action` 发全部卡，再让试点动作按“动作整组目录顺序”领取候选并覆盖试点卡。 |
| `static/js/themed-effects.js` | `exile` self 模板去掉重复的“自己被破坏送入墓地时，”；`detonate` 模板 `{stacks}` → `Math.max(1, p.stacks)`，剧毒扩散措辞改为“每层给对方全体表侧怪兽的守备力下降300，守备力变为0的破坏”。 |
| `src/test/js/pilot-roster.test.js` | 新建，简报两用例逐字使用。 |
| `static/test/themed-gameplay.test.js` | “死亡回归”用例替换为简报给定的异界归来语义。 |
| `static/test/rarity-rules.test.js`（偏差，见 §5） | 规则签名唯一性断言把 `params` 并入签名 key（试点卡刻意共用同一动作，规则差异在参数上；参数唯一性由 `effect-diversity` 全局锁定）。 |

未改动：`signature-rules.js`、其余 278 张自制卡与 60 张 starter 卡的配方/技能名/派生数值（脚本验证 0 变化，见 §4.3）。

## 2. 分组顺序核对脚本输出

脚本：`node task9-groups.mjs`（从 `catalog.js` 导入 `ALL_CARDS`，按 `effects[0].trigger|action` 分组打印；因实现按动作整组发放，另打印纯目录顺序）。

```
== 每个试点动作的卡在目录(ALL_CARDS)中的纯出现顺序 ==
exile: picture_ssr7_003(manual), picture_ex_018(manual), picture_ex_072(onDestroyed)
ignite: picture_ssr7_007(manual), picture_ssr7_026(onSummon), picture_ex_030(onSummon), source_monster_014(manual)
bleed: picture_ssr7_013(manual), picture_ssr7_015(manual), picture_ssr7_049(manual), picture_ex_014(manual), picture_ex_020(manual), source_monster_012(manual)
curse: picture_ssr7_014(manual), picture_ssr7_032(onSummon), source_monster_008(manual)
detonate: picture_ssr7_016(manual), picture_ex_012(manual), picture_ex_027(onSummon), source_monster_013(manual)
gamble: picture_ssr7_036(onSummon)
paralyze: picture_ssr7_043(onSummon), picture_ex_013(manual), picture_ex_048(manual)
domain: picture_ex_011(manual), picture_ex_056(manual), picture_ex_107(manual), source_monster_015(manual)
venom: picture_ex_037(manual)
infinity: source_monster_010(onSummon)

== 按 effects[0].trigger|action 分组（简报要求核对的分组） ==
manual|exile: picture_ssr7_003, picture_ex_018
manual|ignite: picture_ssr7_007, source_monster_014
manual|bleed: picture_ssr7_013, picture_ssr7_015, picture_ssr7_049, picture_ex_014, picture_ex_020, source_monster_012
manual|curse: picture_ssr7_014, source_monster_008
manual|detonate: picture_ssr7_016, picture_ex_012, source_monster_013
onSummon|ignite: picture_ssr7_026, picture_ex_030
onSummon|curse: picture_ssr7_032
onSummon|gamble: picture_ssr7_036
onSummon|paralyze: picture_ssr7_043
manual|domain: picture_ex_011, picture_ex_056, picture_ex_107, source_monster_015
manual|paralyze: picture_ex_013, picture_ex_048
onSummon|detonate: picture_ex_027
manual|venom: picture_ex_037
onDestroyed|exile: picture_ex_072
onSummon|infinity: source_monster_010
```

核对结论（决定数组排列的依据）：

1. 原实现按 `trigger|action` 分组、每组从候选池下标 0 重新发（`ids.forEach((id, index) => candidates[index]...)`）。同一动作存在多个触发组时（如 ignite 的 onSummon 与 manual），同一个下标 0 无法同时满足两组不同的 §7 数值，**按简报候选顺序逐字追加不可能让每张卡拿到 §7 目标值**。
2. 简报给出的候选数组实际是按 §7 表（ROSTER）顺序排列的；而实现按 catalog 顺序发。因此按任务要求“按目录里同动作卡的出现顺序排列”重排数组，并把试点动作改为**按动作整组发放**（10 个动作每张卡只有一项招牌技，语义上也更自然）。
3. 逐张核对：重排后 30/30 张与 §7 目标数值完全一致（见 §3）。
4. 为不改动其余 278 张卡，`prepareSignatureParams` 先用改造前配方快照 `BASE_RECIPES` 发旧参数（试点卡仍在旧分组占位），再覆盖试点卡；直接改会导致 68 张既有卡的候选序号前移、卡面数值被动变化（见 §4.3）。

## 3. 最终参数映射表（脚本逐张核对，30/30 OK）

| # | 卡 ID | 技能名 | action | trigger | params | §7 | 字数 |
|---|---|---|---|---|---|---|---|
| 1 | picture_ex_030 | 炎之呼吸·不知火 | ignite | onSummon | `{"stacks":2,"damage":500}` | OK | 77 |
| 2 | picture_ex_037 | 虫之呼吸·毒刃·紫藤毒 | venom | manual | `{"stacks":2,"damage":450}` | OK | 89 |
| 3 | picture_ex_020 | 蛇之呼吸·委蛇斩 | bleed | manual | `{"stacks":2,"damage":400}` | OK | 74 |
| 4 | picture_ex_048 | 霹雳一闪·火雷神 | paralyze | manual | `{"gamble":true,"amount":600}` | OK | 82 |
| 5 | picture_ex_027 | 血鬼术·爆血 | detonate | onSummon | `{"stacks":2,"damage":650}` | OK | 120 |
| 6 | picture_ex_056 | 破坏杀·罗针 | domain | manual | `{"field":"rojin","cost":800}` | OK | 68 |
| 7 | picture_ex_011 | 白金之星·世界 | domain | manual | `{"field":"za_warudo","cost":1000}` | OK | 59 |
| 8 | picture_ex_012 | 第一炸弹 | detonate | manual | `{"stacks":1,"damage":800}` | OK | 117 |
| 9 | picture_ex_013 | 世界·时停突袭·THE WORLD | paralyze | manual | `{"count":"all","amount":0,"gamble":false}` | OK | 47 |
| 10 | picture_ex_014 | 性感手枪·弹道折射 | bleed | manual | `{"stacks":3,"damage":300}` | OK | 74 |
| 11 | picture_ex_018 | D4C·爱之列车 | exile | manual | `{"turns":2,"penalty":500,"self":false}` | OK | 74 |
| 12 | source_monster_015 | 领域展开·无量空处 | domain | manual | `{"field":"wuji","cost":1200}` | OK | 56 |
| 13 | source_monster_010 | 无下限 | infinity | onSummon | `{"reduce":1000}` | OK | 57 |
| 14 | source_monster_012 | 伏魔御厨子·解 | bleed | manual | `{"stacks":2,"damage":600}` | OK | 74 |
| 15 | source_monster_014 | 开·炎矢 | ignite | manual | `{"stacks":1,"damage":800}` | OK | 74 |
| 16 | source_monster_013 | 虚式茈 | detonate | manual | `{"stacks":3,"damage":500}` | OK | 117 |
| 17 | source_monster_008 | 解·空间斩·狱纹 | curse | manual | `{"stacks":1,"damage":800}` | OK | 75 |
| 18 | picture_ex_072 | 死亡回归 | exile | onDestroyed | `{"turns":1,"penalty":500,"self":true}` | OK | 78 |
| 19 | picture_ssr7_032 | 沉默琴弦·沉默枷锁 | curse | onSummon | `{"stacks":1,"damage":600}` | OK | 78 |
| 20 | picture_ssr7_036 | 自由即兴·即兴曲 | gamble | onSummon | `{"draw":2,"heal":800}` | OK | 42 |
| 21 | picture_ssr7_043 | 人偶键盘·雪夜独奏 | paralyze | onSummon | `{"count":1,"amount":0,"gamble":false}` | OK | 59 |
| 22 | picture_ssr7_026 | 粉色和弦·点燃全场 | ignite | onSummon | `{"stacks":1,"damage":700}` | OK | 77 |
| 23 | picture_ssr7_049 | 暗潮低音 | bleed | manual | `{"stacks":1,"damage":650}` | OK | 74 |
| 24 | picture_ex_107 | 未来音浪·苍穹音浪 | domain | manual | `{"field":"ongaku","cost":600}` | OK | 72 |
| 25 | picture_ssr7_007 | 莱万汀·熔核烈歌 | ignite | manual | `{"stacks":3,"damage":400}` | OK | 74 |
| 26 | picture_ssr7_016 | D12·赤痕爆破 | detonate | manual | `{"stacks":1,"damage":750}` | OK | 117 |
| 27 | picture_ssr7_003 | 深海潮歌·深海夜宴 | exile | manual | `{"turns":1,"penalty":300,"self":false}` | OK | 74 |
| 28 | picture_ssr7_013 | 过载模式·红莲铳火 | bleed | manual | `{"stacks":2,"damage":500}` | OK | 74 |
| 29 | picture_ssr7_014 | 奇美拉·星屑天幕 | curse | manual | `{"stacks":2,"damage":500}` | OK | 75 |
| 30 | picture_ssr7_015 | 沸腾爆裂·炎锯镇岳 | bleed | manual | `{"stacks":1,"damage":700}` | OK | 74 |

`参数不一致或超字数：0；最长说明：120 字`（≤130 约束满足；premium-monster-rule-uniqueness 通过）

## 4. 命令与真实输出

### 4.1 先验证失败（步骤 2）

```
> node --test src/test/js/pilot-roster.test.js          （在 SekaiGame 下）
fail 1  pass 0
"30 张试点卡动作映射正确且卡面可渲染"：AssertionError: picture_ex_030 动作不符
  actual ['charge'] expected ['ignite']

> node --test test/themed-gameplay.test.js              （在 static 下）
tests 20  pass 19  fail 1
"死亡回归：破坏时支付800LP进入异界区并在结束阶段归来"：
  AssertionError: assert.ok(p.banished.includes(c)) === false
```

### 4.2 实现后聚焦测试（步骤 4）

```
> node --test src/test/js/pilot-roster.test.js src/test/js/effect-diversity.test.js src/test/js/premium-monster-rule-uniqueness.test.js
tests 6  pass 6  fail 0
（含“30 张试点卡动作映射正确且卡面可渲染”“30 张试点卡参数互不相同（同动作内）”
  “368张卡的效果文本全部互不相同”“自制卡的效果文字与引擎参数一致（卡面即结算）”
  “同一动作的每张卡都拥有不同的参数组合”“single signature rules passed: 181 cards”）
```

### 4.3 既有卡零改动核对（脚本）

```
> node task9-collateral.mjs
非试点自制卡：278 张，其中派生效果文本/参数发生变化的：0 张
starter 卡变化：0 张
```

（未加 `BASE_RECIPES` 占位时该脚本曾报 68 张变化：picture_ssr7_010/019/021/025/034/047/058、picture_ex_001/019/021/026/029/031/033/034/039/043/044/045/047/051/054/055/058/059/067/068/069/070/075/076/078/079/080/085/086/087/088/090/091/092/093/096/097/098/102/103/104/105/106/112、water_010、dark_006、nc_sp_ur_005、nc_sp_ss_004、gallery_spell_033/034/047、source_monster_001/004/005/007/011/016/017/019/020、source_spell_021。占位方案把这些卡的候选序号完全恢复原值。）

### 4.4 完成标准

```
> node --test src/test/js/*.test.js                    （SekaiGame）
tests 36  pass 36  fail 0   duration_ms 1624.1913        exit=0

> npm test                                              （static）
tests 348  suites 64  pass 348  fail 0  duration_ms 13373.2182   exit=0

> npm run check                                         （static）
无“语法错误”输出                                         exit=0
```

## 5. 关键实现决策与偏差

1. **候选池重排 + 试点动作整组发放**（见 §2 核对结论）：简报候选数组按 §7/ROSTER 顺序给出，与实现的 catalog 顺序及 `trigger|action` 分组都不一致；若照抄，多数卡拿不到 §7 数值（例如 `exile` 自身版会拿到 `self:false` 参数、死亡回归机制直接失效）。最终按任务指示“按目录里同动作卡的出现顺序”重排，并让 10 个试点动作按动作整组发放。
2. **`BASE_RECIPES` 占位**：保证其余 278 张卡派生参数/卡面零变化（§4.3）。代价是试点卡在新参数之外还保留一份旧配方的参数槽位（只参与索引计算，不进入卡面）。
3. **`rarity-rules.test.js` 修改**（简报未列出）：该测试断言 `type:ruleSignature` 全局唯一，而 30 张试点卡现在刻意共用单动作（4 组重复：M:domain×4、M:bleed×3、M:detonate×2、M:paralyze×2），不改测试 `npm test` 不可能全绿。修改方式是把 `effects[0].params` 并入签名 key，测试仍验证“每张卡规则可区分”（参数唯一性由 effect-diversity 全局锁定），未削弱其他断言。
4. **模板微调同步**：`exile`/`detonate` 文本与 handler 逐字一致（`Math.max(1, p.stacks)`），`effect-diversity` 的“卡面即结算”用例通过；30 张卡说明最长 120 字。
5. `picture_ex_072` 的 `RECIPES` 为 `D:exile`，技能名“死亡回归”保留在 `CHARACTER_SKILLS`；`signatureTarget` 对单动作配方直接落到该动作，旧 `SIGNATURE_PICKS` 里的 `returnSelf` 偏好自然失效并回退到 `actions[0]`。

## 6. 疑虑 / 待确认

1. **pilot-roster 只锁唯一性、不锁精确数值**：简报第二个用例按 `trigger|action` 校验参数互异，§7 精确数值目前只有 §3 的脚本核对，没有测试锁定。若后续平衡期调整数值，建议把 §7 映射直接写进测试（或新增一个参数快照测试）。
2. **`signature-rules.js` 的 `SIGNATURE_PICKS` 留有失效条目**（picture_ex_011: timeStop、picture_ex_012: bomb、picture_ex_072: returnSelf 等）。它们已不在新配方中，`pickSignatureAction` 会安全回退，但属于死配置；简报未要求清理，本次未动，建议后续任务顺手移除或注明。
3. **`BASE_RECIPES` 机制**是为“其余卡零改动”付出的复杂度：它假设本文件仍是唯一配方来源。若未来再次改动试点配方，需要同步维护该快照，否则既有卡序号会漂移。
4. **候选池尾部扩展值**（如 ignite 的 `{2,600}/{2,450}/{3,500}/{1,900}`）保留自简报，但当前没有卡领取；若平衡调整新增试点卡，需保证按目录顺序追加，不能插队。
5. `rarity-rules.test.js` 的改动超出简报文件清单（§5.3 已说明），请审查确认该处理方式可接受。

## 7. 审查补充（2026-09-23，只加测试断言，不动生产代码）

### 7.1 新增 §7 精确参数锁定用例

`src/test/js/pilot-roster.test.js` 追加 `EXPECTED_SIGNATURES`（30 张卡逐张的 `trigger/action/§7 参数`）与用例
“30 张试点卡的触发时机与有效参数逐张锁定 §7 表”：

- 有效参数按审查要求以 `{ ...ACTION_DEFAULTS[effect.action], ...(effect.params || {}) }` 合并后断言；
- 期望对象写全默认键（如 paralyze 的 `{count, amount, gamble}`、exile 的 `{turns, penalty, self}`），
  同时做 `deepEqual` 与 `JSON.stringify` 全等（键序/缺省键不一致也会失败）；
- 该用例与“参数互不相同”用例互补：前者锁精确数值，后者锁同动作唯一性。

**鉴别力验证（变异测试）**：把 `picture_ex_030` 的期望 `stacks` 从 2 改成 9 的副本运行：

```
> node --test src/test/js/_mutation-pilot-roster.test.js
pass 2  fail 1
AssertionError [ERR_ASSERTION]: picture_ex_030 有效参数与 §7 不一致
```

（验证后已删除变异副本；正常用例 3/3 通过。）

### 7.2 `picture_ex_072` 真实卡补充用例

`static/test/themed-gameplay.test.js` 在“死亡回归”用例后追加
“死亡回归：同名每回合1次，回归后攻-500并封印到下个回合”，全部走真实卡 `getCardById("picture_ex_072")`：

- 第一只被破坏：支付 800LP（7200）、进入除外区；
- 同一回合第二只同名被破坏：`themedUses["picture_ex_072:0"]` 已登记，`canActivateThemedEffect` 拒绝，
  LP 保持 7200、卡进墓地而非异界区；
- `e.endTurn()` 后回归：守备表示、`currentAttack === 基础攻击 - 500`、`sealedUntil === turn + 1`；
- `s.turn++` 后同名次数过期但封印仍在（`canActivateThemedEffect === false`），再 `s.turn++` 封印到期才恢复
  （`true`）—— 该判定只依赖 `sealedUntil`，具备鉴别力。

（引擎事实核对：`endTurn()` 只 `switchPlayer()`，`state.turn` 仅在 `startTurn()` 自增，因此“第一只回归后、第二只同回合被破坏”成立。）

### 7.3 补充后的完成标准输出

```
> node --test src/test/js/*.test.js                    （SekaiGame）
tests 37  pass 37  fail 0   duration_ms 1785.9529        exit=0

> npm test                                              （static）
tests 349  suites 64  pass 349  fail 0  duration_ms 13283.9326   exit=0

> npm run check                                         （static）
“语法错误”输出 0 条                                      exit=0
```
