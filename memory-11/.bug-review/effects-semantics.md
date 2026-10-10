# 卡牌效果执行层审计 — effects 语义（handler 表 + 调度器 + 效果数据）

**审计范围**：`js/engine.js`（`effectHandlers` 处理器表与 `triggerAllEffects`/`_executeEffect` 调度器）、`js/themed-effects.js`（308 张自制卡实际使用的 `themedAction` 动作表）、效果数据层（`authored-card-rules.js` / `card-rules.js` / `ygo-starter.js`），必要时追进 `js/model.js`、`js/constants.js`。
> 说明：任务描述把 `effects.js`（233 KB）称为「handler 表与 dispatcher」，但该文件是纯表现层（动画/运镜/CSS，已由 `effects-integrity.md` 覆盖）。真正的效果处理器表与调度器在 `engine.js`，自制卡的技能实现在 `themed-effects.js`。本报告按真实实现位置给出证据。

**方法**：静态通读 + 可执行探针（`node` 直接驱动 `GameEngine`）+ 自建跨区域不变式模糊测试（对官方 `fuzz.mjs` 加了「所有区域 instanceId 唯一」等断言，各跑 60 局）。所有结论均在**写报告的同一时刻**在未修改的工作树上复现过；下文每条都给了最小触发代码。

**时效性提醒（重要）**：审计期间工作树被同批次其他审计员持续修改（`engine.js` 从 2664 行涨到 2700 行）。我最初找到的 4 条 bug 已被他们在中途修掉（见文末 §Peer fixes），已从本报告中移除；**下表全部为截至复现时刻仍然存在**的缺陷。行号可能因后续编辑漂移数行，代码片段是逐字复制的。

---

## 汇总表（按严重度）

| id | 位置 | 级别 | 一句话 |
|----|------|------|--------|
| BUG-01 | `themed-effects.js:117,125,173-175,193` | HIGH | `recover`/`recall`/`inherit`/`rescue` 把卡从墓地/除外区/卡组拿回手牌时不重置运行时状态，攻守修正与"已受伤"值随卡复活 |
| BUG-02 | `engine.js:241-242` + `ygo-starter.js:1070-1077,1095-1102` | HIGH | 陷阱「援军 / 城壁」的攻守 +500 作用在**陷阱卡自己**身上，怪兽什么都没得到（整张卡静默无效） |
| BUG-03 | `themed-effects.js:146` | MEDIUM | `twin`（连击）只置 `doubleAttackThisTurn` 不重算 `canAttack`：先攻击再开连击 = 白付 600LP 且无法再攻击 |
| BUG-04 | `engine.js:2376-2387` (+1994-2001) | MEDIUM | 手动选靶只校验区域/归属，完全不校验卡面声明的 `target.selector/filters`：`地裂` 可指定攻击力**最高**的怪兽破坏 |
| BUG-05 | `engine.js:1824-1828` | MEDIUM | `endTurn` 清 `doubleAttackThisTurn` 却不清 `attacksMadeThisTurn`，产生 `attacksMade(2) > limit(1)` 与 `canAttack && made>=limit` 的不一致状态 |
| BUG-06 | `engine.js:209-221` (+2288) | MEDIUM | `signatureTechnique` 的 12 个签名单动作里有 3 个（封锁/攻守逆转/击退）依赖 `ctx.targets`，而 onSummon 签名效果永远拿不到 target → 这 3 个签名技是静默空转 |
| BUG-07 | `engine.js:267-277` | MEDIUM | `debuffEnemyAttack` 无目标兜底时选的是攻击力**最低**的怪兽，与其卡面/说明「攻击力最高」相反 |
| BUG-08 | `model.js:209-221` + `engine.js:1824-1828` | MEDIUM | 效果造成的攻守增减没有登记进 `permanentBuffs/tempEffects`，`_recalcCardStats` 在回合结束把 `心变`/`守备封禁` 的 -500 直接还原 |
| BUG-09 | `engine.js:2371` | MEDIUM | `getEffectTargetType` 把 `lockAttack` 映射为 `"none"`：`光之护封剑` 在对方空场时可发动、无效果、卡照样进墓地 |
| BUG-10 | `engine.js:2616` (+2446-2452) | LOW | 陷阱的 `reduceDamage` 也减免**攻击方**自己撞出来的战斗伤害（守方的盾保护了攻方） |
| BUG-11 | `themed-effects.js:161-168` + `61-69` | LOW | `exchange` 借道 `summon()`，连带把召唤出的怪兽「效果到回合结束无效」，而卡面没写这一条 |
| BUG-12 | `engine.js:681/1093`、`816/1256` | LOW | 对象字面量里同名 handler 重复定义，后写覆盖前写，先写的实现是死代码（`swapAttackDefense`、`directAttackDamage`） |
| BUG-13 | `engine.js:399,412,717,862,1108,1681,2338` | LOW | handler 失配集群：占位 handler 只返回文案不做事；40+ 个已实现 handler 无任何卡引用；`_triggerLegacyEffect` 不可达（若可达会绕过 cost/once-per-turn）；`hasEffectHandler` 从未被调用 |
| BUG-14 | `engine.js:2017-2037` | LOW | 魔法卡一次发动会结算**全部** manual 技能（从不为法术传 `effectIndex`），与卡面「每个技能各自同名每回合1次」的单技能模型不一致 |
| BUG-15 | `engine.js:2444-2456` | LOW（潜伏） | 战斗陷阱的结算账目读的是**数据**而非「真正结算了的效果」：被条件/oncePerTurn/封印跳过的效果照样减伤、照样取消攻击 |

---

## BUG-01 — 从墓地/除外区/卡组取回的卡不重置运行时状态（战损与 buff 跟着复活）

**位置**：`themed-effects.js:117`（recover）、`118-121`（recycle）、`125`（recall）、`173-175`（inherit）、`193`（rescue）；对照实现 `engine.js:102 resetCardState` / `1850 resetFieldCard`。

