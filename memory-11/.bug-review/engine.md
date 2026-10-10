# engine.js — 核心规则引擎审计 (Nightcord Duel Network)

**Scope**: `SekaiGame/src/main/resources/static/js/engine.js` (+ `js/model.js`, `js/constants.js` for call-site tracing).
**Method**: whole-file read, call-site tracing into `controller.js` / `ui.js` / `card-rules.js` / `authored-card-rules.js` / `themed-effects.js` / `ygo-starter.js`, test inspection (`test/*.test.js`), plus live reproduction of every finding with `node` against the real engine API.

**Audited revision**: `engine.js` 2691 lines, SHA-256 `85AD7FD9AF3B29B7390448E1208379BF2E8CD70E1DD96E64F28AE2BD895BB5B6` (17:12). All findings were re-verified against the newest revision seen at write time (2700 lines, SHA-256 `75621E575EAF80A1A297C4CBE01CEBFD5DFD80F0FC621A5B1E6DE2C7D989C596`, 17:13) and still reproduce.
⚠️ `engine.js` is being **modified concurrently by another process** (three edits landed during this audit: an `_executeSummon` attack-counter reset at 17:09 plus further +2/+8/+9 line insertions). Line numbers below are from the 2691-line revision and will drift; the **quoted snippets are authoritative** for locating each site.

**Reachability note used for severity**: the shipped 368-card pool (`ALL_CARDS`) is 308 `themedAction` cards (all authored/rated designs) + 60 `ygo_n_*` "starter_ygo" cards that still use the classic handlers in `engine.js`. 9 of the 15 classic handlers used by those 60 cards are actually pulled into AI stage decks by `stages.js#buildStageDeck`; `死者苏生`/`魔法筒枪` are reachable through demo mode (`main.js` → `enableDemoMode(collection, ALL_CARDS)` gives 3 copies of every card) and are used by the tests/harnesses' own target pickers.

---

## BUG-01 | engine.js:1247 (shadowed twin at :329) | HIGH | `recoverMonster`/`reviveToHand` ignore the target the player selected — a different graveyard card is returned

**Code (live definition, engine.js:1247)** — this one wins the duplicate object key:
```js
    reviveToHand(ctx) {
        const chars = ctx.player.graveyard.filter(c => c.type === "monster");
        const count = ctx.card.effects?.find(e => e.type === "reviveToHand")?.count || 1;
        let revived = 0;
        for (let i = 0; i < count && chars.length > 0; i++) {
            const target = chars[chars.length - 1 - i];   // <-- ignores ctx.target / ctx.targets
            if (!target) break;
            const idx = ctx.player.graveyard.indexOf(target);
            if (idx >= 0) { ctx.player.graveyard.splice(idx, 1); resetCardState(target); ctx.player.hand.push(target); revived++; }
        }
        return revived > 0 ? `从墓地返回${revived}只怪兽到手牌` : "墓地没有可返回的怪兽";
    },
```
Dead earlier definition at engine.js:329 (never reachable — the later key wins):
```js
    reviveToHand(ctx) {
        const chars = ctx.player.graveyard.filter(c => c.type === "monster");
        const target = ctx.target || chars[chars.length - 1];   // honours the selection
        ...
```

