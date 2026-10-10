/**
 * fuzz-invariants.mjs
 * 随机行为 + 逐动作状态不变量压测。
 *
 * 用法：node scripts/fuzz-invariants.mjs [局数] [随机种子]
 *
 * 每个动作之后都会校验：LP 是否有限且非负、区域数量上限、卡牌身份是否跨区域重复、
 * 攻守数值是否 NaN、回合级攻击计数是否自洽、阶段与待选择状态是否匹配、
 * 以及引擎自带的 checkStateIntegrity()。任何一项不满足都会以非 0 退出码结束，
 * 因此可以直接当作 CI 门禁（见 .github/workflows/ci.yml）。
 *
 * 之所以需要它：规则测试只能覆盖写下来的场景，而实战里 368 张卡的组合会让
 * 状态机跑到没人想到的角落——本轮的多个缺陷（召唤后无法攻击、祭品状态残留、
 * 衍生物 ID 撞车）都是靠这套压测才暴露出来的。
 */
import { Player, GameState } from "../js/model.js";
import { GameEngine } from "../js/engine.js";
import { GAME_CONFIG, MONSTER_POSITION, PHASE } from "../js/constants.js";
import { ALL_CARDS } from "../js/catalog.js";

const GAMES = Number(process.argv[2] || 100);
const BASE_SEED = Number(process.argv[3] || 20260101);

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
const VIOLATIONS = new Map();

function buildDeck(rng, size = 40) {
    const pool = ALL_CARDS.filter(card => card && card.id && card.type);
    const deck = [];
    while (deck.length < size) {
        const card = pool[Math.floor(rng() * pool.length)];
        if (deck.filter(item => item.id === card.id).length >= 3) continue;
        deck.push(card);
    }
    return deck;
}

function checkInvariants(engine) {
    const state = engine.state;
    const problems = [];
    for (const player of state.players) {
        if (!Number.isFinite(player.lp)) problems.push(`LP 非有限值: ${player.lp}`);
        if (player.lp < 0) problems.push(`LP 为负: ${player.lp}`);
        if (player.monsterZone.length > GAME_CONFIG.MAX_MONSTER_ZONE) problems.push("怪兽区超限");
        if (player.spellTrapZone.length > GAME_CONFIG.MAX_SPELL_TRAP_ZONE) problems.push("魔法陷阱区超限");
        for (const card of player.monsterZone) {
            if (card.type !== "monster") problems.push(`${card.name} 不是怪兽却在怪兽区`);
            if (!Number.isFinite(card.currentAttack) || !Number.isFinite(card.currentDefense)) {
                problems.push(`${card.name} 攻守为 NaN`);
            }
        }
        for (const card of player.spellTrapZone) {
            if (card.type === "monster") problems.push(`怪兽 ${card.name} 出现在魔法陷阱区`);
            if (card.type === "trap" && card.faceDown !== true) problems.push(`正面表示的陷阱 ${card.name} 留在后场`);
        }
        if (player === state.currentPlayer && state.phase !== PHASE.END) {
            for (const card of player.monsterZone) {
                const made = Number(card.attacksMadeThisTurn) || 0;
                const limit = card.doubleAttackThisTurn ? 2 : 1;
                if (made > limit) problems.push(`${card.name} 本回合攻击 ${made} 次超过上限 ${limit}`);
                if (made > 0 && card.hasAttackedThisTurn !== true) problems.push(`${card.name} 攻击计数与标记不一致`);
                if (card.canAttack && made >= limit) problems.push(`${card.name} 攻击次数用尽却仍标记可攻击`);
            }
        }
    }
    if (!LEGAL_PHASES.has(state.phase)) problems.push(`非法阶段: ${state.phase}`);
    if (state.phase === PHASE.TRIBUTE_SELECT && !state.pendingTribute) problems.push("祭品选择阶段却没有待处理祭品");
    if (state.pendingTribute && state.phase !== PHASE.TRIBUTE_SELECT) problems.push(`存在待处理祭品但阶段是 ${state.phase}`);
    problems.push(...engine.checkStateIntegrity());
    return problems;
}

