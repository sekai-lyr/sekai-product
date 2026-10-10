# meta systems audit — Nightcord Duel Network (non-duel meta systems)

Scope: `js/packs.js`, `js/collection.js`, `js/deck.js`, `js/decks.js`, `js/rewards.js`, `js/storage.js`,
`js/rng.js`, `js/stages.js`, `js/model.js`, `js/constants.js`, `js/card-ignition.js`, `js/card-rules.js`,
`js/authored-card-rules.js`, `js/rarity-rules.js`, `js/themed-effects.js` (read-only audit, no file modified).

Baseline: `node --test test/*.test.js` → 216 pass / 0 fail (v24.14.1). Behaviour asserted by a passing test is
treated as intended. All findings below were traced to a call site and, where possible, reproduced with a
throw-away `node --input-type=module -e` run (no project file written).

Severity order: HIGH → MEDIUM → LOW.

---

## BUG 1 — HIGH — The daily first-win bonus (and the whole base reward table) is unreachable

`js/rewards.js:33-40` (early returns) and `js/rewards.js:42-54` (base table + bonus loop)

```js
if (matchData?.mode === "training") return { duelCoins: 0, bonuses: [], label: "练习模式无奖励", result };
if (matchData?.mode === "pvp") { return { duelCoins: PVP_REWARD_TABLE[result] || 0, bonuses: [], ... }; }
if (matchData?.stage) { const amount = result === "win" ? Number(matchData.stage.reward || 0) : 0; return {...}; }
let base = REWARD_TABLE[result] || 0;
for (const bonus of BONUS_REWARDS) { if (result === "win" && bonus.condition(stats, matchData)) { base += bonus.amount; ... } }
```

Why it is wrong: every reachable duel mode returns **before** the `BONUS_REWARDS` loop. The only invocations are
`app.js:953-955` (`{mode:"ai", stage, …}` or `{mode:"training"}`) and the three `{mode:"pvp", …}` sites
(`app.js:1031/1089/1103`); no call site produces `mode === "ai"` **without** a stage flag (grep of
`onStartDuel|startDuel|mode:` over `js/` confirms). Consequences:

* the 300-coin `first_win_of_day` bonus can never be granted;
* `collection.statistics.firstWinToday` is only ever written inside that dead branch (`rewards.js:76-78`), so it stays
  `null` forever and the home panel is permanently stuck on its "win one AI duel today" state
  (`app.js:256-257`: `firstWinToday === new Date().toDateString() ? "今日奖励已领取。" : "在AI决斗中取得一次胜利即可获得额外决斗币。"`);
* `REWARD_TABLE` (win 120 / loss 50 / draw 60) is dead data — AI stage duels pay `stage.reward`, training pays 0.

Minimal trigger: win any stage duel or the free home-screen duel on a fresh save → `duelCoins` goes up only by
`stage.reward`, `statistics.firstWinToday` remains `null`, home screen still advertises the unclaimed daily bonus.

Suggested fix: evaluate `BONUS_REWARDS` before the `stage`/`training` early returns (e.g. compute `bonuses` first and
add them to the stage/pvp amounts for a win), or move the daily-bonus check into `settleMatch`.

---

## BUG 2 — HIGH — `buildSuggestedDeck` stops filling at the first failed random pick → illegal <40-card decks

`js/deck.js:146-153`

```js
while (deck.length < size && available.length > 0) {
    const before = deck.length;
    const card = rng.pick(available);
    addToDeck(card);
    if (deck.length === before) break; // 无法添加更多卡牌
}
return rng.shuffle(deck).slice(0, size);
```

Why it is wrong: `addToDeck` (`deck.js:115-119`) returns `false` **without pushing** when the picked card already has
`maxCopies` copies, so a single unlucky pick aborts the whole fill loop even though other owned cards could still be
added. The three category loops above add at most **one copy per distinct card** (`for (const m of sortedMonsters) …
addToDeck(m)`), so all remaining copies must come from this loop — the loop is the only way to reach 40.

