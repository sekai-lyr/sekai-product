import { GameState, Player, createCardInstance } from "../SekaiGame/src/main/resources/static/js/model.js";
import { GameEngine } from "../SekaiGame/src/main/resources/static/js/engine.js";
import { PHASE } from "../SekaiGame/src/main/resources/static/js/constants.js";

const state = new GameState();
state.players = [new Player("P1", []), new Player("P2", [])];
state.currentPlayerIndex = 0;
state.turn = 6;
state.firstTurn = false;
state.phase = PHASE.MAIN_1;
const engine = new GameEngine(state);

const removal = createCardInstance({
    id: "remove_trap_test", name: "除魔", type: "spell", rarity: "N",
    effects: [{ trigger: "manual", type: "destroySpellTrap", value: 0 }],
});
const trap = createCardInstance({ id: "trap_target_test", name: "测试陷阱", type: "trap", rarity: "N", effects: [] });
trap.faceDown = true; trap.canActivate = true; trap.setTurn = 4;
state.players[1].spellTrapZone.push(trap);
state.players[0].hand.push(removal);

// 1. Player sets the spell face-down during an earlier turn
const set = engine.setCard(state.players[0], 0);
console.log("setCard:", set.success, set.message);
removal.setTurn = state.turn - 2; // pretend it was set two turns ago

// 2. UI click asks whether it can be activated
const check = engine.canActivateSetSpell(state.players[0], removal);
console.log("canActivateSetSpell ->", check);

// 3. Controller switches to TARGET_SELECT (exactly what controller.activateSetSpell does)
state.phase = PHASE.TARGET_SELECT;
state.validTargets = engine.getValidTargets(state.players[0], removal.effects[0]);
console.log("validTargets:", state.validTargets.map(t => t.name));

// 4. Controller confirms the target
const result = engine.activateSetSpell(state.players[0], removal, trap);
console.log("activateSetSpell ->", result.success, "|", result.message);
console.log("trap still on opponent field:", state.players[1].spellTrapZone.includes(trap));
console.log("spell still in own spell/trap zone:", state.players[0].spellTrapZone.includes(removal));
state.phase = PHASE.MAIN_1;
