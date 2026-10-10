# Bug review — `js/ui.js` / `js/main.js` (+ helper modules)

Scope audited: `js/ui.js`, `js/main.js`, `js/card-view.js`, `js/catalog.js`, `js/image-cards.js`, `js/monster-cinematics.js`, `js/profile.js`, `js/auth.js`.
Call sites traced through `js/controller.js`, `js/app.js`, `js/engine.js`, `index.html`, `css/style.css` and `test/`.
Read-only audit — no file was modified. Baseline: `node --test test/*.test.js` → 216 pass / 0 fail (verified).

Findings are ordered by severity. `BUG-01`…`BUG-14`.

---

## BUG-01 | ui.js:904 | HIGH | 守备/攻击切换按钮的点击监听被注册 N 次，一次点击执行 N 次动作

**Code** (`_bindFieldEvents`, ui.js:858–912 — note the inner `forEach` is *inside* the outer one):

```js
bf.querySelectorAll("[data-instance-id]").forEach(el => {
    el.addEventListener("contextmenu", event => { ... });
    el.addEventListener("click", event => { ... });

    // 守备/攻击切换按钮
    bf.querySelectorAll("[data-pos-switch]").forEach(el => {   // <-- still inside the outer loop
        el.addEventListener("click", event => {
            event.stopPropagation();
            const card = this._findTarget(gs, el.dataset.posSwitch);
            if (!card) return;
            h.onChangePosition(card);
        });
    });
});
```

**Why it is wrong**
The `[data-pos-switch]` query/bind block sits inside the per-element loop of `[data-instance-id]`, so every occupied field slot (monsters + spell/trap, both sides) adds *another* click listener to *every* position-switch button. With N occupied slots, one physical click runs the handler N times (`event.stopPropagation()` only stops bubbling, not sibling listeners on the same element — that would need `stopImmediatePropagation()`). Verified structurally: at the `[data-pos-switch]` line there is one unclosed `{` opened by the outer `forEach` (brace balance = 1).

`controller.changePosition()` is therefore entered N times: the first call really flips the position and calls `_lockForEffect(500)` (ui.js:443), which sets `effectBusy = true` synchronously; every following call is rejected at `if (this.effectBusy)` (controller.js:428) and pushes a red "请等待特效播完" line into the duel log. So each position change also prints a bogus error message, plus N−1 redundant DOM/`refresh()` passes.

**Minimal trigger**
Turn ≥ 2, Main Phase 1. You control one face-up monster that was set/summoned on an earlier turn (the "守备" button is visible, ui.js:721–727) and *any* second occupied slot exists — e.g. the opponent has one monster, or you have a second monster / a set spell. Click "守备": the monster changes position once, but the log additionally shows "请等待特效播完" (and, if the busy lock has already expired, "该怪兽本回合已经转换过姿态").

**Suggested fix**
Move the `bf.querySelectorAll("[data-pos-switch]")` block out of the `[data-instance-id]` loop (dedent it to the body of `_bindFieldEvents`, after line 912), and rename the shadowed `el` to avoid confusion.

---

## BUG-02 | ui.js:888 | HIGH | 主要阶段点击"可攻击怪兽"不会进入战斗阶段（点击攻击流程完全不可达，只能靠拖拽）

**Code** (ui.js:881–901):

```js
el.addEventListener("click", event => {
    const card = this._findTarget(gs, el.dataset.instanceId);
    if (!card || card.isPlayer) return;
    const isOwn = Number(el.dataset.owner) === gs.currentPlayerIndex;
    const isMainPhase = gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2;

    // 战斗阶段优先：己方可攻击怪兽 → 选为攻击手
    if (isOwn && gs.phase === PHASE.BATTLE && el.dataset.attacker !== undefined) {   // <-- requires BATTLE
        const i = Number.parseInt(el.dataset.attacker, 10);
        const attackerCard = gs.currentPlayer.monsterZone[i];
        if (attackerCard) h.onSelectAttacker(attackerCard);
        return;
    }
    // 主要阶段：己方怪兽 → 打开操作面板（含守备表示切换）
    if (isOwn && isMainPhase && !gs.gameOver) { card._onField = true; this._showCardActions(card, -1, h, false); return; }
});
```

