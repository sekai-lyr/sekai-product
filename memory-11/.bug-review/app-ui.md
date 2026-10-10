# Nightcord Duel Network — 前端逻辑审计报告（大厅 / 商店 / 收藏 / 卡组编辑器）

- **审计范围**：`SekaiGame/src/main/resources/static/js/app.js`（主）、`api.js`、`decks.js`、`profile.js`（次）。
  为确认调用链，另外只读追踪了 `main.js`、`card-view.js`、`card-rules.js`、`collection.js`、`deck.js`、`packs.js`、`catalog.js`、`rewards.js`、`stages.js`、`index.html`、`style.css` 以及 Spring 端 `CollectionController/DeckController/DeckService/CollectionService/StarterDeckService`。
- **只读**：本次审计未修改任何项目文件。
- **基线**：在 static 目录执行 `node --test test/*.test.js` → `tests 216 / pass 216 / fail 0`。本报告中没有任何一条与被测试断言的行为冲突。
- **未发现 CRITICAL 级问题**：没有发现“免费开包”“重复领取奖励”“货币变负”这类可无限放大的漏洞；最高为 HIGH（保底计数被错误清零、PvP 断线白送胜场奖励）。

## 结论速查（按严重度排序）

| ID | 位置 | 级别 | 摘要 |
| --- | --- | --- | --- |
| BUG-01 | `js/app.js:385` | HIGH | 十连中出现 UR 时保底计数被直接清零，丢掉同一批里 UR 之后的包数（最多 9 包进度） |
| BUG-02 | `js/main.js:460`（追踪 app.js PvP 入口时发现） | HIGH | 对手断线直接判本地玩家胜并发放 PvP 胜利奖励 +1000 币，两个客户端即可无限刷 |
| BUG-03 | `js/app.js:955` + `js/app.js:256` | MEDIUM | 首页“今日首次胜利 +300”永远无法完成（任何可达的对局模式都会提前 return） |
| BUG-04 | `js/app.js:414`（根因 `js/card-view.js:126`） | MEDIUM | `rarityRank` 把 UR 与 SSR 记为同级，抽到 UR 时卡包演出可能显示“最高稀有度：SSR” |
| BUG-05 | `js/app.js:337-339` | MEDIUM | 确认开包的按钮点击后不关闭、不禁用，快速双击会扣两次费开两次包，且响应乱序会覆盖较新的货币/保底状态 |
| BUG-06 | `js/app.js:460`（同类：521、546、839、883） | MEDIUM | 迟到的异步响应无条件重绘自己的界面，把用户当前所在的其他界面顶掉（路由高亮与内容不一致） |
| BUG-07 | `js/app.js:594` | MEDIUM | 收藏搜索的 140ms 定时器在离开界面后仍会触发 `renderCollection()`，顶掉当前界面 |
| BUG-08 | `js/app.js:1037-1038`（同类：1095、1019、1022） | MEDIUM | 连接期间关闭 PvP 弹窗后，错误分支对已移除的 DOM 取值 → 未处理的 Promise rejection → 弹出致命错误面板 |
| BUG-09 | `js/app.js:142` + `606-610`（同类：732-739） | MEDIUM | 未保存的卡组草稿在“离开再回到卡组页”时被静默丢弃（跨页面保留、回到页面却重置，行为自相矛盾） |
| BUG-10 | `js/app.js:1007` + `1036-1039` | MEDIUM | PvP 创建房间在收到错误回执后永久停留在“正在连接服务器…”，确认按钮被永久禁用且无超时 |
| BUG-11 | `js/app.js:930` / `935-944` | LOW | 设置保存后未在启动时回放（`reduce-motion`/`hide-duel-log` 丢失），且“动画速度”写入了却从未被读取 |
| BUG-12 | `js/app.js:51-52` | LOW | `deckBattleValue` 的稀有度/攻守回退分支对 263/368 张卡永远不执行（默认 priority=0 被当成设计值） |
| BUG-13 | `js/app.js:909-921` | LOW | `renderRules` 中 `return` 之后还有 12 行渲染代码，永远不可达 |
| BUG-14 | `js/app.js:1100-1105` | LOW | `onStartPvp` 既是死代码，又绕过了 `validateDeck`（校验旁路） |
| BUG-15 | `js/app.js:478` + `572` | LOW | 收藏页“成员”筛选永远匹配不到任何卡（全部卡牌的 `member` 为 `null`），选择任一成员结果必为空 |
| BUG-16 | `js/app.js:559-567` | LOW | `syncCollectionToServer()` 在所有调用点都必然提前 `return null`（且该后端接口是 ADMIN-only，真调用会 403） |
| BUG-17 | `js/app.js:28` + `307` | LOW | 商店显示“368张基础卡”，实际卡池为 308 张（60 张 `starter_ygo` 被 `PACK_POOL`/`getPackPool` 排除） |

---

## BUG-01 · 十连保底计数被错误清零

- **位置**：`js/app.js:384-386`
- **级别**：HIGH
- **摘要**：十连只要出现任意一张 UR，就把 `packsSinceUR` 写成 0，丢掉该批次里 UR 之后已经开掉的包数，最多一次抹掉 9 包保底进度。

