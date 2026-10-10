# 任务 13 报告：全量回归 + 平衡冒烟 + 卡池导出

**状态：PASS（附 1 项观察，需协调者裁定；未执行打包/重启，按指示留给协调者）**

- 日期：2026-09-23
- 执行范围：任务简报步骤 1–3 + 卡池导出抽查；步骤 4–6（打包、重启、用户验收）未执行。
- 源码改动：无。临时对比环境在系统临时目录，未触碰项目源码。

---

## 1. 前端全量（工作目录 `SekaiGame\src\main\resources\static`）

### 1.1 `npm run check` — 通过

```
> nightcord-duel-network@1.4.0 check
> node -e "...对 js/scripts/test 下所有 .js/.mjs 做 --check..."
（无语法错误输出，退出码 0）
```

### 1.2 `npm test` — 通过

```
ℹ tests 357
ℹ suites 64
ℹ pass 357
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13417.3751
```

覆盖 pilot 相关用例（状态叠层、灼烧/剧毒结算、引爆/净化、异界、四领域、赌运、状态标签、特效映射等）全部 PASS。

### 1.3 `npm run fuzz`（120 局）— 通过

```
压测 120 局：正常结束 120 局，异常 0 局，平均 49.3 回合
胜负：A 51 / B 67 / 平局 2
```

### 1.4 `npm run selftest`（20 局）— 通过

```
自动试玩完成：20局全部正常结束
平均回合数：7.8
胜负分布：玩家A 10 / 玩家B 10 / 平局 0
```

---

## 2. 规则测试（工作目录 `SekaiGame`）

`node --test src/test/js/*.test.js` — 通过

```
ℹ tests 37
ℹ suites 0
ℹ pass 37
ℹ fail 0
ℹ duration_ms 1396.6173
```

含 pilot-roster（30 张试点卡动作映射/参数互异/§7 逐张锁定）、monster-cinematic-coverage、monster-signature、premium-monster-rule-uniqueness、卡面即结算、368 卡效果文本互异等，全部 PASS。

---

## 3. 平衡统计（`npm run balance`，40 局/对）

```
战斗规则：连锁上限 2 张／每回合无效化 0 次／每次支付 0 LP／陷阱上限 不限
=== 各构筑取向的卡组构成 ===
取向        低星/高星  怪兽  陷阱  平均ATK
curve       29/ 1       30     0    2006
big          2/33       35     1    2951
hybrid      14/15       29     0    2574
spell       17/ 2       19     0    2099
trap        17/ 1       18    20    2086

=== 两两对战（每对 40 局，先手交替）===
取向        胜率      场次
curve        65.0%   160
big           0.0%   160
hybrid       51.9%   160
spell        65.0%   160
trap         68.1%   160

平均回合数：9.0（最短 4，最长 36）
先手胜率：49.5%（已决出 400 局）

=== 陷阱结算统计 ===
攻击 2809 次｜陷阱响应 402 次（14.3% 的攻击被响应）｜其中直接取消攻击 189 次
  reduceDamage           54
  study                  40
  cannotAttack           29
  healPlayer             26
  destroyAttacker        24
  rescue                 24
  destroyAllAttackers    22
  counterAndDamage       22
  一次攻击吃掉的陷阱张数：1 张 378 次｜2 张 24 次
  取消攻击占响应 47.0%：多数陷阱靠效果赚资源，而不是直接废掉进攻。
```

### 3.1 阈值观察：`big` 取向 0.0%（<25%）

按指示**仅标明，未改任何数值**。为判断是否为本计划引入的回归，做了「改动前」对照：

- 对照方法：在系统临时目录（`%TEMP%\opencode\balance-clean\static`）用 `snapshots\clean\js`（改动前代码，无 `status-effects.js`，卡池中 0 处 ignite/exile/domain 引用）搭配当前 `scripts/self-play-balance.mjs` 与 `package.json`，跑同一命令 `node scripts/self-play-balance.mjs 40`。
- 结果：**与当前输出逐位一致**（curve 65.0 / big 0.0 / hybrid 51.9 / spell 65.0 / trap 68.1，陷阱统计也完全相同）。
- 结论：`big 0.0%` 是**改动前既有现象**，不是本次 pilot 引入的平衡回归。是否调整由协调者裁定。