**代码**
```js
// themed-effects.js
117: case "recover": move(last(p.graveyard, lowMonster), p.graveyard, p.hand); break;
118: case "recycle": {
119:     const cards = p.graveyard.filter(x => x !== c).slice(-3);
120:     for (const x of cards) move(x, p.graveyard, p.deck);
121:     p.drawCard(); break;
125: case "recall": move(p.banished.at(-1), p.banished, p.hand); break;
174:     const found = p.deck.find(x => lowMonster(x) && x.attribute === c.attribute);
175:     move(found, p.deck, p.hand); break;
193: if (e.action === "rescue") { const x = last(p.graveyard, lowMonster); if (x) move(x, p.graveyard, p.hand); }
```
（同文件 `61-69` 的 `summon()`、`161-168` 的 `exchange`、`196` 的 `retreat` 都调用了 `ctx.engine.resetFieldCard(...)`，只有上面这 5 处没有。）

**为什么错**：`destroyMonster` 把被破坏的怪兽放进墓地时只清 `themedState`，**保留** `currentAttack/currentDefense/permanentBuffs/tempEffects/faceDown`（`engine.js:71-77`）。`recover/recycle/recall/inherit/rescue` 直接 `move()` 搬卡，不调用 `resetCardState`，于是这些量被原样带到新手牌/新卡组；再召唤上场时只有 `_executeSummon`（`engine.js:1939-1973`）会重置攻击次数，**攻守与 buff 不会被重置**。结果同一个「离开场上再回来」的事件，走 `revive`/`deploy`/`retreat` 路径会恢复原始数值，走 `recover` 路径却带着上一世的战损与永久 buff。受影响面很大：308 张自制卡里 **138 张、共 160 个技能**含这五类动作（`recover` 69 次、`inherit` 29、`recycle` 31、`recall` 25、`rescue` 6）。

**最小触发（实测输出）**
```js
const c = mk({ rulesVersion:"t", effects:[themed("charge"), themed("recover")] });
p.monsterZone.push(c);
e.triggerAllEffects(p, c, "manual", { effectIndex: 0 });   // 蓄力：+200，permanentBuffs=[{attack,200}]
e.destroyFieldMonster(p, c);                                // 送墓：permanentBuffs 仍在
// 用另一张 recover 技能把它拿回手牌
p.monsterZone.push(src); e.triggerAllEffects(p, src, "manual");
p.normalSummonUsed = false; e.normalSummon(p, p.hand.indexOf(c), "attack", false);
```
```
charge: 自身获得1个蓄力指示物…攻击力上升200
ATK after charge: 2000   buffs: [{"type":"attack","value":200,"source":"themedCharge"}]
in graveyard: true       permanentBuffs still: [{"type":"attack","value":200,...}]
recover: …               in hand: true | permanentBuffs in hand: [{"type":"attack","value":200,...}]
re-summoned: true | currentAttack: 2000 (base attack is 1800)
revive（对照路径）: true | currentAttack: 1800 | permanentBuffs: []
```
战损同理：
```
victim.currentDefense = 300;（基础 2000）→ destroyFieldMonster → recover → 再召唤
re-summoned currentDefense: 300 (base 2000)  -> 上一世的"受伤值"带进新生命
```
另外 `resetTurnState` 只遍历 `monsterZone`，所以带在手牌/卡组里的旧 `permanentBuffs` 连"回合结束"都不会被清理。

**建议修复**：在这 5 处 `move()` 之前统一调用 `ctx.engine.resetFieldCard(card)`（与 `summon()`/`retreat()` 一致）；或在 `move()` 与 `Player` 的「入区域」钩子里强制重置，防止再漏。

---

## BUG-02 — 陷阱「援军 / 城壁」的攻守加成加在陷阱卡自己身上

**位置**：`engine.js:241-242`（handler）+ 数据 `ygo-starter.js:1070-1077`（援军 `ygo_n_17814387`）、`1095-1102`（城壁 `ygo_n_44209392`）。

**代码**
```js
// engine.js
241: buffSelfAttack(ctx) { ctx.card.currentAttack = safe(ctx.card.currentAttack + ctx.value); return `攻击力上升${ctx.value}`; },
242: buffSelfDefense(ctx) { ctx.card.currentDefense = safe(ctx.card.currentDefense + ctx.value); return `守备力上升${ctx.value}`; },
```
```jsonc
// ygo-starter.js:1071-1077（援军）
"effects": [ { "trigger": "onAttacked", "type": "buffSelfAttack", "value": 500,
               "description": "受到攻击时：己方怪兽攻击力上升500。" } ]
```

**为什么错**：`buffSelfAttack/buffSelfDefense` 的语义是「自己（= 发动的怪兽）加攻守」，但这两张是**陷阱卡**，在 `_resolveBattleTrap` 里 `ctx.card` 就是陷阱本身（而且它此刻已经被塞进墓地，`engine.js:2426-2431`）。于是 `currentAttack` 被写在墓地里的陷阱对象上（0 → 500），防守方的怪兽一点没变。卡面写的效果永远不会发生：整张卡静默无效，日志却打印「攻击力上升500」，玩家无从察觉。

**最小触发（实测）**
```js
const trap = createCardInstance(ALL_CARDS.find(c => c.id === "ygo_n_17814387"));
trap.faceDown = true; trap.canActivate = true; trap.setTurn = 1; o.spellTrapZone.push(trap);
const attacker = mk({ attack: 2500 }); attacker.canAttack = true; p.monsterZone.push(attacker);
const defender = mk({ attack: 1000 }); o.monsterZone.push(defender);
s.phase = "battle"; e.attack(attacker, defender);
```
```
message: B发动陷阱【援军】，攻击力上升500；ATK攻击DEF，DEF被破坏，对方受到1500点战斗伤害
defender ATK: 1000 | trap ATK: 500 | trap in grave: true      <-- 加成落在墓地里的陷阱上
```
（同样的代码路径也让 `buffSelfDefense` 的「城壁」完全无效。）

**建议修复**：给这两个 handler（或调度器）加 `onAttacked` 分支：当发动者是陷阱时，把加成施加到本次战斗的守方怪兽（`ctx.defenderOwner` 的 `ctx.target`）上；或把这两张卡的写法改为按 `ctx.targets` 施加的 `modifyStat`。

---

## BUG-03 — `twin`（连击）先攻击后发动：LP 白付，第二击打不出来

**位置**：`themed-effects.js:146`，作用点 `engine.js:43-49 markAttackUsed`。