```js
const gotUR = opened.cards.some(card => card.rarity === "UR");
if (count === 10) {
    this.collection.pityCounters[NIGHTCORD_PACK.id] = { packsSinceUR: gotUR ? 0 : opened.packsSinceUR };
} else if (gotUR) {
```

**为什么是错的**：`openTenPacks()` 内部已经逐包维护了正确的 `packsSinceUR`：命中 UR 的包归零，之后每包 +1（`js/packs.js:100-106`）。当这一批第 N 包（N<10）出 UR 时，返回值应为 `10 - N`，但这里的 `gotUR ? 0` 把它强制归零。实测（真实 `packs.js` + 真实卡池，让第 1 包出 UR）：

```
10-pack: UR at index 0 => true packs passed since UR = 9
app stores: 0
```

**最小触发**：攒 9000 币 → 商店“抽取10包” → 十连结果里前几包出了 UR（卡面 `UR`）→ 回到商店看 `UR保底 x / 50`，计数为 0 而不是 8~9。连续如此，玩家实际要比设定多开最多 9 包才有保底 UR（每次约损失 1000 币价值）。

**建议修复**：删掉覆盖，直接采用引擎结果：

```js
this.collection.pityCounters[NIGHTCORD_PACK.id] = { packsSinceUR: opened.packsSinceUR };
```

---

## BUG-02 · 对手断线被判胜并发放完整 PvP 奖励

- **位置**：`js/main.js:460`（在追踪 `app.js` 的 `createPvpRoom` / `showJoinPvpModal` / `onStartPvp` 时发现；`app.js` 是这些回调的装配方）
- **级别**：HIGH
- **摘要**：对手一断线就给本地玩家结算 `winner: 0`（胜），而 PvP 胜场奖励是 +1000 决斗币，两个客户端即可无限刷币。

```js
pvpClient.onOpponentDisconnect = () => { currentController.onGameOver({ winner: 0, isDraw: false }); };
```

**为什么是错的**：`settleMatch({winner:0,isDraw:false})` → `result = "win"` → `calculateMatchReward("win", {mode:"pvp"})` → `PVP_REWARD_TABLE.win = 1000` 币并写入存档。断线本质上不是对局结果，却被当成完整胜利发放满额奖励；`matchSettled` 只能防同一局重复结算，防不住反复建房。

**最小触发**：玩家 A 开 `createPvpRoom` 拿到房间号 → 玩家 B（第二浏览器标签 / 小号）`showJoinPvpModal` 加入 → B 直接关闭标签 → A 收到 `opponent_disconnected` → A 立刻获得 +1000 币和 1 胜；重复 10 次即 10000 币（≈ 11 抽）。

**建议修复**：断线走独立结算（`isDraw` 或无奖励），或至少给出 `duelCoins: 0` 的专用奖励分支；同时把“对手断线”与“对手投降”区分开。

---

## BUG-03 · 首页“今日首次胜利 +300”永远无法完成

- **位置**：`js/app.js:955`（对局模式）与 `js/app.js:254-258`（面板文案），根因链路见 `js/rewards.js:33-40`
- **级别**：MEDIUM
- **摘要**：app 只会以 `training` / `ai`+stage / `pvp` 三种模式开局，而 `calculateMatchReward` 对这三种模式都在每日奖励循环之前 `return`，因此 `statistics.firstWinToday` 永远是 `null`，面板永远显示“未领取 / 0%”，承诺的 +300 也永远不到账。

```js
this.onStartDuel(stage
    ? { mode: "ai", deck, stage, opponentDeck: buildStageDeck(stage) }
    : { mode: "training", deck });
```

```js
if (matchData?.mode === "training") return { duelCoins: 0, bonuses: [], label: "练习模式无奖励", result };
if (matchData?.mode === "pvp") { return { duelCoins: PVP_REWARD_TABLE[result] || 0, bonuses: [], label: "联机决斗奖励", result }; }
if (matchData?.stage) { ... return { duelCoins: amount, bonuses: [], ... }; }   // 每日奖励在下面才结算
```

实测（真实 `rewards.js`）：

```
{"mode":"training"}              -> duelCoins 0    bonuses []
{"mode":"pvp"}                   -> duelCoins 1000 bonuses []
{"mode":"ai","stage":{...}}      -> duelCoins 305  bonuses []
{"mode":"ai"}                    -> duelCoins 420  bonuses [{id:"first_win_of_day",...}]
```

即：只有“没有 stage 的 ai 模式”才能拿到每日首胜与 120/50/60 的基础奖励，而 `app.js` 永远不会以这种模式开局（唯一出路是关卡，关卡分支同样提前 return）。

**最小触发**：任意方式赢一局（首页“揭牌 开始决斗”或“挑战关卡”通关）→ 回到首页 → “今日首次胜利”面板仍显示“在AI决斗中取得一次胜利即可获得额外决斗币。”、进度条 0%，决斗币只增加了关卡奖励。附带影响：首页主 CTA“揭牌/开始决斗”结算时显示“练习模式无奖励”（0 币），玩家按大厅提示“决斗赢币”的主循环实际不产币。

