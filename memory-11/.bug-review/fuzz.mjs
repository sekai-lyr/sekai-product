/**
 * Randomised invariant fuzzer for the Nightcord duel engine.
 * Drives the rules engine directly with random legal actions and asserts
 * structural invariants after every single action.
 *
 * Usage: node .bug-review/fuzz.mjs [games] [seed]
 */
import { Player, GameState } from "../SekaiGame/src/main/resources/static/js/model.js";
import { GameEngine } from "../SekaiGame/src/main/resources/static/js/engine.js";
import { GAME_CONFIG, MONSTER_POSITION, PHASE } from "../SekaiGame/src/main/resources/static/js/constants.js";
import { ALL_CARDS } from "../SekaiGame/src/main/resources/static/js/catalog.js";

const GAMES = Number(process.argv[2] || 200);
const BASE_SEED = Number(process.argv[3] || 1234567);

// deterministic RNG (mulberry32) so failures are reproducible
function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const LEGAL_PHASES = new Set(Object.values(PHASE));

function buildDeck(rng, size = 40) {
    const pool = ALL_CARDS.filter(c => c && c.id && c.type);
    const deck = [];
    while (deck.length < size) {
        const card = pool[Math.floor(rng() * pool.length)];
        const copies = deck.filter(c => c.id === card.id).length;
        if (copies >= 3) continue;
        deck.push(card);
    }
    return deck;
}

function checkInvariants(engine, ctx) {
    const state = engine.state;
    const problems = [];

    for (const p of state.players) {
        if (!Number.isFinite(p.lp)) problems.push(`LP not finite: ${p.lp}`);
        if (p.lp < 0) problems.push(`LP negative: ${p.lp}`);
        if (p.monsterZone.length > GAME_CONFIG.MAX_MONSTER_ZONE) problems.push(`monster zone over: ${p.monsterZone.length}`);
        if (p.spellTrapZone.length > GAME_CONFIG.MAX_SPELL_TRAP_ZONE) problems.push(`spell/trap over: ${p.spellTrapZone.length}`);
        if (!Array.isArray(p.hand)) problems.push("hand is not an array");
        const zones = { deck: p.deck, hand: p.hand, monster: p.monsterZone, spellTrap: p.spellTrapZone, grave: p.graveyard, banished: p.banished, temp: p._tempBanished.map(e => e.card) };
        for (const [name, zone] of Object.entries(zones)) {
            for (const card of zone) {
                if (!card || typeof card !== "object") { problems.push(`${name} has empty entry`); continue; }
                if (!card.instanceId) problems.push(`${name} card without instanceId (${card.name})`);
                if (card.type === "monster") {
                    if (!Number.isFinite(card.currentAttack)) problems.push(`${card.name} currentAttack NaN in ${name}`);
                    if (!Number.isFinite(card.currentDefense)) problems.push(`${card.name} currentDefense NaN in ${name}`);
                }
            }
        }
        if (p.fieldZone && !p.fieldZone.id) problems.push("fieldZone without id");

        for (const card of p.monsterZone) {
            if (card.id && card.type && card.type !== "monster") problems.push(`non-monster ${card.name} (${card.type}) in monster zone`);
        }
        for (const card of p.spellTrapZone) {
            if (card.id && card.type === "monster") problems.push(`monster ${card.name} in spell/trap zone`);
            if (card.type === "trap" && card.faceDown !== true) problems.push(`face-up trap ${card.name} sitting in spell/trap zone`);
        }
        for (const card of p.monsterZone) {
            if (card.type !== "monster") continue;
            // attack accounting only matters for the player whose turn it is, and only
            // outside the end-of-turn hand-off window (endTurn clears doubleAttackThisTurn
            // for both sides before the next player's resetTurnState zeroes the counters).
            if (p !== state.currentPlayer || state.phase === PHASE.END) continue;
            const made = Number(card.attacksMadeThisTurn) || 0;
            const limit = card.doubleAttackThisTurn ? 2 : 1;
            if (made > limit) problems.push(`${card.name} attacked ${made}x > limit ${limit}`);
            if (made > 0 && card.hasAttackedThisTurn !== true) {
                const prev = PREV.get(card.instanceId);
                problems.push(`${card.name} attacked but hasAttackedThisTurn is false :: now=${JSON.stringify({ made, hasAttacked: card.hasAttackedThisTurn, canAttack: card.canAttack, double: !!card.doubleAttackThisTurn, setTurn: card.setTurn, turn: state.turn, set: card.id })} prev=${JSON.stringify(prev)}`);
            }
            if (card.canAttack && made >= limit) problems.push(`${card.name} canAttack with ${made}/${limit} attacks used`);
        }
    }

    if (!LEGAL_PHASES.has(state.phase)) problems.push(`illegal phase: ${state.phase}`);
    if (state.phase === PHASE.TRIBUTE_SELECT && !state.pendingTribute) problems.push("tribute_select without pendingTribute");
    if (state.pendingTribute && state.phase !== PHASE.TRIBUTE_SELECT) problems.push("pendingTribute while phase is " + state.phase);

    const dupes = engine.checkStateIntegrity();
    problems.push(...dupes);

    return problems;
}