**代码**
```js
146: case "twin": p.takeDamage(600); c.doubleAttackThisTurn = true; break;
```
```js
43: function markAttackUsed(monster) {
44:     monster.attacksMadeThisTurn = (Number(monster.attacksMadeThisTurn) || 0) + 1;
45:     monster.hasAttackedThisTurn = true;
46:     monster.canAttack = monster.attacksMadeThisTurn < getAttackLimit(monster)
47:         && !monster.cannotAttack && monster.position === MONSTER_POSITION.ATTACK;
48: }
```

**为什么错**：`canAttack` 是派生量，只在 `markAttackUsed`/召唤/换姿势时更新。怪兽本回合已经攻击过一次后 `canAttack=false`（line 46，限额 1）。此时开连击只把 `doubleAttackThisTurn=true`，限额变 2，但 `canAttack` 仍是 false，`attack()` 的第一道闸门（`if (!replaying && (!attacker.canAttack || attacksMade >= limit))`）直接拒绝 —— 玩家付了 600LP，得到 0 次额外攻击。相反顺序（先连击再攻击）完全正常，实测对照见下。

**最小触发（实测）**
```js
const src = mk({ attack:2000, effects:[themed("twin")] }); p.monsterZone.push(src); o.monsterZone = [];
src.canAttack = true; s.phase = "battle";
e.attack(src, "player");                    // 第一次攻击
s.phase = "main_2";
e.triggerAllEffects(p, src, "manual");      // 连击
s.phase = "battle"; e.attack(src, "player");
```
```
attack1: true | canAttack now: false | attacksMade: 1 | opp LP: 6000
twin: 支付600LP；自身本回合可以攻击2次 | canAttack: false | doubleAttackThisTurn: true | LP: 7400
>>> attack2: false | 该怪兽本回合不能攻击 | opp LP: 6000
（对照：先 twin 再攻击 → attack1 true, attack2 true，LP 7400 → 对方 4000）
```

**建议修复**：`twin` 里改为 `c.doubleAttackThisTurn = true; c.canAttack = (Number(c.attacksMadeThisTurn)||0) < 2 && !c.cannotAttack && c.position === MONSTER_POSITION.ATTACK;`，或把「是否可攻击」抽成 `isAttackAllowed(card)` 供 `attack()`/UI/`markAttackUsed` 共用。

---

## BUG-04 — 手动选靶不校验卡面声明的目标选择器/过滤器

**位置**：`engine.js:2376-2387 getValidTargets`，配合 `1994-2001`（`activateSpell` 的合法性校验）与 `2288`（`_executeEffect` 里 `targets = selectedTarget ? [selectedTarget] : []`）。

**代码**
```js
2376: getValidTargets(player, effect) {
2377:     const tt = this.getEffectTargetType(effect);
2378:     const opp = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
2379:     switch (tt) {
2380:         case "enemy_monster": return [...opp.monsterZone].filter(m => !m.cannotBeTargeted);
...
1995:             const validTargets = this.getValidTargets(player, primaryEffect);
1996:             const valid = validTargets.some(target => { ... });
2001:             if (!valid) return { success: false, message: "目标已经失效或不是合法目标" };
```

**为什么错**：`getValidTargets` 只看 `getEffectTargetType`（区域 + 归属），完全忽略效果数据里声明的 `target: {selector:"lowestAttack"/"highestAttack", filters:{...}}`。因此玩家的选择永远「合法」，卡面的限制形同虚设：`地裂`（卡面：破坏攻击力**最低**的怪兽）可以指着场上攻击力**最高**的怪兽拆；`黑洞`、`心变`、`守备封禁`、`光之护封剑` 同理。AI 也走同一条 `getValidTargets`，所以 AI 同样能选到不符合卡面的目标。数据里的 selector 只剩「没有手动指定目标时」的兜底路径，而 live 卡池里 `enemy_monster` 类目标一定要求手动指定 —— 等于死数据。

**最小触发（实测）**
```js
const card = createCardInstance(ALL_CARDS.find(c => c.id === "ygo_n_66788016")); // 地裂：最低攻击力
p.hand = [card];
const weak = mk({ name:"WEAK", attack:300 }), strong = mk({ name:"STRONG", attack:2900 });
o.monsterZone = [weak, strong];
e.activateSpell(p, 0, strong);      // 指定"最高攻击力"的怪兽
```
```
targetType: enemy_monster | getValidTargets: [ 'WEAK(300)', 'STRONG(2900)' ]
activate vs STRONG: true | 发动了地裂，破坏了STRONG | strong gone: true | weak alive: true
```

**建议修复**：`getValidTargets` 在 `effect.target` 存在时按 `resolveTargets(this, player, effect.target)` 取候选（保留 `cannotBeTargeted` 过滤），或在 `activateSpell` 的目标校验里对 `effect.target` 复算一次并做集合包含判断。

---

## BUG-05 — `endTurn` 清 `doubleAttackThisTurn` 不清 `attacksMadeThisTurn`

**位置**：`engine.js:1824-1828`（`endTurn` 内两方怪兽的收尾），消费点 `engine.js:43-49`、`2447`。

**代码**
```js
1824:             for (const card of owner.monsterZone) {
1825:                 card.tempEffects = (card.tempEffects || []).filter(effect => effect.duration !== DURATION.UNTIL_END_TURN);
1826:                 owner._recalcCardStats(card);
1827:                 card.doubleAttackThisTurn = false;
1828:             }
```
```js
39: function getAttackLimit(monster) { return monster.doubleAttackThisTurn || monster.attackTwiceThisTurn ? 2 : 1; }
```

**为什么错**：连击怪兽本回合合法攻击两次后 `attacksMadeThisTurn=2`，回合结束时限额被清零到 1，而攻击计数留在 2，于是产生 `attacksMade(2) > limit(1)` 的非法状态；如果此前任何代码把 `canAttack` 重新置真（换姿势 / 复活 / 后来的新 handler），就会得到 `canAttack=true && attacksMade>=limit` —— UI 显示「可攻击」，点下去必然失败。这也是 `fuzz.mjs` 的 `attacked 2x > limit 1`（60 局里 15 次、涉及 4 张卡）与 `canAttack with 1/1 attacks used` 两个不变式告警的直接成因。玩家可见后果目前还小（因为该计数在下一位玩家的回合里不影响任何人），但它是同一族「攻击记账三件套不同步」的残留 —— 召唤路径上的那一半刚被修掉（`engine.js:1955`）。