**建议修复**：二者取其一——(a) 把主 CTA 改成 `mode: "ai"`（不带 stage），保留关卡为独立奖励模式；或 (b) 让 stage 分支也执行 `BONUS_REWARDS` 循环，使每日首胜在关卡胜利时结算。

---

## BUG-04 · `rarityRank` 把 UR 与 SSR 记为同级，卡包演出可能谎报最高稀有度

- **位置**：`js/app.js:414`（同时 448、466、629 都依赖它）；根因 `js/card-view.js:125-127`
- **级别**：MEDIUM
- **摘要**：`{ N:0, R:1, SR:2, UR:3, SSR:3 }` 让 UR 与 SSR 比较相等，于是 UR 抽到时“最高稀有度”可能显示 SSR，稀有度排序也不再是 UR 优先。

```js
// js/card-view.js
export function rarityRank(rarity) {
    return { N: 0, R: 1, SR: 2, UR: 3, SSR: 3 }[rarity] ?? 0;
}
```

```js
// js/app.js
const highest = [...reveals].sort((a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity))[0]?.card.rarity || "N";
```

**为什么是错的**：全项目其它地方都认定 UR > SSR：`rarity-rules.js:32` 写的是 `{ N:0, R:1, SR:2, SSR:3, UR:4 }`；`SHARD_VALUES` 为 UR 200 / SSR 100；`CRAFT_COSTS` 为 UR 800 / SSR 400；`PACK_RATES` 为 UR 0.5% / SSR 3.5%。同级的比较函数返回 0，`sort` 保持原顺序，`[0]` 就可能是先出现的那张 SSR。实测：

```
rarityRank: N=0 R=1 SR=2 SSR=3 UR=3
pulled SSR then UR -> banner says: SSR
```

**最小触发**：十连（或单包）里先出 SSR、后出 UR → 卡包演出大字“最高稀有度：SSR”，且结果列表里 UR 不会排在 SSR 之前；收藏页按稀有度排序时 UR/SSR 按卡名交错。

**建议修复**：把 `card-view.js` 的映射改为 `{ N:0, R:1, SR:2, SSR:3, UR:4 }`（与 `rarity-rules.js` 一致）。

---

## BUG-05 · 开包确认按钮不关闭也不禁用：双击扣两次费、开两次包

- **位置**：`js/app.js:337-339`
- **级别**：MEDIUM
- **摘要**：点击“确认抽取”后既不 `closeModal()` 也不 `disabled`，异步等待期间按钮仍可点击；双击会发两次扣费/开包请求，第二次的弹窗会覆盖第一次的结果展示。

```html
<div class="modal-actions"><button class="secondary-action" data-close-modal>取消</button><button class="primary-action" id="confirm-pack-open" ${balance < cost ? "disabled" : ""}>确认抽取</button></div>
</section>`);
this.modalRoot.querySelector("#confirm-pack-open")?.addEventListener("click", () => this.openPacks(count));
```

**为什么是错的**：`openPacks()` 在登录态下第一件事就是 `await openPackServer(...)`（`api.js` 超时 10s），期间弹窗仍然 active、按钮仍然可点。第二次点击会再次扣费并再发一次请求，两次响应各自 `collectPulledCard()`（卡牌都进收藏），并各自把 `currency.duelCoins` / `pityCounters` / `shards` 整体覆盖——后到的旧响应可以覆盖较新的余额（商店会显示高于服务端的余额）。同时第一次开包的结果演出会被第二次 `openModal()` 顶掉，玩家看不到第一批的揭晓。

**最小触发**：登录态（真实网络）→ 商店“抽取1包” → 在弹出的确认框上快速双击“确认抽取” → 决斗币 -2000、卡牌 +16 张、只出现一次揭晓演出。

**建议修复**：点击后立刻 `closeModal()`（或 `button.disabled = true` 并置文案“抽取中…”），并在 `openPacks` 入口加一个 `if (this.packOpening) return; this.packOpening = true; try { ... } finally { this.packOpening = false; }` 的重入锁。

---

## BUG-06 · 迟到的异步响应重绘自己的界面，顶掉用户当前界面

- **位置**：`js/app.js:460`（同类：`521`、`546`、`839`、`883`）
- **级别**：MEDIUM
- **摘要**：异步回调结束时无条件调用本界面自己的渲染函数，不检查 `this.route`，于是“商店/收藏/卡组编辑器”的迟到渲染会覆盖用户此刻正在看的另一个界面，而侧边栏高亮仍指向用户选择的界面。

```js
            </section>`;
        this.renderShop();
    }
```

```js
// 同类调用点
this.renderCollection();     // 521 / 546：craft / dismantle 的 await 之后
this.renderDeckEditor(true); // 839 / 883：saveDeckDraft / deleteCurrentDeck 的 await 之后
```