**Why it is wrong**
`h.onSelectAttacker` is what performs the Main-Phase-1 → Battle-Phase auto-advance (`controller.selectAttacker`, controller.js:839–842, "已自动进入战斗阶段"). But the UI only calls it when `gs.phase === PHASE.BATTLE` — i.e. only when the phase is already Battle — and every Main Phase click is swallowed by the panel branch (`_showCardActions(card, -1, h, false)` never offers an attack action). So from Main Phase 1 the *only* way to reach the Battle Phase is dragging a monster onto an enemy monster or onto the opponent portrait (ui.js:815–824 / 930–938). The click flow the game advertises is dead: `index.html:116` says "点击可攻击怪兽后选择目标", the CSS draws `.field-slot.can-attack { cursor:pointer }` (style.css:734), and the test "点击可攻击怪兽会从主要阶段1自动进入战斗阶段" (test/yugioh-flow.test.js:98) only passes because it calls `controller.selectAttacker` directly, never through the UI. Note that the slot is already marked attackable in Main 1 (`isBattle` at ui.js:636 includes `MAIN_1 && !firstTurn`), so the UI glows "can attack" and does nothing attack-related when clicked.

**Minimal trigger**
Turn ≥ 2 (your 2nd turn), Main Phase 1, you control a face-up ATTACK-position monster summoned last turn, `canAttack === true`. Click it → the card action panel opens with only 查看完整详情 / 变为守备表示, the turn badge still shows 主要阶段1, and no attack targeting appears.

**Suggested fix**
Check attackability before opening the panel, e.g.:

```js
if (isOwn && gs.currentPlayerIndex === 0 && isMainPhase && card.type === "monster"
    && card.faceUp && card.canAttack && !card.cannotAttack && card.position === MONSTER_POSITION.ATTACK
    && !(card.themedState?.frozenUntil >= gs.turn)) { h.onSelectAttacker(card); return; }
```
(optionally keeping the panel reachable by right-click, which already works).

---

## BUG-03 | ui.js:87-88 | MEDIUM | 日志面板的"收起 ×"同时打开全屏日志

**Code** (ui.js:84–88, `#log-collapse-inline` lives inside `.log-panel`, index.html:117):

```js
this.logFullscreen.querySelector("#log-fullscreen-close").addEventListener("click", () => this.closeLogFullscreen());
this.logFullscreen.addEventListener("click", e => { if (e.target === this.logFullscreen) this.closeLogFullscreen(); });
// 点击迷你日志面板 → 打开全屏
const logPanel = document.querySelector(".log-panel");
if (logPanel) logPanel.addEventListener("click", () => this.openLogFullscreen());
```
plus main.js:545: `document.querySelector("#log-collapse-inline")?.addEventListener("click", () => document.body.classList.add("duel-log-collapsed"));`

**Why it is wrong**
The panel-level click handler has no target filter, so the click on the collapse "×" bubbles to `.log-panel` and both actions run: the log collapses (intended) *and* the full-screen DUEL LOG opens on top of the duel (unintended). The user must then close that modal to get back — the affordance "collapse the log" cannot be used on its own.

**Minimal trigger**
In a duel, click the × in the top-right log panel header → the mini panel slides away *and* the full-screen log fills the screen.

**Suggested fix**
Ignore clicks targeting the collapse button: `logPanel.addEventListener("click", e => { if (e.target.closest("#log-collapse-inline, #log-toggle")) return; this.openLogFullscreen(); });` (and skip while `this.logFullscreen.classList.contains("active")`).

---

## BUG-04 | ui.js:950-955 | MEDIUM | `player_*` 目标没有任何 UI 元素：可选择"对方LP"的效果会把界面卡在无目标的选靶状态

**Code** (ui.js:950–955, the only place that understands player targets):

```js
_findTarget(gs, instanceId) {
    if (!instanceId) return null;
    if (instanceId.startsWith("player_")) { const idx = instanceId === "player_" + gs.players[0].name ? 0 : 1; return { isPlayer: true, name: gs.players[idx].name, currentDefense: gs.players[idx].lp }; }
    ...
```