**最小触发（实测）**
```js
const src = mk({ attack:1500, effects:[themed("twin")] }); p.monsterZone.push(src); o.monsterZone = [];
e.triggerAllEffects(p, src, "manual"); src.canAttack = true; s.phase = "battle";
e.attack(src,"player"); e.attack(src,"player");
e.endTurn();
```
```
after 2 attacks: made= 2 double= true  canAttack= false limit= 2
after endTurn:   made= 2 double= false canAttack= false -> made > limit(1)
```

**建议修复**：在 line 1827 一并 `card.attacksMadeThisTurn = 0; card.hasAttackedThisTurn = false;`（与 `resetTurnState` 的语义对齐），或者把限额判定改成不依赖 `doubleAttackThisTurn` 的即时清理。

---

## BUG-06 — `signatureTechnique` 的 3 个签名单动作因缺 target 而空转

**位置**：`engine.js:209-221`（动作表），`engine.js:2288`（`ctx.targets` 的构造）。

**代码**
```js
209:         const actions = [
210:             () => { ctx.card.currentAttack += amount; ... },
...
214:             () => effectHandlers.debuffEnemyAttack({ ...ctx, value: amount }),
215:             () => effectHandlers.lockAttack({ ...ctx, value: 1 }),
216:             () => effectHandlers.banishEnemyGraveyard({ ...ctx, value: 1 + seed % 2 }),
217:             () => effectHandlers.tokenSummon({ ...ctx, value: Math.min(1400, 400 + amount) }),
218:             () => effectHandlers.discardAndDraw({ ...ctx, value: 1 }),
219:             () => effectHandlers.swapAttackDefense(ctx),
220:             () => effectHandlers.returnToHand(ctx),
221:             () => effectHandlers.protectAllies({ ...ctx, value: 1 }),
```
```js
2286:         const targetSpec = eff.target;
2287:         let targets = selectedTarget ? [selectedTarget] : [];
2288:         if (!selectedTarget && targetSpec) { targets = resolveTargets(this, player, targetSpec); }
```

**为什么错**：`signatureTechnique` 的 12 个动作里有 3 个（5=`lockAttack`「封锁」、9=`swapAttackDefense`「攻守逆转」、10=`returnToHand`「击退」）读的是 `ctx.targets`，而签名效果的数据只有 `protocol`、没有 `target`，`_executeEffect` 于是给出 `targets = []`、`targetSpec = undefined`。`lockAttack` 的分支 `if (targets.length === 0 && ctx.targetSpec)` 也不会兜底 → 三者都返回「没有目标 / 没有可封锁的怪兽」，效果为零。卡面写的是「结算①…然后结算②」，玩家看到文案生效了，实际什么都没发生。
（live 卡池目前没有 `signatureTechnique`：308 张自制卡全走 `authored-card-rules` 的逐卡配方，60 张入门卡用固定效果，所以这是「随规则层重新启用就会立即出错」的潜伏缺陷 —— 但 `rarity-rules.js:210-216` 仍在生成它。）

**最小触发（实测）**：给一张怪兽挂 `{trigger:"onSummon", type:"signatureTechnique", protocol:{primary:5,secondary:0,...}}`，对方场上有 2 只可取对象怪兽。
```
lockAttack(5)+buff(0):        没有可封锁的怪兽；专属蓄势：攻击力上升600   [enemy STRONG atk=2900 cannotAttack=false]
swapAttackDefense(9)+buff(0): 没有目标；专属蓄势：攻击力上升600           [enemy STRONG atk=2900]
returnToHand(10)+buff(0):     没有目标；专属蓄势：攻击力上升600           [enemy count=2]
```

**建议修复**：在动作表里显式解析目标，例如
`() => effectHandlers.lockAttack({ ...ctx, targets: resolveTargets(ctx.engine, ctx.player, { owner:"opponent", zone:"monster", selector:"highestAttack", count:1 }) })`，
或让 `_executeEffect` 在没有 `eff.target` 时对 `signatureTechnique` 这类复合效果给出默认目标集。

---

## BUG-07 — `debuffEnemyAttack` 的无目标兜底选「攻击力最低」，与卡面相反

**位置**：`engine.js:267-277`。

**代码**
```js
267: debuffEnemyAttack(ctx) {
268:     const opp = ctx.opponent;
269:     const target = ctx.target || (opp.monsterZone.length > 0
270:         ? opp.monsterZone.reduce((a, b) => a.currentAttack < b.currentAttack ? a : b)
271:         : null);
272:     if (target) { target.currentAttack = Math.max(0, target.currentAttack - ctx.value); ... }
```

**为什么错**：`reduce` 无初值、比较符为 `<`，选出的是攻击力**最小**的怪兽；而 `rarity-rules.js` 为这个 handler 生成的说明、`card-rules.js` 的 `ENEMY_HIGH` 数据以及实机说明书全部写「对方攻击力最高的怪兽攻击力下降N」。也就是说：凡是没有携带 `target` 规格的 `debuffEnemyAttack` 效果（数据层大量以 ENEMY_HIGH 声明，但手工/兜底生成的效果可能没有），都会打到最弱的怪身上。live 池里唯一一张（`心变`）因为带了 `target` / 走手动选靶路径才没暴露。

**最小触发（实测）**
```js
const card = mk({ effects:[{ trigger:"onSummon", type:"debuffEnemyAttack", value:500 }] }); // 无 target
o.monsterZone = [mk({name:"STRONG",attack:2900}), mk({name:"WEAK",attack:400})];
p.monsterZone = [card]; e.triggerAllEffects(p, card, "onSummon");
```
```
result: WEAK攻击力下降500
STRONG atk: 2900 | WEAK atk: 0
```

**建议修复**：`opp.monsterZone.reduce((a, b) => a.currentAttack > b.currentAttack ? a : b)`（与同文件 `ultimateCopy`/`resonanceRedirect` 里选最高攻的写法一致）。

---

## BUG-08 — 效果造成的攻守增减没登记，回合结束时被 `_recalcCardStats` 无条件还原

**位置**：`engine.js:241-242 / 278-289`（直接改 `currentAttack/currentDefense`）＋ `model.js:209-221`（重算）＋ `engine.js:1824-1828`（回合结束对两方怪兽重算）。

