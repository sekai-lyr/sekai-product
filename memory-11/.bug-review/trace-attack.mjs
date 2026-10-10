/**
 * Traces which code path leaves a monster with attacksMadeThisTurn>0
 * while hasAttackedThisTurn stays false at the END of an action.
 */
import { Player, GameState } from "../SekaiGame/src/main/resources/static/js/model.js";
import { GameEngine } from "../SekaiGame/src/main/resources/static/js/engine.js";
import { GAME_CONFIG, MONSTER_POSITION, PHASE } from "../SekaiGame/src/main/resources/static/js/constants.js";
import { ALL_CARDS } from "../SekaiGame/src/main/resources/static/js/catalog.js";

const GAME_INDEX = Number(process.argv[2] || 1);
const BASE_SEED = 777001;

function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function buildDeck(rng, size = 40) {
    const pool = ALL_CARDS.filter(c => c && c.id && c.type);
    const deck = [];
    while (deck.length < size) {
        const card = pool[Math.floor(rng() * pool.length)];
        if (deck.filter(c => c.id === card.id).length >= 3) continue;
        deck.push(card);
    }
    return deck;
}

const WRITES = new Map();
function instrument(card) {
    if (WRITES.has(card.instanceId)) return;
    WRITES.set(card.instanceId, []);
    let made = Number(card.attacksMadeThisTurn) || 0;
    let attacked = !!card.hasAttackedThisTurn;
    const log = (what, value) => {
        const buf = WRITES.get(card.instanceId) || [];
        buf.push({ card: card.name, what, value, stack: new Error("trace").stack.split("\n").slice(2, 6).map(s => s.trim()).join(" <- ") });
        if (buf.length > 10) buf.shift();
        WRITES.set(card.instanceId, buf);
    };
    Object.defineProperty(card, "attacksMadeThisTurn", {
        get() { return made; },
        set(v) { made = v; log("made", v); },
        configurable: true, enumerable: true,
    });
    Object.defineProperty(card, "hasAttackedThisTurn", {
        get() { return attacked; },
        set(v) { attacked = v; log("attacked", v); },
        configurable: true, enumerable: true,
    });
}

const rng = makeRng(BASE_SEED + GAME_INDEX * 7919);
const state = new GameState();
state.players = [new Player(`A${GAME_INDEX}`, buildDeck(rng)), new Player(`B${GAME_INDEX}`, buildDeck(rng))];
for (const p of state.players) for (const c of p.deck) instrument(c);

function findBad() {
    for (const p of state.players) {
        for (const c of [...p.monsterZone, ...p.hand, ...p.graveyard]) {
            if (Number(c.attacksMadeThisTurn) > 0 && c.hasAttackedThisTurn === false) return c;
        }
    }
    return null;
}

const engine = new GameEngine(state, rng);
for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) {
    engine.drawCard(state.players[0]);
    engine.drawCard(state.players[1]);
}
state.turn = 0; state.firstTurn = true; state.currentPlayerIndex = 0;
engine.startTurn({ skipDraw: true });
state.phase = PHASE.MAIN_1;

let steps = 0;
const history = [];
while (!state.gameOver && steps < 4000) {
    steps++;
    const player = state.currentPlayer;
    const opponent = state.opponentPlayer;
    const phaseIsMain = state.phase === PHASE.MAIN_1 || state.phase === PHASE.MAIN_2;
    const actions = [];
    const add = (label, fn) => actions.push({ label, fn });

    if (phaseIsMain) {
        if (!player.normalSummonUsed) {
            player.hand.forEach((card, index) => {
                if (card?.type !== "monster") return;
                const needed = engine.getTributeNeeded(card.level);
                if (player.monsterZone.length < needed) return;
                if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE && needed === 0) return;
                add(`summon#${index}:${card.name}`, () => {
                    const r = engine.normalSummon(player, index, MONSTER_POSITION.ATTACK, false);
                    if (r.needsTribute) {
                        [...player.monsterZone].filter(c => !c.cannotUseAsMaterial).slice(0, r.tributeNeeded).forEach(c => engine.selectTribute(c));
                        if (engine.state.pendingTribute) engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
                    }
                    return r;
                });
                add(`setMonster#${index}:${card.name}`, () => engine.setCard(player, index));
            });
        }
        player.hand.forEach((card, index) => {
            if (card?.type === "spell") {
                add(`spell#${index}:${card.name}`, () => {
                    const eff = card.effect || card.effects?.[0];
                    const type = engine.getEffectTargetType(eff);
                    const needs = !["none", "enemy_player", "self_player", "both_players"].includes(type);
                    const targets = needs ? engine.getValidTargets(player, eff) : [];
                    const target = needs ? targets[Math.floor(rng() * Math.max(1, targets.length))] : null;
                    return engine.activateSpell(player, index, target || null);
                });
            }
            if (card?.type === "spell" || card?.type === "trap") add(`setCard#${index}:${card.name}`, () => engine.setCard(player, index));
        });
        player.monsterZone.forEach(card => {
            if (!card.faceUp && card.setTurn !== state.turn) add(`flip:${card.name}`, () => engine.flipSummon(player, card));
            if (card.faceUp) add(`position:${card.name}`, () => engine.changePosition(player, card));
            if (card.faceUp) add(`effect:${card.name}`, () => {
                const eff = card.effect || card.effects?.[0];
                const targets = engine.getValidTargets(player, eff);
                const target = targets[Math.floor(rng() * Math.max(1, targets.length))];
                return engine.triggerEffect(player, card, target || null);
            });
        });
    }
    if (!state.firstTurn) {
        if (phaseIsMain) add("enterBattle", () => { state.phase = PHASE.BATTLE; return { success: true }; });
        if (state.phase === PHASE.BATTLE) {
            player.monsterZone.forEach(attacker => {
                if (!attacker.canAttack || attacker.position !== MONSTER_POSITION.ATTACK || !attacker.faceUp) return;
                opponent.monsterZone.forEach(t => add(`attack:${attacker.name}->${t.name}`, () => engine.attack(attacker, t)));
                add(`attackPlayer:${attacker.name}`, () => engine.attack(attacker, "player"));
            });
        }
    }
    add("endTurn", () => { engine.endTurn(); return { success: true }; });

    const pick = actions[Math.floor(rng() * actions.length)];
    history.push(pick.label);
    if (history.length > 18) history.shift();
    pick.fn();

    const bad = findBad();
    if (bad) {
        console.log(`BAD STATE after action: ${pick.label}`);
        console.log("recent actions:", history.join(" | "));
        const zone = state.players.flatMap((p, i) => [
            p.monsterZone.includes(bad) ? `P${i}:monster` : null,
            p.hand.includes(bad) ? `P${i}:hand` : null,
            p.graveyard.includes(bad) ? `P${i}:grave` : null,
        ]).filter(Boolean);
        console.log("card:", bad.name, "zone:", JSON.stringify(zone), "turn:", state.turn);
        for (const w of (WRITES.get(bad.instanceId) || [])) console.log(`  ${w.what}=${JSON.stringify(w.value)}\n     ${w.stack}`);
        break;
    }

    if (state.phase === PHASE.END) {
        if (engine.checkGameOver()) break;
        engine.startTurn();
        state.phase = PHASE.MAIN_1;
    }
}
console.log("done; final phase", state.phase, "turn", state.turn);
