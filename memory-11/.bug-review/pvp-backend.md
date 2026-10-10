# PvP / 后端 逻辑缺陷审计（pvp.js · pvp-server · PvpWebSocketHandler · Java services/controllers/security/config）

审计日期：2026-09-20
范围：`static/js/pvp.js`、`static/pvp-server/*`、`static/scripts/pvp-server.mjs`、`static/scripts/server.mjs`、
`websocket/PvpWebSocketHandler.java`、`service/`、`controller/`、`security/`、`config/`
（`engine.js` / `controller.js` / `effects.js` / `ui.js` / `app.js` 仅作为“协议另一端”被读取以核对契约，缺陷归属已标注。）

说明：本报告只列出真实的逻辑/安全问题，不含风格、命名、注释、微性能问题。

---

## BUG-01 | 客户端每个回合消息都超过服务器 64 KiB 上限 → 第一个 `end_turn` 就把 socket 打死（对局必然软锁）
**文件**：`src/main/java/com/sekai/game/websocket/PvpWebSocketHandler.java:22,63-67`；`config/WebSocketConfig.java:25-27`；`static/scripts/pvp-server.mjs:15,60,71-75`
**严重级**：CRITICAL

```java
// PvpWebSocketHandler.java
private static final int MAX_MESSAGE_LENGTH = 64 * 1024;           // :22
...
if (message.getPayloadLength() > MAX_MESSAGE_LENGTH) {             // :63
    sendJson(session, Map.of("type", "error", "reason", "消息过大"));
    session.close(new CloseStatus(1009, "Message too big"));       // :65  直接把连接关掉
    return;
}
```
```js
// static/scripts/pvp-server.mjs
const MAX_MESSAGE_BYTES = 64 * 1024;                               // :15
const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES }); // :60
if (raw.length > MAX_MESSAGE_BYTES) { ... ws.close(1009, ...) }     // :71-75
```
两端都会收到这种消息：
```js
// js/pvp.js:86
endTurn(state = null, requestId = null) { return this.send({ type: "end_turn", state, requestId }); }
// js/controller.js:1112-1114
const finalState = this._serializePvpState();     // 双方全部区域的完整快照
const requestId = `turn_${this.state.turn}_${Date.now()}_...`;
```

**为什么是错的**：`_serializePvpState()` 序列化**双方**的 deck/hand/monsterZone/spellTrapZone/graveyard/banished/extraDeck 以及每张卡的 ~25 个字段，实测大小：

| 卡组张数 | `end_turn` 报文字符数 | 结果 |
|---|---|---|
| 40 | 51,083 | 通过 |
| 45 | 57,363 | 通过 |
| 50 | 63,643 | 逼近上限 |
| 55 | 69,923 | **超限** |
| 60 | 76,203 | **超限** |

（用 `_serializePvpState()` 真实调用测得，资源目录内 node 直接跑 controller+model 即可复现；字符数与 UTF-8 字节数一致，token/中文 `themedState` 只会更大。）
游戏规则允许主卡组 **40～60 张**，所以 55～60 张卡组在**第一回合结束**时消息就超过 64 KiB。Java 侧 `getPayloadLength() > 64*1024` 成立 → 回一条 `error` 并且 `session.close(1009)`；Jetty 的 `setMaxTextMessageBufferSize(64*1024)` 甚至会更早抛 `MessageTooLargeException` 关连接。node 侧 `ws` 的 `maxPayload` 超限同样直接以 1009 断开。对手只会收到 `opponent_disconnected`，双方对局立刻结束；本机 `turnEnding` 永远为 true。

**最小触发**：两个玩家各带 60 张卡组建房 → 双方 `game_start` → 先手点“结束回合” → 连接被服务器关闭，双双弹出掉线。
**建议修复**：把 `MAX_MESSAGE_LENGTH` / `maxPayload` / `maxTextMessageBufferSize` 提高到 ≥ 256 KiB 并增加“消息过大只报错不断连”的分支；更根本的是不要把整份状态快照塞进每条动作消息（见 BUG-02）。

---

## BUG-02 | 服务器把“客户端自造的整局状态快照”原样转发，接收端无校验直接套用 → 回合玩家对自己的对手拥有完全权威
**文件**：`websocket/PvpWebSocketHandler.java:204-231,250-261`；`static/scripts/pvp-server.mjs:148-157`；接收端 `static/js/controller.js:1143,1224-1259,1269-1285`
**严重级**：CRITICAL