function record(problems) {
    for (const problem of problems) {
        const key = problem.replace(/\[\d+\]/g, "[]");
        VIOLATIONS.set(key, (VIOLATIONS.get(key) || 0) + 1);
    }
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
    record(checkInvariants(engine));

    let steps = 0;
    while (!state.gameOver && steps < 4000) {
        steps++;
        const player = state.currentPlayer;
        const opponent = state.opponentPlayer;
        const isMain = state.phase === PHASE.MAIN_1 || state.phase === PHASE.MAIN_2;
        const actions = [];
        const add = (fn) => actions.push(fn);

        if (isMain) {
            if (!player.normalSummonUsed) {
                player.hand.forEach((card, index) => {
                    if (card?.type !== "monster") return;
                    const needed = engine.getTributeNeeded(card.level);
                    if (player.monsterZone.length < needed) return;
                    if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE && needed === 0) return;
                    add(() => {
                        const result = engine.normalSummon(player, index, MONSTER_POSITION.ATTACK, false);
                        if (result.needsTribute) {
                            [...player.monsterZone].filter(c => !c.cannotUseAsMaterial)
                                .slice(0, result.tributeNeeded).forEach(c => engine.selectTribute(c));
                            if (engine.state.pendingTribute) engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
                        }
                        return result;
                    });
                    add(() => engine.setCard(player, index));
                });
            }
            player.hand.forEach((card, index) => {
                if (card?.type === "spell") {
                    add(() => {
                        const effect = card.effect || card.effects?.[0];
                        const type = engine.getEffectTargetType(effect);
                        const needsTarget = !["none", "enemy_player", "self_player", "both_players"].includes(type);
                        const targets = needsTarget ? engine.getValidTargets(player, effect) : [];
                        const target = needsTarget && targets.length ? targets[Math.floor(rng() * targets.length)] : null;
                        return engine.activateSpell(player, index, target);
                    });
                }
                if (card?.type === "spell" || card?.type === "trap") add(() => engine.setCard(player, index));
            });
            player.monsterZone.forEach(card => {
                if (!card.faceUp && card.setTurn !== state.turn) add(() => engine.flipSummon(player, card));
                if (card.faceUp) add(() => engine.changePosition(player, card));
                if (card.faceUp) {
                    add(() => {
                        const effect = card.effect || card.effects?.[0];
                        const targets = engine.getValidTargets(player, effect);
                        const target = targets.length ? targets[Math.floor(rng() * targets.length)] : null;
                        return engine.triggerEffect(player, card, target);
                    });
                }
            });
            player.spellTrapZone.forEach(card => {
                if (card.type !== "spell" || !card.faceDown) return;
                add(() => {
                    const effect = card.effect || card.effects?.[0];
                    const type = engine.getEffectTargetType(effect);
                    const needsTarget = !["none", "enemy_player", "self_player", "both_players"].includes(type);
                    const targets = needsTarget ? engine.getValidTargets(player, effect) : [];
                    const target = needsTarget && targets.length ? targets[Math.floor(rng() * targets.length)] : null;
                    return engine.activateSetSpell(player, card, target);
                });
            });
        }
        if (!state.firstTurn) {
            if (isMain) add(() => { state.phase = PHASE.BATTLE; return { success: true }; });
            if (state.phase === PHASE.BATTLE) {
                player.monsterZone.forEach(attacker => {
                    if (!attacker.canAttack || attacker.position !== MONSTER_POSITION.ATTACK || !attacker.faceUp) return;
                    opponent.monsterZone.forEach(target => add(() => engine.attack(attacker, target)));
                    add(() => engine.attack(attacker, "player"));
                });
            }
        }
        add(() => { engine.endTurn(); return { success: true }; });

        actions[Math.floor(rng() * actions.length)]();
        record(checkInvariants(engine));

        if (state.phase === PHASE.END) {
            if (engine.checkGameOver()) break;
            engine.startTurn();
            state.phase = PHASE.MAIN_1;
        }
    }
    if (!state.gameOver) throw new Error(`第 ${gameIndex + 1} 局在 ${steps} 步内没有结束（回合 ${state.turn}）`);
    return { turns: state.turn, winner: state.isDraw ? "draw" : state.winner };
}

const results = [];
const failures = [];
for (let i = 0; i < GAMES; i++) {
    try {
        results.push(playGame(i));
    } catch (error) {
        failures.push(`第 ${i + 1} 局：${error.message}`);
    }
}

const violationCount = [...VIOLATIONS.values()].reduce((sum, count) => sum + count, 0);
const avgTurns = results.length ? (results.reduce((sum, item) => sum + item.turns, 0) / results.length).toFixed(1) : "n/a";
console.log(`压测 ${GAMES} 局：正常结束 ${results.length} 局，异常 ${failures.length} 局，平均 ${avgTurns} 回合`);
console.log(`胜负：A ${results.filter(r => r.winner === 0).length} / B ${results.filter(r => r.winner === 1).length} / 平局 ${results.filter(r => r.winner === "draw").length}`);
if (violationCount > 0) {
    console.log(`\n不变量违规 ${violationCount} 次：`);
    for (const [problem, count] of [...VIOLATIONS.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  x${count}  ${problem}`);
    }
}
for (const failure of failures.slice(0, 10)) console.log("  " + failure);
if (failures.length > 0 || violationCount > 0) process.exitCode = 1;