const VIOLATIONS = new Map();
const PREV = new Map(); // instanceId -> {made, hasAttacked, canAttack, zone, turn}
function snapshotCards(state) {
    const next = new Map();
    for (const [pi, p] of state.players.entries()) {
        for (const card of p.monsterZone) next.set(card.instanceId, { made: Number(card.attacksMadeThisTurn) || 0, hasAttacked: card.hasAttackedThisTurn, canAttack: card.canAttack, zone: `monster${pi}`, turn: state.turn });
        for (const card of p.hand) next.set(card.instanceId, { made: Number(card.attacksMadeThisTurn) || 0, hasAttacked: card.hasAttackedThisTurn, canAttack: card.canAttack, zone: `hand${pi}`, turn: state.turn });
    }
    return next;
}
function record(problems, ctx) {
    for (const problem of problems) {
        const key = problem.replace(/\[\d+\]/g, "[]");
        const entry = VIOLATIONS.get(key) || { count: 0, first: ctx };
        entry.count++;
        VIOLATIONS.set(key, entry);
    }
    return problems.length > 0;
}

function playGame(gameIndex) {
    const rng = makeRng(BASE_SEED + gameIndex * 7919);
    const state = new GameState();
    state.players = [new Player(`A${gameIndex}`, buildDeck(rng)), new Player(`B${gameIndex}`, buildDeck(rng))];
    const engine = new GameEngine(state, rng);

    for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) {
        engine.drawCard(state.players[0]);
        engine.drawCard(state.players[1]);
    }
    state.turn = 0;
    state.firstTurn = true;
    state.currentPlayerIndex = 0;
    engine.startTurn({ skipDraw: true });
    state.phase = PHASE.MAIN_1;
    record(checkInvariants(engine, `g${gameIndex} start`), `g${gameIndex} start`);

    let steps = 0;
    const MAX_STEPS = 4000;
    while (!state.gameOver && steps < MAX_STEPS) {
        steps++;
        const player = state.currentPlayer;
        const opponent = state.opponentPlayer;
        const phaseIsMain = state.phase === PHASE.MAIN_1 || state.phase === PHASE.MAIN_2;

        const actions = [];
        if (phaseIsMain) {
            if (!player.normalSummonUsed) {
                player.hand.forEach((card, index) => {
                    if (card?.type !== "monster") return;
                    const needed = engine.getTributeNeeded(card.level);
                    if (player.monsterZone.length < needed) return;
                    if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE && needed === 0) return;
                    actions.push(() => {
                        const r = engine.normalSummon(player, index, MONSTER_POSITION.ATTACK, false);
                        if (r.needsTribute) {
                            const candidates = [...player.monsterZone].filter(c => !c.cannotUseAsMaterial);
                            const picks = candidates.slice(0, r.tributeNeeded);
                            picks.forEach(c => engine.selectTribute(c));
                            if (engine.state.pendingTribute) engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
                        }
                        return r;
                    });
                });
                player.hand.forEach((card, index) => {
                    if (card?.type !== "monster") return;
                    const needed = engine.getTributeNeeded(card.level);
                    if (player.monsterZone.length < needed) return;
                    if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE && needed === 0) return;
                    actions.push(() => engine.setCard(player, index));
                });
            }
            player.hand.forEach((card, index) => {
                if (card?.type === "spell") {
                    actions.push(() => {
                        const eff = card.effect || card.effects?.[0];
                        const type = engine.getEffectTargetType(eff);
                        const needsTarget = !["none", "enemy_player", "self_player", "both_players"].includes(type);
                        const targets = needsTarget ? engine.getValidTargets(player, eff) : [];
                        const target = needsTarget ? targets[Math.floor(rng() * Math.max(1, targets.length))] : null;
                        return engine.activateSpell(player, index, target || null);
                    });
                }
                if (card?.type === "spell" || card?.type === "trap") {
                    actions.push(() => engine.setCard(player, index));
                }
            });
            player.monsterZone.forEach(card => {
                if (!card.faceUp && card.setTurn !== state.turn) actions.push(() => engine.flipSummon(player, card));
                if (card.faceUp) actions.push(() => engine.changePosition(player, card));
                if (card.faceUp && !card.hasAttackedThisTurn) actions.push(() => engine.triggerAllEffects(player, card, "manual"));
                if (card.faceUp) {
                    actions.push(() => {
                        const eff = card.effect || card.effects?.[0];
                        const type = engine.getEffectTargetType(eff);
                        const targets = engine.getValidTargets(player, eff);
                        const target = targets[Math.floor(rng() * Math.max(1, targets.length))];
                        return engine.triggerEffect(player, card, target || null);
                    });
                }
            });
            player.spellTrapZone.forEach(card => {
                if (card.type === "spell" && card.faceDown) {
                    actions.push(() => {
                        const eff = card.effect || card.effects?.[0];
                        const type = engine.getEffectTargetType(eff);
                        const supportsPlayerTarget = type === "enemy_player" || type === "self_player" || type === "both_players";
                        let target = null;
                        if (type === "enemy_monster_or_player") {
                            const list = engine.getValidTargets(player, eff);
                            const playerChoice = { instanceId: "player_" + opponent.name, isPlayer: true, name: opponent.name, currentDefense: opponent.lp };
                            target = list.length ? list[Math.floor(rng() * list.length)] : playerChoice;
                            if (target && target.isPlayer) {
                                const t = engine.getValidTargets(player, eff).find(x => x.isPlayer);
                                return engine.activateSetSpell(player, card, t || null);
                            }
                        } else if (!["none", "enemy_player", "self_player", "both_players"].includes(type)) {
                            const list = engine.getValidTargets(player, eff);
                            target = list.length ? list[Math.floor(rng() * list.length)] : null;
                        }
                        if (target && target.isPlayer) target = null;
                        if (supportsPlayerTarget) target = null;
                        return engine.activateSetSpell(player, card, target);
                    });
                }
            });
            if (state.pendingTribute) {
                const candidates = [...player.monsterZone].filter(c => !c.cannotUseAsMaterial);
                candidates.forEach(c => actions.push(() => engine.selectTribute(c)));
                actions.push(() => engine.confirmTribute(MONSTER_POSITION.ATTACK, false));
                actions.push(() => { engine.cancelTribute(); return { success: true }; });
            }
        }

        if (!state.firstTurn) {
            if (state.phase === PHASE.MAIN_1 || state.phase === PHASE.MAIN_2) {
                actions.push(() => { state.phase = PHASE.BATTLE; return { success: true }; });
            }
            if (state.phase === PHASE.BATTLE) {
                player.monsterZone.forEach(attacker => {
                    if (!attacker.canAttack || attacker.position !== MONSTER_POSITION.ATTACK || !attacker.faceUp) return;
                    opponent.monsterZone.forEach(t => actions.push(() => engine.attack(attacker, t)));
                    actions.push(() => engine.attack(attacker, "player"));
                });
            }
        }
        actions.push(() => { engine.endTurn(); return { success: true }; });

        const pick = actions[Math.floor(rng() * actions.length)];
        try {
            pick();
        } catch (error) {
            error.message = `ACTION THREW (g${gameIndex} step${steps} phase=${state.phase} turn=${state.turn}): ${error.message}\n${error.stack}`;
            throw error;
        }

        record(checkInvariants(engine, `g${gameIndex} step${steps} phase=${state.phase}`), `g${gameIndex} step${steps}`); PREV.clear(); for (const [k,v] of snapshotCards(state)) PREV.set(k, v);

        if (state.lastActionShouldEndTurn) break;
        // when the turn ended we must start the next one
        if (state.phase === PHASE.END) {
            if (engine.checkGameOver()) break;
            engine.startTurn();
            state.phase = PHASE.MAIN_1;
            if (state.gameOver) break;
            record(checkInvariants(engine, `g${gameIndex} turnstart${state.turn}`), `g${gameIndex} turnstart`);
        }
    }

    if (!state.gameOver) {
        throw new Error(`GAME DID NOT END (g${gameIndex}) after ${steps} steps, turn=${state.turn}, lp=${state.players.map(p => p.lp).join("/")}, deck=${state.players.map(p => p.deck.length).join("/")}`);
    }
    return { turns: state.turn, steps, winner: state.isDraw ? "draw" : state.winner };
}

const results = [];
const failures = [];
for (let i = 0; i < GAMES; i++) {
    try {
        results.push(playGame(i));
    } catch (error) {
        failures.push({ game: i, message: error.message });
        if (failures.length <= 8) console.error("THREW:", error.message.split("\n").slice(0, 4).join("\n"), "\n");
    }
}

const avgTurns = results.length ? (results.reduce((s, r) => s + r.turns, 0) / results.length).toFixed(1) : "n/a";
console.log(`games=${GAMES} ok=${results.length} failed=${failures.length} avgTurns=${avgTurns}`);
console.log(`winners A=${results.filter(r => r.winner === 0).length} B=${results.filter(r => r.winner === 1).length} draw=${results.filter(r => r.winner === "draw").length}`);
if (failures.length) {
    console.log(`\n--- thrown failures (first 10) ---`);
    for (const f of failures.slice(0, 10)) console.log(`game ${f.game}: ${f.message.split("\n")[0]}`);
}
console.log(`\n--- distinct invariant violations (${VIOLATIONS.size}) ---`);
for (const [key, entry] of [...VIOLATIONS.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`x${entry.count}  ${key}   [first: ${entry.first}]`);
}
if (failures.length || VIOLATIONS.size) process.exitCode = 1;