```java
// PvpWebSocketHandler.handleEndTurn
JsonNode state = msg.get("state");                                    // :250
if (state != null && state.isObject() && opponent != null && opponent.isOpen()) {
    ObjectNode syncAction = objectMapper.createObjectNode();
    syncAction.put("type", "syncState");
    syncAction.set("state", state);                                   // :255  客户端给的 blob
    ...
    sendJson(opponent, forwardMsg);                                   // :260  原样塞给对手
}
```
```js
// controller.js:1143（每个动作都附带整份快照）
this.pvpClient.sendAction({ ...action, state: this._serializePvpState() });
// controller.js:1275 / 1224-1252（接收端）
this._applyPvpSnapshot(action.state);
assignPlayer(this.state.players[0], snapshot.players[1]);   // :1250
assignPlayer(this.state.players[1], snapshot.players[0]);   // :1251
```

**为什么是错的**：服务器对 `state` 只做 `isObject()` 判断，既不校验、也不由服务端自己维护权威状态；接收端把对手快照**逐字段覆盖**到自己两侧玩家（含 LP、手牌、卡组、墓地、胜负字段）。于是“当前回合玩家”的浏览器是两人对局的唯一权威：
1. 改包的玩家可以在快照里把对手 LP 写成 0 / 把自己的 LP 写成 8000，下一次刷新对手就输了；
2. 攻击结算（包括对手陷阱是否发动）在**攻击方**客户端里完成（`controller.js:883-900`，`result.trap` 由攻击方引擎给出并随 `trapCardData` 中继），所以攻击方只要不发 `trapCardData`，对手的陷阱在这局就永远不结算，且对手本地状态随即被攻击方快照覆盖，无法纠正；
3. 服务器端唯一的“回合归属”检查（`room.turn != player.playerIndex`）只挡住“抢对手的回合”，挡不住“在自己回合里改整张盘面”。

**最小触发**：A 回合内用浏览器控制台执行
`pvpClient.send({type:"game_action", action:{type:"syncState", state:{...snapshot, players:[{...自己8000...},{...对手lp:0...}]}}})`
→ B 的客户端立刻把 B 的 LP 改成 0，B 下一回合抽卡后判负。
**建议修复**：服务端保存权威状态（或至少对快照做校验/夹紧：LP ∈ [0,8000] 且只允许变化有据可查、只允许发送方自己一侧发生改变、校验回合号单调递增、拒绝发件人对对手区域的写入）；退化方案是至少拒绝由发件人直接指定对手 LP/胜负字段的快照。攻击/陷阱的裁决必须由防守方或服务端参与（见 BUG-04 同源问题）。

---

## BUG-03 | PvP 服务器完全不校验卡组合法性/归属：可带任意卡（含未拥有、未启用、甚至不存在的卡）参赛
**文件**：`websocket/PvpWebSocketHandler.java:310-322,158-169`；`static/scripts/pvp-server.mjs:39-48,119-127`
**严重级**：HIGH

```java
private boolean isValidDeck(JsonNode deck) {                     // :310
    if (deck == null || !deck.isArray() || deck.size() < MIN_DECK_SIZE || deck.size() > MAX_DECK_SIZE) return false;
    Map<String, Integer> counts = new HashMap<>();
    for (JsonNode card : deck) {
        if (!card.isTextual() || card.asText().isBlank() || card.asText().length() > 50) return false;
        if (counts.merge(card.asText(), 1, Integer::sum) > 3) return false;
    }
    return true;                                                  // 只查“张数 40~60 / 同名 ≤3”
}
```
**为什么是错的**：整条链路上没有任何一处按用户校验卡组内容——`handleSetDeck` 不查 `UserCard`（服务端根本没有可用的 userId，WebSocket 握手身份完全没被使用），而卡组 ID 列表会被**原样交给对手**（`:185-197` 的 `deck`/`opponentDeck`），对手客户端用自己本地的卡表 `getCardById(id)` 把卡真的造出来（`main.js:390-402`）。因此改包的客户端只要发送 40 个 UR/不存在卡的 ID，就能在实机上使用自己从未拥有的卡。客户端的 `validateDeck`（`app.js:1004`）只是可绕过的本地检查。另外发不存在的 ID 会让对手的 `filter(Boolean)` 静默少牌。
**最小触发**：控制台 `pvpClient.setDeck(Array(40).fill("ur_最强卡"))`（或用 40 个未拥有卡的 ID）→ 对手侧正常开局，作弊者拿到这些卡。
**建议修复**：握手时把 JWT 主体绑定到 `WebSocketSession`（`PvpWebSocketHandler` 目前只用 `session.getId()`，没有任何用户身份），`handleSetDeck` 用该 userId 校验卡牌存在、`enabled=true`、且 `sekai_game_user_cards.count ≥ 卡组内数量`。

---

## BUG-04 | `game_over` 由客户端单方面宣告且服务器不校验 → 任一方可随时宣布自己胜利（并可据此刷奖励）
**文件**：`websocket/PvpWebSocketHandler.java:76-77,274-289`；`static/scripts/pvp-server.mjs:174-179`；客户端 `static/js/main.js:460-464`
**严重级**：HIGH