`_renderMonsterSlots` / `_renderSpellTrapSlots` / `_renderTop` never emit `data-effect-target` (or `data-instance-id`) for the opponent player, yet the engine produces exactly such a target (engine.js:2357):

```js
case "enemy_monster_or_player": return [...opp.monsterZone.filter(m => !m.cannotBeTargeted), { instanceId: "player_" + opp.name, isPlayer: true, name: opp.name, currentDefense: opp.lp }];
```

**Why it is wrong**
`activateSpell`/`activateSetSpell` enter `TARGET_SELECT` whenever `getEffectTargetType` is not in the auto-resolve list (controller.js:494–502). For `damageTarget` / `damageAndHeal` / `negateCounterEffect` that type is `enemy_monster_or_player`, and `canPlayEffect` counts the phantom player entry as a legal target. Because no DOM element ever carries `data-effect-target="player_<name>"`, the only clickable effect targets are enemy monster slots — if the opponent's monster zone is empty there is *nothing* to click: the hand is replaced by "选择目标 · ESC 取消" (ui.js:959–961), `#end-turn-button` is disabled (ui.js:1090) and the only way out is 取消选择 / Esc. The `player_` branch of `_findTarget` is dead code. (The AI can use player targets — controller.js:2291–2294 — so this is a human-vs-AI UI asymmetry.)

**Minimal trigger**
Opponent controls no monsters. Activate a spell whose effect type is `damageAndHeal` (e.g. `nc_sp_ur_008`, card-rules.js:48) from hand. The game asks you to choose a target and shows no selectable target at all; the card cannot hit the opponent's LP.

**Suggested fix**
Render the player target: in `_renderTop`/`_bindFieldEvents`, when `gs.validTargets.some(t => t.isPlayer)` add `data-effect-target="player_<opponent name>"` (and the `effect-target` class) to the opponent HUD, mirroring the existing direct-attack wiring at ui.js:914–922. Alternatively filter `isPlayer` entries out of the UI-side playability check so the card is refused instead of opening an unusable selection.

---

## BUG-05 | ui.js:385 (set at 873/897) | MEDIUM | 卡牌实例上的 `_onField` 永久残留：手牌会显示"翻转召唤 / 变为守备表示"等只能在场上的操作

**Code** (ui.js:385–401, 873, 897):

```js
if (card._onField && card.type === "monster") {
    if (!card.faceUp && card.position === MONSTER_POSITION.DEFENSE) addAction("翻转召唤", "primary-action", () => handlers.onFlipSummon(card));
    if (card.faceUp && !card.hasAttackedThisTurn && !card.positionChangedThisTurn) {
        const newPos = card.position === MONSTER_POSITION.ATTACK ? "守备表示" : "攻击表示";
        addAction(`变为${newPos}`, "secondary-action", () => handlers.onChangePosition(card));
    }
    ...
```
```js
// ui.js:897 (field click)
if (isOwn && isMainPhase && !gs.gameOver) { card._onField = true; this._showCardActions(card, -1, h, false); return; }
```

**Why it is wrong**
`_onField` is a sticky flag written onto the card *instance* and never cleared when the card leaves the monster zone (`engine.resetCardState`, engine.js:102–123, resets `position/faceUp/positionChangedThisTurn/hasAttackedThisTurn` but not `_onField`). Plenty of effects bounce a monster to its owner's hand (`returnToHand` is used by dozens of cards, e.g. rarity-rules.js:54/112/222/423, card-rules.js:39). A bounced monster that the player had once clicked on the field therefore keeps presenting field-only actions in the hand menu, and those buttons call `h.onFlipSummon(card)` / `h.onChangePosition(card)` on a card that is not on the field.

Consequence: `controller.changePosition` runs the animation/lock, then `engine.changePosition` walks past every "is this monster on the field?" wall — `card.faceUp` is true after `resetCardState`, `positionChangedThisTurn`/`hasAttackedThisTurn` were reset, and `setTurn` is an older turn — and only fails at the very last check (`idx === -1 → "该怪兽不在场上"`, engine.js:2195–2196). So you get a meaningless red error line; worse, if the opponent controls the water field spell (`fieldSpellDiscardCost`, engine.js:2189–2193) the cost is paid *before* that check: `player.hand.pop()` is sent to the graveyard and the position change then fails — a silent hand-card loss for an action that could never work.

