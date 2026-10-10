import { ALL_CARDS } from "../src/main/resources/static/js/catalog.js";
import { AI_STAGES, buildStageDeck } from "../src/main/resources/static/js/stages.js";
import { GameState, Player } from "../src/main/resources/static/js/model.js";
import { GameEngine } from "../src/main/resources/static/js/engine.js";
import { GameController } from "../src/main/resources/static/js/controller.js";
import { GAME_CONFIG, MONSTER_POSITION, PHASE } from "../src/main/resources/static/js/constants.js";
import { SeededRandom } from "../src/main/resources/static/js/rng.js";

globalThis.document = {
    body: { appendChild() {} },
    createElement() { return { style: {}, remove() {} }; },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
};

const TRIALS_PER_STAGE = Number(process.env.AI_TRIALS || 1000);
const MAX_TURNS = Number(process.env.AI_MAX_TURNS || 160);
const stageFilter = process.env.AI_STAGE || "";
const stagesToRun = stageFilter
    ? AI_STAGES.filter(stage => stage.id === stageFilter || String(stage.order) === stageFilter)
    : AI_STAGES;
const cardById = new Map(ALL_CARDS.map(card => [card.id, card]));

function makeUi() {
    return {
        addLog() {},
        render() {},
        refresh() {},
        cardHTML() { return ""; },
        showAiAction() {},
    };
}

function buildCards(deck) {
    return deck.main.map(id => cardById.get(id)).filter(Boolean);
}

function withAiPlayer(controller, playerIndex, action) {
    if (playerIndex === 1) return action();

    // 控制器的AI决策原本固定使用players[1]。交换数组视图，
    // 让同一套真实AI决策也能无副本地测试先手玩家。
    const state = controller.state;
    const players = state.players;
    const currentIndex = state.currentPlayerIndex;
    state.players = [players[1], players[0]];
    state.currentPlayerIndex = 1;
    try {
        return action();
    } finally {
        state.players = players;
        state.currentPlayerIndex = currentIndex;
    }
}

function createController(stage, gameIndex) {
    const random = new SeededRandom(`${stage.id}:${gameIndex}`);
    const deck = buildStageDeck(stage);
    const cards = buildCards(deck);
    const state = new GameState();
    const shuffleRandom = () => random.next();
    state.players = [
        new Player("AI-A", cards, shuffleRandom),
        new Player("AI-B", cards, shuffleRandom),
    ];
    const engine = new GameEngine(state, random);
    const controller = new GameController(state, engine, makeUi());
    controller.mode = "ai";
    controller.aiProfile = stage.ai;
    controller.aiMaxMainActions = stage.ai.maxMainActions;
    controller.aiActionDelay = 0;
    controller.refresh = () => {};
    controller.checkAndRefresh = () => {};
    controller._lockForEffect = () => {};
    controller._releaseEffectLocks = () => {};
    return { state, engine, controller };
}

function runMain(controller, playerIndex, stats) {
    return withAiPlayer(controller, playerIndex, () => {
        const state = controller.state;
        let actions = 0;
        while (actions < controller.aiMaxMainActions) {
            const action = controller._chooseAiPlayAction();
            if (action) {
                const result = controller._executeAiPlayAction(action);
                if (!result?.success) {
                    stats.failedAiActions++;
                    break;
                }
                stats.actionTrace.push({
                    turn: state.turn,
                    player: state.currentPlayer.name,
                    kind: action.kind,
                    card: action.instanceId,
                    result: result.message,
                });
                stats.mainActions++;
                actions++;
                continue;
            }

            const monsterEffect = controller._activateAiMonsterEffect();
            if (!monsterEffect) break;
            stats.manualMonsterEffects++;
            actions++;
        }
        state.phase = PHASE.MAIN_1;
    });
}