```java
private void handleGameOver(WebSocketSession session, JsonNode msg) throws IOException {   // :274
    PvpPlayer player = sessionPlayers.get(session.getId());
    if (player == null) return;
    PvpRoom room = rooms.get(player.roomId);
    if (room == null) return;
    // 不检查 room.gameStarted、不检查 winner 是否就是发送方、不关房
    gameOverMsg.put("type", "game_over");
    gameOverMsg.set("winner", msg.get("winner"));    // :284  客户端原样给定
    sendJson(room.host, gameOverMsg);
    sendJson(room.guest, gameOverMsg);               // :288  连输家也收到“你输了”
}
```
```js
// main.js:461-464
pvpClient.onGameOver = (winner, reason) => {
    const myWin = winner === gameInfo.yourIndex;
    currentController.onGameOver({ winner: myWin ? 0 : 1, isDraw: false });   // 输家被判负并 settleMatch
};
```
**为什么是错的**：(a) 对局随时可被一方宣告结束并指定赢家，对手客户端完全相信（`settleMatch` → 记负 → 上传战绩与奖励）；(b) 服务器对局结束后既不 `rooms.remove` 也不置 `gameStarted=false`，双方仍可继续发动作、`turn` 仍会翻转（`:263`），状态可被打乱；(c) 同一漏洞的“良性版”已经写进客户端：`pvpClient.onOpponentDisconnect = () => onGameOver({winner: 0})`（`main.js:460`），即**“对手掉线 = 我赢”**——断网/拔网线/关掉第二标签页即可强制获胜。
**最小触发**：控制台 `pvpClient.gameOver(0, "对局结束")` → 对手界面显示失败并按负场上报；或直接断开自己与服务器的连接。
**建议修复**：删掉客户端的 `game_over` 授权，胜负只由服务端裁决（LP/卡组耗尽/掉线超时）；掉线应判“掉线方负”而非“在线方必胜”，并给重连宽限期。

---

## BUG-05 | 战绩接口沿用客户端自报结果，固定发币 → 可无限刷决斗币
**文件**：`controller/DuelRecordController.java:26-71`（关键 `:46-57`）；`service/DuelRecordService.java:49-59`
**严重级**：HIGH

```java
String result = text(body, "result", "draw");                       // :31 客户端说了算
...
if ("pvp".equals(opponentType)) {                                   // :47
    coinsEarned = "win".equals(result) ? 1000 : ("loss".equals(result) ? -333 : 0);
}
...
DuelRecord record = duelRecordService.recordDuel(userId, result, opponentType, opponentName, deckUsedId, ...);
```
```java
// DuelRecordService.java:57-59
long nextCoins = (long) valueOrZero(user.getDuelCoins()) + coinsEarned;
user.setDuelCoins((int) Math.max(0, Math.min(Integer.MAX_VALUE, nextCoins)));   // 直接加钱
```
**为什么是错的**：奖励完全建立在客户端自报的 `result`/`opponentType` 上，服务器不校验是否真的存在过该 PvP 对局、也不校验对手、每局唯一性。与 BUG-04（“掉线即胜”）以及 BUG-03（可以带任何卡组）叠加后，脚本化刷币完全可行：一个 `POST /api/duels/user/{我} {"result":"win","opponentType":"pvp"}` 就是 +1000 决斗币，且可无限重复（`data integrity: client-authoritative reward`）。
**最小触发**：登录后循环 `await api.recordDuel(myId, {result:"win", opponentType:"pvp"})` → 每请求 +1000 币。
**建议修复**：奖励只能由服务端根据自身记录的 PvP 对局结果结算（例如对局开始时在服务端建局，结束时由服务端结算并幂等记账）；`/api/duels/user/{id}` 只用于上传非奖励性统计，或彻底移除客户端奖励计算。

---

## BUG-06 | 两个 PvP 服务器协议漂移：node 版 `game_start` 缺 `deck` 且**两端都不洗牌**，8080/8079 调试路径下卡组顺序完全固定
**文件**：`static/scripts/pvp-server.mjs:119-145`（`game_start` 载荷）对比 `websocket/PvpWebSocketHandler.java:172-198`；客户端 `static/js/main.js:401-409`、`static/js/model.js:82-89`
**严重级**：HIGH