**代码**
```js
241: buffSelfAttack(ctx) { ctx.card.currentAttack = safe(ctx.card.currentAttack + ctx.value); ... },
278: debuffEnemyDefense(ctx) {
281:     target.currentDefense = Math.max(0, target.currentDefense - ctx.value); ...
```
```js
// model.js
209: _recalcCardStats(card) {
204:     for (const buff of (card.permanentBuffs || [])) { if (buff.type === "attack") atkBonus += buff.value; ... }
220:     card.currentAttack = Math.max(0, (card.attack || 0) + atkBonus);
```

**为什么错**：`_recalcCardStats` 把当前数值**整体重写**为 `基础值 + permanentBuffs + tempEffects`。凡是直接对 `currentAttack/currentDefense` 做加减、又没有把增量登记进这两个数组的效果，其修正都会在下一次重算时凭空消失。live 卡池里就有两张：`心变`（`ygo_n_4031928`，-500 攻）与 `守备封禁`（`ygo_n_25880422`，-500 守），卡面都没有写持续期限（按游戏王惯例应持续到该怪兽离场），引擎却在**发动当回合的结束阶段**（`endTurn` 对双方怪兽重算）就把数值还原，等于效果只维持半个回合。

**最小触发（实测）**
```js
const spell = createCardInstance(ALL_CARDS.find(c => c.id === "ygo_n_4031928")); p.hand = [spell];
const target = mk({ attack:2400 }); o.monsterZone = [target];
e.activateSpell(p, 0, target);   // -> currentAttack 1900
e.endTurn();                     // -> currentAttack 2400（还原）
```
```
发动了心变，TARGET攻击力下降500 | currentAttack: 1900
after endTurn: currentAttack: 2400
（守备封禁：2600 → 2100 → after endTurn 2600）
```

**建议修复**：让这类 handler 把增量写进 `tempEffects`（带明确 duration）或 `permanentBuffs`，再调用 `_recalcCardStats`；否则应在 `_recalcCardStats` 中保留未登记的绝对修正（例如把「基础值」记成 `card.baseAttack`，效果改 `baseAttack`）。

---

## BUG-09 — `lockAttack` 的目标类型被映射成 `"none"`，可以「无目标发动」并白白送墓

**位置**：`engine.js:2371`（`getEffectTargetType` 映射表），触发点 `engine.js:1988-2001`、`canPlayEffect`。

**代码**
```js
2371: const map = { ..., lockAttack: "none", ... };
```
```js
1989: const primaryEffect = card.effect || card.effects?.[0];
1990: const targetType = this.getEffectTargetType(primaryEffect);
1991: const requiresTarget = !["none", "enemy_player", "self_player", "both_players"].includes(targetType);
1992: if (requiresTarget && !selectedTarget) { return { success: false, needsTarget: true, ... }; }
```

**为什么错**：`lockAttack` 的实现在没有 `ctx.target` 时从 `ctx.targetSpec` 自适应取「对方最高攻」（`engine.js:1362-1376`），所以引擎把它当成不需要目标的效果。结果是：发动条件里**没有**「必须有合法目标」这一项，`光之护封剑` 在对方空场（或对方仅有 `cannotBeTargeted` 怪兽）时仍然可以发动 —— 处理器返回「没有可封锁的怪兽」，卡照样进墓地，玩家净亏一张卡（YGO 规则下这类「必然不结算」的卡不允许发动）。同样的映射问题也存在于 `cannotAttack`（作为手牌魔法时）等条目。

**最小触发（实测）**
```js
const card = createCardInstance(ALL_CARDS.find(c => c.id === "ygo_n_72302403")); p.hand=[card]; o.monsterZone=[];
e.canPlayEffect(p, card);   // {canPlay:true}
e.activateSpell(p, 0);
```
```
canPlayEffect: {"canPlay":true,"reason":""} | mech: none
activateSpell: true | 发动了光之护封剑，没有可封锁的怪兽 | grave: true
```

**建议修复**：把映射改为 `lockAttack: "enemy_monster"`（并在处理器里保留 `ctx.targetSpec` 兜底），或让 `canPlayEffect`/`activateSpell` 对「自带 target 规格」的效果调用 `resolveTargets` 判空后拒绝发动。

---

## BUG-10 — 战斗陷阱的减伤也会减免「攻击方自己撞出来」的伤害

**位置**：`engine.js:2591`、`2616`（`attack()` 中攻击方受伤的两个分支），数值来源 `engine.js:2446-2452 / 2547`。

**代码**
```js
2591: battleDamage = attacker.preventsBattleDamage ? 0 : Math.max(0, defPower - atkPower - reduction);
2616: battleDamage = attacker.preventsBattleDamage ? 0 : Math.max(0, defPower - atkPower - reduction);
```
（`reduction` 来自守方陷阱：`2446: if (effect.type === "reduceDamage") battle.reduction += Math.max(0, Number(effect.value) || 0);`）

**为什么错**：守方发动减伤陷阱的意图（也是卡面「对方攻击宣言时：本次伤害减少N」）是保护**自己**；但 ATK<DEF 或 ATK 劣势对攻时受伤的是**攻击方**，引擎照样把这个 `reduction` 减在攻击方的自伤上 —— 守方的盾变成了替对手挡伤害，甚至能把对手本该承受的 1500 点伤减到 0。实测：攻击 1000 撞守备 2500 本应自伤 1500，带 1800 减伤的陷阱后变成 0。

**最小触发（实测）**
```js
const trap = mk({ type:"trap", effects:[{trigger:"onAttacked",type:"reduceDamage",value:1800}] });
trap.faceDown = true; trap.canActivate = true; trap.setTurn = 1; o.spellTrapZone=[trap];
const attacker = mk({attack:1000}); attacker.canAttack=true;
const defender = mk({attack:500, defense:2500}); defender.position="defense";
p.monsterZone=[attacker]; o.monsterZone=[defender]; s.phase="battle";
e.attack(attacker, defender);
```
```
B发动陷阱【TRAP】，本次战斗伤害减少1800；ATK攻击DEF，攻击方受到0点战斗伤害
attacker owner LP: 8000      （未减伤时应为 8000-1500=6500）
```

**建议修复**：`reduction` 只在「伤害由守方承担」的分支生效（line ~2595-2598 的对攻分支与该分支的贯穿伤害），攻击方自伤分支用 `reduction: 0`；或把减伤绑定到「本次战斗的受击方 = 陷阱控制者」。

---

## BUG-11 — `exchange` 借道 `summon()`，静默给换上的怪兽加「效果到回合结束无效」