### 3.2 疑虑：平衡冒烟的敏感度有限

连同 3.1 可推断：本次 30 张试点卡的新动作在这些 AI 构筑对局中**完全没有改变统计结果**（前后输出完全相同）。即 `npm run balance` 对 pilot 改动的回归敏感度为 0，不能用它证明新机制「未破坏平衡」，只能证明「未使既有统计恶化」。建议协调者知悉此局限。

---

## 4. 卡池导出（工作目录 `SekaiGame`）

命令：`node scripts/export-web-card-rules.mjs`

```
Exported 368 cards for Spring Boot and review document; Godot export is separate.
```

### 4.1 导出前后文件 mtime / 体积

| 文件 | 导出前 | 导出后 |
|---|---|---|
| `SekaiGame\src\main\resources\full-card-pool.json` | 2026/9/23 19:32:33，658,415 B | 2026/9/23 23:09:39，662,869 B |
| `docs\card-rules-2026-09.md` | 2026/9/23 19:32:33，107,114 B | 2026/9/23 23:09:39，109,317 B |

两文件 mtime 均已刷新。

> 路径说明：简报中的 `docs/card-rules-2026-09.md` 实际位于仓库根 `D:\Sekai_two\memory-16\docs\`（导出脚本按 `../../docs` 解析），非 `SekaiGame\docs\`。已验证该文件即导出目标。

### 4.2 `full-card-pool.json` 抽查（`effects[0]`）

| 卡 ID | 名称 | 实际 action | params | 预期（pilot-roster/§7） |
|---|---|---|---|---|
| picture_ex_030 | 炼狱杏寿郎·炎之呼吸 | `ignite` (onSummon) | `{stacks:2, damage:500}` | `S:ignite`，一致 |
| picture_ssr7_003 | 浊心斯卡蒂·深海夜宴 | `exile` (manual) | `{turns:1, penalty:300, self:false}` | `M:exile`，一致 |
| source_monster_015 | 五条悟·无量空处 | `domain` (manual) | `{field:"wuji", cost:1200}` | `M:domain`，一致 |
| source_monster_010 | 五条悟·无下限（可选抽查） | `infinity` (onSummon) | `{reduce:1000}` | 一致，且卡面描述含「战斗伤害减少1000」 |

`docs/card-rules-2026-09.md` 中对应卡行已同步新文案（如第 159 行炎之呼吸 ignite、第 73 行异界流放、第 343 行无量空处、第 338 行无下限）。

---

## 5. 异常与疑虑汇总

1. **`big` 取向 0.0% 胜率（<25% 阈值）**：已确认为改动前既有、可复现（seed 固定、确定性脚本），非本计划回归。仅报告，未改数值。
2. **平衡冒烟对 pilot 无敏感度**：改动前后统计逐位相同（见 3.1/3.2），作为回归信号价值有限。
3. **文档路径与简报笔误**：`docs/card-rules-2026-09.md` 在仓库根而非 `SekaiGame\docs`，不影响导出结果。
4. 无测试失败、无异常中断；未发现明确回归，因此未触发「停止并修复」路径。

---

## 6. 结论

- 前端 check / test / fuzz / selftest、规则测试、卡池导出全部通过；无失败。
- 卡池与规则文档已重新导出并抽查正确，满足打包前的资源更新要求。
- **可以进入打包阶段**（步骤 4 打包/重启由协调者执行）。
- 放行附带一项协调者裁定事项：`big 0.0%` 的既有平衡观察（本计划未引入、未恶化）。

**可复现命令：**

```powershell
# static 目录
npm run check
npm test
npm run fuzz
npm run selftest
npm run balance
# SekaiGame 目录
node --test src/test/js/*.test.js
node scripts/export-web-card-rules.mjs
```