**为什么是错的**：`navigate()` 只设置 `this.route` 并渲染目标界面（`app.js:131-145`），没有任何“渲染只允许发生在当前路由”的守卫，也没有给渲染注册 generation/序号。于是延迟回调把 `screenRoot.innerHTML` 换成自己的界面：用户看到的界面 ≠ 侧边栏高亮 ≠ `this.route`，之后点击“卡组”等按钮时会因为 route 未变化而看不出问题（`navigate` 会重新渲染，但期间界面是错的状态），弹窗也可能出现在不相干的界面上。

**最小触发**（任选其一）：
1. 商店 → 抽取1包 → 确认抽取 → 在请求返回前点“取消”关掉弹窗 → 立刻点侧栏“卡组” → 响应到达后卡包演出弹窗在当前界面弹出，点“揭晓结果”后整个界面被替换成商店，但侧栏仍高亮“卡组”。
2. 收藏 → 点“制作1张” → 在服务器响应返回前点侧栏“卡组” → 响应到达后界面被 `renderCollection()` 顶回收藏。

**建议修复**：渲染入口统一加守卫，例如把 `renderShop/renderCollection/renderDeckEditor` 包一层 `renderFor(route, fn)`，仅当 `this.route === route` 时执行（或在 `navigate()` 里递增 `this.renderToken`，回调里比对）。

---

## BUG-07 · 收藏搜索的防抖定时器在离开界面后仍会渲染

- **位置**：`js/app.js:589-603`（`this.searchTimer = setTimeout(...)` 在 594）；`navigate()` 未清理该定时器（`js/app.js:131-145`）
- **级别**：MEDIUM
- **摘要**：输入搜索词后 140ms 的延迟渲染不检查当前路由，离开收藏页后仍会触发，把当前界面替换成收藏页。

```js
element?.addEventListener(id === "collection-search" ? "input" : "change", () => {
    this.collectionFilters[key] = element.value;
    if (id === "collection-search") clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
        this.renderCollection();
        ...
    }, id === "collection-search" ? 140 : 0);
});
```

**为什么是错的**：定时器唯一的取消点是下一次搜索输入（`clearTimeout` 只在 `id === "collection-search"` 时执行）；`navigate()`、`closeModal()`、`hideShell()` 都没有清理它。渲染函数本身也不检查路由（见 BUG-06），所以定时器到期即无条件重绘。

**最小触发**：收藏页 → 在搜索框输入任意字（如“蓝”）→ 140ms 内点击侧栏“卡组”或“商店” → 界面先切到卡组，随后被收藏页顶掉，侧栏高亮与内容不一致；搜索框还会被程序 `focus()` 抢走焦点。

**建议修复**：在 `navigate()` 开头 `clearTimeout(this.searchTimer)`（并且同样在 BUG-06 的渲染守卫生效后），或把定时器改为可取消的 `AbortController`/token 模式。

---

## BUG-08 · PvP 弹窗被关闭后错误分支空指针 → 全局致命错误面板

- **位置**：`js/app.js:1036-1039`（同类：`1094-1096`；`1019`/`1022` 也直接依赖这些元素）
- **级别**：MEDIUM
- **摘要**：`await pvp.connect()` 期间用户若点了“取消”，`closeModal()` 会清空 `modalRoot.innerHTML`；连接失败进入 `catch` 时对已移除的元素取属性 → TypeError → 该 async 事件回调的 rejection 无人处理 → `main.js` 的全局 `unhandledrejection` 处理弹出“PvP 初始化失败”致命面板。

```js
            } catch (e) {
                document.getElementById("pvp-status").textContent = "PvP服务器未启动，请先运行 pvp-server.mjs";
                document.getElementById("pvp-create-confirm").disabled = false;
            }
```

**为什么是错的**：这里的元素全部位于弹窗内部，`closeModal()` 会把它们从 DOM 移除，`getElementById` 返回 `null`；而同文件其他位置都做了防护（例如 `pvp.onError` 用 `if (status) ... else this.toast(...)`）。一旦抛出，`main.js:37` 的 `window.addEventListener("unhandledrejection", ...)` 会把堆栈以红框形式打在页面上。

**最小触发**：首页 → “创建房间” → 点“创建房间”后在连接完成前点“取消”（PvP 服务未启动时 `connect()` 会 reject）→ 页面出现 `PvP 初始化失败` + TypeError 堆栈。加入房间弹窗同理（`1095`）。

**建议修复**：`catch` 内统一先取元素再判空（`const status = this.modalRoot.querySelector("#pvp-status"); if (status) ... else this.toast(...)`），或用 `this.modalRoot.querySelector` + 可选链，并把 `catch` 包在 try 内避免二次抛出。

---

## BUG-09 · 未保存的卡组草稿在返回卡组页时被静默丢弃

- **位置**：`js/app.js:142`（`navigate` → `renderDeckEditor(true)`）+ `js/app.js:606-610`；同类 `js/app.js:732-739`（切换卡组下拉）
- **级别**：MEDIUM
- **摘要**：草稿在离开界面时被保留（暗示“不会丢”），但重新进入卡组页时被无条件用持久化卡组覆盖；切换下拉里的另一副卡组同样直接丢弃当前草稿，全程没有任何“未保存”提示或确认。