**Minimal trigger**
1. Main Phase, click one of your face-up monsters (this is the normal way to inspect a monster — see BUG-02, it sets `_onField`).
2. Let the opponent's effect/trap bounce that monster to your hand (`returnToHand`).
3. In a later Main Phase click the card in your hand → the action panel now lists "变为守备表示" (or "翻转召唤"); clicking it logs "该怪兽不在场上".

**Suggested fix**
Derive fieldness from the live state instead of the flag, e.g. pass the legal zone to `_showCardActions` (`gs.currentPlayer.monsterZone.includes(card) && gs.currentPlayerIndex === 0`), or delete `card._onField` whenever a card leaves `monsterZone`.

---

## BUG-06 | main.js:216 / main.js:319 | MEDIUM | 服务器"收藏为空"被判成登录失效：空背包账号会被反复踢回登录页

**Code** (main.js:213–216, 314–324):

```js
collection.inventorySynced = Boolean(collectionResult.success && serverCollection.length > 0);
```
```js
let synced = false;
try { synced = await syncFromServer(auth.userId); } catch (e) { synced = false; }
if (!synced) {
    clearAuth();
    authScreen.classList.remove("hidden");
    authError.textContent = "登录状态已失效，请重新登录以同步服务器卡牌";
    return;
}
```

**Why it is wrong**
`inventorySynced` conflates "the request succeeded" with "the account owns at least one card". A perfectly valid account whose collection happens to be empty (`{ success: true }` with no owned cards — e.g. after dismantling everything, or any state where the server returns no rows) is reported as a failed session: `startApp()` calls `clearAuth()`, hides the lobby and demands a re-login. Logging in again repeats the same path, so the player is stuck in a login loop even though authentication succeeded.

**Minimal trigger**
Sign in with an account for which `GET /api/collection/{userId}` returns success with an empty inventory (all cards dismantled / no rows). Result: the lobby never opens; the login screen reappears with "登录状态已失效，请重新登录以同步服务器卡牌".

**Suggested fix**
`collection.inventorySynced = Boolean(collectionResult.success);` — treat an empty (but successful) inventory as "synced, zero owned cards", and keep the existing `if (serverCollection.length > 0)` guard for replacing `collection.cards` if overwriting with an empty map is undesirable.

---

## BUG-07 | ui.js:85 + main.js:547 | LOW | 全屏日志既不能用背景点击关闭（死分支）也不能用 Esc 关闭

**Code**

```js
// ui.js:85
this.logFullscreen.addEventListener("click", e => { if (e.target === this.logFullscreen) this.closeLogFullscreen(); });
// ui.js:338-344
closeTopOverlay() {
    if (this.cardActionOverlay?.classList.contains("active")) { this.hideCardActions(); return true; }
    if (this.detailOverlay?.classList.contains("active")) { this.hideDetail(); return true; }
    if (this.tributeOverlay?.classList.contains("active")) { return false; }
    if (this.graveyardOverlay?.classList.contains("active")) { return false; }
    return false;
}
// main.js:547-552
document.addEventListener("keydown", event => { if (event.key !== "Escape") return; if (currentUI?.closeTopOverlay?.()) return; ... });
```

**Why it is wrong**
`.log-fullscreen` is a *centred, fixed-size* box (`position:fixed; inset:0; width:min(880px,92vw); height:min(760px,84vh); margin:auto`, style.css:937), not a full-viewport backdrop, and its two children (`.log-fullscreen-header`, `.log-fullscreen-body`) fill the whole box. `e.target === this.logFullscreen` therefore can never be true, and clicks outside the box never reach the element at all — the backdrop-click-to-close branch is dead. `closeTopOverlay()` also knows nothing about `logFullscreen`, so Esc is swallowed (or falls through to the phase-cancel logic) while the full-screen log stays open. The only way out is the × button — which, per BUG-03, is reachable only if you did not use the mini panel's collapse button.