```js
// scripts/pvp-server.mjs:126-142  —— 没有洗牌，也没有 deck 字段
room.decks[ws.playerIndex] = [...msg.deck];
...
room.players.forEach((p, i) => { if (p) send(p, {
    type: "game_start",
    yourIndex: i, firstPlayer, seed: room.seed,
    opponentName: room.players[1 - i].playerName,
    opponentDeck: room.decks[1 - i],        // 未洗牌的原始卡组顺序
}); });                                      // ← 缺少 Java 版有的 deck 字段
```
```java
// PvpWebSocketHandler.java:173-198 —— Java 版洗牌并下发自己的卡组
room.hostDeck = shuffleDeck(room.hostDeck);
room.guestDeck = shuffleDeck(room.guestDeck);
...
hostMsg.set("deck", room.hostDeck);         // :185
hostMsg.set("opponentDeck", room.guestDeck); // :187
```
```js
// main.js:401-404 / model.js:89
const playerCards = mode === "pvp" && Array.isArray(gameInfo?.deck)
    ? gameInfo.deck.map(...)          // 有 deck：用服务器洗好的顺序
    : buildDeckCards(playerDeck);     // 没有 deck：用本地卡组顺序
const preserveDeckOrder = mode === "pvp";
// model.js:89
this.deck = preserveDeckOrder ? instances : shuffleArray(instances, rng);   // pvp 下不洗牌
```
**为什么是错的**：`pvp.js:7` 在页面由 `scripts/server.mjs`（8080）托管时把 WebSocket 指向 8079，也就是 `scripts/pvp-server.mjs`——这是 README 与 `start.bat` 描述的主调试路径。该路径下：服务器不洗牌，客户端又因为 `preserveDeckOrder=true` 不洗牌，而 `gameInfo.deck` 缺失导致自方卡组回落到“卡组编辑器里的原始顺序”。结果是**起手 5 张与每一抽都可以被预先知道**，玩家只要在卡组编辑器里把想要的牌排到前面就能稳定拿到完美起手；同一份客户端在 Java 路径（8091）下行为完全不同，构成两地行为漂移。`seed` 虽然两端都发，但因为 `preserveDeckOrder=true` 从未用于洗牌。
**最小触发**：用 `start.bat` 起 8080+8079，双方各带同一套卡组 → 每次对局的起手完全相同且等于卡组列表前 5 张。
**建议修复**：node 服务器补上 `deck` 字段并用同一 `seed`（或 `crypto` 随机）对 `room.decks[i]` 洗牌，使两个服务器行为一致；`preserveDeckOrder` 只应在服务器已下发洗好顺序时使用。

---

## BUG-07 | 每条 PvP 消息都把当前玩家的**手牌**和双方卡组全量泄露给对手（与代码注释声明的隐藏信息契约相反）
**文件**：`static/js/controller.js:1146-1221`（快照内容）、`:1262-1266`（注释）、`static/js/pvp.js:83-86`；转发侧 `websocket/PvpWebSocketHandler.java:225-229,252-261`、`static/scripts/pvp-server.mjs:155`
**严重级**：HIGH

```js
// controller.js:1262-1266 —— 声明的契约
/** 从手牌出牌时，附带完整卡牌数据（对手不知道你手牌内容） */
// 实际实现（:1187-1210）
const serializePlayer = player => { ... hand: hand.map(serializeCard), deck: deck.map(serializeCard), ... };
return { ..., players: this.state.players.map(serializePlayer) };   // :1220 双方都发，含发件人手牌
```
**为什么是错的**：`_serializePvpState()` 被附在每个 `game_action` 与 `end_turn`（`pvp.js:85-86`）上，且服务器逐字节转发（两个服务器都不做裁剪）。对手只要在 devtools 里看 WebSocket 帧，就能读到发件人的**全部手牌（含里侧盖放的真实身份）、卡组剩余顺序、盖放魔陷**。这与注释声明“对手不知道你手牌内容”直接冲突，属于协议契约被破坏 + 严重作弊面。
**最小触发**：A 出牌时在 B 的浏览器 Network → WS 里查看 `game_action.action.state.players[0].hand` → 完整手牌。
**建议修复**：发送前剥离对手不可见信息（只保留区域长度与已公开卡），或改为“服务端裁剪后再转发”。

---

## BUG-08 | 对手掉线后房间被删，但**幸存者**的会话记录没清 → 该连接再也无法建房/加入房间（软锁）
**文件**：`websocket/PvpWebSocketHandler.java:42-58`（清理），相关判重 `:88-91`、`:117`
**严重级**：HIGH

```java
public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    PvpPlayer player = sessionPlayers.remove(sessionId);        // :44 只清自己
    if (player != null && player.roomId != null) {
        PvpRoom room = rooms.get(player.roomId);
        if (room != null) {
            WebSocketSession opponent = room.getOpponent(session);
            if (opponent != null && opponent.isOpen()) sendJson(opponent, Map.of("type", "opponent_disconnected"));
            rooms.remove(player.roomId);                        // :53 房间没了
        }
    }
}
```
```java
private void handleCreateRoom(...) {
    if (sessionPlayers.containsKey(session.getId())) {          // :88 → 永远为 true
        sendJson(session, Map.of("type","error","reason","你已经在房间中"));   // :89
        return;
    }
}
```
**为什么是错的**：房间被删后，对手的 `PvpPlayer`（含已失效的 `roomId`）仍留在 `sessionPlayers` 里，且该 socket 还活着（客户端每 20s 还在发 ping）。此后这位用户在**同一连接**上：`create_room` → “你已经在房间中”；`join_room` → “房间号无效”（`:117` 同一个判重）。只能整页刷新重连。同时 `sessionPlayers` 里这些失效条目要等 socket 关闭才回收。
**最小触发**：A 建房、B 加入、B 关标签页 → A 收到掉线提示，回到大厅再点“创建房间” → 永远失败，直到刷新页面。
**建议修复**：房间销毁时同步清理**双方**的 `sessionPlayers`（或把 `sessionPlayers.remove` 放到房间移除分支里对 host/guest 各做一次），并把房间状态改为挂在 player 上按需重建。