**位置**：`themed-effects.js:161-168`（exchange）＋ `61-69`（`summon()` 里的 `card.themedState = { sealedUntil: ... }`）。

**代码**
```js
161: case "exchange": {
162:     const replacement = p.hand.find(lowMonster);
...
167:     summon(ctx, replacement, p.hand); break;
```
```js
61: function summon(ctx, card, from) {
65:     card.setTurn = ctx.gameState.turn;
66:     card.themedState = { sealedUntil: ctx.gameState.turn };   // 本回合该卡效果无效
```

**为什么错**：`deploy` / `revive` 的卡面明确写了「其效果直到回合结束无效」，所以 `summon()` 打封印是合理的；但 `exchange` 的卡面（`ACTION_TEXT.exchange`：「将自己攻击力最低的表侧怪兽返回手牌，再将手牌第一只4星以下怪兽特殊召唤为守备表示」）没有任何「效果无效」的说明，引擎却照样把换上来的怪兽封印一回合 —— 玩家用 `exchange` 铺场时，新怪兽的登场技/主动技当回合全部被吞掉，且日志不会提示。

**最小触发（实测）**
```js
const src = mk({ effects:[themed("exchange")] }); const own2 = mk({ name:"LOW", attack:500 });
const handMon = mk({ name:"HANDMON", level:3, attack:1600 });
p.monsterZone=[src, own2]; p.hand=[handMon];
e.triggerAllEffects(p, src, "manual");
```
```
summoned: HANDMON position: defense themedState: {"sealedUntil":5}   <-- 卡面未声明的追加效果
```

**建议修复**：给 `summon()` 增加 `seal` 参数，只有 `deploy`/`revive` 传 `true`；或让 `exchange` 走独立的召唤分支。

---

## BUG-12 — 同名 handler 重复定义，先写的实现被静默覆盖（死代码）

**位置**：`engine.js:681` 与 `1093`（`swapAttackDefense`）、`engine.js:816` 与 `1256`（`directAttackDamage`）。同族问题还有 `reviveToHand`（`329`/被 `1247` 覆盖），其中被覆盖的那一份曾持有唯一正确的「按选择目标复活」逻辑，现已被同伴修进覆盖版。

**代码**
```js
// 第一份（永远不执行）
681: swapAttackDefense(ctx) { const targets = ctx.targets || []; ... }      // 只作用于 ctx.targets
// 第二份（生效）
1093: swapAttackDefense(ctx) { const targets = ctx.targets || ctx.opponent.monsterZone; ... }
```
```js
816: directAttackDamage(ctx) { ctx.opponent.takeDamage(ctx.value); return `对${ctx.opponent.name}造成${ctx.value}点伤害`; },
1256: directAttackDamage(ctx) { ctx.opponent.takeDamage(ctx.value); return `对${ctx.opponent.name}造成${ctx.value}伤害`; },
```

**为什么错**：JS 对象字面量允许重复键，后写者胜，先写者永远不可达。`swapAttackDefense` 两版语义不同（前者只在有显式目标时生效，后者在无目标时回落到对方全场）—— 维护者修改第一份时不会看到任何行为变化，是非常容易被误判为「改了没生效」的陷阱。`directAttackDamage` 两份完全相同，是纯复制粘贴残留。

**最小触发**：静态可见；`node -e` 里 `Object.keys` 只出现一次即可证明。
```js
// 任意一张卡声明 swapAttackDefense 且带 target 时，执行的是 1093 那一份
```

**建议修复**：删除 `681`/`816` 两处被覆盖的实现（保留语义更完整的那份），并在 CI 里加一条「对象字面量重复键」检查（`no-dupe-keys`）。

---

## BUG-13 — handler 失配集群：占位 handler、无人引用的 handler、不可达分支

**位置**：`engine.js:399`（counterAndDamage）、`412`（lifesteal）、`717`（negateEffect）、`862`（oncePerTurn）、`1108`（redirectAttack）、`1681`（hasEffectHandler）、`2338`（`_triggerLegacyEffect`）、`40/74`（`attackTwiceThisTurn` / `attackLocked`）。

**代码**
```js
399: counterAndDamage(ctx) { return "火焰护盾准备就绪"; },
412: lifesteal(ctx) { return "吸血准备就绪"; },
717: negateEffect(ctx) { return "效果无效化准备就绪"; },
862: oncePerTurn(ctx) { return "一回合一次效果已使用"; },
1108: redirectAttack(ctx) { return "选择对方一只怪兽，本回合其攻击必须攻击己方另一只怪兽"; },
```
```js
1681: export function hasEffectHandler(effectType) { return typeof effectHandlers[effectType] === "function"; }   // 全仓库无人调用
```
```js
2338: _triggerLegacyEffect(player, card, triggerType = "manual", eventContext = {}) { ...handler(ctx) }  // 无 cost / oncePerTurn / condition 校验
```

**为什么错**（三类真实缺陷，均可被未来的卡牌数据直接踩中）：
1. **占位 handler**：`counterAndDamage`、`lifesteal`、`negateEffect`、`oncePerTurn`、`redirectAttack` 被判定为「有实现」（`hasEffectHandler` 返回 true），调用后只返回一句文案、不改任何状态 —— 任何声明这些类型的卡都会静默无效，且不会被「缺 handler → 返回 null」的路径记录。
2. **已实现但无人引用**：以 368 张卡的正式卡池（765 个 `themedAction` + 24 个 legacy 效果）为基准，以下 handler **没有任何卡能触发**：`lifeCostBurst`、`selfDestructBurst`、`lowHpBurst`、`ultimateBurst`、`resonanceBurst`、`resonanceFreeze`、`resonancePower`、`ultimateGroup`、`ultimateFreeze`、`ultimateDraw`、`ultimateCopy`、`ultimateRedirect`、`resonanceRedirect`、`destroyAllWeakened`、`guessGame`、`guessGameV2`、`sacrificeDestroy`、`snapshot`（`trapStackAndRecover`/`preventDestructionByBanish`/`discardToDisableAttack`/`fieldWaterBuff`/`fieldOceanScene`/`temporaryBanish`/`recycleWaterAndProtect` 等同理，因为 308 张自制卡已全部改走 `themedAction`）。它们是死代码，也是「说明书与实现不一致」的温床（例如 `buffSelfAttack` 这类陷阱用法就是从这个池子里遗留下来的）。
3. **不可达分支 / 空挂标志**：`_triggerLegacyEffect`（只有 `effects` 为空且 `effect` 存在时才走）在 `createCardInstance` 把 `effect` 折进 `effects` 之后永远不可能命中；若哪天命中，它会**跳过成本、oncePerTurn、condition 校验**（对比 `triggerAllEffects` 的 `2232-2234` 行）。`attackTwiceThisTurn`、`attackLocked`、`piercingDamage`、`effectDisruptor` 这些被读取的标志，live 卡池里没有任何代码会把它们置真。

