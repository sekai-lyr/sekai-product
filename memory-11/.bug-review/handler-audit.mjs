import { ALL_CARDS } from "../SekaiGame/src/main/resources/static/js/catalog.js";
import { hasEffectHandler, GameEngine } from "../SekaiGame/src/main/resources/static/js/engine.js";
import { GameState, Player } from "../SekaiGame/src/main/resources/static/js/model.js";
import { themedEffectHandlers } from "../SekaiGame/src/main/resources/static/js/themed-effects.js";
import { PHASE } from "../SekaiGame/src/main/resources/static/js/constants.js";

const state = new GameState();
state.players = [new Player("A", []), new Player("B", [])];
state.phase = PHASE.MAIN_1;
const engine = new GameEngine(state);

const handlertypes = new Set(Object.keys(themedEffectHandlers));
console.log("themed handlers:", [...handlertypes].join(", "));

const missing = new Map();
const triggerless = new Map();
let effectCount = 0;
for (const card of ALL_CARDS) {
    const list = card.effects?.length ? card.effects : (card.effect ? [card.effect] : []);
    if (!list.length) continue;
    for (const eff of list) {
        effectCount++;
        if (!eff || !eff.type) { triggerless.set(card.id + ":" + card.name, "effect without type"); continue; }
        if (!hasEffectHandler(eff.type)) {
            const key = eff.type;
            const entry = missing.get(key) || { count: 0, cards: [] };
            entry.count++;
            if (entry.cards.length < 4) entry.cards.push(`${card.id}/${card.name}`);
            missing.set(key, entry);
        }
    }
}
console.log(`\ntotal effect entries: ${effectCount}`);
console.log(`distinct cards: ${new Set(ALL_CARDS.map(c => c.id)).size}`);
console.log(`\n=== effect types WITH NO HANDLER (${missing.size}) ===`);
for (const [type, entry] of [...missing.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${type}  x${entry.count}  e.g. ${entry.cards.join(", ")}`);
}
if (triggerless.size) {
    console.log(`\n=== malformed effects (${triggerless.size}) ===`);
    for (const [k, v] of triggerless) console.log(`  ${k}: ${v}`);
}

// also: handler implemented but never referenced by any card (dead handler)
const usedTypes = new Set();
for (const card of ALL_CARDS) {
    for (const eff of (card.effects?.length ? card.effects : (card.effect ? [card.effect] : []))) {
        if (eff?.type) usedTypes.add(eff.type);
    }
}