---

## BUG-09 | `requestId` 只被回显、从不校验/去重：迟到的重发会被当成“新的结束回合”，把陈旧快照推给对手并夺回回合
**文件**：`websocket/PvpWebSocketHandler.java:233-272`（`:240` 读、`:245`/`:267` 回显）；`static/scripts/pvp-server.mjs:159-172`；客户端 `static/js/controller.js:1113-1131`、`static/js/main.js:450-459`
**严重级**：MEDIUM（并发下可升为 HIGH）

```java
String requestId = msg.path("requestId").asText("");     // :240 读出来
if (room.turn != player.playerIndex) {                   // :241 只比“回合”，不比 requestId/回合号
    ... ack.put("requestId", requestId); ...             // :245 仅回显
    return;
}
...
room.turn = 1 - player.playerIndex;                      // :263 无条件翻转
turnMessage.put("requestId", requestId);                 // :267 仅回显
```
```js
// controller.js:1122-1131 —— 客户端 6s 后重发同一条 end_turn（同一个 requestId）
this.turnAckTimer = setTimeout(() => { sendEndTurn(); ... }, 6000);
// main.js:450-459 —— 收到任何 turn_changed 都处理，忽略 requestId
pvpClient.onTurnChange = currentPlayer => { ... }        // requestId 参数被丢弃
```
**为什么是错的**：服务器没有任何幂等/序号校验。“A 结束回合（ack 丢失）→ B 结束回合 → 又轮到 A”之后，A 的迟到重发会因为 `room.turn == A` 而**合法通过**，于是服务器把 A 12 秒前的旧快照覆盖给 B（盘面回退、墓地/手牌回滚），并且再次把回合交给 B，A 白白丢掉自己的回合。客户端同样不比对 `requestId`，任何 `turn_changed` 都会清掉当前的 ack 定时器，ack 语义形同虚设。
**最小触发**：A 点结束回合后立刻断网 6s 再恢复（或人为延迟 ack），待 B 也结束回合后 A 的重发到达 → B 的盘面回退且 A 的回合被吞。
**建议修复**：服务端维护 `currentTurnSeq`（或 `turn` 计数器），只接受 `requestId`/序号匹配当前回合的 `end_turn`，重复/过期直接忽略；客户端也在 `onTurnChange` 里比对 `requestId` 后再清定时器。

---

## BUG-10 | `PvpRoom.ready`（HashSet）与开局流程被多线程无锁改写 → 可能重复开局或永远开不了局
**文件**：`websocket/PvpWebSocketHandler.java:163-201`、`:378`
**严重级**：MEDIUM

```java
if (player.playerIndex == 0) { room.hostDeck = deck; room.ready.add(0); }   // :163-166
else { room.guestDeck = deck; room.ready.add(1); }                          // :167-169
if (room.ready.size() == 2) {                                               // :172
    room.hostDeck = shuffleDeck(room.hostDeck);
    room.guestDeck = shuffleDeck(room.guestDeck);
    room.gameStarted = true;
    int firstPlayer = secureRandom.nextInt(2);
    room.turn = firstPlayer;
    ... sendJson(room.host, hostMsg); sendJson(room.guest, guestMsg);       // :188,198
}
```
```java
static class PvpRoom { ... Set<Integer> ready = new HashSet<>(); ... }      // :378 非并发容器
```
**为什么是错的**：WebSocket 回调运行在容器线程池上，两个玩家的 `set_deck` 可能并发。`HashSet` 并发 `add` 既可能丢失元素（于是 `size()` 永远到不了 2，双方卡在准备界面 = 软锁），也可能两个线程都读到 `size()==2` 而**各自执行一次开局**（`game_start` 被发两次，客户端把对局重置两次、`firstPlayer` 取到不同的值）。相邻的 `handleEndTurn` 用了 `synchronized (room)`，这里却没用，属于同一处共享状态的一致性缺口。
**最小触发**：两个客户端同时点“准备/进入”，或竞赛脚本同时发 `set_deck`。
**建议修复**：整段准备+开局逻辑放进 `synchronized (room)`；`ready` 改用 `ConcurrentHashMap.newKeySet()` 或直接用 `hostDeck != null && guestDeck != null` 判定。

---