**最小触发**：静态可验证。
```js
// 1) 占位：给任意卡挂 { type:"lifesteal" } → 触发后状态零变化
// 2) 无人引用：hasEffectHandler("ultimateBurst") === true，但 368 张卡里 type==="ultimateBurst" 的数量为 0
// 3) _triggerLegacyEffect 不可达：createCardInstance 保证 effects.length>0 当 effect 存在
```

**建议修复**：删除占位 handler 或补实现；把 `hasEffectHandler` 接进卡表校验（对每张卡的每个效果断言 handler 存在且非占位）；删除 `_triggerLegacyEffect` 与永不置真的标志。

---

## BUG-14 — 多技能魔法一次发动会结算全部技能（从不为法术传 `effectIndex`）

**位置**：`engine.js:2017-2037`（`activateSpell` 的结算调用）、`2137-2140`（`activateSetSpell` 同形）、对照 `controller.js:447-477`（怪兽可以逐技能发动）与 `engine.js:2250`（调度器支持 `effectContext.effectIndex` 过滤）。

**代码**
```js
2017:         const payTrigger = card.isFieldSpell ? "field" : "manual";
2018:         if (card.effects) { for (const eff of card.effects) { if (eff.cost && getEffectTrigger(eff) === payTrigger) this._checkCost(player, eff.cost); } }
2035:         const result = selectedTarget ? this.triggerEffect(player, card, selectedTarget)
2037:                                        : this.triggerAllEffects(player, card, "manual");   // 无 effectIndex → 全部 manual 技能
```
```js
2250:             if (eventContext.effectIndex != null && eventContext.effectIndex !== index) continue;   // 调度器支持，但法术路径从不传
```

**为什么错**：自制卡的技能模型是「每个技能各自 `同名此效果每回合1次`」，怪兽端也严格按 `effectIndex` 单选发动（`themed-gameplay.test.js:41-47` 断言了「蓄力不足不消耗发动次数」这种逐技能语义）。而魔法卡路径从不传 `effectIndex`，于是 `nc_sp_ur_001`（配方 `M:prepare M:recall M:recover`）一次发动会把三个技能**全部**结算（实测日志同时出现「积累记忆」「越界归来」「重逢」），三张卡的强度相当于卡面单技能预算的 3 倍，且玩家无法选择只用其中一个。这是法术与怪兽两条路径在**同一张卡数据**上的语义分裂（要么法术也该逐技能发动并各付一次代价，要么卡面不该按技能逐条写 once-per-turn）。

**最小触发（实测）**
```js
const card = createCardInstance(ALL_CARDS.find(c => c.id === "nc_sp_ur_001")); p.hand=[card];
p.graveyard=[mk(),mk(),mk(),mk()]; p.banished=[mk()]; p.deck=[...6×mk]; p.lp=8000;
e.activateSpell(p, 0);
```
```
res: true | 发动了八千年的思念，八千年的思念·积累记忆：将卡组顶2张卡送入墓地，
             八千年的思念·越界归来：将自己除外区最后一张卡加入手牌，
             八千年的思念·重逢：将自己墓地最后一只4星以下怪兽加入手牌
LP: 7000   （1000 代价只付一次；三个技能全部结算）
```

**建议修复**：让 `activateSpell`/`activateSetSpell` 接收并转传 `effectIndex`（UI 侧像怪兽那样给每个技能一个按钮），或明确改为「发动时结算全部技能」并把卡面文案改成单条描述、把代价/额度按总和标定。

---

## BUG-15 — 战斗陷阱的记账读数据而非「实际结算的效果」（潜伏，当前卡池未能触发）

**位置**：`engine.js:2444-2456`。

**代码**
```js
2436:         const effectMessage = this.triggerAllEffects(defenderOwner, trap, "onAttacked", { ...attackEvent, ..., battle });
2444:         for (const effect of effects) {
2445:             if (getEffectTrigger(effect) !== "onAttacked") continue;
2446:             if (effect.type === "reduceDamage") { battle.reduction += Math.max(0, Number(effect.value) || 0); }
2449:             if (["cancelAttackAndReturn","cannotAttack","counterDestroy","destroyAttacker","reflectDamage","returnToHand"].includes(effect.type)) battle.canceled = true;
2452:         }
2453:         if (effects.some(effect => getEffectTrigger(effect) === "onAttacked" && effect.type === "destroyAttacker")
2454:             && hasResonance(defenderOwner, 2)) { attackerOwner.takeDamage(500); }
```

**为什么错**：这一段是在 `triggerAllEffects` **之后**再按陷阱的原始数据重算一次战斗账目，因此完全无视「该效果这次到底有没有结算」：被 `_checkEffectCondition`、`card.oncePerTurnUsed`、`card.effectNegated`、`sealedUntil` 跳过的 `reduceDamage`/取消类效果，仍然会减伤/取消攻击；`destroyAttacker` 的共鸣 500 追加伤害也只看数据里有没有这条效果。live 卡池里入门陷阱都没有 `oncePerTurn`/`condition`，且 `seal` 只针对怪兽，所以目前触发不到 —— 但一旦有卡牌数据加上 `oncePerTurn`（配方层已经普遍这么干）或对陷阱加封印，就会立刻成为「没结算也生效」的规则漏洞。

**最小触发**：把任意带 `oncePerTurn: true` 的 `reduceDamage` 陷阱摆上后场，同一战斗阶段攻击两次 —— 第二次攻击时 `triggerAllEffects` 已按 `oncePerTurnUsed` 跳过效果，但 `battle.reduction` 仍会被加满。

**建议修复**：让 `triggerAllEffects`/处理器把实际生效的减伤与取消写进 `battle`（`reduceDamage` 的处理器里直接 `ctx.battle.reduction += ...`），删除这段事后按数据重算的逻辑。

