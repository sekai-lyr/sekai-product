# controller.js — Real-Logic-Bug Audit

Scope: `SekaiGame/src/main/resources/static/js/controller.js` (2388 lines). `engine.js`, `model.js`,
`constants.js`, `ui.js`, `main.js`, `themed-effects.js`, `cards.js` and `test/*` were read only to
trace call sites and to check whether a behaviour is asserted by a passing test.

All findings below were verified by reading the code and (where noted) by running a controller-level
reproduction harness in Node (driver scripts kept outside the repo; they build a `GameState`/`GameEngine`/
`GameController`, stub `ui`, and stub `_scheduleAi` so that the AI's timer chain can be stepped manually).

Verification summary produced by the harness (`_runAiBattleStep` stepped at most 25 times):

```
A[noDirectAttackThisTurn]      rounds=25 stillReschedulingBattle=true  phase=battle attackerCanAttack=true lp=8000
A[control (same state, flag off)] rounds=2  stillReschedulingBattle=false phase=draw  attackerCanAttack=false lp=6200
A[target cannotBeAttacked]     rounds=25 stillReschedulingBattle=true  phase=battle attackerCanAttack=true lp=8000
A[attacker frozen (timeStop)]  rounds=25 stillReschedulingBattle=true  phase=battle attackerCanAttack=true lp=8000
A[face-down attacker, ATK pos] rounds=25 stillReschedulingBattle=true  phase=battle attackerCanAttack=true lp=8000
B effectBusy=true -> summonMonster refused ("请等待特效播完"), endTurn() succeeded anyway (turn=2, P2's turn)
D clicking a DEF monster in MAIN_1 -> phase=battle, selectedAttacker=null (silent)
E set spell w/ graveyard target -> phase=target_select, validTargets=1 (UI never opens the graveyard overlay)
H synthetic rulesVersion manual effect -> 12 consecutive main-phase "actions", never leaves the loop
```

---

## BUG-01 — CRITICAL — `_runAiBattleStep` never terminates when the engine rejects the chosen attack

* **id**: BUG-01
* **file:line**: `js/controller.js:1888-2034` (attacker filter `1894-1900`, attack loop `1929-1938`, reschedule `2033`)
* **severity**: CRITICAL (AI turn never ends — permanent soft-lock / infinite animation + log spam)
* **summary**: If `engine.attack()` returns `success:false` the attacker is left `canAttack === true`, so the same
  attacker is picked again on the next scheduled battle step, forever.

Code:

```js
1894:        const attackers = ai.monsterZone
1895:            .filter(card => card.canAttack && !card.cannotAttack && card.position === MONSTER_POSITION.ATTACK);
...
1929:        while (redirectDepth <= 3) {
1930:            result = this.engine.attack(attacker, attackTarget);
1931:            this.ui.addLog(result.message, "damage", result.trap ? { card: result.trapCard } : null);
1932:            if (result.redirect) { redirectDepth++; attackTarget = result.redirect; continue; }
1933:            break;
1934:        }
...        // no `if (!result.success) return;` anywhere below
2029:        this.state.selectedAttacker = null;
2030:        this.checkAndRefresh();
2031:        if (this.state.gameOver) return;
2033:        this._scheduleAi(() => this._runAiBattleStep(), this.effectBusy ? 500 : this.aiActionDelay);
```

Why it is wrong: `canAttack` is only cleared by `markAttackUsed()` inside a *successful* engine resolution,
or by the hand-written "decline to attack" branch (`1912-1918`). Every early-return of `engine.attack()`
(`engine.js:2442-2474`) leaves the monster attackable, and the controller neither disables the monster nor
stops the battle phase, so the 600 ms timer chain re-enters `_runAiBattleStep` with the identical state.
The same code path also fires the phantom visuals (`ui.showAiAction(attacker,"AI ATTACK")` at 1908,
`playAttackAnimation` + `showDamageNumber(attacker.currentAttack)` at 2003-2008) on every iteration, i.e.
the player sees repeated attack animations and damage numbers while their LP never changes.

Concrete triggers (all reproduced, each non-terminating; the same state with the cause removed terminates in 2 rounds):

1. **Most reachable — 放学后的茶会 (`nc_sp_ur_004`, `recoverAndDrawV2`, in the default/AI deck `decks.js`):**
   `engine.js:1464 ctx.player.noDirectAttackThisTurn = true`. AI Main 1: play 茶会 → Main 1 → Battle.
   Human field empty ⇒ `target = "player"` (`1909`) ⇒ `engine.attack` returns
   `{success:false,"场地魔法效果：当回合不能直接攻击玩家"}` (`engine.js:2453`) on every retry.
2. **Human trap `cannotBeAttacked`** (`card-rules.js:116` → `engine.js:723-726`): the AI's
   `_chooseAiAttackTarget` (`2275-2301`) does not filter `cannotBeAttacked`, so it selects a protected
   monster; `engine.js:2463` refuses.
3. **Frozen attacker**: `timeStop` (`themed-effects.js:182-188`) sets `frozenUntil = turn+1` without
   changing position; `resetTurnState` (`model.js:159-167`) sets `canAttack = !attackLocked` and ignores
   `frozenUntil`, and the battle filter at `1894` does not check `frozenUntil`, so `engine.js:2451` refuses.
4. **Face-down attacker in attack position**: `sleep` (`themed-effects.js:128-132`) leaves
   `position === ATTACK` with `faceUp === false`; `resetTurnState` re-enables `canAttack`; the filter at
   `1894` does not check `faceUp` (the UI does — `ui.js:691`), so `engine.js:2450` refuses.

Trigger scenario (minimal, from the harness): `currentPlayerIndex=1`, `turn=4`, `firstTurn=false`,
`phase=MAIN_1`; AI field = one face-up ATK-position monster with `canAttack=true`; human field empty;
`state.players[1].noDirectAttackThisTurn = true`; call `_runAiBattleStep()` → the scheduled callback is
`() => this._runAiBattleStep()` **every time**, `state.phase` stays `"battle"`, and the AI turn never ends.

Suggested fix: after the attack loop, handle the failure explicitly, e.g.

```js
if (!result.success || result.replay) {              // battle did not resolve
    attacker.hasAttackedThisTurn = true;
    attacker.canAttack = false;
    this.state.selectedAttacker = null;
    this.checkAndRefresh();
    if (this.state.gameOver) return;
    this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
    return;
}
```
and additionally exclude unusable attackers in the `1894` filter (`&& card.faceUp && !(card.themedState?.frozenUntil >= this.state.turn)`),
skip `cannotBeAttacked`/`priorityTarget`-protected targets in `_chooseAiAttackTarget`, and treat
`noDirectAttackThisTurn` as "no direct attack available" in `_runAiBattleStep`.

---

## BUG-02 — MEDIUM — `endTurn()` ignores the effect lock, so a turn can end while an effect chain is still resolving

* **id**: BUG-02
* **file:line**: `js/controller.js:1075-1076` (guard), related `133`, `527-533`, `1081-1096`
* **severity**: MEDIUM (rule violation: end-of-turn hand limit can be bypassed; a resumed async chain mutates the *next* turn)
* **summary**: Every other player action starts with `if (this.effectBusy) return;` — `endTurn` is the only
  one that does not, and `_beginTurn` unconditionally clears `effectBusy`.

Code:

```js
1075:    endTurn() {
1076:        if (this.state.gameOver || this.turnEnding || !this._isHumanAllowed()) return;
...
1081:        const excess = Math.max(0, player.hand.length - GAME_CONFIG.END_HAND_LIMIT);
```
vs. e.g. `231: if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }` (summon),
`862` (attack), `480` (spell). `ui.js:1090 btnEnd.disabled = !canAct || gs.gameOver || selecting;`
never consults `effectBusy`, and `main.js:534` binds the click straight to `controller.endTurn()`.

Why it is wrong: while a 9 s spell chain is in flight (`565 this._lockForEffect(9000)`), the human can end
their turn. The chain then still runs afterwards: it re-inserts the temporarily removed drawn cards
(`530-533` splice them out of `hand`; `622 player.hand.push(drawn)` puts them back), calls
`checkAndRefresh()`/`_releaseEffectLocks()` during the opponent's turn, and `_beginTurn` already set
`effectBusy = false` at `133`, silently dropping the running lock.

Verification: with `_lockForEffect(9000)` active, `summonMonster(0)` was refused with "请等待特效播完"
while `endTurn()` completed normally (`currentPlayerIndex` 0→1, turn 1→2, log "=== 第2回合 · P2的回合 ===").

Concrete trigger: human activates 月下传讯 (`discardAndDraw`, draw 3; `ANIMATED_DRAW_EFFECTS` at line 28)
in Main 1 → hand goes from 5 to 8 with 3 cards removed from the array for the animation → hand `.length`
reads 5 → click "结束回合" within 9 s → `excess = 0`, no discard; the 3 cards come back after the turn
already ended, so the player enters the opponent's turn holding 8 cards (end-phase limit 6 violated).

Suggested fix: add `|| this.effectBusy` to the `1076` guard (or disable the button while `effectBusy`
for the local player), and stop clearing `effectBusy` in `_beginTurn` while `_lockTimers.length > 0`.

---

## BUG-03 — MEDIUM — The AI ignores a battle replay: the attack is consumed without resolving

* **id**: BUG-03
* **file:line**: `js/controller.js:1929-1938` and `1948-2027` (human counterpart handles it at `902-907`)
* **severity**: MEDIUM
* **summary**: `engine.attack()` can return `{replay:true}` after a trap changes the defending field; the AI
  path never checks `result.replay`, so it leaves the replayed attacker un-attacked and plays a phantom battle.

Code (AI — no replay branch, falls straight through to the trap/`else` visual block):

```js
1930:            result = this.engine.attack(attacker, attackTarget);
1932:            if (result.redirect) { redirectDepth++; attackTarget = result.redirect; continue; }
1933:            break;
1938:        }
1939:        if (redirectDepth > 3) { ... }
1948:        if (result.trap) { ... } else { ... }   // false on the replay path
```
Human path, for contrast:

```js
902:        if (result.replay) {
903:            this.ui.addLog(result.message, "play");
904:            this.state.selectedAttacker = attacker;
905:            this.refresh();
906:            return;
907:        }
```

Why it is wrong: on the replay path `engine.js:2504-2508` already calls `markAttackUsed(attacker)` and sets
`state.pendingBattleReplay`. The AI therefore loses that monster's attack for the whole battle phase
(it can never re-declare) while `1948-2027` still runs `playAttackAnimation(attackerSlot, targetSlot, …)`
for a battle that never happened; `state.pendingBattleReplay` stays set afterwards (only cleared by the
next `engine.attack` or `engine.endTurn`).

Concrete trigger: AI battle phase; AI attacker vs. a DEF-position defender; the human controls a set trap
whose `onAttacked` effect adds/removes monsters on the defender's side without being in the
`["cancelAttackAndReturn","cannotAttack","counterDestroy","destroyAttacker","reflectDamage","returnToHand"]`
list of `engine.js:2417` (e.g. a trap whose recipe action resolves to `token`/`deploy`). The engine returns
`replay:true`; the AI logs the message, animates a normal attack, and never attacks again with that monster.

Suggested fix: mirror the human branch — on `result.replay`, keep the attacker selected and re-run the
target choice, e.g. `if (result.replay) { this.state.selectedAttacker = attacker; this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay); return; }`
plus a guard that the same monster is not counted twice.

---

## BUG-04 — MEDIUM — A set spell with a graveyard target enters `target_select`, so its target UI can never open

* **id**: BUG-04
* **file:line**: `js/controller.js:357-372` (compare the hand-spell path at `494-503`)
* **severity**: MEDIUM (the card becomes unusable; the player is only rescued by Cancel)
* **summary**: `activateSetSpell` uses `PHASE.TARGET_SELECT` for *every* target type, while `activateSpell`
  correctly uses `PHASE.GRAVEYARD_SELECT` for `targetType === "graveyard"`.

Code:

```js
364:            this.pendingSetSpell = true;
...
367:            this.state.phase = PHASE.TARGET_SELECT;      // <- also for graveyard targets
368:            this.state.validTargets = this.engine.getValidTargets(player, effect);
```
vs.

```js
498:            this.state.phase = targetType === "graveyard" ? PHASE.GRAVEYARD_SELECT : PHASE.TARGET_SELECT;
```

Why it is wrong: `ui.js:505` only calls `_showGraveyardSelect()` for `PHASE.GRAVEYARD_SELECT`, and the
field renderer only tags monsters/spell-traps with `data-effect-target` when
`isTargetSelect = gs.phase === PHASE.TARGET_SELECT` (`ui.js:638,694,705`) — graveyard cards are not field
slots, so **no element is clickable**. `_renderControls` does show the cancel button for `target_select`
(`ui.js:1081-1093`), so the player is not permanently stuck, but the card can never be used this way.

Concrete trigger (reproduced): Main 1, own graveyard has 1 monster; a card with effect
`{trigger:"manual", type:"recoverMonster"}` (target type `"graveyard"`, `engine.js:2339/2340`) is face-down
in the spell/trap zone with `setTurn < turn`; `canActivateSetSpell` returns `{canActivate:true}`;
`activateSetSpell(card)` → `state.phase === "target_select"`, `validTargets.length === 1`, log
"请选择复活魔法的目标", and nothing on screen can be clicked.

Suggested fix: use the same ternary as `activateSpell`:
`this.state.phase = targetType === "graveyard" ? PHASE.GRAVEYARD_SELECT : PHASE.TARGET_SELECT;`

---

## BUG-05 — LOW — ~145 lines of remote-action handling are unreachable (dead branch after `return`)

* **id**: BUG-05
* **file:line**: `js/controller.js:1327-1330` (block ends at `1473`)
* **severity**: LOW (no current behavioural effect; a whole code path is silently dead)
* **summary**: `_applyRemoteActionQueued` returns unconditionally and then executes a `switch` that can never run.

Code:

```js
1327:        this.effectBusy = false;
1328:        return;
1329:
1330:        switch (action.type) {
1331:            case "turnStart": { ... }
...
1470:            default:
1471:                console.warn("Unknown PvP action:", action.type);
```

Why it is wrong: everything from `1330` to `1473` (`turnStart/draw/summon/set/flipSummon/changePosition/
activateSpell/activateMonsterEffect/attack/selectTribute/confirmTribute/cancelTribute/discard`) is dead,
including a second `_playRemoteActionEffect` call and an `_applyPvpSnapshot` call at `1474-1477`. Remote
PvP actions are in fact applied only through the snapshot in `_applyPvpSnapshot` (`1224-1260`), which is why
no test fails. Anyone editing these handlers will change nothing.

Concrete trigger: n/a (unreachable). Verified by control flow only; no test references
`applyRemoteAction`/`_applyRemoteActionQueued` (grepped `test/`).

Suggested fix: delete `1330-1473` (or move the snapshot application above the `return` if the `switch` was
meant to stay live).

---

## BUG-06 — LOW — Clicking a monster that cannot attack still forces the Battle Phase

* **id**: BUG-06
* **file:line**: `js/controller.js:839-847` (same pattern in `_ensureMainPhaseForHandAction`, `220-228`)
* **severity**: LOW
* **summary**: The Main 1 → Battle transition happens *before* the attacker is validated, so any monster
  click (DEF position, already attacked, `cannotAttack`, face-down) advances the phase and logs
  "已自动进入战斗阶段" while `selectedAttacker` stays `null`.

Code:

```js
839:        if (this.state.phase === PHASE.MAIN_1) {
840:            this.state.phase = PHASE.BATTLE;
841:            this.ui.addLog("已自动进入战斗阶段", "turn");
842:        }
843:        if (this.state.phase !== PHASE.BATTLE) { ... return; }
...
847:        if (!card.canAttack || card.position === MONSTER_POSITION.DEFENSE || card.cannotAttack) return;
```

Why it is wrong: an illegal click mutates phase state and can no longer be undone (Main 1 is gone;
`_ensureMainPhaseForHandAction` only converts Battle → Main 2). The player sees a phase change and a
"battle phase entered" log for a click that did nothing.

Concrete trigger (reproduced): `turn=5`, `firstTurn=false`, `phase=MAIN_1`, own field = one face-up
DEF-position monster → `selectAttacker(thatMonster)` → `state.phase === "battle"`, `selectedAttacker === null`.

Suggested fix: move the `839-842` transition below the `847` validation (return/log first, then advance).

---

## BUG-07 — LOW — AI target model treats ATK == DEF as a kill, but the engine destroys nothing on equality

* **id**: BUG-07
* **file:line**: `js/controller.js:2281-2283` (against `engine.js:2555` and `2573-2578`)
* **severity**: LOW (AI decision quality; the attack is consumed for no effect)
* **summary**: `if (atk >= tPower)` classifies an equal-power target as `killable`, but equality never destroys.

Code:

```js
2281:            const tPower = t.position === MONSTER_POSITION.DEFENSE ? (t.currentDefense || 0) : (t.currentAttack || 0);
2282:            if (atk >= tPower) {
2283:                killable.push({ card: t, power: tPower, loss: 0 });
```

Why it is wrong: for a DEF-position target, `engine.js:2555-2556` returns
"攻击力等于守备力，均不破坏且不受伤害" — nothing happens and the attack is spent. For an ATK-position
target with equal ATK, `engine.js:2573-2578` destroys **both** monsters, yet the entry records `loss: 0`
(the `loss` field is dead data — nothing reads `suicide`/`loss`), so the AI believes the exchange is free.
The classifier should be `atk > tPower` for a guaranteed kill.

Concrete trigger: AI 1800 ATK monster vs. the only human monster, face-up DEF with DEF 1800 →
`_chooseAiAttackTarget` returns that monster → `engine.attack` destroys nothing, no damage, the AI's attack
for that monster is used up.

Suggested fix: build `killable` with `atk > tPower` (and treat the equality cases separately, accounting
for mutual destruction in ATK position).

---

## BUG-08 — LOW — Wrong owner index when playing `onDestroyed` effect visuals

* **id**: BUG-08
* **file:line**: `js/controller.js:1006` and `js/controller.js:1030`
* **severity**: LOW (visual only)
* **summary**: `const ownerIdx = owner === 0 ? 0 : this.state.currentPlayerIndex;` — the "else" branch
  resolves to the attacker's own owner index, so a destroyed opponent's effect animation is played on the
  wrong side of the field.

Code:

```js
1005:                        for (const { card, owner } of destroyedTargets) {
1006:                            const ownerIdx = owner === 0 ? 0 : this.state.currentPlayerIndex;
```

Why it is wrong: in `attackTarget` the attacking side is `this.state.currentPlayerIndex`, so for a
destroyed **opponent** monster (`owner === 1`) `ownerIdx` becomes `0` and the code looks up
`[data-owner="0"][data-zone="monster"]` and plays the effect on the attacker's last slot. Should simply be
`owner`. (Same expression repeated at `1030` in the non-cinematic path.)

Concrete trigger: human attacks and destroys an opponent monster that has an `onDestroyed` effect → the
destruction effect animation is played on the human's own monster slot.

Suggested fix: `const ownerIdx = owner;`

---

## BUG-09 — LOW — Tribute-summon animation is hardcoded to owner 0

* **id**: BUG-09
* **file:line**: `js/controller.js:806-816` (line `808`)
* **severity**: LOW (visual only; only reachable when player 1 tribute-summons, i.e. `local`/PvP modes)
* **summary**: `document.querySelectorAll('[data-owner="0"][data-zone="monster"]')` ignores the acting player.

Code:

```js
806:        if (result.success && card && result.card?.faceUp !== false) {
807:            raf(() => {
808:                const slots = document.querySelectorAll('[data-owner="0"][data-zone="monster"]');
```

Why it is wrong: every other animation resolves the owner dynamically
(`[data-owner="${this.state.currentPlayerIndex}"]`, e.g. `259`, `320`, `407`, `465`), so for the second
player the summon effect is played on the wrong half of the field.

Concrete trigger: `mode = "local"`, player index 1 tribute-summons a level-5+ monster via
`confirmTribute()` → the effect is drawn over player 0's monster row.

Suggested fix: use `[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`.

---

## BUG-10 — LOW (latent) — AI monster-effect branch has no `aiMaxMainActions` bound

* **id**: BUG-10
* **file:line**: `js/controller.js:1848-1856`
* **severity**: LOW (not reachable with the shipped card pool; would be an infinite AI loop if it were)
* **summary**: The `_activateAiMonsterEffect()` retry is entered precisely when
  `actionCount >= this.aiMaxMainActions`, so the `actionCount + 1` bound no longer applies.

Code:

```js
1848:        const action = actionCount < this.aiMaxMainActions ? this._chooseAiPlayAction() : null;
1849:        if (!action) {
1850:            const monsterEffect = this._activateAiMonsterEffect();
1851:            if (monsterEffect) {
...
1854:                this._scheduleAi(() => this._runAiMainStep(actionCount + 1), this.aiActionDelay);
1855:                return;
```

Why it is wrong: `_activateAiMonsterEffect` (`2260-2273`) only blocks *non*-`rulesVersion` cards via
`oncePerTurnUsed` (`2271`); a `rulesVersion` monster with a `manual`, non-`themedAction` effect that always
resolves would keep returning a message → infinite "AI acts" loop. All authored cards are built as
`themedAction` + `oncePerTurn`/`hardOncePerTurn` (`authored-card-rules.js:431`) and `canActivateThemedEffect`
consumes a per-turn use, so a real deck cannot currently reach it. Reproduced only with a synthetic card
(12 consecutive main-phase steps, never left the loop).

Suggested fix: pass and enforce a hard bound, e.g. `if (monsterEffect && monsterEffectCount < this.aiMaxMainActions)`,
or track a separate `aiMaxMonsterEffects` counter.

---

## BUG-11 — LOW — Spurious damage number for a battle-protected defending monster

* **id**: BUG-11
* **file:line**: `js/controller.js:1058-1060`
* **severity**: LOW (wrong displayed value; LP is not actually reduced)
* **summary**: `dmg = attacker.currentAttack - target.currentDefense` is shown whenever the attacker
  survived, without checking that any damage was actually dealt or that the target is in DEF position.

Code:

```js
1058:                if (targetSlot) {
1059:                    const dmg = Math.max(0, (attacker.currentAttack || 0) - (target.currentDefense || 0));
1060:                    if (dmg > 0) setTimeout(() => showDamageNumber(targetSlot, dmg, "damage"), 400);
```

Why it is wrong: this branch is reached whenever the target was not destroyed — including
`cannotBeDestroyedByBattle` targets in DEF position, where `engine.js:2545-2554` deals **no** battle damage
unless the attacker has piercing. The UI then shows a damage number for damage that never happened (and
conversely, when ATK < DEF the real damage goes to the *attacker* and is never displayed).

Concrete trigger: human 2500 ATK attacker vs. a face-up DEF 1000 monster with
`cannotBeDestroyedByBattle` → LP unchanged, "1500" damage number shown on the defender slot.

Suggested fix: only show the number when piercing damage was actually dealt (e.g. derive it from
`result.damage`/the LP delta as already done in `875-876`), and show the attacker-side damage in the
ATK < DEF case.

---

## BUG-12 — LOW — End-phase discard selection is only offered to player index 0

* **id**: BUG-12
* **file:line**: `js/controller.js:1082`
* **severity**: LOW (only `mode === "local"`; the shipped app never sets that mode — `main.js:414` maps only
  `"training"→"ai"`, plus `"ai"`/`"pvp"`.)
* **summary**: Player 1 in hot-seat mode always gets the automatic (random) discard instead of choosing.

Code:

```js
1082:        if (excess > 0 && this.state.currentPlayerIndex === 0 && typeof this.ui.showDiscardSelection === "function") {
...
1093:        if (excess > 0) {
1094:            const discarded = this.engine.discardToEndLimit(player);
```

Why it is wrong: `_isHumanAllowed()` (`215-218`) explicitly returns `true` for both players in `local` mode,
and `ui.js` renders the local player's hand/controls for both sides, so the selection UI is expected for
both — but the guard restricts it to index 0.

Concrete trigger: `mode = "local"`, player 2 (index 1) ends the turn with 9 cards → 3 cards are discarded
automatically, with no choice (behaviour the index-0 player does not get).

Suggested fix: drop the `currentPlayerIndex === 0` condition (rely on `_isHumanAllowed()`), or make it
`(this.mode === "local" || this.state.currentPlayerIndex === 0)`.

---

## Categories checked with no bug found

* **Phase machine / human soft-lock**: the End Turn button is always enabled outside the select phases
  (`ui.js:1090`), `endTurn()` cancels pending `TRIBUTE_SELECT`/`TARGET_SELECT` states first (`1077-1078`),
  `cancelTargetSelect`/`cancelTribute` restore `phaseBeforeSelection`/`previousPhase`, and the discard
  overlay cannot be dismissed without the callback (`ui.js:263-299`). No unrecoverable human soft-lock was
  found besides BUG-01 (AI turn).
* **First-turn / attack legality**: first-turn and `skipBattlePhase` are blocked in both the controller
  (`831-838`) and the engine (`engine.js:2442,2451`); "already attacked" is enforced by `canAttack` /
  `attacksMadeThisTurn` in both; direct attack with a non-empty opponent field is blocked in
  `attackPlayer()` (`1068`) *and* the engine (`2459`). No legality gap found for the human path.
* **Attack redirect/rewind**: `attackTarget`'s `_redirectDepth` recursion is bounded (`865-869`) and the AI's
  redirect `while` loop is bounded (`1929-1945`); `attackRedirector` is consumed via `_redirectUsedThisTurn`
  (`engine.js:2477-2494`), so the loops terminate. The replay path is BUG-03 only.
* **Turn/duel end re-entrancy**: `gameOver()` may be called repeatedly from `checkAndRefresh`, but
  `main.js:483-484` settles a match once (`matchSettled`), `gameOver()` clears the AI timer (`2333`), and
  every AI entry point (`aiTurn`, `_runAiMainStep`, `_runAiBattleStep`, `_finishAiTurn`, `_scheduleAi`'s
  catch) re-checks `state.gameOver`, so no AI step runs after the duel ends.
* **Concurrent end-turn requests**: `endTurn()` is guarded by `turnEnding` (PvP keeps it `true` until the
  ack); in AI mode the second call is rejected by `_isHumanAllowed()` after the player switch. (The only
  unguarded variant is the *effect-lock* case, BUG-02; in `local` mode the hand-off overlay covers the
  button, so a double end-turn was not demonstrable.)
* **Per-turn flag resets**: `engine.startTurn` → `player.resetTurnState()` resets `normalSummonUsed`,
  `skipBattlePhase`, `oncePerTurnUsed`, `positionChangedThisTurn`, `attacksMadeThisTurn`, `frozenUntil`-adjacent
  flags etc. (`model.js:150-199`), `engine.endTurn` clears `pendingBattleReplay`/`pendingTribute`/`validTargets`
  (`1831-1837`), and the controller resets `turnEnding`/`selectedAttacker` in `_beginTurn` (`186-187`) and
  `onPvpTurnStart` (`1802-1808`). Trap timing is enforced by `canActivate = setTurn < turn` (`engine.js:1756-1760`).
  No reset gap found other than the `effectBusy` clearing in BUG-02.
* **Missing `await`**: the AI chains are timer-driven and serialized through `_scheduleAi` (which cancels the
  previous timer) plus `_lockForEffect`; `_runAiBattleStep` deliberately does not wait for animations
  (asserted as intended by `test/yugioh-flow.test.js:140-169`). The only sequencing defect found is BUG-02.