## BUG-11 | 两个服务器对中间态动作（祭品选择）的处理互相矛盾：Java 静默丢弃、node 转发
**文件**：`websocket/PvpWebSocketHandler.java:217-221` 对比 `static/scripts/pvp-server.mjs:148-157`
**严重级**：MEDIUM

```java
String actionType = action.path("type").asText("");
if (Set.of("selectTribute", "confirmTribute", "cancelTribute").contains(actionType)) {
    logger.warn("Ignored intermediate PvP action {} from room {}", actionType, player.roomId);
    return;                                    // :220 静默丢弃，连给发送方一个 error 都没有
}
```
```js
// scripts/pvp-server.mjs —— 同样的动作会被原样转发
case "game_action": { ... send(opponent, { type: "game_action", action: msg.action, playerIndex: ws.playerIndex }); }
```
**为什么是错的**：同一个协议的两个实现直接矛盾（Java 下对手看不到祭品选择、node 下看得到）。当前**实际影响是潜伏的**：经核对，客户端并不发送 `selectTribute/confirmTribute/cancelTribute`（祭品流程是通过 `summon` 的 `tributeSummon` 额外字段隧穿的；`controller.js:1452-1458` 里那两个 case 位于 `:1328` 的 `return` 之后，属于不可达的死代码），所以这条黑名单目前不会真的丢消息——但只要客户端日后按 `_applyRemoteActionQueued` 的意图发送这些动作，Java 端会静默丢包且不给发送方任何反馈（客户端会以为已同步），而 node 端会正常转发，形成“同一行为两个后端结果不同”的漂移。
**最小触发**：不触发（潜伏）；一旦客户端补发 `selectTribute`，Java 端会静默丢弃而 node 端转发。
**建议修复**：只保留一份服务端实现（或让两者共享同一份分发逻辑），并把“被忽略的动作”以 `error` 明确回给发送方。

---

## BUG-12 | 余额/碎片是“读-改-写”且 User 无 `@Version`：并发的开包/合成可以只扣一次钱却拿到两份卡
**文件**：`service/CollectionService.java:96-101,163-183`；`entity/User.java:28`（无 `@Version`）；同类问题 `service/DuelRecordService.java:57-59`
**严重级**：MEDIUM

```java
int cost = count == 80 ? 9000 : 1000;
if ((user.getDuelCoins() == null ? 0 : user.getDuelCoins()) < cost) {          // :99  读
    return Map.of("success", false, "reason", "决斗币不足");
}
... for (Card card : pulledCards) { addCardToUser(userId, card.getId(), 1); }  // :163  发卡
user.setDuelCoins(user.getDuelCoins() - cost);                                 // :177  写（覆盖式，非原子）
```
**为什么是错的**：两个并发的 `POST /api/collection/{id}/pack` 都读到同一余额并通过检查，各自插入卡牌、各自把“原余额 - cost”写回去 → 丢更新：玩家只被扣一次钱（甚至因后写者覆盖而少扣），却拿到两份卡。`User` 没有任何乐观锁（无 `@Version`）、没有 `SELECT ... FOR UPDATE`、也没有原子 `UPDATE ... SET coins = coins - ?`。同理 `craftCard`(碎片扣减) 与 `DuelRecordService` 的加减币都基于读到的旧值。
**最小触发**：一个 `for` 循环里同时 `fetch` 两个 `openPackServer(userId,"nightcord",80)`。
**建议修复**：用带条件的原子更新（`UPDATE ... SET duel_coins = duel_coins - :cost WHERE id=:id AND duel_coins >= :cost`，受影响行数=0 则拒绝）或给 `User` 加 `@Version` + 重试；碎片同理。

---

## BUG-13 | 仓库里同时存在第三套、完全不同协议的 PvP 服务器（`pvp-server/server.js`），且它被打进了 `target/classes`
**文件**：`static/pvp-server/server.js:9-20,24,58-107`
**严重级**：MEDIUM

```js
 * 协议（CLIENT → SERVER）：
 *   { type: "create-room", name: "玩家名" }
 *   { type: "join-room", code: "ABCD", name: "玩家名" }
 *   { type: "relay", data: { ... } }
const PORT = Number(process.env.PVP_PORT || 3001);       // :24
const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";        // :30 4 位字母数字房间码
```
**为什么是错的**：`js/pvp.js` 说的是 `create_room`/`join_room`/`set_deck`/`game_action`/`end_turn` 与 6 位数字房间号、端口 8079 或同源 `/ws/pvp`；这个文件的协议是连字符命名 + 4 位字母码 + `relay`，端口 3001，两边**没有一条消息能对上**。它是死代码但仍在源码树里，而且 `target/classes/static/pvp-server/server.js` 说明它随构建产物一起分发；任何按它启动或对照它开发的人都会得到一个完全不工作的 PvP。它同时没有消息大小/频率限制、没有心跳、没有超时清理（死房间只在 close 时回收）。
**最小触发**：`node static/pvp-server/server.js` 然后用游戏客户端连接 → 一直连不上/无法建房。
**建议修复**：删除该文件（或明确标注为废弃并移出构建产物）。

