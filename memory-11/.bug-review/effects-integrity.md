# effects.js — State-Integrity & Robustness Audit (2nd audit, different angle)

- Target: `SekaiGame/src/main/resources/static/js/effects.js` (4815 lines, 232 913 bytes)
- Angle: state corruption, crashes, async/promise integrity, loop bounds, type/lookup safety.
  Rule semantics (costs, once-per-turn, damage signs) are deliberately **not** covered.
- Read-only: no project file was modified. Harnesses were created under
  `%TEMP%\dsh-effects-harness\` (`h.mjs`, `h2.mjs`, `h3.mjs`) and import `effects.js` unchanged.
- Method:
  1. Full read of the file; every helper traced to its definition before being reported.
  2. `node --test test/*.test.js` defines the design contract — note that **no test imports
     `effects.js`** (verified: `grep -l effects.js test/*.js` → none), so nothing in this file is
     covered by the passing suite. Behaviour asserted by tests elsewhere was not reported.
  3. Executed every one of the 51 exported functions under a fake DOM plus a **virtual clock**
     (fake `setTimeout`/`requestAnimationFrame`, 40 000-step drain) so that every timer callback —
     including 2–4 s deferred ones — actually ran; harness caught throws in timers and promises
     that never settle. A second pass ran with a null-returning DOM (`getElementById`/`querySelector`
     → null) and with five malformed card payloads; a third pass dumped the markup the file builds
     from card fields.
  4. Cross-checked reachability in the caller: `controller.js` (call sites + how remote PvP payloads
     reach the functions), `ui.js` (`_renderField`), `pvp.js`, `index.html`, `css/style.css`.
- Verified **not** reachable / not bugs (so they are deliberately absent below):
  `RULE_VISUALS[key]` lookups (all 15 keys used by `ruleVisualKey`/`resolveRuleTargets` exist),
  `getMonsterCinematicProfile()` returning `null` for rarity `N` (every call is guarded by
  `signature.enabled`, which is computed from the same rarity expression), the null-DOM pass
  (zero crashes with a fully empty DOM), every `document.getElementById`/`querySelector` id used by
  the file (all exist in `index.html`; `#opponent-hand` also carries the `opponent-hand` class the
  file's `.opponent-hand` selector needs), all catalog attributes (368 cards, only the 7 table keys),
  all CSS custom properties set by JS (none is unmatched in `style.css`), and no input object
  (`card`, `trapCard`, …) is ever mutated by the file.

---

## BUG-1 | effects.js:1403–1405 (call sites 1652, 1804, 2042, 2263, 2378, 2496) | HIGH

**`escapeHtml()` is neither type-safe nor attribute-safe, and every call site interpolates it into a
quoted attribute; peer-supplied card fields therefore inject live event handlers into the DOM (an
`<img src=… onerror=…>` fires without user interaction) and a non-string field throws a `TypeError`.**

```js
function escapeHtml(s) {
    if (!s) return "";
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
```

Why it is wrong (concrete, reproduced):

- `s.replace(...)` throws for any non-string that is truthy. Reproduced:
  `TypeError: s.replace is not a function at escapeHtml (effects.js:1405:14) at Module.playAttackAnimation (effects.js:1652:215)`
  (also `playTrapActivationV5:2378`, `animateTrapToGraveyard:2496`, `playNegatedAttackBarrier:2433`).
- `"` and `'` are not escaped even though the value is placed inside `attr="…"`:

```js
: `<img class="${imageClass}" src="${escapeHtml(img)}" alt="${escapeHtml(card.name)}" … onerror="this.style.display='none'">`
...
fly.innerHTML = `<div class="card in-field rarity-${attackerCard.rarity || "N"}"> … ${createFlyingCardInner(attackerCard)} …`   // rarity not escaped at all
```

Harness output for a card whose peer-supplied `name`/`rarity`/`image` all equal `陷阱" onerror="globalThis.__pwned=1`:

```html
<div class="card in-field rarity-UR" onerror="globalThis.__pwned=1">…<span class="card-name">陷阱" onerror="globalThis.__pwned=1</span>…
  <img class="card-breeze-image" src="x" onerror="globalThis.__pwned=1" alt="陷阱" onerror="globalThis.__pwned=1" …>
```

`<img src="x">` cannot load → the injected `onerror` runs. This is DOM/state corruption of the live
document, and the same markup is also produced for the flat file paths of the flying card.

Minimal trigger: PvP peer sends an action whose card payload carries a quote in `name`/`rarity`/
`image`; the receiving client reaches it through `controller.js:1552`
(`const trapCard = action.trapCardData;`) → `controller.js:1559` `await playTrapActivationV5(visual.trapSlot, trapCard)`
→ `effects.js:2378`/`createFlyingCardInner`, or via `controller.js:1230`
(`{ ...createCardInstance(base), ...data }`, remote fields last) on any later animation.
Note: the bundled catalog is clean — all 368 cards have quote/handler-free `name`/`image`/`rarity`
(verified), and `card-view.js:2` already has the correct implementation
(`String(value ?? "").replaceAll('"','&quot;')…`), so only this file's copy is defective.

Fix: replace with the canonical helper, i.e. coerce (`String(s ?? "")`) and escape `& < > " '`
(and/or build these nodes with `textContent`/`setAttribute` instead of `innerHTML`), and escape
`attackerCard.rarity` at line 1652.

---

## BUG-2 | effects.js:853–854 + 889–895 | HIGH

**`tributeCount` is only clamped from below, so a peer-supplied `Infinity` makes the summon cinematic
loop forever (hard tab freeze); a large finite value builds millions of DOM nodes.**

```js
const tributeCount = Math.max(0, Number(options.tributeCount) || (options.tributeSummon ? (starLevel >= 7 ? 2 : 1) : 0));
…
for (let index = 0; index < tributeCount; index++) {
    const soul = document.createElement("div");
    soul.className = "tribute-soul-pillar";
    …
    overlay.appendChild(soul);
}
```

Why it is wrong: `starLevel` is clamped (1–12) but `tributeCount` is not. `Number(1e999) || …` →
`Infinity` (truthy, and `Math.max(0, Infinity) === Infinity`), and `JSON.parse('{"tributeCount":1e999}')`
really yields `Infinity` (verified: `parsed value: Infinity | isFinite: false | loop would run: Infinity`).
The loop then never terminates — it appends a node per iteration, so the tab freezes and grows until OOM.

Minimal trigger: PvP peer sends
`{"type":"game_action","action":{"type":"summon","tributeSummon":true,"tributeCount":1e999,"cardData":{…}}}`.
`pvp.js:54` relays `msg.action` unvalidated → `controller.js:1275 applyRemoteAction` →
`controller.js:1725` `tributeCount: action.tributeCount` → `playSummonEffect(…, options)` →
`playLevelSummonCinematic`. A finite hostile value (e.g. `1e6`) has the same effect without hanging.

Fix: clamp — `const tributeCount = Math.min(3, Math.max(0, Number(options.tributeCount) || fallback));`
— and require `Number.isFinite`.

---

## BUG-3 | effects.js:105 + 110 | MEDIUM

**`getCardVisualTheme()` indexes a 7-key attribute table with no fallback and then dereferences the
result, so any attribute outside that table throws before any effect runs.**

```js
const fallback = {
    fire: […], water: […], wind: […], earth: […], light: […], dark: […], none: […],
}[card.attribute || card.element || attribute || "none"];
…
const base = matched || { key: fallback[0], label: "卡牌效果", color: fallback[1], accent: fallback[2], glyph: fallback[3] };
```

Why it is wrong: an unmatched key yields `undefined` and `fallback[0]` throws.
Reproduced directly (`getCardVisualTheme({name:"Test", rarity:"UR", attribute:"DIVINE"})`):

```
"DIVINE" -> TypeError: Cannot read properties of undefined (reading '0')
"LIGHT"  -> TypeError: …
"all"    -> TypeError: …
"spell"  -> TypeError: …
```

Note the sibling module does this correctly (`monster-cinematics.js:132`
`ATTRIBUTE_FALLBACK[card.attribute || card.element || "none"] || ATTRIBUTE_FALLBACK.none`), so the
defect is local to this table.

Trigger: `attribute` outside the table — e.g. a PvP `cardData` with `"attribute":"LIGHT"`/`"DIVINE"`
(controller.js:1230 spreads remote fields over the catalog instance; controller.js:1778 passes that
object to `playSpellEffectV2` → `playCardThemeAccent:132` → here), or any future/legacy attribute.
Failure is a synchronous `TypeError` that aborts the whole spell/trap activation visual
(and in the awaited PvP trap sequence aborts the remaining steps of that action).
All 368 bundled cards use table keys, so it is not reachable from single-player today.

Fix: `const theme = TABLE[key] || TABLE.none;` (or `?? TABLE.none` on the lookup).

---

## BUG-4 | effects.js:2241, 2261–2263, 2340–2345 | MEDIUM (currently unreachable — no caller)

**`playCounterTrapV3()` can return a promise that never settles, because the `resolve()` call is
scheduled inside a nested timer that an earlier throw prevents from ever being registered — a caller
that `await`s it hangs forever (controller soft-lock: `effectBusy` stays true).**

```js
setTimeout(() => {                       // 1000 ms
    …
    fly.innerHTML = `… rarity-${escapeHtml(trapCard.rarity || "N")} … ${createFlyingCardInner(trapCard)} …`;   // <-- throws
    …
    setTimeout(() => {                   // 2000 ms — never registered if the line above throws
        fly.remove();
        trail.remove();
        trapSlot.innerHTML = `…`;
        resolve();
    }, 2000);
}, 1000);
return done;                             // done is created at line 2164 and only settled there
```

Why it is wrong: the only settlement path is inside the nested callback, so any throw earlier in the
1000 ms callback leaves the promise pending forever. Reproduced with a malformed card payload:

```
CRASH [playCounterTrapV3:numericName] timer@100300  TypeError: s.replace is not a function … 2263:193
NEVER-RESOLVES [playCounterTrapV3:numericName]
```

The same structural risk (settlement inside a later, separately-registered callback) exists in
`playTrapActivationV3` (2132–2136, inside the 1200 ms timer) and `playAttackAnimation` (1746/1790,
inside the 600 ms timer). Of these, `playAttackAnimation` is live (controller.js:992/1048/1057/1616/
2005/2012) but its promise is never awaited; `playCounterTrapV3`/`playTrapActivationV3` are imported
by `controller.js:17` and never called.

Fix: register the settle timer in the outer scope next to the others (as `playTrapActivationV5`
does at line 2404), or wrap the deferred body in `try { … } finally { resolve(); }`.

---

## BUG-5 | effects.js:2343 | MEDIUM (currently unreachable — no caller)

**A visual function writes game-UI state: it unconditionally replaces the whole spell/trap slot's
inner HTML 2 s later, discarding `data-instance-id` and the slot's state classes.**

```js
setTimeout(() => {
    fly.remove();
    trail.remove();
    // 陷阱槽位清空
    trapSlot.innerHTML = `<div class="field-slot empty spell-trap-slot" data-owner="${trapSlot.dataset.owner}" data-zone="spell-trap"></div>`;
    resolve();
}, 2000);
```

Why it is wrong: this is the only place in the file that mutates real game DOM (verified: every other
`innerHTML =` in the file writes to an element the same function just created). It is fired 2 s after
activation regardless of what actually happened to the card — if the trap was not sent to the
graveyard (e.g. it stays face-up, or a later effect re-uses the zone, or the refresh has already
rewritten the slot), the DOM loses the card while the state still has it, and every
`[data-zone="spell-trap"][data-instance-id]` lookup (`resolveRuleTargets:184`, ui event binding) stops
matching that card until the next refresh. The live path deliberately does *not* do this: it calls
`playTrapActivationV5` + `animateTrapToGraveyard` and lets `ui.refresh()` decide (controller.js:927).

Fix: delete the DOM write and let the state-driven render clear the slot (or only clear it if
`trapSlot.dataset.instanceId === trapCard.instanceId`).

---

## BUG-6 | effects.js:520–527 | MEDIUM (currently unreachable — no callers)

**`animatePlayCard()` references an undefined `resolve` (ReferenceError in a timer) and returns a
promise that settles ~950 ms before the animation it represents finishes.**

```js
    // 清理
    setTimeout(() => {
        fly.remove();
        trail.remove();
        handCard.classList.remove("play-glow");
        resolve();                                   // <-- no `resolve` in this scope
    }, 950);

    return new Promise(resolve => { setTimeout(resolve, 0); resolve; });   // resolves at ~0 ms
```

Why it is wrong: the function never declares `resolve`; the identifier inside the arrow function can
only resolve against the arrow's parameter list (line 527 is a different scope) or the module/global
scope, where it does not exist. Reproduced:

```
CRASH [animatePlayCard:catalog-ur] timer@950  ReferenceError: resolve is not defined  at effects.js:524:9
```

The second half is a separate defect: callers of the other animation helpers get a promise that
resolves when the animation is done (`done` at 1100–3700 ms), but this one resolves immediately
(`setTimeout(resolve,0)`), so `await animatePlayCard(...)` would continue while the card is still
flying; `resolve;` on line 527 is also a no-op statement. Every comparison helper in the file
(`animatePlayToZone`, `animatePlayToGraveyard`, `animateDrawCard`) uses the `let resolve; const done = new Promise(...)`
pattern; this function was left half-migrated. No caller exists today (`grep` over `js/`, `scripts/`,
`test/`), so the crash cannot be reached in the current build.

Fix: use the `let resolve; const done = …` pattern and `return done;`.

---

## BUG-7 | effects.js:3244 vs 3479 | LOW

**Two `else if` branches test the same condition; the second is unreachable, so its intended visual
(16 staggered particles instead of 12) never plays.**

```js
} else if (effectType === "mutualHandRefresh") {         // 3244 — always wins
    for (let i = 0; i < 12; i++) { … }
    screenFlash("rgba(200,180,120,.08)");
} else if (effectType === "directDamage") { … }
…
} else if (effectType === "mutualHandRefresh") {         // 3479 — dead
    for (let i = 0; i < 16; i++) { … }
    screenFlash("rgba(200,180,120,.08)");
}
```

Why it is wrong: a duplicated else-if in one chain is dead code by definition; `mutualHandRefresh`
always takes the first branch (`controller.js` passes the card's own effect type).

Fix: merge the two branches (or delete the second).

---

## BUG-8 | effects.js:2617–2621 | LOW

**Alpha is derived by string surgery on a colour literal, so the "dim" glow is wrong for some
rarities and unchanged for others.**

```js
const glow = document.createElement("div");
glow.className = "draw-glow-enhanced";
glow.style.cssText = `--draw-glow-color:${rc.color.replace('.3','.1')};`;
```

Why it is wrong: `.replace('.3','.1')` is a plain substring replace, not an alpha edit.
`rc.color` for `SR` is `"rgba(255,180,50,.35)"` → the first `".3"` is rewritten, producing
`rgba(255,180,50,.15)` (accidental but wrong), and for `SSR`/`UR`
(`"rgba(255,140,30,.4)"`, `"rgba(180,100,255,.4)"`) no `".3"` substring exists at all, so the
"dimmed" glow is emitted at full flash opacity.

Fix: store the alpha (or a second colour) in `rarityColors` and interpolate it.

---

## BUG-9 | effects.js:1643–1647 | LOW (latent — currently masked by the field re-render)

**The attacker's `visibility` is captured and written back later, so an overlapping second attack can
restore `"hidden"` instead of the real previous value.**

```js
const sourceCard = sourceElement?.querySelector(".card") || sourceElement;
const previousVisibility = sourceCard?.style.visibility || "";
if (sourceCard) sourceCard.style.visibility = "hidden";
const restoreSource = () => {
    if (sourceCard?.isConnected) sourceCard.style.visibility = previousVisibility;
};
```

Why it is wrong: the value is captured before the mutation and written back after an arbitrary delay
(1100–1350 ms after the call). The function explicitly supports a rapid re-entry mode
(`attackVisualBusyUntil` / `lightweight` at 1629–1631), and if a second call starts on the same
element the second call captures `"hidden"` and writes it back last — the attacker card would stay
invisible. In the current build this is masked because `controller.attackTarget` calls
`checkAndRefresh()` → `ui._renderField` (`ui.js:649` `this.battlefield.innerHTML = …`) before each
attack, so every animation starts on a freshly created card element; the same masking
(`sourceCard?.isConnected` false) also covers the target-destroyed branch, which passes an element
that is detached two lines later (controller.js:992 vs 1018).

Fix: restore with `sourceCard.style.visibility = ""` (or store/restore per element with a counter).

---

## BUG-10 | effects.js:4796–4806 | MEDIUM

**`animateCinematicReturnToHand()` permanently overwrites the positioning mode of a persistent game
UI element (the player's hand, `#hand`, or the opponent's hand) and never restores it.**

```js
if (handEl) {
    const flash = document.createElement("div");
    flash.style.cssText = `
        position:absolute; inset:-10px; …`;
    handEl.style.position = "relative";      // <-- writes the game element, never reverted
    handEl.appendChild(flash);
    removeAfter(flash, 600);
}
```

Why it is wrong: this is a live path (`controller.js:609`, `:752` and `:1681` — the latter passes
`"hand"`), and it mutates an element that outlives the animation. Both candidate elements are
absolutely positioned in CSS and centred with `left:50%` + `translateX(-50%)`:
`.hand { position:absolute; left:50%; bottom:14px; width:min(1000px,78vw); transform:translateX(-50%); }`
and `.opponent-hand { position:absolute; left:50%; top:58px; transform:translateX(-50%); }`
(`css/style.css`). With the inline `position:relative` the container leaves the absolute layer and
becomes an in-flow block that is additionally offset by `left:50%`, so the hand element shifts for the
rest of the duel; nothing resets it — the only other writer of these elements is
`ui._renderHand`/`_renderOpponentHand`, which replaces children, not inline style
(verified: no other `style.position` write anywhere in `js/`).

Fix: put the overlay on a wrapper/absolutely positioned sibling (or save and restore
`handEl.style.position` in a `finally`).

---

## BUG-11 | effects.js:2576–2580 and 3910–3914 | LOW

**Heal effects clear `style.animation` from a timer that is not tied to the animation it started, so
a second heal within 750 ms has its animation cancelled by the first heal's timer.**

```js
export function playPlayerHealEffect(playerHud) {
    if (!isBrowser || !playerHud) return;
    playerHud.style.animation = "healGlow .7s ease-out";
    setTimeout(() => { playerHud.style.animation = ""; }, 750);   // same code at 3911-3914
}
```

Why it is wrong: the element's animation state is shared, but each call schedules an independent
reset; the earlier timer wipes whatever animation is currently set — including a newer one
(a heal resolved during the standby phase, then a second heal effect resolving 200 ms later, is a
normal occurrence in this engine). The same pattern in `playBigHealEffect` (3911–3914).

Fix: key the reset on the element (e.g. `animationend` listener / `AbortController`-style token) or
use a class with a fixed animation instead of the `style.animation` property.

---

## Categories checked with no defect found

- **Zone/array integrity**: the file holds no game arrays. No `splice`, no `indexOf`, no `push` into
  a zone; the only game-object write is BUG-5's `innerHTML`. Cards are never put in two zones here.
- **Shared references / shallow copies**: no input object is mutated (grep for property assignment on
  `card`/`trapCard`/`attackerCard`/`profile`/`signature`/`theme`/`target` → none); `{ ...base, … }`
  (112) and `{ ...card, effects:[effect] }` (2647) only add a fresh object; `CARD_THEME_RULES`
  entries are never written through.
- **Loop bounds**: every particle/shard loop uses a literal or a clamped value except BUG-2;
  `animateSpiral`'s rAF recursion terminates because `progress` is `Math.min(elapsed/duration, 1)`;
  no loop mutates the collection it iterates.
- **Timers/leaks**: every element appended to `document.body`/`.battle-screen` has a matching
  `removeAfter`/`remove()`. Machine-checked: the harness counted live nodes under `body`,
  `#battle-screen`, `#battlefield` and every field slot before/after each of the ~90 exercised calls
  and drained all timers in between — the only call that leaves nodes behind is `addFoilShimmer`
  (+2, the intentional persistent `.card-foil-overlay`).
- **Promise settlement**: all 14 promise-returning effects settle in the happy path (verified by the
  harness, which reports any promise still pending after the full timer drain) — only BUG-4 is
  pathologically unsettleable.
- **Data/handler desync**: unknown `effect.type` values degrade to the generic `effect` visual
  (`ruleVisualKey` falls through to `"effect"`, which exists in `RULE_VISUALS`); no missing-handler throw.
- **NaN/Infinity into game values**: the file computes no LP/ATK/DEF; `showDamageNumber` ignores
  falsy/NaN values (1839–1846), and `level` is clamped at 850. Only BUG-2 leaks an unbounded number
  into a loop count.
- **CSS contract**: every `--custom-property` written by this file is either consumed by
  `style.css` or harmless; no JS-only variable name was found (automated diff of 112 JS vars vs
  180 CSS vars).

## Informational (not counted as bugs)

Dead code in and around this file — `animatePlayCard`, `playRecycleEffect`, `playSnatchEffect`,
`playBuffDebuffEffect`, `playBigHealEffect`, `playMutationEffect`, `playTimeSlowEffect`,
`playChromaticBurst`, `playParticleRain`, `playCameraSwoop`, `playEnergyPulse`,
`playURSpellCinematic`, `playSSRMonsterCinematic`, `getMonsterVisualSignature`,
`getMonsterParticleProfile`, `playRecycleEffect`, plus the internal helpers `spawnTrailParticle` (810)
and `spawnShatterFragments` (1810) are never called; `controller.js:14/17` imports
`playTrapChainEffect`, `playTrapActivationV3`, `playCounterTrapV3` and never calls them. BUG-4/5/6
sit in that dead region, which is why they are severity-graded below their intrinsic risk.