```js
if (route === "decks") this.renderDeckEditor(true);
```

```js
renderDeckEditor(resetDraft = false) {
    const deck = this.getSelectedDeck();
    if (resetDraft) this.deckDraft = deck ? clone(deck) : null;
    else if (!this.deckDraft) this.deckDraft = deck ? clone(deck) : null;
    else if (!this.deckDraft.isNew && this.deckDraft.id !== deck?.id) this.deckDraft = deck ? clone(deck) : null;
```

**为什么是错的**：`resetDraft=false` 的分支刻意保留草稿（过滤、加减卡、改名都靠它），说明“工作副本跨渲染保留”是设计意图；但 `navigate("decks")` 每次都传 `true`。结果是：离开→回来 = 草稿被丢掉，未保存的卡组构成与卡名一起消失，且没有任何提示。若用户已经在卡组页，再点一次侧栏“卡组”也会立刻重置草稿——最难察觉的一种丢改动方式。

**最小触发**：卡组页 → 点若干张卡左侧卡牌加入（右上角 `N/60` 数字变化）→ 点侧栏“首页” → 点侧栏“卡组” → 改动全部消失（`N/60` 回到保存值），没有确认框、没有 toast。或：编辑中直接再点一次高亮的“卡组”按钮，同样瞬间回滚。

**建议修复**：区分“进入此界面”与“保存/删除后的重载”——`navigate` 改为 `renderDeckEditor(false)`（保留草稿），仅在 `saveDeckDraft`/`deleteCurrentDeck`/`#deck-select` 切换后传 `true`；若确实要丢弃，先加“有未保存改动，是否放弃？”确认。

---

## BUG-10 · PvP 创建房间的错误分支让界面永久停在“正在连接服务器…”

- **位置**：`js/app.js:1006-1007` 与 `1036-1039`（`onError` 见 `1013-1017`）
- **级别**：MEDIUM
- **摘要**：点击创建后立即禁用确认按钮，但只有在 `connect()` 抛异常时才会重新启用；若连接成功而服务端回 `error`（或干脆不回应），状态文本会显示错误而按钮永久禁用、无超时，玩家只能关掉弹窗重来。

```js
document.getElementById("pvp-status").textContent = "正在连接服务器...";
document.getElementById("pvp-create-confirm").disabled = true;
```

```js
pvp.onError = (msg) => {
    const status = document.getElementById("pvp-status");
    if (status) status.textContent = `错误: ${msg}`;
    else this.toast(msg || "PvP连接失败", "error");
};
```

**为什么是错的**：错误/超时路径没有恢复 `disabled = false`，也没有把 `pvp.createRoom()` 包装成可超时的 Promise；`joinRoom` 分支虽然没禁用按钮，但同样没有超时，状态会一直停在“正在连接...”。

**最小触发**：PvP 服务可用但房主创建被拒（例如服务端返回 `{type:"error"}`）→ 弹窗显示“错误: …”，但“创建房间”按钮始终灰着，无法重试；或服务端不响应 create_room → 永远停在“正在连接服务器...”。

**建议修复**：在 `onError` 里同时恢复按钮（`const btn = ...; if (btn) btn.disabled = false;`），并给 `connect()`/`createRoom()` 加超时（例如 10s 后把状态置为“连接超时”并恢复按钮）。

---

## BUG-11 · 设置未在启动时回放，且“动画速度”是死设置

- **位置**：`js/app.js:930`、`935-944`（回放缺失点在 `main.js` 的 `startApp()`）
- **级别**：LOW
- **摘要**：`reduce-motion` / `hide-duel-log` 两个 body class 只在点击“保存设置”的瞬间设置，刷新后不再应用（勾选状态却仍是保存值）；而“动画速度”虽然被保存，全项目没有任何地方读取 `settings.animationSpeed`。

```js
<label class="setting-row"><div><strong>动画速度</strong><span>控制AI行动和界面演出的速度。</span></div><select id="setting-speed">...</select></label>
```

```js
settings.reduceAnimations = this.screenRoot.querySelector("#setting-reduce").checked;
settings.animationSpeed = Number(speed.value);
settings.logLevel = this.screenRoot.querySelector("#setting-log").checked ? 1 : 0;
saveData(this.collection);
document.body.classList.toggle("reduce-motion", settings.reduceAnimations);
document.body.classList.toggle("hide-duel-log", settings.logLevel === 0);
```

**为什么是错的**：`css/style.css:979` 与 `:1025` 分别依赖 `.hide-duel-log`、`.reduce-motion`，但全仓 `grep` 显示只有这 4 行会设置它们；启动流程（`main.js:274-362`）从不回放已保存的设置。此外 `grep animationSpeed` 的结果只有 `collection.js`（默认值）、`storage.js`（migrate）与这里的写入——没有任何读取方，所以“慢速/正常/快速”对 AI 行动与演出完全没有影响。

**最小触发**：设置页 → 勾选“减少动态效果”/取消“决斗日志” → 保存 → 刷新页面 → 复选框仍是勾选状态，但页面动画与日志面板恢复默认（类名未应用）；把“动画速度”改成“快速”保存后，AI 行动速度毫无变化。