Reproduced (14 distinct monsters × 3 copies = 42 owned cards, 200 runs): **200/200 invalid**, deck length 17-35.
With 20 distinct cards × 3 copies (= 60 owned cards, comfortably enough for 40): **53/60 invalid** (88 %), lengths
23-40. User-visible path: the deck editor's `#reset-starter` button (`app.js:740-747`) assigns the result directly to
the draft, and `saveDeckDraft` (`app.js:811-812`) then refuses with "主卡组最少40张".

Secondary defect in the same function: `const maxCopies = Math.min(DECK_RULES.MAX_COPIES, 3)` (`deck.js:113`) ignores
`getCardCopyLimit(card)`, so a card with `deckLimit` (or the ≥4000 ATK rule) can be proposed 3 times even though
`validateDeck` would reject it.

Suggested fix: build the candidate pool once and skip exhausted cards instead of breaking, e.g.
`while (deck.length < size) { const addable = available.filter(c => (deckCounts[c.id]||0) < getCardCopyLimit(c)); if (!addable.length) break; addToDeck(rng.pick(addable)); }`

---

## BUG 3 — MEDIUM — Ten-pack "SSR/UR guarantee" is never implemented, and the pity counter is reset too eagerly

`js/packs.js:91` / `js/packs.js:108` / `js/packs.js:112`, with `js/app.js:385`

```js
let hasSSR = false;                                             // packs.js:91
if (result.cards.some(c => c.rarity === "SSR" || c.rarity === "UR")) hasSSR = true;   // packs.js:108 — never read
// 十连保底：至少一张SSR或UR
if (!allCards.some(c => ["SR", "SSR", "UR"].includes(c.rarity)) && allCards.length > 0) { ... }   // packs.js:112
```

```js
this.collection.pityCounters[NIGHTCORD_PACK.id] = { packsSinceUR: gotUR ? 0 : opened.packsSinceUR };  // app.js:385
```

Why it is wrong (two defects in one flow):

1. `hasSSR` is assigned and never read; the guarantee condition tests `SR+` across **all 80** cards instead of the
   tracked `hasSSR`. The documented guarantee ("十连保底：至少一张SSR或UR", `packs.js:111`) therefore never fires as
   specified — with SR+ ≈ 13 % per card, P(no SR+ in 80) ≈ 1e-5, so the branch is effectively dead. (The shop text at
   `app.js:309` says "至少包含一张SR", matching the accidental behaviour while contradicting the in-code intent — the
   two must be reconciled.)
2. `openTenPacks` itself returns a correct `packsSinceUR` (0 after the last UR, then +1 per pack, `packs.js:100-106`),
   but the caller overrides it with `0` whenever *any* UR appeared in the batch. If the only UR is in pack 3 of 10,
   the counter should be 7 and becomes 0 → the next guaranteed UR is delayed by up to 9 packs.

Minimal trigger: open a ten-pack that contains exactly one UR in the first packs; inspect
`collection.pityCounters.nightcord_pack_001.packsSinceUR` → `0` instead of the number of packs since that UR.

Suggested fix: use `hasSSR` in the guarantee condition (`if (!hasSSR …)`), and store
`packsSinceUR: opened.packsSinceUR` unconditionally (add `shouldGuaranteeUR`/`calculatePity`, both currently unused in
`packs.js:126-133`, or delete them).

---

## BUG 4 — MEDIUM — Demo mode re-grants +3 copies of every card on every page load

`js/collection.js:86-94` (called from `js/main.js:295-298`)

```js
export function enableDemoMode(collection, cardDatabase) {
    collection.settings.demoMode = true;
    collection.currency.duelCoins = 999999;
    for (const card of cardDatabase) {
        if (card.enabled !== false) { collection.cards[card.id] = (collection.cards[card.id] || 0) + 3; }
    }
}
```

```js
if (collection.settings.demoMode) { enableDemoMode(collection, ALL_CARDS); collection.currency.duelCoins = 999999; }
saveData(collection);   // main.js:295-312
```