---

## 按类别逐项核对、确认无问题的部分

- **代价支付**：`activateSpell` 现在是「先 dryRun 校验全部代价 → 再做目标校验 → 扣手牌 → 真付代价」，代价不足时不会扣任何资源；`_checkCost(player, cost, {dryRun})` 纯检查、不产生副作用；场地魔法按 `trigger === "field"` 付代价。LP 代价「`lp === cost` 视为不足」是测试断言的既定设计（`themed-gameplay.test.js:95-99`）。**未发现重复扣费或漏扣**（含盖放魔法路径：实测 1000 LP 只扣一次）。
- **目标合法性 / 目标中途离场**：本引擎的「发动 → 结算」是同一次同步调用（法术、战斗陷阱都是立即结算），不存在「发动时合法、结算时已离场」的窗口；因此该类别**只发现 BUG-04/BUG-09 两条校验缺失**，未发现悬空目标崩溃。
- **一回合一次 / 每局一次**：`themedAction` 的守卫键是 `${card.id}:${index}`（= 卡牌定义 id，即「同名每回合一次」，与卡面文案一致，且跨实例共享，`themed-gameplay.test.js:48-55` 断言了跨实例与离场保留语义）；守卫在变更前检查（`2250-2256`）、在结算前打标（`2257-2260`）。**未发现键错位（同名 vs 实例 id）或重复消耗**；唯一隐患是 `_triggerLegacyEffect` 完全不做 once-per-turn 校验（已并入 BUG-13）。
- **破坏 / 移除 / 送墓的「恰好一次」**：`destroyMonster` 以 `indexOf === -1` 提前返回，重复破坏安全；`bomb` 在结束阶段用快照循环破坏也不会重复计数；token 不进墓地。**跨区域重复**：自建不变式（deck/hand/monster/spellTrap/graveyard/banished/_tempBanished/fieldZone 的 instanceId 唯一）在 60 局 × ~4000 步随机对局中**零告警**。唯一问题是「离开旧区域时没有清运行时状态」（BUG-01）。
- **持续 / 残留效果**：`sealedUntil`（回合内）、`frozenUntil`（到下一回合结束）、`shelterUntil`（一次破坏替代）、`piercingUntil`（当回合）、`wardUntil`（到下一回合结束）、`poisonTurn`/`bombTurn`（当回合结束阶段）的写入时机与 `resolveThemedTurnEnd` 的清理时机逐一核对（`themed-effects.js:217-229`），**均与卡面时限一致**；`tempEffects` 的 `untilEndTurn` 清理、`permanentBuffs` 保留也都符合 `engine.test.js:479-495` 的断言。缺陷集中在 BUG-01 / BUG-05 / BUG-08。
- **伤害 / LP 算术**：直击、ATK 对 ATK 四分支、ATK 对 DEF 三分支、贯穿（`hasPiercing` 依赖 `piercingUntil`/`piercingDamage`）、治疗上限、`damageBothPlayers`/`directDamage` 的受方归属逐一核对，**未发现符号错误、扣错玩家、重复加血**。唯一算术语义缺陷是 BUG-10；`ATK === DEF` 时双方均不破坏是测试断言的既定设计。
- **召唤 / 特殊召唤**：祭品数量按 `getTributeNeeded`（5-6★ 1 只、7★+ 2 只 —— 与 `engine.test.js:51-52` 断言一致）、满场仍可上级召唤（`themed-gameplay.test.js:144-148`）、`additionalNormalSummon` 的扣减顺序（`engine.test.js:38-50`）、里侧盖放的表示形式与 `cannotUseAsMaterial` 标记（衍生物）均正确；`deploy/revive/exchange` 都有 `space` 与区域上限检查。**未发现召唤路径漏检**（`signatureTechnique` 的目标缺失属 BUG-06）。
- **handler 失配（数据 → 实现方向）**：以 368 张卡的实际效果为准，**没有**任何效果类型找不到实现（缺失数为 0），也没有「声明了触发时机但永远不触发」的效果（monster 只有 onSummon/manual/onDestroyed/onTurnEnd，spell 全 manual，trap 全 onAttacked）。失配问题全部在反方向：已实现却无人引用 / 占位实现 / 不可达分支（BUG-13）。

## 给合并报告的两点交叉提示

1. **`engine.md` BUG-04 不要修**：它主张 `ATK === DEF === 0` 应当同归于尽，但 `themed-gameplay.test.js:137-140`（「0攻平手不破坏」）明确断言不破坏，属于既定设计。
2. 我在审计过程中发现 4 条 bug 已在被同伴修复（我复现时已消失），若合并报告仍列它们会造成重复：`recoverMonster`/`reviveToHand` 忽略选择目标（engine.md BUG-01，现已按选择目标复活）、`reflectDamage` 忽略 `value`（engine.md BUG-02，现为实测 500）、`endTurn` 在游戏结束时提前 return 留下 `pendingTribute`（现已把清理挪到判定之前，`engine.js:1834-1843`）、召唤时未清 `attacksMadeThisTurn`（现已在 `_executeSummon` 清，`engine.js:1950-1958`）。

## 复现方式

所有探针都在项目外（`%TEMP%\dsh-audit\`）以 `node` 直接驱动 `GameEngine`，未修改任何项目文件；核心断言为「引擎返回的 message / 怪兽与玩家的前后状态」。可直接复跑：
```
node %TEMP%\dsh-audit\probe1.cjs      # BUG-02（援军/城壁）、BUG-01 的 recycle 侧写、reflectDamage 对照
node %TEMP%\dsh-audit\probe2.cjs      # 复活/召唤后的攻击记账
node %TEMP%\dsh-audit\probe4.cjs      # BUG-03（连击）、BUG-04（地裂选靶）、BUG-14（多技能法术）
node %TEMP%\dsh-audit\probe6.cjs      # BUG-01（buff/战损随复活带过来）
node %TEMP%\dsh-audit\probe7.cjs      # BUG-05、BUG-06、BUG-07、BUG-09、BUG-10
node %TEMP%\dsh-audit\probe8.cjs      # BUG-11（exchange 静默封印）、BUG-08（心变/守备封禁被重算还原）
node %TEMP%\dsh-audit\fuzz-dup.mjs 60 555001   # 不变式模糊测试（含跨区域重复检查）
```