---

## BUG-14 | 放弃的 PvP 客户端永不释放：心跳定时器与 WebSocket 常驻，服务器端的房间/会话条目也随之常驻
**文件**：`static/js/pvp.js:27-45,64-71,88`、`static/js/app.js:1009-1012,1070-1073`
**严重级**：MEDIUM

```js
// pvp.js:64-71
_startHeartbeat() { this._stopHeartbeat(); this.heartbeatTimer = setInterval(() => this.send({type:"ping", at:Date.now()}), 20000); }
// pvp.js:88 —— 只有显式 disconnect() 才会停心跳并关闭 socket
disconnect() { this._stopHeartbeat(); this.connected = false; this.ws?.close(); this.ws = null; this.roomId = null; }
```
```js
// app.js:1010-1012 —— 每次尝试都新建一个客户端并覆盖引用，从不 disconnect 上一个
const pvp = new PvPClient();
await pvp.connect();
this._pvpClient = pvp;
```
**为什么是错的**：`disconnect()` 只在 `createNewGame` 的 `onReturnHome`（`main.js:425-428`）和对局后的 `rematch` 里被调用。用户在大厅点“创建房间”成功、对手一直没来就关掉弹窗/回大厅，这个客户端的 `setInterval` 与 WebSocket 会**永久存活**（每 20s 一次心跳，浏览器不回收），服务器端对应房间与 `sessionPlayers` 条目也永不回收（BUG-08 同源）。重复 N 次就是 N 个常驻连接。
**最小触发**：大厅反复“创建房间 → 关闭弹窗”，在 devtools 里可以看到多个常驻 WebSocket。
**建议修复**：在弹窗关闭/导航离开时调用 `this._pvpClient?.disconnect()`；把心跳放进可被 `AbortController`/`destroy()` 统一清理的生命周期，并在 `connect()` 失败或超时时自我清理。

---

## BUG-15 | `saveCollection` 会整表删除该用户的收藏并按请求体重建：未知/禁用卡被静默丢弃，空 body 直接清空收藏
**文件**：`service/CollectionService.java:45-73`；入口 `controller/CollectionController.java:31-39`（`hasRole('ADMIN')`）
**严重级**：MEDIUM（仅管理员可达）

```java
userCardRepository.deleteByUserId(userId);            // :55 全删
userCardRepository.flush();
for (Map.Entry<?, ?> entry : cards.entrySet()) {
    int count = entry.getValue() instanceof Number n ? n.intValue() : 0;
    if (count <= 0) continue;
    Card card = cardRepository.findById(cardId).orElse(null);
    if (card == null || !Boolean.TRUE.equals(card.getEnabled())) continue;   // :64 静默跳过
    ...
}
userCardRepository.saveAll(savedCards);               // :71
```
**为什么是错的**：这是“全量覆盖”式写入——请求体里任何不在卡表里 / 被禁用的卡都会被**静默丢弃**，请求体为空 `{}` 则把该用户收藏清空；而返回体只报 `cards: savedCards.size()`，调用方无法察觉损失。没有事务性的保护（“先删后插”一旦中途失败，虽然 `@Transactional` 会回滚，但静默丢弃不是回滚能救的）。
**最小触发**：管理员（或任何拿到 ADMIN 令牌的人）用一份引用了旧卡 ID 的收藏 JSON 覆盖某用户 → 旧卡静默消失。
**建议修复**：改为增量合并（upsert），对无法识别的 cardId 直接报错（返回 400 并列出 ID），并在覆盖前做总数/差异校验。

---

## BUG-16 | `DataInitializer` 迁移逻辑里的死过滤/死三元：`filter(card -> owner)` 恒为真，`owner ? 3 : 1` 恒为 3
**文件**：`config/DataInitializer.java:112-117`
**严重级**：LOW

```java
userCardRepository.deleteByUserId(user.getId());
List<UserCard> inventory = cards.stream()
    .filter(card -> owner)                  // :114 用循环变量当谓词：此处 owner 必然为 true
    .map(card -> ownedCard(user, card, owner ? 3 : 1))   // :115 也必然是 3
    .toList();
```
**为什么是错的**：`!owner` 的分支在 `:106-110` 已经 `continue` 掉，`owner` 到这里恒为 true，`filter` 不起作用、三元恒取 3——看起来像“非房主只给 1 张”的意图被写错，实际上这段代码给种子账号发了**全部 368 张卡各 3 张**。行为恰好符合种子账号的预期，但这段表达式毫无作用且会误导后续维护。
**最小触发**：无（当前不改变行为）。
**建议修复**：删除无意义的 `filter`，直接把 `3` 写成常量；若要保留“非 owner 给 1 张”的语义，需要把该分支移到 `if (!owner)` 的位置。