**建议修复**：在 `startApp()`/`CardGameApp` 构造时根据 `collection.settings` 回放 `document.body.classList.toggle(...)`；删除“动画速度”控件或把它接到 `controller.aiActionDelay` / 动画 timing 上。

---

## BUG-12 · `deckBattleValue` 的稀有度/攻守回退分支永远不执行

- **位置**：`js/app.js:50-59`
- **级别**：LOW
- **摘要**：`aiHints.priority` 在卡池归一化时被统一补成 0，`Number.isFinite(0)` 为真，于是 263/368 张卡的“战力估值”恒为 0，后面的稀有度/攻守/效果回退成了死代码，卡组左侧列表的“战力排序”对大多数卡实际退化成稀有度+卡名。

```js
export function deckBattleValue(card) {
    const designedValue = Number(card?.aiHints?.priority);
    if (Number.isFinite(designedValue)) return designedValue;
    const rarityValue = { N: 10, R: 25, SR: 45, SSR: 65, UR: 85 }[card?.rarity] || 0;
```

**为什么是错的**：`js/card-rules.js:160-164` 的 `applyPlayableRules` 会为所有卡补 `priority: 0`（`catalog.js` 用 `normalizeCardPool` 统一处理），实测 `priority 0: 263 / >0: 105`。设计者写 `Number.isFinite` 显然是想跳过“没有设计值”的卡，但 0 被当成了有效设计值。

**最小触发**：卡组编辑器 → 左侧“可用卡牌”列表（默认按 `deckBattleValue` 降序）→ 105 张有 `aiHints.priority` 的卡全部排在 263 张 0 值卡之前，且这 263 张之间只按稀有度+卡名排序，稀有度/攻守估算完全没参与。

**建议修复**：`if (Number.isFinite(designedValue) && designedValue > 0) return designedValue;`

---

## BUG-13 · `renderRules` 中 `return` 之后仍是渲染代码（死分支）

- **位置**：`js/app.js:908-921`
- **级别**：LOW
- **摘要**：函数在渲染完 19 条规则后直接 `return;`，后面还有一整套 8 面板的旧规则 HTML，永远不可达（典型的复制粘贴残留）。

```js
this.screenRoot.innerHTML = `<section class="screen-heading">...${detailedRules.map(...)}...`;
return;
this.screenRoot.innerHTML = `
    <section class="screen-heading">...本项目采用游戏王式自动阶段规则...</section>
    <section class="rules-grid">
        <article class="rule-panel"><span>01</span><h2>胜利条件</h2>...
```

**为什么是错的**：不可达代码会误导后续维护（改错副本、两份规则文案不一致）；且旧副本与当前规则文案存在冲突（例如旧 08 写“攻守任一达到4000的顶级怪兽限1张”，而卡池实测没有任何 4000 攻/守的卡，且 `deck.js` 的 `deckLimit` 也从未被设置）。

**最小触发**：静态可判（无运行时触发）；`navigate("rules")` 永远只显示 19 条规则那版。

**建议修复**：删除 `return;` 之后的整段 HTML（或删掉前面的新版本，二者留一）。

---

## BUG-14 · `onStartPvp` 是死代码，并绕过卡组校验

- **位置**：`js/app.js:1100-1105`
- **级别**：LOW
- **摘要**：`onStartPvp(pvpClient, deck, gameInfo)` 直接 `onStartDuel({mode:"pvp", ...})`，没有 `validateDeck`；全仓 grep 显示它没有任何调用方（PvP 实际走 `createPvpRoom` / `showJoinPvpModal` 内部回调，二者都校验）。

```js
onStartPvp(pvpClient, deck, gameInfo) {
    this.playHomeLaunch(() => {
        this.hideShell();
        this.onStartDuel({ mode: "pvp", deck, pvpClient, gameInfo });
    });
}
```

**为什么是错的**：它是类上唯一的“启动决斗但不过校验”的公开入口。当前不可达所以没有实际危害，但一旦被接上（例如外部脚本或后续重构）就是“非法卡组可以进入决斗”的旁路。其余入口都做了校验：`startDuel()` 重校验、首页按钮按 `validation.valid` 禁用、两个 PvP 弹窗校验后才发房。

**最小触发**：当前无（静态死代码）；若被调用则传入任意 40 张未拥有卡的卡组也能开局。

**建议修复**：删除该方法，或在其内部复用 `startDuel` 的校验逻辑（`if (!validateDeck(deck, ALL_CARDS, this.collection).valid) return this.toast(...)`）。

---

## BUG-15 · 收藏页“成员”筛选永远匹配不到卡牌

- **位置**：`js/app.js:478`（筛选器定义）与 `js/app.js:572`（过滤逻辑）
- **级别**：LOW
- **摘要**：筛选器提供 “东云绘名 / 宵崎奏 / 朝比奈真冬 / 晓山瑞希 / 四人共同”，但所有卡牌的 `member` 都是 `null`，选择任一具体成员后列表必定为空。

```js
${selectHtml("collection-member", "成员", this.collectionFilters.member, [["all", "全部"], ["ena", "东云绘名"], ...])}
```

```js
if (f.member !== "all" && card.member !== f.member) return false;
```

**为什么是错的**：实测 `ALL_CARDS` 中 `member` 为真值的卡数为 0（`[...new Set(ALL_CARDS.map(c=>c.member))]` = `[null]`），`card-rules.js` 的归一化也不会补 member。因此该筛选器的 5 个具体成员选项全部是无效 UI（唯一可用的是“全部”）；同时 `MEMBER_NAMES[selected.member] || "Nightcord"` 与 `hydrateCardArt` 的成员兜底图也永远走 `group` 分支。

**最小触发**：收藏页 → “成员”下拉选“东云绘名” → 卡牌网格显示“没有符合条件的卡牌。”

**建议修复**：要么在卡池归一化时为 nightcord 卡补 `member`（按卡组归属/名称映射），要么移除“成员”筛选器；同时在 `filterCollectionCard` 中对 `!card.member` 给出明确的处理。

---

## BUG-16 · `syncCollectionToServer()` 在所有调用点都必然提前返回

- **位置**：`js/app.js:559-567`（调用点 `393`、`528`、`553`）
- **级别**：LOW
- **摘要**：函数第一行就是 `if (!auth?.userId) return null;`，而三处调用全部位于 `if (auth?.userId) { ...; return; }` 之后的“未登录分支”，因此永远返回 `null`——“把本地收藏推送到云端”这条路径实际上不存在。

```js
async syncCollectionToServer() {
    const auth = loadAuth();
    if (!auth?.userId) return null;
    const result = await saveUserCollection(auth.userId, { cards: this.collection.cards });
    if (!result.success) this.toast("云端收藏同步失败，数据已保存在本机", "error");
    return result;
}
```

**为什么是错的**：`openPacks`(393)、`#craft-card`(528)、`#dismantle-card`(553) 三个调用点都只在 `!auth?.userId` 时可达（登录态在上面已经 `return`），所以这个 await 只是空转一个微任务。并且即使真被调用也会失败——Spring 端 `CollectionController.saveCollection` 标注 `@PreAuthorize("hasRole('ADMIN')")`，普通用户 PUT 会 403，函数会误报“云端收藏同步失败”，而本地其实已经写入成功。注意 `test/pack-persistence.test.js` 依赖这个方法存在（测试用桩替换），因此不要直接删名，但应明确其语义。