function validateState(state) {
    const issues = [];
    const seen = new Set();
    const zones = [];

    for (const player of state.players) {
        if (!Number.isFinite(player.lp) || player.lp < 0 || player.lp > player.maxLp) {
            issues.push(`${player.name}: LP=${player.lp}`);
        }
        if (player.monsterZone.length > GAME_CONFIG.MAX_MONSTER_ZONE) issues.push(`${player.name}: 怪兽区超限`);
        if (player.spellTrapZone.length > GAME_CONFIG.MAX_SPELL_TRAP_ZONE) issues.push(`${player.name}: 后场超限`);
        zones.push(
            ...player.deck,
            ...player.hand,
            ...player.monsterZone,
            ...player.spellTrapZone,
            ...player.graveyard,
            ...player.banished,
            ...(player.fieldZone ? [player.fieldZone] : []),
            ...(player._tempBanished || []).map(entry => entry.card),
        );

        for (const monster of player.monsterZone) {
            if (!Number.isFinite(monster.currentAttack) || monster.currentAttack < 0) issues.push(`${monster.name}: ATK=${monster.currentAttack}`);
            if (!Number.isFinite(monster.currentDefense) || monster.currentDefense < 0) issues.push(`${monster.name}: DEF=${monster.currentDefense}`);
            const limit = monster.doubleAttackThisTurn || monster.attackTwiceThisTurn ? 2 : 1;
            if ((Number(monster.attacksMadeThisTurn) || 0) > limit) issues.push(`${monster.name}: 攻击次数超限`);
            if ((Number(monster.attacksMadeThisTurn) || 0) >= limit && monster.canAttack) {
                issues.push(`${monster.name}: 攻击次数耗尽仍可攻击（${monster.attacksMadeThisTurn}/${limit}, pos=${monster.position}, faceUp=${monster.faceUp}, cannotAttack=${monster.cannotAttack}, attackLocked=${monster.attackLocked}, double=${monster.doubleAttackThisTurn}, twice=${monster.attackTwiceThisTurn}）`);
            }
            if (monster.canAttack && (!monster.faceUp || monster.position !== MONSTER_POSITION.ATTACK || monster.cannotAttack)) {
                issues.push(`${monster.name}: 可攻击状态与场上状态不一致（pos=${monster.position}, faceUp=${monster.faceUp}, cannotAttack=${monster.cannotAttack}, attackLocked=${monster.attackLocked}）`);
            }
        }
    }

    for (const card of zones) {
        if (!card?.instanceId) continue;
        if (seen.has(card.instanceId)) issues.push(`${card.name}: 卡牌跨区域重复`);
        seen.add(card.instanceId);
    }
    if (!Number.isInteger(state.turn) || state.turn < 1) issues.push(`回合号无效: ${state.turn}`);
    return issues;
}

function snapshotMonsters(state) {
    return state.players.map(player => ({
        player: player.name,
        monsters: player.monsterZone.map(monster => ({
            name: monster.name,
            instanceId: monster.instanceId,
            position: monster.position,
            faceUp: monster.faceUp,
            canAttack: monster.canAttack,
            cannotAttack: monster.cannotAttack,
            attackLocked: monster.attackLocked,
            attacksMadeThisTurn: monster.attacksMadeThisTurn,
            doubleAttackThisTurn: monster.doubleAttackThisTurn,
            frozenUntil: monster.themedState?.frozenUntil,
        })),
    }));
}

function simulate(stage, gameIndex) {
    const { state, engine, controller } = createController(stage, gameIndex);
    const stats = {
        turns: 0,
        mainActions: 0,
        manualMonsterEffects: 0,
        failedAiActions: 0,
        effectCalls: 0,
        effectTypes: new Set(),
        effectTrace: [],
        actionTrace: [],
        attackTrace: [],
        stateTrace: [],
        errors: [],
        integrityIssues: [],
    };

    const executeEffect = engine._executeEffect.bind(engine);
    engine._executeEffect = (...args) => {
        const effect = args[2];
        stats.effectCalls++;
        if (effect?.type) stats.effectTypes.add(effect.type);
        stats.effectTrace.push({
            turn: engine.state.turn,
            card: args[1]?.name,
            type: effect?.type,
            trigger: effect?.trigger,
        });
        return executeEffect(...args);
    };
    const executeAttack = engine.attack.bind(engine);
    engine.attack = (attacker, target) => {
        const result = executeAttack(attacker, target);
        stats.attackTrace.push({
            turn: state.turn,
            attacker: attacker?.name,
            attackerId: attacker?.instanceId,
            target: target === "player" ? "player" : target?.name,
            result: result?.message,
            success: result?.success,
            attacksMade: attacker?.attacksMadeThisTurn,
            canAttack: attacker?.canAttack,
            cannotAttack: attacker?.cannotAttack,
        });
        return result;
    };

    for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) {
        engine.drawCard(state.players[0]);
        engine.drawCard(state.players[1]);
    }
    state.turn = 0;
    state.firstTurn = true;
    state.currentPlayerIndex = 0;
    engine.startTurn({ skipDraw: true });
    state.phase = PHASE.MAIN_1;

    while (!state.gameOver && stats.turns < MAX_TURNS) {
        const playerIndex = state.currentPlayerIndex;
        try {
            runMain(controller, playerIndex, stats);
            if (!state.gameOver) {
                state.phase = PHASE.BATTLE;
                if (!state.firstTurn && !state.currentPlayer.skipBattlePhase) {
                    withAiPlayer(controller, playerIndex, () => controller._aiAttack());
                }
                engine.checkGameOver();
            }
            stats.stateTrace.push({ turn: state.turn, phase: state.phase, currentPlayer: state.currentPlayer.name, monsters: snapshotMonsters(state) });
            if (stats.stateTrace.length > 12) stats.stateTrace.shift();
            const issues = validateState(state);
            if (issues.length) {
                stats.integrityIssues.push({ turn: state.turn, issues, effectTrace: stats.effectTrace.slice(-12), actionTrace: stats.actionTrace.slice(-20), attackTrace: stats.attackTrace.slice(-20), stateTrace: stats.stateTrace });
                break;
            }
        } catch (error) {
            stats.errors.push({ turn: state.turn, message: error?.stack || String(error) });
            break;
        }

        if (state.gameOver) break;
        engine.endTurn();
        const draw = engine.startTurn();
        state.phase = PHASE.MAIN_1;
        stats.turns++;
        if (draw?.deckOut) engine.checkGameOver();
    }

    return {
        completed: state.gameOver,
        draw: state.isDraw,
        winner: state.isDraw ? "draw" : state.winner,
        turn: state.turn,
        reason: state.winReason,
        stats,
    };
}