---

## BUG-17 | 配置与杂项：明文数据库口令默认值、`ddl-auto: update`、`../pricture` 目录对外暴露、`/api/auth/**` 免 CSRF、`deckUsedId` 未限长且把数据库异常文本回给客户端
**文件**：`resources/application.yml:13,21`；`config/WebConfig.java:27-31`；`config/SecurityConfig.java:38-42`；`controller/DuelRecordController.java:41,68-70`
**严重级**：LOW

```yaml
password: ${APP_DB_PASSWORD:20070831}      # :13 明文默认口令入库到仓库
ddl-auto: update                           # :21 生产环境自动改表
```
```java
String pricturePath = new File("../pricture").getAbsoluteFile().toURI().toString();   // WebConfig:28
registry.addResourceHandler("/pricture/**").addResourceLocations(pricturePath);       // :29 暴露 Web 根之外的文件系统目录
```
```java
.ignoringRequestMatchers("/api/auth/**", "/api/health", "/api/cards/**")              // SecurityConfig:42 认证接口免 CSRF（登录 CSRF）
```
```java
String deckUsedId = body.get("deckUsedId") instanceof String v ? v : null;   // :41 未限长（实体列长 50）
... catch (RuntimeException e) { return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage())); }  // :69 回显数据库异常文本
```
**为什么是错的**：口令默认值让“忘记设置环境变量”直接变成弱口令部署（`app.jwt.secret` 反而是 `${APP_JWT_SECRET}` 无默认值、且 `JwtService:33-35` 强制 ≥32 字符，这点是对的）；`ddl-auto: update` 会在生产静默改表；`/pricture/**` 把应用目录之外的本地目录作为静态资源发布（依赖 `PathResourceResolver` 的路径防护，但发布面本身没必要）；`/api/auth/**` 免 CSRF 允许登录 CSRF；`deckUsedId` 超过 50 字符会触发 DB 异常，而异常原文会被回给客户端（信息泄露）。
**最小触发**：不设 `APP_DB_PASSWORD` 启动即用仓库里的明文口令；超长 `deckUsedId` 提交可在响应里看到 SQL/约束文本。
**建议修复**：移除默认口令（缺失即启动失败）、`ddl-auto: validate`、删除 `/pricture/**` 处理器、把 CSRF 排除限定到 `POST /api/auth/login|register`、对 `deckUsedId` 限长并统一用 `ApiExceptionHandler` 返回不透明错误。

---

## 明确未发现问题的区域（已逐项核对，非遗漏）

1. **JWT 校验**：`JwtService.parse` 使用 `Jwts.parser().verifyWith(signingKey)`（jjwt 0.12.5），密钥为 `Keys.hmacShaKeyFor` 生成的对称密钥并要求 ≥32 字符——不存在算法混淆；`parseSignedClaims` 会自动校验 `exp`（`ExpiredJwtException` 被 `catch (RuntimeException)` 吞掉返回空），**没有“缺少过期检查”或“不验签”的问题**。Cookie 为 `httpOnly` + `SameSite=Strict`。
2. **路径 userId 的越权**：`CollectionController` / `UserController` / `DeckController` / `DuelRecordController` 中每一个带 `{userId}`、`{deckId}` 的接口都有 `@PreAuthorize("@userAccess.isCurrentUser(...)")` 或 `isDeckOwner(...)`，`UserAccessService` 用 JWT 主体（`authentication.getName()`）比对，`AnonymousAuthenticationToken` 被显式排除，`@EnableMethodSecurity` 已开启。**没有发现 A 读写 B 的收藏/卡组/战绩的接口**。
3. **SQL/JPQL 注入**：仓库层只有派生查询与一条无字符串拼接的 `@Query`，`CardService`/`DeckService` 等一律走 `findById` —— 未发现注入面。
4. **`/ws/pvp` 的鉴权**：握手是普通 HTTP 请求，`SecurityConfig` 的 `anyRequest().authenticated()` 对它生效（JWT Cookie 会随同源握手发出），`WebSocketConfig:36-39` 也限定了 Origin —— 未认证者无法直接连上 Java 端；但**握手后的身份完全没有被业务使用**（这正是 BUG-03 的根因）。
5. **`scripts/server.mjs`（8080 静态服务器）**：`safePath` 做了 `decodeURIComponent` 异常捕获 + `path.resolve` 前缀校验 + 405 限制，CSP/`X-Content-Type-Options`/`X-Frame-Options` 齐备 —— 这一段没有发现真实缺陷。
6. **`PvpRoom.getOpponent` 的身份判定、`sendJson` 的加锁与 null 保护、`normalizeName`/`normalizeMessage` 的长度截断、房间随机号生成与去重、握手与 `MAX_NAME_LENGTH`** 等处未发现真实缺陷。
