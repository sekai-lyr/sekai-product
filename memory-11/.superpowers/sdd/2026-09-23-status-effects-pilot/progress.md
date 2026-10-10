# SDD ledger — plan: D:\Sekai_two\memory-16\docs\superpowers\plans\2026-09-23-status-effects-pilot.md

Task 1: fix round 1/5 (2 addressed, 0 open — tick/activeDomain tests added; valueKey cleared on remove/cleanse)
Task 1: complete (js/status-effects.js + test/status-effects.test.js; review clean)
Task 1: minor (deferred): applyAilment creates statuses before validating def; zero-damage tick still decays/emits; domain.until missing treated permanent; test asserts via AILMENTS.burn.max self-reference; tick events/emit not asserted
Task 2: complete (js/themed-effects.js, js/engine.js, js/model.js, test/status-effects.test.js; review clean)
Task 2: ruling — applyAilment 数值为『每次施加更新、后来源覆盖』（spec §3 注释已更新）
Task 2: minor (deferred): themed-effects.js 新增未用导入；canResolve 新门槛未测试（任务13补）；ACTION_TEXT 断言偏弱；statuses 中段 import 风格
Task 3: fix round 1/5 (2 addressed: direct-attack bleed via _settleBleed; curse test no longer vacuous)
Task 3: fix round 2/5 (1 addressed: bleed snapshot before destruction -> destroyed bleeders still settle; curse deathrattle limited to isDestruction; ACTION_TEXT list extended)
Task 3: complete (js/themed-effects.js, js/engine.js, test/status-effects.test.js; review clean)
Task 3: minor (deferred): _settleBleed decay write lacks statuses guard; snapshot-based decay overwrite OK by design note; bleedDamage residual after delete; selectTribute curse guard before deselect branch; redundant !monster check; curse deathrattle inline instead of event bus (equivalent)
Task 4: fix round 1/5 (2 addressed: predictBattle infinity sync + 5 regression scenarios; expiry test uses opponent endTurn)
Task 4: complete (js/themed-effects.js, js/engine.js, test/status-effects.test.js, test/bugfix-regression.test.js; review clean)
Task 4: minor (deferred): plan's vacuous defense-position case retained; engine expiry unconditional cannotBeTargeted=false; count:'all' canResolve requires targetable enemy; UI/AI frozenUntil-only checks (move to task 10 scope)
Task 5: fix round 1/5 (1 critical + 1 important addressed: move() region-exclusion on return; 4 new tests; enemy exile resets card state)
Task 5: complete (js/themed-effects.js, test/status-effects.test.js; review clean)
Task 5: ruling — sealedUntil=turn+1 accepted ('封1回合'，与 freeze 约定一致); self template fixed turns:1
Task 5: minor (deferred): permanentBuffs not recalculated during exile zone; move() return unchecked; recall canResolve counts exiled; plan pseudocode push bug caught by review
Task 6: complete (js/themed-effects.js, test/status-effects.test.js; review clean; both deviations ratified: 7400 expectation, purify canResolve relaxation)
Task 6: minor (deferred): detonate stacks=0 text/resolution gap -> task 9 candidate pool MUST NOT include stacks:0 (plan already excludes); venom burst wording lacks 表侧/守备力; ACTION_TEXT list missing detonate; synthetic stacks:0 tests
Task 7: constraint — rojin deflection must also sync predictBattle (preview=resolution invariant per task 4)
Task 7: fix round 1/5 (C1 applied pure-JSON + instanceId lookup; I1 purgeOrphanDomainBuffs + destroy/attack hooks; M1 wuji guard limited to monsters; M2 sourceId distinguishes stacks)
Task 7: complete (js/themed-effects.js, js/engine.js, test/status-effects.test.js, test/bugfix-regression.test.js; review clean)
Task 7: minor (deferred): non-destroy leave paths purge at next end phase (same-turn window); PvP receive-side index flip relies on purge fallback; redundant ownerIndex deletion path
Task 8: fix round 1/5 (2 addressed: removed lastCoinResult shared state — each coin action rolls exactly once; tests for both branches + roll counts)
Task 8: complete (js/themed-effects.js, test/status-effects.test.js; review clean)
Task 8: minor (deferred): gamble empty-deck deck-out risk; draw:0 text gap; card-view paralyzed label pending task 10; PvP snapshot coin state moot with shared RNG
Task 9: fix round 1/5 (2 addressed: pilot-roster locks exact §7 trigger/params with deepEqual; 072 real-card once-per-turn + attack-500 + sealed tests)
Task 9: complete (js/signature-tuning.js, js/authored-card-rules.js, js/themed-effects.js template polish, src/test/js/pilot-roster.test.js, static/test/themed-gameplay.test.js, static/test/rarity-rules.test.js sync; review clean)
Task 9: spec updated by coordinator: §4.9 detonate text now 表侧/守备力精确措辞
Task 9: minor (deferred): LP<=800 real-card path only handler-level; pilot-roster ROSTER/EXPECTED key cross-check; signature-rules stale SIGNATURE_PICKS & BASE_RECIPES cleanup; export-web-card-rules/full-card-pool regeneration before packaging (task 13)
Task 10: fix round 1/5 (Important: flipSummon paralyzedUntil guard + engine-level test with control; minor: ×N label format, DOMAIN_DEFS lookup)
Task 10: complete (js/card-view.js, js/controller.js, js/ui.js, js/engine.js, css/style.css, test/status-effects.test.js; review clean)
Task 10: minor (deferred): right-click panel shows flip/position buttons for paralyzed/frozen; twin canAttack refresh checks frozen only; DOMAIN_DEFS prototype-key edge
Task 11: fix round 1/5 (2 important addressed: themed anchors to target cards + data-atk; status-mark badges + CSS + reduced-motion; merge order; fallback/no-op tests)
Task 11: complete (js/effects.js, js/controller.js, js/ui.js, css/style.css, test/status-effects.test.js; review clean)
Task 11: minor (deferred): paralyze-all marks face-down too; strongest ignores cannotBeTargeted; mark stacks show applied not resulting; paralyze gamble always marks 麻痹; exile-self visual branch unreachable; temp DOM harness not committed to test suite (fold easy ones into task 12)
Task 12: fix round 1/5 (I1: THEMED_ACTION_SOUNDS dispatch in playRuleDrivenEffect; onStatusTick subscription; reduced-motion full degradation; domain sound single-shot)
Task 12: complete (js/effects.js, js/audio.js, js/controller.js, css/style.css, test/status-effects.test.js; review clean)
Task 12: minor (deferred): onSummon path sound may play even if effect fizzles; no off() for subscriptions; onDestroyed(exile-self) path still no visual/sound card param; statusTick multi-fire; harness not committed; domain chip fixed 20s; domain visuals weaker than spec; banner overlapped by overlay