**Minimal trigger**
Click anywhere in the mini log panel → the full-screen log opens → press Esc and click the dimmed area around it: nothing happens; only the ✕ in its header closes it.

**Suggested fix**
Add `if (this.logFullscreen?.classList.contains("active")) { this.closeLogFullscreen(); return true; }` to `closeTopOverlay()`, and move the backdrop handler onto a full-viewport wrapper element (or make the root element a backdrop with an inner dialog).

---

## BUG-08 | ui.js:389 vs ui.js:721-723 | LOW | 操作面板提供的"变为守备/攻击表示"缺少 `setTurn` 校验（必失败的动作）

**Code**

```js
// ui.js:389 (action panel — missing the setTurn guard)
if (card.faceUp && !card.hasAttackedThisTurn && !card.positionChangedThisTurn) { ... addAction(`变为${newPos}`, ...); }
// ui.js:721-723 (field button — has it)
const showPosBtn = canControl && !gs.gameOver && (gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2)
    && c.faceUp && c.setTurn !== gs.turn && !(c.themedState?.frozenUntil >= gs.turn) && !c.hasAttackedThisTurn && !c.positionChangedThisTurn;
```
`engine.changePosition` rejects exactly this case: `if (card.setTurn === this.state.turn && !card.hasAttackedThisTurn) return { success:false, message:"本回合召唤或盖放的怪兽不能手动改变表示形式" }` (engine.js:2181).

**Why it is wrong**
The two affordances for the same action use different conditions; the panel one offers an action that must fail. The player summons a monster, right-click/clicks it in the same Main Phase, and gets a "变为守备表示" button that only produces a red error line (plus a 500 ms effect lock and a full re-render, controller.js:427–444).

**Minimal trigger**
Main Phase 1: normal-summon a monster, then open its action panel (right-click it) → click "变为守备表示" → "本回合召唤或盖放的怪兽不能手动改变表示形式".

**Suggested fix**
Add `&& card.setTurn !== gs.turn && !(card.themedState?.frozenUntil >= gs.turn)` to the ui.js:389 condition (and to the flip-summon guard for symmetry).

---

## BUG-09 | ui.js:690-693 / 865 | LOW | "local" 热座模式：控制权/可攻击/可选靶全部硬编码给 0 号玩家

**Code** (ui.js:689–693, 865):

```js
const isLocalOwner = ownerIdx === 0;
const canControl = isLocalOwner && currentPlayerIndex === 0;
const canAtk = canControl && isBattle && ...;
const isEnemy = ownerIdx === 1;
const isTargetable = isEnemy && currentPlayerIndex === 0 && isBattle && hasAttacker && !c.cannotBeAttacked;
...
const isOwn = Number(el.dataset.owner) === 0;   // contextmenu handler
```

**Why it is wrong**
Every other place treats local hot-seat as a real mode (`this.mode === "local"` in `_renderHand` ui.js:964/983, `_renderControls` ui.js:1080, `_renderDeckPiles` ui.js:543, `controller._isHumanAllowed()` controller.js:216, and `showHandoff` for the device handover). Field control does not: when the local state's `currentPlayerIndex` is 1 (the second hot-seat player's turn), that player's monsters are rendered in the `opp-…` half with `ownerIdx === 1`, so `canControl`/`canAtk` are false (no `data-attacker`, not draggable, no position button) and the first player's monsters — now the "enemies" — get `ownerIdx === 0`, so `isTargetable` is false as well. The active player cannot attack or be targeted at all; clicks fall through to the action panel branch of the `[data-instance-id]` handler (`isOwn = owner === currentPlayerIndex` is correct there, so the panel opens but there is no attack path).

**Minimal trigger**
`controller.mode = "local"`, let player 0 end the turn (device handoff), then let player 1 try to attack with a monster that can attack: no slot shows the attackable styling, and no enemy monster becomes a drop/click target. (Not reachable from the shipped product — `mode: "local"` is only produced by tests — hence LOW, but the mode is half-implemented.)