Why it is wrong: `demoMode` is persisted in the save, so on **every** startup the function adds another 3 copies to
every card that is already owned, and the increment is immediately persisted. After N reloads every card sits at 3N
copies, silently violating `MAX_COPIES = 3` (`collection.js:8`) — the invariant the shard/craft/dismantle economy and
`addCard`'s duplicate-to-shard conversion rely on.

Minimal trigger: enable demo mode once, reload the page 3 times → `collection.cards[<anyId>] === 12`.
`createDemoCollection` (`collection.js:28-34`) has the same additive pattern.

Suggested fix: make it idempotent — `collection.cards[card.id] = Math.max(collection.cards[card.id] || 0, MAX_COPIES);`

---

## BUG 5 — MEDIUM — The one-time reward table can never be claimed

`js/rewards.js:25-30`; `js/collection.js:190-199`

```js
export const ONE_TIME_REWARDS = [
    { id: "tutorial_complete", amount: 2000, label: "教程完成奖励" },
    { id: "beat_ai_easy", amount: 500, label: "首次击败简单AI" }, ...
];
```

Why it is wrong: nothing in the shipped code turns a `ONE_TIME_REWARDS` entry into a reward. `applyReward`'s
`claimId` de-duplication is only reachable if a caller sets `claimId`, and no caller does (`claimId` appears only in
`rewards.js:62-65` and in tests). Likewise `claimReward`/`hasClaimedReward` are referenced only by
`test/collection.test.js` / `test/nightcord.test.js`. So the 2000-coin tutorial reward and the three 500-coin
"first win vs. easy/normal/hard AI" rewards are unclaimable dead data, while `calculateMatchReward` has the difficulty
information (`matchData.stage.difficulty`) needed to grant them. (`beat_ai_easy` also cannot match `stages.js`
difficulties, which are `easy|normal|hard|expert|nightmare`, so a fix must map them.)

Minimal trigger: complete any stage on a fresh save → no one-time reward exists anywhere (collection detail panel and
settings expose no claim button either).

Suggested fix: in `calculateMatchReward`, when a stage win's difficulty maps to `beat_ai_*` and
`!hasClaimedReward(collection, id)`, append `{ claimId: id, duelCoins: amount, … }` — or delete the table.

---

## BUG 6 — MEDIUM — `shuffleArray`/`Player` RNG contract mismatch throws for the `RandomSource` objects used everywhere else

`js/model.js:8-16`, used by `js/model.js:89`

```js
export function shuffleArray(arr, rng = null) {
    const a = [...arr];
    const rand = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); ... }
}
```

```js
this.deck = preserveDeckOrder ? instances : shuffleArray(instances, rng);   // model.js:89
```

Why it is wrong: the parameter is called `rng` and every other module passes/injects the *object* form
(`rng.js` exports `RandomSource`/`SeededRandom` with `.next()`; `deck.js` uses `rng.pick`/`rng.shuffle`;
`engine.js:1686-1688` explicitly supports `typeof rng === "function"` **or** `rng.next`). An object is not callable,
so `rand()` throws. Reproduced: `shuffleArray([1,2,3,4], new SeededRandom("x"))` → `TypeError: rand is not a function`
and `new Player("p", [c1,c2,c3], new SeededRandom("x"), false)` → same. (A 1-card deck does not throw only because the
loop body never runs.) `Player`'s seeded-RNG injection is therefore broken for the only RNG class the codebase
produces; `rng.js:70`'s `rng` singleton works only by accident because `RandomSource.next()` ignores `this`.

Minimal trigger: `new Player("p", deckOf40Cards, new SeededRandom(seed), false)`.

Suggested fix: normalise in one place, e.g.
`const rand = typeof rng === "function" ? rng : rng?.next ? () => rng.next() : Math.random;`
(or route `Player` through `rng.shuffle`).

---

## BUG 7 — MEDIUM — `migrateSave` has no migration: the version is read, then overwritten; a legacy currency key is silently zeroed