const report = {
    stages: stagesToRun.length,
    trialsPerStage: TRIALS_PER_STAGE,
    totalGames: 0,
    completedGames: 0,
    draws: 0,
    unfinishedGames: 0,
    errors: [],
    integrityIssues: [],
    failedAiActions: 0,
    effectCalls: 0,
    effectTypes: new Set(),
    stageResults: [],
};

const startedAt = Date.now();
for (const stage of stagesToRun) {
    const stageResult = {
        id: stage.id,
        name: stage.name,
        games: 0,
        completed: 0,
        draws: 0,
        unfinished: 0,
        errors: 0,
        integrityIssues: 0,
        averageTurns: 0,
        effectCalls: 0,
        effectTypes: new Set(),
    };
    let totalTurns = 0;
    for (let gameIndex = 1; gameIndex <= TRIALS_PER_STAGE; gameIndex++) {
        const result = simulate(stage, gameIndex);
        stageResult.games++;
        totalTurns += result.turn;
        stageResult.effectCalls += result.stats.effectCalls;
        result.stats.effectTypes.forEach(type => stageResult.effectTypes.add(type));
        report.totalGames++;
        report.effectCalls += result.stats.effectCalls;
        result.stats.effectTypes.forEach(type => report.effectTypes.add(type));
        report.failedAiActions += result.stats.failedAiActions;

        if (result.completed) {
            stageResult.completed++;
            report.completedGames++;
        } else {
            stageResult.unfinished++;
            report.unfinishedGames++;
            report.errors.push({ stage: stage.id, game: gameIndex, turn: result.turn, reason: result.reason || "超过回合上限" });
        }
        if (result.draw) {
            stageResult.draws++;
            report.draws++;
        }
        if (result.stats.errors.length) {
            stageResult.errors += result.stats.errors.length;
            report.errors.push(...result.stats.errors.map(error => ({ stage: stage.id, game: gameIndex, ...error })));
        }
        if (result.stats.integrityIssues.length) {
            stageResult.integrityIssues += result.stats.integrityIssues.length;
            report.integrityIssues.push(...result.stats.integrityIssues.map(issue => ({ stage: stage.id, game: gameIndex, ...issue })));
        }
    }
    stageResult.averageTurns = Number((totalTurns / Math.max(1, stageResult.games)).toFixed(2));
    report.stageResults.push({ ...stageResult, effectTypes: [...stageResult.effectTypes].sort() });
    console.error(`${stage.id} ${stage.name}: ${stageResult.completed}/${stageResult.games} 完成，平均${stageResult.averageTurns}回合，效果调用${stageResult.effectCalls}`);
}

report.elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));
report.effectTypes = [...report.effectTypes].sort();
report.effectTypeCount = report.effectTypes.length;
const output = process.env.AI_FULL_REPORT === "1"
    ? report
    : {
        ...report,
        errors: report.errors.slice(0, 20),
        integrityIssues: report.integrityIssues.slice(0, 20),
        truncatedErrors: Math.max(0, report.errors.length - 20),
        truncatedIntegrityIssues: Math.max(0, report.integrityIssues.length - 20),
    };
console.log(JSON.stringify(output, null, 2));

if (report.totalGames !== report.completedGames || report.errors.length || report.integrityIssues.length) {
    process.exitCode = 1;
}