**最小触发**：静态可判；离线用户开包时该 await 实际上什么都没做（不会破坏功能，只是掩盖了“登录用户的开包同步是由服务端 `/pack` 自己完成的”这一事实）。

**建议修复**：删除这三个调用点与冗余 await（或把函数改成显式抛错的“仅登录态可用”工具），并把 `pack-persistence` 测试改为对服务端响应流的断言。

---

## BUG-17 · 商店显示的卡池张数与真实卡池不符

- **位置**：`js/app.js:28`（`const NIGHTCORD_ONLY = ALL_CARDS;`）与 `js/app.js:307`
- **级别**：LOW
- **摘要**：商店标签用 `NIGHTCORD_ONLY.length` 显示“368张基础卡”，而真实抽取池是 308 张（60 张 `starter_ygo` 被 `PACK_POOL` 与 `packs.getPackPool` 排除）。

```js
const NIGHTCORD_ONLY = ALL_CARDS;
```

```js
<div class="pack-tags"><span>${NIGHTCORD_ONLY.length}张基础卡</span><span>全卡池</span><span>UR 0.5%</span></div>
```

**为什么是错的**：实测 `ALL_CARDS.length = 368`、`starter_ygo = 60`、`getPackPool(NIGHTCORD_PACK, ALL_CARDS - starter_ygo).length = 308`。`app.js` 里这个局部别名还覆盖了 `catalog.js` 里同名的 `NIGHTCORD_ONLY`（后者是 80 张 nightcord 卡，并被 `test/app-integration.test.js` 断言为 80），同名不同义极易再次踩坑。

**最小触发**：商店页 → 特色卡包标签显示“368张基础卡”，但实际只能抽到 308 种。

**建议修复**：标签改用 `PACK_POOL.length`（或 `getPackPool(NIGHTCORD_PACK, PACK_POOL).length`），并把局部别名改成 `ALL_PLAYABLE_CARDS` 之类以避免与 `catalog.NIGHTCORD_ONLY` 混淆。

---

## 已按类别逐项核对但**未发现问题**的部分