`js/storage.js:105-134`

```js
data.version = Number(data.version || 0);     // storage.js:108 — never used afterwards
...
data.currency.duelCoins = Number(data.currency.duelCoins || 0);   // storage.js:113
...
data.version = SAVE_VERSION;                  // storage.js:132 — unconditional
```

Why it is wrong: the version number is parsed and then unconditionally replaced, and there is no `if (version < 2)`
branch anywhere, so the whole migration layer is decorative. Any pre-v2 save keeps its legacy shape and simply loses
data: a save whose currency field was `duelPoints` (the codebase still carries that name in
`packs.js:30` `cost: { duelPoints: 100 }` and in the accessor names `addDuelPoints`/`spendDuelPoints`,
`collection.js:96-105`, plus the dead `addPackTicket`/`spendPackTicket` stubs `collection.js:218-224`) migrates to
`duelCoins: 0` — all coins wiped, and the rewritten `version: 2` makes the loss permanent. `importSave` is harsher:
`validateSaveStructure` (`storage.js:141`) rejects the same file with "货币数据损坏".

Verified: `saveData`→`loadSave` round trip preserves `currency/cards/decks/selectedDeckId/pityCounters/
claimedRewards/statistics/settings/stageProgress/profile` exactly (current format is fine); importing
`{"version":1,"cards":{"a":2},"decks":[],"currency":{"duelPoints":9000}}` returns
`{success:false, reason:"货币数据损坏"}`.

Minimal trigger: seed `localStorage["dimensional_duel_save"]` with a `duelPoints`-era payload and reload → coins 0.

Suggested fix: branch on `Number(data.version||0)` and map legacy keys
(`if (v < 2) { data.currency.duelCoins = data.currency.duelCoins ?? data.currency.duelPoints ?? 0; }`), and relax
`validateSaveStructure` to accept either key.

---

## BUG 8 — MEDIUM — Rule-priority inversion: four rule layers are unreachable for every shipped card

`js/card-rules.js:176-191`

```js
if (hasAuthoredRules(normalized.id)) return authoredCardRules(normalized);
const designed = designRarityRules(normalized);
if (designed) { Object.assign(normalized, designed); return normalized; }
// 有CARD_RULES定义的优先用CARD_RULES，否则保留原始效果
if (CARD_RULES[normalized.id]) { ... } else if (!Array.isArray(card.effects) || card.effects.length === 0) { galleryEffect … fallbackEffect }
```

Why it is wrong: the comment states CARD_RULES has priority, but the code checks authored rules and the generated
design first. Measured over the real catalogue (`js/catalog.js`, 368 cards):

* 308 cards have an authored recipe (`authored-card-rules.js`), the other 60 are `series === "starter_ygo"` and
  return at `card-rules.js:165-175`;
* therefore **0 of 368 cards can reach `CARD_RULES`, `galleryEffect`, `fallbackEffect` or `designRarityRules`**;
* every `CARD_RULES` key (`water_007-011`, `dark_006`, `nc_sp_ur_001-012`, `nc_sp_ss_001-006`, `nc_tr_001-005`, 29
  entries) is shadowed by an authored recipe — e.g. `water_007` is documented there as
  `buffSelfDefense +300` but actually resolves to the themed action `M:recover`;
* the entire design layer `js/rarity-rules.js` (774 lines, including `simplifyRules`/`plainRuleDescription` text) is
  dead code for the published build.

Minimal trigger: `applyPlayableRules({id:"water_007",…}).effects` returns `[{type:"themedAction",action:"recover"}]`,
never the `CARD_RULES` entry.

Suggested fix: pick one intent and make it explicit — either move the `CARD_RULES` lookup above
`designRarityRules` (and update the authored recipes that intentionally override it), or delete the stale layers and
correct the comment; add a test that every catalogue card resolves through the expected layer.

---

## BUG 9 — MEDIUM — Empty `PRESET_DECKS`: no starter deck, AI difficulty ignored, and the only fallback deck is itself illegal