**Why it is wrong**: `effectHandlers` declares `reviveToHand` **twice** (engine.js:329 and :1247); the second definition silently overwrites the first, so the version that honours `ctx.target` is dead code. The engine itself *demands* a target for this effect: `getEffectTargetType('reviveToHand')/('recoverMonster') === "graveyard"`, `activateSpell` returns `needsTarget`, `controller.activateSpell` enters `PHASE.GRAVEYARD_SELECT` and shows `getValidTargets` (the player's graveyard monsters), `confirmTarget` passes the pick as `selectedTarget`, `activateSpell` **validates** it, `_executeEffect` puts it in `ctx.target` … and then the handler throws it away and takes the *last* card of the graveyard instead. The card text says "选择己方墓地1只怪兽加入手牌 / 将自己墓地1只怪兽加入手牌".

**Verified trigger** (`死者苏生`, `ygo_n_83764718`, effect `recoverMonster`, reachable in demo mode / via the engine API):
- P1 graveyard (oldest→newest) = [`A`(selected target), `B`]; hand = [死者苏生].
- `activateSpell(P1, 0, A)` → hand becomes **[`B`]**, `A` stays in the graveyard.
- Observed: `发动了死者苏生，从墓地返回1只怪兽到手牌 -> hand: 最后进墓`.

**Suggested fix**: delete the duplicate at :329 (or :1247) and make the surviving body use the selection first:
```js
const chosen = (ctx.targets && ctx.targets.length) ? ctx.targets : chars.slice(-count).reverse();
```

---

## BUG-02 | engine.js:383–390 | HIGH | `reflectDamage` ignores the effect's declared value and reflects the attacker's whole ATK

**Code**:
```js
    reflectDamage(ctx) {
        if (ctx.event === "onAttacked" && ctx.attacker) {
            const reflected = Math.max(0, ctx.engine.getEffectiveAttack(ctx.attacker));
            ctx.attackerOwner.takeDamage(reflected);
            return `攻击无效并反弹${reflected}点伤害`;
        }
        return "镜面反射准备就绪";
    },
```

**Why it is wrong**: the trap `魔法筒枪` (`ygo_n_96355986`, the only `reflectDamage` card in the pool) declares `{ trigger: "onAttacked", type: "reflectDamage", value: 500 }` and its printed effect text — which `card-rules.js#applyPlayableRules` builds from `effects[].description` and the UI displays — is **"对方攻击宣言时：反射500点伤害。"** The handler never reads `ctx.value`, so the reflected amount is the attacker's ATK instead of 500. Every other battle-math handler in this file consumes `ctx.value` (`reduceDamage :386`, `debuffEnemyAttack :267`, …) and `_resolveBattleTrap` itself reads `effect.value` for `reduceDamage` (:2423), so this is an internal inconsistency, not a documented rule.

**Verified trigger**: P1 attacks directly with a 2600-ATK monster; P2 has `魔法筒枪` set (setTurn < turn). Observed: `B发动陷阱【魔法筒枪】，攻击无效并反弹2600点伤害` → attacker's controller 8000 → **5400** (printed effect promises 500, a 5.2× error; a 3000-ATK attacker would burn 3000).

**Suggested fix**: use the declared value (keeping the ATK fallback for the derived `value: 0` traps):
```js
const declared = Math.max(0, Number(ctx.value) || 0);
const reflected = declared > 0 ? declared : Math.max(0, ctx.engine.getEffectiveAttack(ctx.attacker));
```

---

## BUG-03 | engine.js:14–26 (used at :2429/:2435 and in ~20 handlers) | MEDIUM | `getUniqueNightcordMembers`/`hasResonance` can never be true: no card in the catalogue has a `member`

**Code**:
```js
const NIGHTCORD_MEMBERS = ["ena", "kanade", "mafuyu", "mizuki"];

export function getUniqueNightcordMembers(player) {
    const members = new Set();
    for (const card of player.monsterZone) {
        if (card.series === "nightcord" && NIGHTCORD_MEMBERS.includes(card.member)) {
            members.add(card.member);
        }
    }
    return members;
}

export function hasResonance(player, requiredMembers = 2) {
    return getUniqueNightcordMembers(player).size >= requiredMembers;
}
```

**Why it is wrong**: the helper requires **both** `series === "nightcord"` and a `member` in the four-name list. In the shipped catalogue (368 cards, 80 of them `series: "nightcord"`) **not one card carries a member value** — `nightcord-cards.js`, `picture-extension.js` and `starter-n.js` set `member: null`, `cards.js`/`image-cards.js`/`generated-cards.js` do not set the field at all (verified programmatically over `ALL_CARDS`: `cards with a real nightcord member: 0`). `hasResonance()` therefore always returns `false`, so every resonance-gated branch in this file is dead — `resonanceBurst`/`resonanceBoost`/`ultimateBurst`/`groupDraw`/`groupBuff`/`resonancePower`/`ultimateGroup`/`resonanceFreeze`/`destroyAllWeakened`/`ultimateFreeze`/`copyLastSpell`/`protectAllies`/`counterDestroy`/`debuffAndDestroy`/`ultimateRedirect`, and the `destroyAttacker` +500 follow-up in `_resolveBattleTrap` (:2429–2436, which *is* reachable because `落穴`/`神圣防护罩`/`夹击` appear in stage decks). `test/nightcord.test.js` only passes because it synthesises `mkNightcord({ member: "ena" })` cards by hand.

**Minimal trigger scenario**: field any two `series:"nightcord"` monsters from the real pool (e.g. `water_007` + `water_009`, or any `picture_*`), then resolve any `hasResonance(player, 2)` effect → the bonus never applies (`hasResonance` = false).

**Suggested fix**: derive the member from data that exists (id/name mapping, e.g. the `MEMBER_*` tables already in `card-view.js`/`nightcord-art.js`) or populate `member` in the card sources; otherwise drop the resonance gating and its advertised text.

---

## BUG-04 | engine.js:2597 | MEDIUM | 0-ATK vs 0-ATK in attack position destroys nothing, contradicting the documented "equal ATK destroys both"

**Code**:
```js
            } else if (atkPower === defPower && atkPower === 0) {
                msg += "，双方攻击力均为0，均不破坏";
            } else if (atkPower === defPower) {
                const attackerDestroyed = destroyMonster(attackerOwner, attacker, this, "battle");
                const targetDestroyed = destroyMonster(defenderOwner, target, this, "battle");
                msg += attackerDestroyed && targetDestroyed
                    ? "，攻击力相同，双方怪兽都被破坏"
                    : "，攻击力相同，未能破坏具有战斗抗性的怪兽";
```

**Why it is wrong**: the design rule for ATK-vs-ATK is "lower is destroyed …, equal ATK destroys both". This branch exempts the 0-vs-0 case before the equal-ATK branch can run, so two 0-ATK monsters in attack position survive each other indefinitely. (The ATK==DEF case legitimately destroys nothing, but this branch is inside the ATTACK-position target path, where the operand is ATK, not DEF.) No test in `test/` asserts the 0/0 exception.

**Minimal trigger scenario**: `js/themed-effects.js` `token` action summons `{ attack: 0, defense: 1000 }` tokens; use `engine.changePosition` on two of them (one per side, tokens stay on the field from a previous turn) and call `attack(tokenA, tokenB)` with both in ATTACK position → observed `零A攻击零D，双方攻击力均为0，均不破坏`, both zones keep their monster (also reachable for any monster whose `currentAttack` was reduced to 0 by an ATK debuff).

**Suggested fix**: delete the `&& atkPower === 0` special case (or, if it is intentional, document it next to the rule); for the DEF-position path the existing `atkPower === defPower` branch is already correct.

---

## BUG-05 | engine.js:818–841 (with :75 and `model.js:182`) | LOW | `tokenSummon` creates tokens without `isToken`, so destroyed tokens leak into the graveyard and can be used as material

**Code**:
```js
        const token = createCardInstance({
            id: "token_" + ctx.engine._random().toString(36).slice(2, 6),
            name: "衍生物",
            type: "monster",
            attribute: "none",
            race: "rock",
            level: 1,
            attack: ctx.value || 500,
            defense: ctx.value || 500,
            rarity: "N",
            effect: null,
            description: "衍生物",
        });                                   // <-- no isToken: true
```
compared with `destroyMonster` (engine.js:75) and `Player.resetTurnState` (model.js:182):
```js
        if (!monster.isToken) owner.graveyard.push(monster);
...
            c.cannotUseAsMaterial = !!c.isToken;
```

**Why it is wrong**: `isToken` is the flag the engine uses to keep tokens out of the graveyard and out of tribute/fusion material; `themed-effects.js:156` sets it explicitly for its own token, this handler does not. Consequence: (a) a destroyed token is pushed into its controller's graveyard as a real card (it can then be targeted by `reviveToHand`/`specialSummonFromGraveyard`/`returnMultiple`, and inflates graveyard-count conditions and `checkSpecialVictory`-style counting); (b) the same token can be picked as a tribute in `confirmTribute`/`selectTribute` and as fusion material in `fusionSummon`, unlike every other token in the game.

**Minimal trigger scenario**: activate `tokenSummon`, then resolve `destroyAllEnemyMonsters` against the token → observed `opp graveyard: ["衍生物"]`, `isToken: undefined`, `cannotUseAsMaterial: undefined`. (No shipped card currently uses `tokenSummon` — `designRarityRules`/`galleryEffect` producers are all overridden by `authoredCardRules` — so this is a latent leak, not a live one.)

**Suggested fix**: add `isToken: true` to the `createCardInstance({...})` payload (and consider clearing it in `resetCardState` for non-tokens).

---

## BUG-06 | engine.js:1753–1760 + model.js:159–167 | LOW | The "until the opponent's next end phase" attack lock is released at the start of the victim's turn, so it can never block an attack

**Code (engine.js `startTurn`)**:
```js
        // 朝比奈真冬效果：回合开始时清除本方怪兽的 attackDisabledUntilEndPhase
        player.monsterZone.forEach(c => {
            if (c.attackDisabledUntilEndPhase) {
                c.attackDisabledUntilEndPhase = false;
                c.cannotAttack = c.attackLocked || false;
                c.canAttack = !c.attackLocked;
            }
        });
        player.resetTurnState();
```
**Code (model.js `resetTurnState`)** — the branch that was supposed to keep the lock alive:
```js
            // 朝比奈真冬效果：attackDisabledUntilEndPhase 持续到对方下个结束阶段
            if (c.attackDisabledUntilEndPhase) {
                c.canAttack = false;
                c.cannotAttack = true;
            } else {
```

**Why it is wrong**: an attack lock matters only on the locked monster's own turn (`attack()` requires `attackerOwner === state.currentPlayer`). `startTurn` clears the flag **immediately before** `resetTurnState` runs for exactly that player, so `resetTurnState`'s preserving branch is unreachable dead code and the lock is gone by the time the victim may attack. The card that sets it (`discardToDisableAttack`, `dark_006` 朝比奈真冬 raw data) spends a discard to lock a monster "直至对方下个结束阶段" and the lock blocks nothing. (Contrast with the themed `freeze` action, which stores `frozenUntil = turn + 1` and survives into the victim's turn — the two mechanisms disagree.) `discardToDisableAttack` is not reachable in the shipped pool (authored rules replace it), hence LOW.

**Minimal trigger scenario**: during P1's turn set `target.attackDisabledUntilEndPhase = true; target.cannotAttack = true` on a P2 monster (exactly what `discardToDisableAttack` does), then `state.currentPlayerIndex = 1; engine.startTurn({skipDraw:true})` → observed `cannotAttack=false, canAttack=true, flag=false`; the monster attacks freely on the very turn the lock was meant to cover.

**Suggested fix**: delete the clearing loop in `startTurn` and let `resetTurnState`'s branch run; only clear the flag at the end of the locked player's turn (e.g. in `endTurn`/`resolveThemedTurnEnd`).

---

## BUG-07 | engine.js:1279–1290 | LOW | `buffThenDebuff` never applies its declared penalty (and reads a field the engine never supplies)

**Code**:
```js
    buffThenDebuff(ctx) {
        const targets = ctx.targets || [];
        const buffValue = ctx.value || 400;
        const penalty = ctx.effects?.[0]?.penalty || 700;      // ctx.effects is never set by _executeEffect
        for (const t of targets) {
            if (t.currentAttack !== undefined) t.currentAttack = safe(t.currentAttack + buffValue);
        }
        // 记录回合结束时的削弱（简化：立即扣除，作为"永久"效果）
        // 实际上应该在endPhase触发，这里简化处理
        const msg = `${targets.length}只怪兽攻击力+${buffValue}（回合结束时将永久-${penalty}）`;
        return msg;
    },
```

**Why it is wrong**: the card text (畸变DNA: "本回合己方所有怪兽攻击力+400，回合结束时永久-700") and the handler's own message promise a permanent −700 at the end of the turn, but no code path ever subtracts anything: the temporary +400 is simply wiped by `_recalcCardStats` in `endTurn` (:1826) and the penalty is never applied — the card is a free, downside-free buff. Secondarily, `_executeEffect` builds `ctx` with `value`, `duration`, `effect` … but never `ctx.effects`, and the declared `penalty` sits on `ctx.effect.penalty` (`nightcord-cards.js:164`), so the declared value is ignored and the default 700 is always used.

**Verified trigger**: `activateSpell` on 畸变DNA with one 1500-ATK monster → message claims "回合结束时将永久-700"; after `endTurn()` the monster is back at `currentAttack = 1500` (base 1500, `permanentBuffs = []`). (No shipped card uses `buffThenDebuff` → LOW.)

**Suggested fix**: record the penalty (e.g. push a negative `permanentBuffs` entry at end of turn, or apply it immediately as the comment intends) and read `ctx.effect?.penalty ?? 700`.

---

## BUG-08 | engine.js:1097–1112 (repeated at :1125, :1138, :1155) | LOW | "Return to hand" handlers use a hardcoded hand cap of 7 and dump the monsters into the graveyard instead

**Code**:
```js
    returnMultiple(ctx) {
        const opp = ctx.opponent;
        const targets = [...opp.monsterZone].slice(0, Math.max(1, Number(ctx.value) || 2));
        let returned = 0;
        for (const t of targets) {
            const idx = opp.monsterZone.indexOf(t);
            if (idx >= 0) {
                opp.monsterZone.splice(idx, 1);
                resetCardState(t);
                if (opp.hand.length < 7) opp.hand.push(t);
                else opp.graveyard.push(t);
                returned++;
            }
        }
        return returned > 0 ? `将${returned}只怪兽返回手牌` : "没有目标";
    },
```

**Why it is wrong**: the effect is entitled "将对方怪兽返回手牌" (bounce), but when the opponent holds 7+ cards the monsters are **destroyed into the graveyard** instead — an undocumented, perverse rule (it *helps* the opponent's board removal). Every other bounce handler in the file uses the real limit `GAME_CONFIG.MAX_HAND_SIZE` (99, engine.js `returnToHand`/`searchDeck`), and the hardcoded `7` matches neither `MAX_HAND_SIZE` (99) nor `END_HAND_LIMIT` (6). Same `7` in `resonanceRedirect` (:1125, :1138) and `ultimateRedirect` (:1155). The message also still claims "返回手牌". (No shipped card uses these three handlers → LOW.)

**Verified trigger**: opponent hand = 7 cards, opponent field = 2 monsters, resolve `returnMultiple` (`value: 2`) → observed `opp hand=7`, `opp grave=["对方怪1","对方怪2"]` (both monsters removed from the field permanently).

**Suggested fix**: use `GAME_CONFIG.MAX_HAND_SIZE` for the cap (and say so in the message), consistent with `returnToHand`.

---

## BUG-09 | model.js:178 (consumer at engine.js:1982) | LOW | `cannotActivateThisTurn` is only reset for monsters, so a spell marked by `searchSpellByDiscard` is bricked forever

**Code (`model.js#resetTurnState`, which only iterates `monsterZone`)**:
```js
        this.monsterZone.forEach(c => {
            ...
            c.cannotActivateThisTurn = false;
```
**Producer (engine.js:542)**: `picked.cannotActivateThisTurn = true;` — the searched spell is put **in the hand**.
**Consumer (engine.js:1982)**: `if (card.cannotActivateThisTurn) return { success: false, message: \`${card.name}本回合不能发动\` };`

**Why it is wrong**: the flag means "cannot be activated **this turn**" (青蓝妆者: "这张魔法本回合不能发动"), but the only reset site is the per-turn loop over `monsterZone`; hand cards are never reset, so the searched spell can never be activated in any later turn either. `hand` cards also never pass through `resetCardState` unless they move zones.

**Verified trigger**: create a hand spell with `cannotActivateThisTurn = true`, run `endTurn()` + the owner's `startTurn()` (the flag survives: `true`), then `activateSpell` → observed `marked本回合不能发动`. (No shipped card uses `searchSpellByDiscard` → LOW.)

**Suggested fix**: reset the flag for `this.hand` (and `spellTrapZone`) in `resetTurnState`, or store the turn number instead of a boolean (`cannotActivateTurn = state.turn`).

---

## BUG-10 | engine.js:1813–1820 | LOW | `advancePhase()` maps Target/Graveyard/Tribute-select states to index −1 and therefore jumps back to the DRAW phase

**Code**:
```js
    advancePhase() {
        const order = [PHASE.DRAW, PHASE.STANDBY, PHASE.MAIN_1, PHASE.BATTLE, PHASE.MAIN_2, PHASE.END];
        const idx = order.indexOf(this.state.phase);
        if (idx < order.length - 1) {
            this.state.phase = order[idx + 1];
            if (this.state.phase === PHASE.END) this.endTurn();
        }
    },
```

**Why it is wrong**: for any phase not in `order` (`target_select`, `graveyard_select`, `tribute_select`, `waiting`) `indexOf` returns `-1`, which satisfies `-1 < 5`, so the phase is set to `order[0]` = **DRAW** — a phase regression inside a selection dialog, followed by `endTurn()` on the next call. Currently latent: nothing in `js/` calls `advancePhase` (the controller drives phases itself via `nextPhase`/`_ensureMainPhaseForHandAction`).

**Verified trigger**: `state.phase = "tribute_select"; engine.advancePhase()` → observed `phase = "draw"`.

**Suggested fix**: guard with `if (idx < 0) return;` (or `if (idx >= 0 && idx < order.length - 1)`).

---

# Categories examined with NO findings

- **LP arithmetic and loss detection** — `Player.takeDamage` floors and clamps at 0 (`model.js:139`), `heal` clamps to `maxLp`, `_checkCost.payLife` correctly refuses `lp <= cost` and always charges the correct controller; `checkGameOver` reads `lp <= 0 || deckOut` on both sides and sets `winner`/`isDraw`/`winReason` correctly (verified by reading and by the existing LP/zero-LP tests). Damage is applied to the correct owner in every branch of `attack()` (attacker's controller for ATK<DEF and for `preventsBattleDamage`, defender's controller for ATK>DEF, no damage for ATK==DEF).
- **Victory/defeat detection** — deck-out (`Player.drawCard` → `deckOut` → `checkGameOver`), LP 0, simultaneous double loss (draw), special victory (5 distinct pieces, hand-only by design and asserted by `test/yugioh-flow.test.js:202`) are all handled once; a loser cannot be declared twice and no winner branch is missing (`gameOver` short-circuits).
- **Battle resolution besides BUG-04** — direct-attack legality (no monsters), ATK>DEF/DEF-branch piercing (`defPower` comparison, `reduction` applied to the correct side), `preventsBattleDamage`/`cannotBeDestroyedByBattle`/`cannotBeDestroyedByEffect` interactions, face-down flip-up timing (flip effects fire after damage calculation), `getEffectiveDefense` use, and destroying the attacker in ATK<DEF all match the stated rules; hand-verified arithmetic for 2600/1500 (500 damage), 2000/piercing 1500 DEF (500 piercing), 1500 vs 1800 DEF (300 to attacker).
- **Attack-count accounting / replay** — `markAttackUsed` (limit 2 for double attackers, `canAttack` recomputed), consume-on-cancel (asserted by `test/engine.test.js:192`), the battle-step rewind (`pendingBattleReplay` carries `reduction`, does not re-fire the trap, does not double-count `markAttackUsed`), and `endTurn` clearing `pendingBattleReplay` are consistent; the recently added reset of `attacksMadeThisTurn` in `_executeSummon` closes the stale-counter hole for re-summoned cards.
- **Turn/phase state machine (engine side)** — `startTurn` order (turn++, temporary-banished restore, lock cleanup, `resetTurnState`, set-spell `canActivate`, field re-apply, DRAW, events, optional skip-draw), `endTurn` order (end triggers → themed end resolution → temp-effect/stat recalculation → hand limit → game-over check → switch player → `firstTurn = false`) and the `firstTurn`/`skipDraw`/`FIRST_TURN_NO_BATTLE` interplay are correct; `resetTurnState`'s reset set matches the flags the engine reads (except BUG-09's hand flag).
- **Zone/board integrity besides BUG-05** — `activateSpell`/`activateSetSpell`/`_executeSummon`/`setCard`/`confirmTribute`/`returnToHand`/`destroySpellTrap`/`_restoreTemporaryBanishments`/`resetFieldCard` move cards out of a zone before pushing them into the next one; `_resolveBattleTrap` removes the trap exactly once and sends it to the graveyard before resolving; the self-exclusion filters (`x !== c`) in the themed `recycle`/`ambush`/`sanctuary` handlers work for both the pre-graveyard (spell) and post-graveyard (trap) orders.
- **`resolveTargets` / `hasEffectHandler`** — `owner`/`zone`/filter/selector handling, `cannotBeTargeted` exclusion (only for non-`all` selectors, as documented at :187), sort/slice counts and the `_random()` usage are correct; `hasEffectHandler` matches the handler table exactly (it is exported but unused).

# Additional observations (dead code / non-bugs, listed for completeness)

1. `getAttackLimit` (:40) checks `monster.attackTwiceThisTurn`, but **nothing in `js/` ever sets that field** (only `doubleAttackThisTurn`); the operand is dead.
2. `card.wasFlipSummoned` is written by `_executeSummon` (clearing) and `flipSummon` (setting) but never read anywhere in `js/`.
3. `attack()` (:2470) refuses a second attack when the double-attack grant arrives *after* the first attack: `doubleAttackThisTurn = true` + `attacksMadeThisTurn = 1` + limit 2, yet the cached `attacker.canAttack` (set false by `markAttackUsed`) still rejects it ("该怪兽本回合不能攻击"). The engine's own limit accounting and its cached flag disagree here; with the current phase flow (BATTLE → MAIN_2 is one-way, `controller.js:220`) the effect is simply consumed and wasted when activated in Main Phase 2 after attacking.
4. `checkStateIntegrity` (:2679) scans only deck/hand/monsterZone/spellTrapZone/graveyard — `fieldZone`, `banished` and `extraDeck` are not covered, so a card duplicated into a field zone or the banish pile would not be reported.
5. `signatureTechnique` (:199) indexes `actions[protocol.primary % actions.length]`; a card without numeric `protocol.primary/secondary` yields `actions[NaN]` → `TypeError` on call. Dead in the shipped pool (no card uses `signatureTechnique`).
6. `_executeEffect`'s 宫崎奏 disruption block (:2288–2301) and the `effectDisruptor` flag are unreachable in the shipped pool (authored rules replace `water_009`).