**Suggested fix**
Use `ownerIdx === (this.mode === "local" ? gs.currentPlayerIndex : 0)` for control, and `ownerIdx !== (this.mode === "local" ? gs.currentPlayerIndex : 0)` for `isEnemy`; make the contextmenu `isOwn` use `gs.currentPlayerIndex` like the click handler does.

---

## BUG-10 | ui.js:1061-1063 (+ 351-375) | LOW | 手牌操作面板保存的是渲染时的 index / canPlay 快照，从不重新校验

**Code** (ui.js:1061–1063, consumed at ui.js:374–382):

```js
element.addEventListener("click", event => {
    event.preventDefault();
    this._showCardActions(card, index, h, canPlay);   // index + canPlay frozen here
});
...
addAction("攻击表示召唤", "primary-action", () => handlers.onSummon(index, MONSTER_POSITION.ATTACK, false));
addAction("盖放魔法", "secondary-action", () => handlers.onSetCard(index));
```
`controller.summonMonster(cardIndex)` / `activateSpell(cardIndex)` then index straight into `this.state.currentPlayer.hand[cardIndex]` (controller.js:236, 485).

**Why it is wrong**
The modal is not refreshed when the game state changes, so it keeps acting on a stale hand position and a stale playability snapshot. Any hand mutation that reorders the hand while the panel is open (e.g. a PvP opponent's `recycleAndDraw` / forced discard) makes "攻击表示召唤" summon whatever card happens to sit at that index now — a wrong-card play the player cannot see. The same snapshot also keeps the buttons enabled after the phase moved on (the guard is only `effectBusy`/`_ensureMainPhaseForHandAction`).

**Minimal trigger**
PvP duel: open the action panel for hand card #2 and leave it open while the opponent acts; any effect that forces a draw-into-graveyard hand replacement (recycleAndDraw / discard-and-draw) shifts the hand, then click "攻击表示召唤" — the summoned monster is not the card shown in the panel preview.

**Suggested fix**
Resolve the card by identity instead of index at click time (`onSummonCard(card)` → `hand.indexOf(card)` and re-validate `canPlay`), or close the panel on every `render()` when the hand/phase changed.

---

## BUG-11 | ui.js:1113-1121 | LOW | 祭品选择列出不可用作祭品的怪兽，也不按 needed 限制可选项

**Code** (ui.js:1113–1121):

```js
pt.player.monsterZone.forEach(c => {
    const el = document.createElement("div");
    el.className = `card in-hand rarity-${c.rarity || "N"} ${pt.selected.includes(c) ? "tribute-selected" : ""}`;
    ...
    el.addEventListener("click", () => h.onSelectTribute(c));
```

**Why it is wrong**
The engine marks material-restricted monsters (`card.cannotUseAsMaterial`, set for tokens — model.js:182) and caps the selection at `pt.needed` (`pt.selected.length >= pt.needed → "已选满祭品"`, engine.js:1905), but the overlay offers every monster on the field with the same live styling. The only feedback for clicking a token or a 4th monster is a red log line, and the card looks fully selectable — the "disabled affordance that still triggers the action" pattern.

**Minimal trigger**
Tribute-summon a level 5+ monster while a token (`isToken`) is on your field → the token appears in the 选择祭品 grid as a normal clickable card; clicking it logs "…不能用作召唤素材" and the confirm button stays disabled.

**Suggested fix**
Skip/disable entries with `c.cannotUseAsMaterial`, and stop accepting clicks once `pt.selected.length >= pt.needed` (or grey them out with a `disabled`-style class).

---

## BUG-12 | index.html:91 + ui.js:626-632 | LOW | 阶段进度条永远不可见（`display:none` 无人移除）

**Code**

```html
<!-- index.html:91 -->
<div class="phase-bar" id="phase-bar" style="display:none"></div>
```
```js
// ui.js:626-632
_renderPhaseBar(gs) {
    const bar = document.getElementById("phase-bar");
    if (this.turnBadge) this.turnBadge.textContent = `TURN ${gs.turn} · ${PHASE_NAMES[gs.phase] || gs.phase}`;
    if (!bar) return;
    const currentIdx = PHASE_ORDER.indexOf(gs.phase);
    bar.innerHTML = PHASE_ORDER.map((p, i) => `...`).join('<span class="phase-arrow">→</span>');
}
```

**Why it is wrong**
The element carries an inline `display:none` and no code ever clears it (only `.innerHTML` is written), while the stylesheet styles it as a visible absolutely-positioned bar (`.phase-bar { position:absolute; z-index:6; ... display:flex; }`, style.css:648, 1474). The whole phase-progression rendering path — the only visualisation of Draw→Standby→Main1→Battle→Main2→End — is dead work; only the small turn badge reflects the phase.

**Minimal trigger**
Any duel: the phase bar never appears, even though `#phase-bar` is repopulated on every render.

**Suggested fix**
Remove the inline `style="display:none"` from index.html:91 (or have `_renderPhaseBar` set `bar.style.display = "flex"`).

---

## BUG-13 | card-view.js:126 + ui.js:1148 | LOW | UR 稀有度在两张映射表里缺失（UR 被当成 SSR）

**Code**

```js
// card-view.js:125-127
export function rarityRank(rarity) {
    return { N: 0, R: 1, SR: 2, UR: 3, SSR: 3 }[rarity] ?? 0;
}
```
```js
// ui.js:1148
const rarityName = { N: "普通", R: "稀有", SR: "超稀有", SSR: "传说" }[card.rarity] || "";
```

**Why it is wrong**
UR is the top rarity elsewhere in the codebase: `rarity-rules.js:32` ranks `UR: 4, SSR: 3` and the dismantle values in app.js:490 are `UR: 200 > SSR: 100`. With `UR === SSR === 3`, the pack-reveal "highest card" and every rarity sort (app.js:414/448/466/629) can report/pick an SSR when a UR was opened and cannot order UR above SSR. Separately, the detail view's rarity label has no UR entry, so a UR card renders a trailing empty rarity in `#detail-type`.

**Minimal trigger**
Open a pack containing both a UR and an SSR → the "highest rarity" banner/sort may show SSR; open any UR card's detail view → "怪兽卡 · 暗属性 · 战士族 · Lv.4 · " with nothing after the last separator.

**Suggested fix**
`RARITY_RANK = { N:0, R:1, SR:2, SSR:3, UR:4 }` and add `UR: "究极稀有"` to the detail label map.

---

## BUG-14 | main.js:22-37 | LOW | 任何未捕获异常都会弹出无法关闭、且标题写错的面板

**Code** (main.js:22–37):

```js
function showFatalGameError(error) { ... panel.innerHTML = `<strong ...>PvP 初始化失败</strong><code ...>${message}</code><p ...>请截图此提示发送给开发者。</p>`; }
window.addEventListener("error", event => showFatalGameError(event.error || event.message));
window.addEventListener("unhandledrejection", event => showFatalGameError(event.reason));
```

**Why it is wrong**
The listener is global and unconditional, so any uncaught exception anywhere (a throwing click handler, a failed DOM query, a bug in an effect animation) is reported as "PvP 初始化失败" even in a single-player AI duel. The panel is `position:fixed; z-index:10000` with no close control and no auto-dismiss, so it permanently covers the duel and blocks further play; combined with the missing try/catch around UI paths there is no way for the player to continue. During this audit at least two library-shaped failure paths (ui.js:395 `card.effects.forEach` on a card that has `rulesVersion` but no `effects`; unguarded `document.getElementById(...)` dereferences in `showDetail`/`showGameOver`) would land here.

**Minimal trigger**
Trigger any uncaught error during an AI duel (e.g. an uncaught TypeError inside a click handler) → a "PvP 初始化失败" panel with a stack trace appears and cannot be dismissed.

**Suggested fix**
Only show the panel for errors raised while `currentMatch?.mode === "pvp"`, add a dismiss button, and/or restructure it as a toast. Guard `_showCardActions` with `(card.effects || [])` and null-check the detail/gameover DOM lookups.

---

## Categories checked with **no** bug found

* **Drop-zone detection / off-by-one indexing** — the row/owner mapping is consistent (`_renderField` ui.js:649–665 renders `p1.monsterZone` into `data-owner="1"` and `p0.monsterZone` into `data-owner="0"`, and `data-attacker`/`data-target`/`data-tribute` values `i` are read back from the same array the slot was rendered from: ui.js:773 `gs.opponentPlayer.monsterZone[i]`, ui.js:788 `gs.currentPlayer.monsterZone[i]`, ui.js:890 `gs.currentPlayer.monsterZone[i]`). Illegal drops cannot land: the `dragover`/`drop` handlers for `[data-drop-zone]` (ui.js:828–856) bail out *without* `preventDefault()` unless `zone.dataset.owner === gs.currentPlayerIndex` **and** the row type matches `drag.cardType`, so the browser never fires a `drop` for a foreign half or the wrong zone row.
* **One gesture playing a card twice** — `drop` runs `this._finishDrag()` (ui.js:850) before the handler, so `dragContext` is null for any later event; `dragend` does not synthesise a click; the field-attack path (`onSelectAttacker` → `onAttack`) is idempotent because `selectAttacker` only sets `selectedAttacker` when the opponent's zone is non-empty and `attackPlayer()` early-returns on `!selectedAttacker` (controller.js:1067), so the portrait-drop path (`onSelectAttacker` then `onAttackPlayer`) cannot double-attack.
* **Duplicate duel sessions from double-clicking 揭牌 / a stage / 再次决斗** — `playDuelLaunch().cancel()` only pauses the timeline and never calls `onComplete` (card-ignition.js:230–234), and `.overlay{display:none}` / `hideShell()` / `closeModal()` remove the clicked control synchronously, so a second click of a double-click cannot reach a live listener; `createNewGame` also re-arms `matchSettled = false` and `settleMatch` is single-shot (`matchSettled` guard, main.js:483).
* **Missing `preventDefault` on right-click** — all five `contextmenu` handlers call `event.preventDefault()` (ui.js:860, 1065, 1101, 1119) and the field-slot ones also `stopPropagation()`.
* **Double end-turn / double phase actions from fast clicks** — `endTurn` is guarded by `turnEnding`/`_isHumanAllowed` (controller.js:1076, 1082), and the RPS/turn-choice buttons live in `.overlay` containers that switch to `display:none` on the first click, so the second click of a double-click misses.
* **Detail modal opening twice / closing the wrong element** — `_bindDetailOverlay` binds once, `querySelectorAll("#detail-close, [data-detail-close]")` de-duplicates (the same node matches both selectors), and `showDetail` calls `hideCardActions()` first so the two overlays are mutually exclusive; `_showCardActions` rebuilds its buttons with `replaceChildren()`.
* **Ghost listeners on re-render** — the field, hand, opponent hand and both HUDs are rebuilt via `innerHTML`/`replaceChildren` on every render (ui.js:594, 605, 649, 970), and the per-overlay handlers use `onclick =` assignment (ui.js:1103/1104/1123/1124/1125, 292), so no accumulation was found apart from BUG-01 and the (guarded) `.log-panel` binding.
* **Phase advance after battle** — all three hand actions route through `controller._ensureMainPhaseForHandAction()` (`summonMonster` 232, `setCard` 287, `activateSpell` 481), so "use a hand card after the Battle Phase → Main Phase 2" is implemented and matches test/yugioh-flow.test.js:171.
* **Themed status badges in `card-view.js`** — `cardRuleStatusHtml` looks like it would show 冻结/不可取对象 forever, but `resolveThemedTurnEnd` (themed-effects.js:217–228, called from engine.js:1821) deletes the expired turn-stamped keys at the end of every turn, so the labels disappear correctly.

---

### Cross-references for the other auditors (out of my scope, found while tracing)

* `engine.js:2357` — `enemy_monster_or_player` injects a **snapshot** pseudo-target (`{isPlayer:true, currentDefense: opp.lp}`); `damageAndHeal` (engine.js:308–316) then writes to that snapshot, so the "player" variant of that effect deals no LP damage even when it is chosen (the AI can choose it, controller.js:2291–2294).
* `engine.js:2189–2193` — the field-spell discard cost is paid *before* the `idx === -1` ("该怪兽不在场上") check, which is what turns BUG-05 into a hand-card loss.