`js/decks.js:7-41`

```js
export const NIGHTCORD_STARTER_DECK = AI_FALLBACK_DECK;
export const PRESET_DECKS = [];
export function getDefaultDecks() { return PRESET_DECKS.map(...); }        // → always []
export function getAIDeck(difficulty = "normal") {
    const filtered = PRESET_DECKS.filter(d => d.difficulty === difficulty);
    if (filtered.length === 0) return AI_FALLBACK_DECK;                    // → always
    return filtered[Math.floor(Math.random() * filtered.length)];
}
```

Why it is wrong:

1. `PRESET_DECKS` is empty, so `getDefaultDecks()` (`decks.js:29-35`, called by `profile.js:11` and `profile.js:22`)
   always returns `[]` — a new profile has **no** deck even though a 40-card `NIGHTCORD_STARTER_DECK` is defined,
   tested (`test/nightcord.test.js:254-262`) and never handed to a player.
2. The `difficulty` filter is a dead branch: `getAIDeck("hard")` and `getAIDeck("nightmare")` both return
   `ai_fallback`. (In practice `getAIDeck` is imported by `main.js:10` but never called — the AI uses
   `matchConfig.opponentDeck || playerDeck`, so this is latent.)
3. `AI_FALLBACK_DECK.main` has 40 entries but **4 copies** of `water_007/008/009/010/011` and `dark_006`; verified
   `{water_007:4, water_008:4, water_009:4, water_010:4, water_011:4, dark_006:4}`. That violates
   `DECK_RULES.MAX_COPIES = 3` and would fail `validateDeck` (`"water_007最多只能携带3张"`) if the alias
   `NIGHTCORD_STARTER_DECK` were ever used as a player/AI deck.

Minimal trigger: `createNewProfile().decks.length === 0`; `validateDeck(createDeck("x","x",AI_FALLBACK_DECK.main), ALL_CARDS, null).valid === false`.

Suggested fix: put the starter deck into `PRESET_DECKS` (with per-difficulty entries) and replace the 6 duplicated
entries with cards not already at 3 copies.

---

## BUG 10 — LOW — SSR spells always lose their third designed effect

`js/rarity-rules.js:712` vs `js/rarity-rules.js:151-157` (`simplifyRules`) and `js/rarity-rules.js:766`

```js
if (rarity === "SSR") return [base[0], base[1], rule("manual", "searchDeck", 1, "余韵：从卡组检索1张与本卡不同类型的卡。", …)];
```

```js
const limit = forcedLimit ?? (rarity === "UR" ? 3 : rarity === "N" || rarity === "R" ? 1 : 2);
return rules.slice(0, limit).map(...);
```

Why it is wrong: the SSR branch deliberately builds three effects, then `simplifyRules` truncates every non-UR /
non-forced list to 2 — the "余韵" search effect can never appear, while the parallel UR branch (limit 3) keeps all
three. Verified by calling `designRarityRules` directly on `{type:"spell", rarity:"SSR", series:"picture"}` →
`effects.length === 2, ["damageAllEnemyMonsters","directDamage"]`, and the same input with `rarity:"UR"` → 3 effects.

Minimal trigger: `designRarityRules({id:"x",name:"y",type:"spell",rarity:"SSR",series:"picture"}).effects.length`.
(Currently unreachable through `applyPlayableRules` — see BUG 8 — but it becomes live the moment a card without an
authored recipe is added.)

Suggested fix: pass a forced limit of 3 for SSR spells/traps, or stop building the third effect.

---

## BUG 11 — LOW — `SeededRandom(0)` (or any falsy seed) silently becomes non-deterministic

`js/rng.js:29-34`

```js
constructor(seed) { super(); this._s = new Uint32Array(this._hashSeed(seed || Date.now())); }
```

