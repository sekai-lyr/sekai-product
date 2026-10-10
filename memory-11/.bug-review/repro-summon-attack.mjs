import { GameState, Player, createCardInstance } from "../SekaiGame/src/main/resources/static/js/model.js";
import { GameEngine } from "../SekaiGame/src/main/resources/static/js/engine.js";
import { PHASE, MONSTER_POSITION } from "../SekaiGame/src/main/resources/static/js/constants.js";

const state = new GameState();
state.players = [new Player("P1", []), new Player("P2", [])];
state.currentPlayerIndex = 0;
state.turn = 8;
state.firstTurn = false;
state.phase = PHASE.MAIN_1;
const engine = new GameEngine(state);
const me = state.players[0];

// A monster that already fought earlier in the duel.
const veteran = createCardInstance({ id: "veteran", name: "老兵怪兽", type: "monster", level: 4, attack: 1800, defense: 1200, effects: [] });
me.monsterZone.push(veteran);
veteran.canAttack = true;
veteran.setTurn = 2;

// --- it is tributed for a higher-level summon (engine.destroyMonster writes
//     hasAttackedThisTurn = true / attacksMadeThisTurn = 1 before it hits the GY)
state.players[1].monsterZone.push(createCardInstance({ id: "t", name: "祭品目标", type: "monster", level: 8, attack: 3000, defense: 2500, effects: [] }));
const bigOne = createCardInstance({ id: "big", name: "上级怪兽", type: "monster", level: 6, attack: 2400, defense: 2000, effects: [] });
me.hand.push(bigOne);
engine.normalSummon(me, 0, MONSTER_POSITION.ATTACK, false);
engine.selectTribute(veteran);
engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
console.log("veteran in graveyard:", me.graveyard.includes(veteran), "made =", veteran.attacksMadeThisTurn);

// --- a themed "recycle" effect returns the top 3 graveyard cards to the deck
//     (themed-effects.js case "recycle" -> move() does not reset runtime state)
me.graveyard = me.graveyard.filter(c => c !== veteran);
me.deck.push(veteran);
console.log("veteran back in deck, made =", veteran.attacksMadeThisTurn);

// --- it is drawn again on a later turn and normal summoned fresh
state.turn = 10;
state.currentPlayerIndex = 0;
me.normalSummonUsed = false;
me.monsterZone.length = 0;
me.hand.push(veteran);
const index = me.hand.indexOf(veteran);
const summon = engine.normalSummon(me, index, MONSTER_POSITION.ATTACK, false);
console.log("re-summon:", summon.success, summon.message);
console.log("canAttack =", veteran.canAttack, "| hasAttackedThisTurn =", veteran.hasAttackedThisTurn, "| attacksMadeThisTurn =", veteran.attacksMadeThisTurn);

state.phase = PHASE.BATTLE;
state.players[1].monsterZone.length = 0;
const attack = engine.attack(veteran, "player");
console.log("ATTACK RESULT:", attack.success, "|", attack.message);
console.log("opponent LP:", state.players[1].lp, "(expected", 8000 - 1800 + ")");
