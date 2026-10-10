# 逻辑 Bug 审查与修复报告

审查范围：`SekaiGame`（Java Spring Boot 后端 + 浏览器端 ES Module 游戏）
+ `SekaiGameGodot` 不涉及。
基线：修改前 `node --test test/*.test.js` = 216 通过 / 0 失败（即缺陷未被现有测试覆盖）。

## 验证结果（修改后）

| 项目 | 结果 |
| --- | --- |
| 规则/流程测试 `node --test test/*.test.js` | **247 通过 / 0 失败**（新增 31 条回归测试） |
| 随机不变量压测 `.bug-review/fuzz.mjs`（200 局，逐步校验状态完整性） | **200 局全部正常结束，0 处不变量违规** |
| AI 自动对战 `scripts/self-play.mjs`（20 局） | 全部正常结束，平均 16.2 回合 |
| 主题卡自战 `scripts/self-play-themed.mjs` | 通过 |
| PvP 端到端 `.bug-review/pvp-e2e.mjs` | 建房/加入/开局/122KB 快照中继全部通过 |
| 后端编译 `mvn -o -DskipTests compile` | 通过 |
| 浏览器模块图 `.bug-review/module-graph.mjs` | 87 个模块 URL 全部 200 |

## 修复清单（按严重度）

### 致命 / 高

1. **AI 战斗阶段死循环（PvP 与 AI 对局软锁）** `controller.js`
   `_runAiBattleStep` 在 `engine.attack()` 返回 `success:false` 时没有失败分支，
   而过滤器每轮都会重新选中同一只怪兽 → AI 回合永不结束。触发条件包括场地魔法
   禁止直接攻击、目标「不能被攻击」、怪兽被冻结、里侧攻击表示等。
   修复：新增 `_skipAiAttack()` 消耗攻击机会 + 显式失败/卷回分支 + 过滤器补
   `faceUp`/`frozenUntil` + `_chooseAiAttackTarget` 跳过受保护目标。
2. **重新上场的怪兽无法攻击** `engine.js`
   `_executeSummon` 只清 `hasAttackedThisTurn` 不清 `attacksMadeThisTurn`，
   而祭品送墓会写入 `attacksMadeThisTurn=1`。结果：被祭品/效果送回卡组后再召唤的
   怪兽 `canAttack=true`（界面显示可攻击），实际 `attack()` 拒绝「该怪兽本回合不能攻击」。
3. **盖放的魔法卡永远无法发动** `engine.js`
   `canActivateSetSpell` 只允许 MAIN_1/MAIN_2，但控制器确认目标时阶段是
   TARGET_SELECT → 一切「需要指定目标的盖放魔法」都报「只能在主要阶段发动」。
   修复：与 `activateSpell` 一致，放行目标选择阶段。
4. **对手断线 = 白送 PvP 胜利奖励** `main.js`
   `onOpponentDisconnect` 直接判定自己获胜并发放 +1000 决斗币，两个客户端可无限刷。
   修复：断线按平局结算（0 奖励）。
5. **PvP 消息超过 64 KiB 导致必定软锁** `WebSocketConfig.java`/`PvpWebSocketHandler.java`/`scripts/pvp-server.mjs`
   每条 end_turn 都携带双方完整快照，实测 60 张卡组约 76 KB，55 张起超过旧上限
   64 KiB → 服务器直接关连接。修复：上限提升到 512 KiB，超限只报错不断连。
6. **PvP 服务端不洗牌 / 不下发自己的卡组** `scripts/pvp-server.mjs`
   客户端 PvP 使用 `preserveDeckOrder`，node 版服务器既不下发 `deck` 也不洗牌 →
   双方按编辑器原始顺序出战（起手可预知）。修复：服务端洗牌并同时下发双方卡组。
7. **十连保底进度被清零** `app.js`
   十连中只要出现 UR 就把 `packsSinceUR` 写 0，丢掉同一批里 UR 之后的包数（最多 9 包）。