Why it is wrong: the class documents "PvP 模式下两端使用相同种子确保随机结果一致", but `seed || Date.now()` maps the
falsy seeds `0` and `""` to the current time, so two clients cannot agree. Verified: `new SeededRandom(0)` twice in
the same tick gives the same sequence, but with a 15 ms gap the first values differ (`5725413190666586` vs a
different value) — i.e. determinism is accidental. The Spring `PvpWebSocketHandler.generateSeed()` returns a 32-char
hex string today, so nothing currently depends on it, but `gameInfo?.seed` is truthiness-checked in `main.js:384`
(`if (mode === "pvp" && gameInfo?.seed)`), so a numeric `0` seed would additionally skip seeding entirely.

Minimal trigger: `new SeededRandom(0)` in two different milliseconds → different streams.

Suggested fix: `this._hashSeed(seed === undefined || seed === null ? Date.now() : seed)`.

---

## BUG 12 — LOW — `summon()` overwrites `themedState`, so charge counters desync from their attack buffs

`js/themed-effects.js:61-69` vs `js/themed-effects.js:138-141` and `js/themed-effects.js:210-215`

```js
function summon(ctx, card, from) { ...; card.themedState = { sealedUntil: ctx.gameState.turn }; ctx.player.monsterZone.push(card); ... }
case "charge": state(c).charges = (state(c).charges || 0) + 1;
               c.permanentBuffs.push({ type: "attack", value: 200, source: "themedCharge" }); p._recalcCardStats(c); break;
function spendCharge(ctx) { state(ctx.card).charges--; const index = ctx.card.permanentBuffs.findIndex(x => x.source === "themedCharge"); if (index >= 0) …splice(index,1); … }
```