- **开包扣费与余额**：确认弹窗的 `balance < cost` 校验、`#confirm-pack-open` 的 `disabled`、`spendDuelPoints` 的余额校验、失败时的退款（`app.js:376-380`）、服务端的二次校验（`CollectionService.openPack`）都成立；无法既不开包又不扣费，也不会出现负余额。唯一缺陷是重复点击（BUG-05），不是“一次付费多次得包”。
- **确认弹窗被取消后仍然执行**：未发现。`modalRoot` 的点击代理只在“点击遮罩本身”或“命中 `[data-close-modal]`”时 `closeModal()`；`#confirm-pack-open` 不带 `data-close-modal`，取消路径不会触发开包；`showPackResults` 的“完成”按钮也只是关闭。
- **奖励/一次性领取被重复领取**：`applyReward` 的 `claimId` 守卫与 `claimedRewards` 去重、`settleMatch` 的 `matchSettled` 单局去重、以及 `claimReward/hasClaimedReward` 都正确。需要说明：`ONE_TIME_REWARDS` 与 `claimId` 目前没有任何调用方（死数据），关卡奖励可重复获得（`app.js:962-966` 显示“已通关”但仍可再战再得，与 `main.js:493` 的设计一致，判定为有意设计，故不作为缺陷上报）。
- **卡组数量/同名卡上限**：`addCardToDraft`（60 张上限、`getCardCopyLimit`、拥有数上限、未拥有拦截）、`validateDeck`（40~60、同名 3 张、拥有数、启用状态）、服务端 `DeckService.validateOwnedDeck`（40~60、拥有数、≤3）三处一致；未发现可把非法卡组存进 `collection.decks` 的路径。卡池中不存在 `deckLimit` 或攻/守 ≥4000 的卡，因此 `getCardCopyLimit` 的 1 张分支与 `buildSuggestedDeck` 未使用该限制的问题当前不可达，未上报。
- **非法卡组进入决斗**：未发现（`startDuel` 二次校验 + 首页按钮按校验禁用 + 两个 PvP 弹窗校验）。仅存在 BUG-14 所述不可达的死方法旁路。
- **索引 vs 稳定 ID**：未发现。所有列表循环都用卡牌 ID 绑定事件（`data-card-id` / `data-art-id` / `data-deck-add` / `data-deck-remove` / `data-stage-id`），`flightPositions[index]`、`previewPositions[index]` 用的是展示位次而非身份，`removeCardFromDraft` 用 `lastIndexOf(cardId)` 删的是同一张卡。
- **就地修改数据源**：未发现。收藏筛选、卡组可用池、卡包结果、卡包演出都是先 `filter`/展开成新数组再 `sort`（`NIGHTCORD_ONLY`/`ALL_CARDS`/`PACK_POOL` 均未被就地排序）；`this.collection.decks` 的 `splice`/下标赋值都是有意持久化。
- **缺字段导致 NaN/undefined 显示**：未发现。218 张怪兽卡的 `attack/defense/level` 全部为有限数值；非怪兽卡走 `catalogCardHtml` 的“类型/描述”分支；`formatNumber`、`Number(...) || 0`、`showCardDetail` 的 `|| "?"` 都做了兜底。
- **`api.js`**：未发现逻辑缺陷。CSRF 头名（`XSRF-TOKEN`/`X-XSRF-TOKEN`）与 Spring `CookieCsrfTokenRepository.withHttpOnlyFalse()` 一致；HTTP 200 + 体内容 `success:false`（如“决斗币不足”）在 `{success:true, ...data}` 的展开顺序下仍会得到 `success:false` 且保留 `reason`；数组响应的处理在 `main.js` 侧用 `Object.values` 做了兼容。
- **`profile.js` / `decks.js`**：未发现可影响正式流程的逻辑缺陷（`getDefaultDecks()` 返回空数组、`member` 为 null 已在 BUG-15 说明）。附录另记一条离线模式的可用性缺口。

---

## 附录：审计范围外、但追踪时确认的相邻问题

1. **离线（localhost 前端调试）新档无法进入可玩状态** —— `profile.js:7-15` 的 `createNewProfile()` 给出 `cards: {}` 与 `decks: []`（`test/app-integration.test.js` 明确断言 `profile.decks.length === 0`，即正式流程依赖服务端 `StarterDeckService` 发卡）。但 `main.js:120-148` 在 localhost 上允许注册/登录失败时退回“离线用户”，此时玩家：0 张卡、0 副卡组、2000 币 → 最多开 2 包 = 16 张卡 → 永远无法组成 40 张卡组 → 无法决斗 → 无法赚币（首页三个决斗入口全部因 `validation.valid === false` 禁用），只能清档重来。修复建议：离线档也给一份 starter 收藏/卡组（或在离线模式下把初始决斗币提到足够开 5 包）。
2. **保底 50 包时整包全 UR** —— `packs.js:46` 的 `getEffectiveRates(pityCount >= 50)` 返回 `UR: 1.0`，会被用于该包的**每一个**抽卡位（`packs.js:68-75` 循环内逐张判定），因此第 50 包会产出 8 张 UR（十连则按包计）。商店文案是“最晚第50包获得UR”（单数）。修复建议：把 `pityCount >= 50` 改为“本包至少 1 张 UR”（例如只强制 `cardsPerPack - 1` 这一位，或抽取后回填）。
3. **收藏分解/制作按钮在服务器请求期间不禁用** —— `app.js:509-556` 的两个 `async` 处理器在 `await` 期间按钮仍可点击，双击会发两次请求（服务端各执行一次）。语义上不算“一次点击得两份”，但与 BUG-05 同源，建议统一加重入锁。