8. **每日首胜奖励永远无法获得** `rewards.js`
   关卡与普通 AI 分支都在每日奖励循环之前 return，而首页常年宣传「+300」。
   修复：关卡胜利同样结算每日首胜。
9. **建议卡组非法（不足 40 张）** `deck.js`
   `buildSuggestedDeck` 随机抽到已达同名上限的卡就 break。修复：每轮重新过滤候选。
10. **`escapeHtml` 不转义引号/不转字符串** `effects.js`
    卡片数据会插入 `src="..."` 等属性，PvP 对端可注入 `" onerror=`；非字符串还会抛
    `TypeError`。修复：强制 `String()` 并转义 `& < > " '`。

### 中

11. `engine.js` `endTurn()` 提前 return 前不清理 `pendingTribute` 等状态。
12. `engine.js` `endTurn()` 只清 `doubleAttackThisTurn` 不清 `attacksMadeThisTurn`。
13. `engine.js` 陷阱「援军/城壁」把 +500 加在陷阱卡自己身上（整卡无效）；直接攻击时
    又会加成到攻击方。修复：只作用于本次战斗的守方怪兽。
14. `engine.js` `reflectDamage` 忽略卡面数值（声明 500 却按攻击力全额反弹）。
15. `engine.js` `reviveToHand` 被重复定义，生效的那份忽略玩家选择的墓地目标。
16. `engine.js` 手动选靶忽略卡面 `target.selector/filters`（「地裂」可拆任意怪兽）。
17. `engine.js` 攻守数值只改字段不登记 buff，回合边界被 `_recalcCardStats` 还原
    （「心变」「守备封禁」的 -500 当回合结束即失效）。
18. `engine.js` 守方减伤陷阱同时减免了攻击方自身承受的战斗伤害。
19. `engine.js` `changePosition` 在确认怪兽在场之前扣除场地魔法的弃手代价（白掉手牌）。
20. `engine.js` `advancePhase()` 对目标选择阶段返回 index -1 会把阶段跳回抽卡阶段。
21. `engine.js` `_restoreTemporaryBanishments` / `destroyMonster` 等路径产生的
    衍生物缺少 `isToken`，被破坏后进入墓地且可作祭品。
22. `engine.js` `debuffEnemyAttack` 无目标兜底选的是攻击力**最低**的怪兽。
23. `engine.js` `damageAndHeal` 选「对方玩家」时既不造成伤害也不回血。
24. `engine.js` 签名技中「封锁/攻守逆转/击退」因缺少目标而静默空转。
25. `engine.js` 朝比奈真冬的「攻击封锁」在回合开始时被清除，封锁等于无效。
26. `model.js` `cannotActivateThisTurn`（手牌/后场）永不清除。
27. `model.js`/`themed-effects.js` 复活后从墓地回卡组/手牌不清运行时状态，攻守修正
    与已受伤数值会跟着「复活」。
28. `themed-effects.js` 连击（twin）只改 `doubleAttackThisTurn` 不刷新 `canAttack`，
    已攻击过的怪兽白付 600LP。
29. `themed-effects.js` `exchange` 换上的怪兽被错误地封印效果一回合。
30. `themed-effects.js` 衍生物 instanceId 用「回合+事件数+怪兽区数量」组合，可重复
    （产生跨区域重复的卡牌身份）。
31. `rng.js` `weightedPick` 把权重 0 当成 1，保底期间被压到 0 的稀有度仍会被抽中。
32. `rng.js` `SeededRandom(0)` 被 `seed || Date.now()` 判为无种子，破坏确定性契约。
33. `rng.js`/`model.js` `shuffleArray` 把随机源对象当函数调用（PvP 会抛 TypeError）。
34. `packs.js` 十连 SSR 保底判断错误（`hasSSR` 从未使用）；最后一包保底在卡池无 R 时
    静默失效；第 50 包把每个卡位都变成 UR（8 张 UR）。