Why it is wrong: charges live in `themedState` while their +200 attack bonuses live in `permanentBuffs`. `summon()`
replaces (does not merge) `themedState` for `deploy`/`revive`/`exchange`, so a charged monster that is returned to the
hand (e.g. by `exchange`, `retreat`, or the opponent's `returnToHand` trap) and redeployed keeps the permanent +200×N
attack buff while losing the counter — `burst`/`timeStop` are then unusable and the bonus is unremovable
(`spendCharge` would do `undefined--` → `NaN`).

Minimal trigger: `M:charge` ×3 (attack +600) → the monster is bounced to hand → `M:deploy` it → attack is still
+600, `themedState.charges === 0`.

Suggested fix: in `summon`, merge instead of replace: `card.themedState = { ...(card.themedState || {}), sealedUntil: ctx.gameState.turn }`, and in `spendCharge` guard `charges` with `Math.max(0, (charges||0)-1)`.

---

## BUG 13 — LOW — The per-pack rarity guarantee degrades silently when the pool lacks that rarity

`js/packs.js:76-84`

```js
if (i === cardsPerPack - 1 && rarity === "N") rarity = "R";
const rarityPool = pool.filter(c => c.rarity === rarity);
if (rarityPool.length > 0) { results.push({ ...randomSource.pick(rarityPool) }); }
else { results.push({ ...randomSource.pick(pool) }); }
```

Why it is wrong: the documented guarantee (`PACK_GUARANTEE.perPack = { minRarity: "R", position: 7 }`, rendered in the
shop as "第8张至少R", `app.js:309`) is skipped whenever the filtered pool contains no card of the guaranteed rarity —
the fallback picks from the **whole** pool and can return an N card. Only 6 R cards exist in the 368-card catalogue,
and `getPackPool` also applies `packDef.pool.attribute/types` filters (`packs.js:40-41`), so any restricted
`PACK_DEFINITIONS` entry (e.g. `standard_pack_001`) can break its own guarantee. Note `PACK_GUARANTEE` is never
imported anywhere — the guarantee exists only as literals inside `openPack`.

Minimal trigger: `openPack({id:"p", cardsPerPack:8, pool:{attribute:"water"}}, dbWithoutRarityR, …)` → last card can be N.

Suggested fix: when the guaranteed rarity pool is empty, fall back to the lowest rarity **at or above** the guarantee
(e.g. `pool.filter(c => RARITY_ORDER[c.rarity] >= RARITY_ORDER[rarity])`), and derive the position/minRarity from
`PACK_GUARANTEE`.

---

## BUG 14 — LOW — Backend deck sync mutates deck ids *after* the local save was serialised

`js/storage.js:52-70`

```js
const payload = { ...data, version: SAVE_VERSION, lastSaved: Date.now() };
localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
...
for (const deck of (data.decks || [])) {
    ... else { const created = await api.createDeck(userId, deck.name, deck.coverCardId, deck.main || []); if (created?.id) deck.id = created.id; }
}
```

Why it is wrong: `saveData` writes localStorage synchronously and only then runs the debounced `syncToBackend`, which
rewrites `deck.id` on the **live** collection after the JSON has already been written. The persisted deck keeps the
local id while the server holds a different one, so (a) a reload before the next `saveData` restores the stale id and
the next sync creates a *second* server deck for the same deck (`serverDeckIds.has(deck.id)` misses), and (b) the
in-memory and persisted deck ids diverge. The same payload object is shared with `Object.assign(data, payload)`, so
the mutation is invisible to the save that already happened.

Minimal trigger: create a deck offline-capable, log in, let the sync run, reload the page immediately → the next save
posts a duplicate deck to `/api/decks/user/{id}`.

Suggested fix: persist after the sync (or call `saveData(collection)` once new ids are assigned), and key server decks
by a stable client-generated `clientId` instead of a server id.

---

## BUG 15 — LOW — `extra`/`side` deck contents are never validated

`js/deck.js:43-44`

```js
if ((deck.extra || []).length > DECK_RULES.MAX_EXTRA) result.errors.push(`额外卡组最多${DECK_RULES.MAX_EXTRA}张`);
if ((deck.side  || []).length > DECK_RULES.MAX_SIDE)  result.errors.push(`副卡组最多${DECK_RULES.MAX_SIDE}张`);
```

Why it is wrong: only the lengths are checked. `counts` is built from `deck.main` only (`deck.js:46-57`), so cards in
`extra`/`side` are never checked for existence (`不存在于卡牌数据库`), ownership (`拥有N张`) or the per-card copy limit,
and `createRuntimeDeck` (`deck.js:87-97`) ignores `extra` entirely. A deck can therefore be "valid" while referencing
unowned/unknown cards in `extra`/`side`; the game silently plays without them. The counts also differ from the
documented rules (`app.js:898`).

Minimal trigger: `validateDeck(createDeck("d","d",fortyOwnedIds,[/* 15 unowned ids */],[/* 15 unowned ids */]), ALL_CARDS, emptyCollection).valid === true`.

Suggested fix: run the same existence/ownership/copy-limit checks over `extra` and `side` (or, if those zones are not
supported, drop them from the schema and the UI).

---

## BUG 16 — LOW — Internal data contradictions in the generated-rule layer

`js/rarity-rules.js:392` and `js/rarity-rules.js:725`

```js
rule("onDestroyed", "returnMultiple", 1, "时间逆流：被破坏时将对方最多2只怪兽返回手牌。")   // value 1 vs "最多2只"
```
```js
function trapRules(card, budget, seed, heal) { ... }   // `budget` is never used inside the function
```

Why it is wrong: the numeric value (1) contradicts the printed description (2) for the same effect — the engine
resolves `value`, so the card does less than its text says. `trapRules`' `budget` parameter is dead, which means trap
strength is not tied to the rarity budgets (`BUDGETS`) the rest of the file scales from. Both are currently
unreachable (BUG 8) but will surface as soon as a card without an authored recipe is added.

Suggested fix: make the description derive from `value` (`将对方最多${value}只…`) and either use or remove `budget`.

---

## Checked and found clean (explicitly, so they need not be re-audited)

* **`js/rng.js`** (apart from BUG 11): `RandomSource.shuffle` copies its input (verified input unchanged), preserves
  the multiset, and uses an unbiased Fisher–Yates; `weightedPick` has no modulo bias and its weights sum to 1 for
  `PACK_RATES` (`test/packs.test.js:46-54`); `SequenceRandom` is deterministic and its modulo wrap is intentional
  (asserted by `test/packs.test.js:22-29`).
* **`js/constants.js`**: `GAME_CONFIG.MIN_DECK_SIZE/MAX_DECK_SIZE/MAX_EXTRA_DECK_SIZE/MAX_SIDE_DECK_SIZE` (40/60/15/15)
  agree with `DECK_RULES` in `deck.js`; `END_HAND_LIMIT` matches `model.js:119`. `EFFECT_TYPE`/`COST_TYPE`/
  `LIMIT_TYPE`/`AI_DIFFICULTY`/`AI_ROLE` are unused exports (dead data, not a logic defect).
* **`js/stages.js`**: all 50 stage decks were built and validated — 50/50 are exactly 40 cards, no card exceeds 3
  copies, no unknown ids, `validateDeck(...).valid === true` for every stage; `isStageUnlocked` reads
  `AI_STAGES[order-2]` (the previous stage's id, matching the key written at `main.js:494-495`) and stage 1 is always
  unlocked. Reward curve is monotonic within a chapter. No bug found.
* **`js/card-ignition.js`**: no logic bug found. `prefersReducedMotion` correctly treats an explicit boolean as
  authoritative (so `reduceAnimations: false` does not fall through to `matchMedia`), `selectIgnitionCards` dedupes by
  id and honours the limit, and `resetIgnitionState` clears every class/style it sets. `playCardIgnition` returns
  without calling `onComplete` when `root` is falsy (unlike `playDuelLaunch`), but neither call site passes
  `onComplete` (`app.js:267/274`), so it is not reachable.
* **Deck 3-copy rule keyed by id vs name**: `validateDeck` counts by `id`. I checked the whole catalogue for
  same-name/different-id pairs — **0 duplicates among 368 cards**, so id-keyed counting is currently equivalent to
  name-keyed counting. No bug (but it would silently break if alt-art cards were ever added as separate ids).
* **Duplicate/missing grants**: `addCard` (`collection.js:43-64`) caps at `MAX_COPIES` and converts the remainder to
  shards of the card's own rarity; `dismantleCard` uses the per-deck maximum (not the sum) of copies, which is correct
  because only one deck is played at a time; `craftCard` re-checks via `canCraft` before spending shards. No
  double-add / lost-card path found.
* **Currency arithmetic**: `spendDuelPoints`/`spendShards` refuse negatives and insufficient balances
  (`collection.js:101-117`); no reachable caller passes `NaN` (pack costs and reward amounts are all `Number(...)`- or
  table-derived). Balances are read before mutation consistently in `openPacks` local path, which refunds exactly once
  on a failed open (`app.js:376-380`).
* **Persistence round trip**: `saveData` → `loadSave` preserved every field of `DEFAULT_COLLECTION` plus
  `stageProgress` and `profile` in a byte-for-byte comparison (only BUG 7's *legacy* shape is mishandled).
* **`js/authored-card-rules.js`**: recipe keys were matched against the catalogue by prefix — `picture_ssr7_` 59/59,
  `picture_ex_` 119/119, `source_monster_` 20/20, `source_spell_` 2/2, `source_trap_` 28/28, `gallery_spell_` 51/51,
  `nc_sp_*` 18/18, `nc_tr_` 5/5, `water_` 5/5, `dark_006` — **no missing or mis-keyed recipe** (every id uses the
  zero-padded 3-digit form the `rows()` helper produces), and no non-monster card is assigned a recipe action that
  requires the source card to be on the monster zone (`charge/burst/twin/pierce/ward/timeStop` → 0 violations).
* **`js/collection.js` art system**: `addArt`/`hasArt`/`getArtCount`/`setSelectedArt`/`getSelectedArt` are consistent
  (count 0 = locked, `hydrateCardArt` reads `selectedArtByCard`). No bug found.