35. `collection.js` `enableDemoMode` 每次启动给每张卡 +3（累积 3N，超过持有上限）。
36. `decks.js` AI 预设卡组对 6 种卡各放 4 张（本身是非法卡组，过不了校验）。
37. `ui.js` `[data-pos-switch]` 监听器写在卡槽循环内，一次点击执行 N 次。
38. `ui.js` 点击可攻击怪兽不会进入战斗阶段（与帮助文案、测试语义矛盾）。
39. `ui.js` `enemy_monster_or_player` 的「玩家」目标没有任何可点元素 → 进入选靶态后
    手牌隐藏、结束回合禁用（界面软锁）。
40. `ui.js` `_onField` 是历史标记，离场后仍提供场内操作（配合场地弃手会白掉手牌）。
41. `app.js` 开包确认按钮不关闭不禁用，双击扣两次费开两次包。
42. `app.js` 迟到的异步回调无条件重绘自己的界面（顶掉用户当前界面）。
43. `app.js` 收藏搜索防抖定时器不被导航清理。
44. `app.js` PvP 弹窗被关闭后错误分支空指针 → 全局致命错误面板；错误回执后按钮永久禁用。
45. `app.js` 卡组草稿在重返卡组页时被静默丢弃；`renderRules` 有不可达代码；
    `onStartPvp` 绕过卡组校验；商店显示卡池数量错误（368 vs 308）。
46. `app.js`/`card-view.js` `rarityRank` 把 UR 与 SSR 记为同级（卡包演出会谎报最高稀有度）。
47. `main.js` 空背包账号被判为登录失效（反复踢回登录页）。
48. `main.js` 显示设置（减少动效/决斗日志）刷新后失效。
49. `main.js` 离线新档 0 卡 0 卡组 → 无法决斗赚钱（新增入门卡组）。
50. `PvpWebSocketHandler.java` 房间销毁时未清理对手的会话条目（对手再也无法建房/加入）；
    `room.ready` 非并发安全；`requestId` 从不比对（重发会抢回回合）；
    `game_over` 未校验且胜负视角未换算。
51. `CollectionService.java` 开包余额为读-改-写，并发可双花；改为条件式原子扣费。
52. `effects.js` `tributeCount` 只做 ≥0 限制，`Infinity` 会导致死循环；
    属性主题表无兜底会抛错；`animateCinematicReturnToHand` 永久破坏手牌容器定位。

## 未修复 / 需要决策（已确认但属设计取舍或数据缺失）

- 「共鸣」系统：`getUniqueNightcordMembers` 依赖卡牌 `member` 字段，但 368 张卡的
  `member` 全部为 `null`（数据里显式写的 null）。补齐需要按角色名归类，属于新增数据，
  未擅自修改。影响面极小：所有 `resonance*` 处理器目前无任何卡引用，
  仅 `_resolveBattleTrap` 的 +500 追加伤害受影响。
- `card-rules.js` 中 `CARD_RULES`/`galleryEffect`/`fallbackEffect`/`rarity-rules.js`
  设计层在归一化顺序上被 `authoredCardRules` 全覆盖，属既有设计分层问题，
  重排会一次性改动全部卡牌效果，未在本次修复中调整。
- `application.yml` 仍保留明文数据库口令默认值、`ddl-auto: update`，
  `/pricture/**` 静态映射与 `/api/auth/**` 免 CSRF —— 安全加固项，
  改动会影响本地启动方式，未纳入本次「逻辑 bug」修复。
- `static/pvp-server/server.js` 是一套与客户端协议完全不兼容的旧服务器（死代码）。
- 拼图 `storage.js` 的旧格式迁移（`duelPoints`）缺失，当前格式读写往返正常。

## 复现与验证脚本（审计辅助，可删除）

- `.bug-review/fuzz.mjs`：随机行为 + 逐步状态不变量压测
- `.bug-review/module-graph.mjs`：浏览器模块图 404 检查
- `.bug-review/pvp-e2e.mjs`：PvP 建房/开局/大消息中继
- `.bug-review/repro-set-spell.mjs`、`.bug-review/repro-summon-attack.mjs`：两条缺陷最小复现
- `.bug-review/*.md`：各模块只读审计原始报告
