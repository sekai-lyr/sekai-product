/**
 * self-play-balance.mjs
 * 平衡实验室：用同一套 AI 驱动跑不同构筑取向的卡组，输出可用作平衡依据的统计。
 *
 * 用法：node scripts/self-play-balance.mjs [每对局数]
 *
 * 输出：
 *   - 各构筑取向的胜率（曲线速攻 / 高星压制 / 魔法 / 陷阱）
 *   - 平均回合数、先手胜率
 *   - 各取向卡组的平均星数曲线与平均攻击力
 *
 * 为什么需要它：卡池里有 78 张 7 星怪兽（需要 2 只祭品）、91 张 ATK≥2500，
 * 而免祭品的 ≤4 星怪兽只有 79 张。这种分布到底让"低曲线速攻"和"高星压制"
 * 谁更强，靠感觉判断会出错——用数据跑一遍才有结论。
 */
import { Player, GameState } from "../js/model.js";
import { GameEngine, BATTLE_RULES } from "../js/engine.js";
import { GAME_CONFIG, MONSTER_POSITION, PHASE } from "../js/constants.js";
import { ALL_CARDS } from "../js/catalog.js";

// 支持 --traps=2 / --negate=0 之类的参数做 A/B 实验
// （例如验证"一次攻击允许几张陷阱连锁"或"完全禁用攻击无效化"是否改变强弱格局）
const trapArg = process.argv.find(value => value.startsWith("--traps="));
if (trapArg) BATTLE_RULES.maxResponseTraps = Math.max(1, Number(trapArg.split("=")[1]) || 1);
const negateArg = process.argv.find(value => value.startsWith("--negate="));
if (negateArg) BATTLE_RULES.maxAttackNegationsPerTurn = Math.max(0, Number(negateArg.split("=")[1]) || 0);
const costArg = process.argv.find(value => value.startsWith("--cost="));
if (costArg) BATTLE_RULES.attackNegationLpCost = Math.max(0, Number(costArg.split("=")[1]) || 0);
const ROUNDS_PER_PAIR = Number(process.argv.find(value => /^\d+$/.test(value)) || 200);
// --trapmax=N：构筑时限制陷阱张数（0 = 不限制）。
// 用来回答"陷阱取向过强，是因为无效化，还是因为一个卡组里塞了 20 张免费防守"。
const trapMaxArg = process.argv.find(value => value.startsWith("--trapmax="));
const TRAP_CAP = trapMaxArg ? Math.max(0, Number(trapMaxArg.split("=")[1]) || 0) : 0;
const trapCount = deck => deck.filter(card => card.type === "trap").length;
console.log(`战斗规则：连锁上限 ${BATTLE_RULES.maxResponseTraps} 张／每回合无效化 ${BATTLE_RULES.maxAttackNegationsPerTurn} 次／每次支付 ${BATTLE_RULES.attackNegationLpCost} LP／陷阱上限 ${TRAP_CAP || "不限"}`);

function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const POOL = ALL_CARDS.filter(card => card.enabled !== false && card.type);
const isMonster = card => card.type === "monster";
const isLowMonster = card => isMonster(card) && (Number(card.level) || 0) <= 4;
const isHighMonster = card => isMonster(card) && (Number(card.level) || 0) >= 5;
const byAttack = card => (card.attack || 0) + (card.effects?.length || 0) * 120;
const byLevelThenAttack = card => (Number(card.level) || 0) * 100 + (card.attack || 0) / 4;
const byEffectCount = card => (card.effects?.length || 0) * 100 + (card.rarity === "UR" ? 30 : 0);
/**
 * 默认按"效果数"排序会让魔法画像只拿 3 效果的 UR/SSR 魔法——2 效果的实用卡
 * （例如 SR 的拆除）永远进不了卡组，于是实验室**看不到"后场对策"这条轴**。
 * --spellmix=1 改成真实玩家会做的事：在后场对策上加权，顺手凑齐几张拆除。
 */
const SPELL_MIX = process.argv.includes("--spellmix=1");
const answersBackrow = card => (card.effects || []).some(effect =>
    ["destroySpellTrap", "destroyAllEnemySpellTraps", "bounceBackrow", "disarm"].includes(effect.action || effect.type));
const spellScore = card => SPELL_MIX
    ? (card.effects?.length || 0) * 60 + ({ UR: 30, SSR: 20, SR: 10 }[card.rarity] || 0) + (answersBackrow(card) ? 500 : 0)
    : byEffectCount(card);

/**
 * 按"分类占比"配牌，而不是单纯按打分排序——否则高星卡永远把低星卡挤出卡组，
 * "高星+祭品底子"这种真实构筑根本复现不出来，统计结论也就不可信。
 */
function compose(size, plan, rng) {
    const deck = [];
    const counts = new Map();
    const take = (candidates, quota, score) => {
        let taken = 0;
        for (const card of [...candidates].sort((a, b) => score(b) - score(a))) {
            if (taken >= quota) break;
            if (TRAP_CAP > 0 && card.type === "trap" && trapCount(deck) >= TRAP_CAP) continue;
            const used = counts.get(card.id) || 0;
            if (used >= 3) continue;
            counts.set(card.id, used + 1);
            deck.push(card);
            taken++;
        }
    };
    for (const step of plan) take(POOL.filter(step.match), Math.round(size * step.ratio), step.score || byAttack);
    while (deck.length < size) {
        const card = POOL[Math.floor(rng() * POOL.length)];
        if (TRAP_CAP > 0 && card.type === "trap" && trapCount(deck) >= TRAP_CAP) continue;
        const used = counts.get(card.id) || 0;
        if (used >= 3) continue;
        counts.set(card.id, used + 1);
        deck.push(card);
    }
    return deck;
}

const PROFILES = {
    curve: { plan: [{ match: isLowMonster, ratio: 0.72 }, { match: card => !isMonster(card), ratio: 0.25 }] },
    big: { plan: [{ match: isHighMonster, ratio: 0.78 }] },
    hybrid: { plan: [{ match: isLowMonster, ratio: 0.36 }, { match: isHighMonster, ratio: 0.36, score: byLevelThenAttack }, { match: card => !isMonster(card), ratio: 0.25, score: byEffectCount }] },
    spell: { plan: [{ match: card => card.type === "spell", ratio: 0.5, score: spellScore }, { match: isLowMonster, ratio: 0.42 }] },
    trap: { plan: [{ match: card => card.type === "trap", ratio: 0.5, score: byEffectCount }, { match: isLowMonster, ratio: 0.42 }] },
};

function buildDeck(profile, rng, size = 40) {
    return compose(size, profile.plan, rng);
}

function deckStats(deck) {
    const monsters = deck.filter(card => card.type === "monster");
    const low = monsters.filter(card => (Number(card.level) || 0) <= 4).length;
    const avgAtk = monsters.length ? monsters.reduce((sum, card) => sum + (card.attack || 0), 0) / monsters.length : 0;
    return { monsters: monsters.length, low, high: monsters.length - low, avgAtk: Math.round(avgAtk) };
}

/** 统计陷阱实际结算情况，用来判断"某个取向过强"到底由哪种效果造成。 */
const trapStats = { byType: {}, canceled: 0, fired: 0, attacks: 0, chainLen: {}, consumed: {} };

function playOne(seed, deckA, deckB, firstIsA) {
    const rng = makeRng(seed);
    const state = new GameState();
    state.players = [new Player("A", deckA, rng), new Player("B", deckB, rng)];
    const engine = new GameEngine(state, rng);
    for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) {
        engine.drawCard(state.players[0]);
        engine.drawCard(state.players[1]);
    }
    state.turn = 0;
    state.firstTurn = true;
    state.currentPlayerIndex = firstIsA ? 0 : 1;
    engine.startTurn({ skipDraw: true });
    state.phase = PHASE.MAIN_1;

    let turns = 0;
    while (!state.gameOver && turns < 60) {
        turns++;
        const player = state.currentPlayer;
        const opponent = state.opponentPlayer;

        if (!player.normalSummonUsed) {
            const choice = player.hand
                .map((card, index) => ({ card, index, needed: card?.type === "monster" ? engine.getTributeNeeded(card.level) : 99, atk: card?.attack || 0 }))
                .filter(item => item.card?.type === "monster"
                    && player.monsterZone.length >= item.needed
                    && (player.monsterZone.length < GAME_CONFIG.MAX_MONSTER_ZONE || item.needed > 0))
                .sort((a, b) => b.atk - a.atk)[0];
            if (choice) {
                const result = engine.normalSummon(player, choice.index, MONSTER_POSITION.ATTACK, false);
                if (result.needsTribute) {
                    [...player.monsterZone]
                        .filter(card => !card.cannotUseAsMaterial)
                        .sort((a, b) => (a.currentAttack || 0) - (b.currentAttack || 0))
                        .slice(0, result.tributeNeeded)
                        .forEach(card => engine.selectTribute(card));
                    if (state.pendingTribute) engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
                }
            }
        }

        let spellActions = 0;
        while (spellActions < 2) {
            const index = player.hand.findIndex(card => card?.type === "spell" && engine.canPlayEffect(player, card).canPlay);
            if (index < 0) break;
            const card = player.hand[index];
            const effect = card.effect || card.effects?.[0];
            const type = engine.getEffectTargetType(effect);
            const needsTarget = !["none", "enemy_player", "self_player", "both_players"].includes(type);
            const targets = needsTarget ? engine.getValidTargets(player, effect) : [];
            const target = needsTarget && targets.length ? targets[0] : null;
            const result = engine.activateSpell(player, index, target);
            if (!result.success) break;
            spellActions++;
            if (engine.checkGameOver()) break;
        }

        if (player.spellTrapZone.length < GAME_CONFIG.MAX_SPELL_TRAP_ZONE) {
            const trapIndex = player.hand.findIndex(card => card?.type === "trap");
            if (trapIndex >= 0) engine.setCard(player, trapIndex);
        }

        if (!state.firstTurn) {
            state.phase = PHASE.BATTLE;
            // 攻击顺序：对方有盖放陷阱时先用"最弱怪"试探（骗掉陷阱），否则用最强怪压血。
            // 这是真实玩家的标准打法，缺了它会把"对手有陷阱"误判成"对手无敌"。
            const opponentHasSetTraps = opponent.spellTrapZone.some(card => card.type === "trap" && card.faceDown);
            const orderedAttackers = [...player.monsterZone].sort((a, b) => opponentHasSetTraps
                ? (a.currentAttack || 0) - (b.currentAttack || 0)
                : (b.currentAttack || 0) - (a.currentAttack || 0));
            for (const attacker of orderedAttackers) {
                if (state.gameOver) break;
                if (!attacker.canAttack || attacker.cannotAttack || attacker.position !== MONSTER_POSITION.ATTACK) continue;
                // 只攻击能打赢的目标，避免随机送怪污染统计
                const options = opponent.monsterZone.map(target => {
                    const previewLook = engine.predictBattle(attacker, target);
                    return previewLook && (previewLook.outcome === "destroy" || previewLook.damageTo !== "attacker") ? target : null;
                }).filter(Boolean);
                const target = options.length ? options.sort((a, b) => (a.currentDefense || 0) - (b.currentDefense || 0))[0]
                    : (opponent.monsterZone.length === 0 ? "player" : null);
                if (!target) continue;
                trapStats.attacks++;
                // 一次攻击吃掉几张盖放陷阱：连锁上限的直接观测指标。
                // 无效化为主时这个数字接近 1（第一张就取消攻击、链断开），
                // 无效化变少之后才可能真的出现"一次攻击连吃两张"。
                const trapsBefore = opponent.spellTrapZone.length;
                const attackResult = engine.attack(attacker, target);
                const eaten = trapsBefore - opponent.spellTrapZone.length;
                if (eaten > 0) trapStats.consumed[eaten] = (trapStats.consumed[eaten] || 0) + 1;
                if (attackResult?.trap) {
                    trapStats.fired++;
                    if (attackResult.attackCanceled) trapStats.canceled++;
                    const type = (attackResult.trapCard?.effects || []).map(e => e.action || e.type).join("+") || "unknown";
                    trapStats.byType[type] = (trapStats.byType[type] || 0) + 1;
                }
                if (engine.checkGameOver()) break;
            }
        }
        if (engine.checkGameOver()) break;
        engine.endTurn();
        engine.startTurn();
        state.phase = PHASE.MAIN_1;
    }
    if (!state.gameOver) return { winner: null, turns };
    return { winner: state.isDraw ? "draw" : state.winner, turns };
}

const names = Object.keys(PROFILES);
const rng = makeRng(20260101);
const decks = {};
for (const name of names) decks[name] = buildDeck(PROFILES[name], rng);

console.log("=== 各构筑取向的卡组构成 ===");
console.log("取向        低星/高星  怪兽  陷阱  平均ATK");
for (const name of names) {
    const stats = deckStats(decks[name]);
    console.log(`${name.padEnd(10)}  ${String(stats.low).padStart(2)}/${String(stats.high).padStart(2)}      ${String(stats.monsters).padStart(3)}   ${String(trapCount(decks[name])).padStart(3)}   ${String(stats.avgAtk).padStart(5)}`);
}

console.log(`\n=== 两两对战（每对 ${ROUNDS_PER_PAIR} 局，先手交替）===`);
const wins = Object.fromEntries(names.map(name => [name, 0]));
const plays = Object.fromEntries(names.map(name => [name, 0]));
const allTurns = [];
let firstPlayerWins = 0;
let decided = 0;

for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
        const a = names[i], b = names[j];
        for (let round = 0; round < ROUNDS_PER_PAIR; round++) {
            const firstIsA = round % 2 === 0;
            const result = playOne(1000 + i * 137 + j * 31 + round, decks[a], decks[b], firstIsA);
            allTurns.push(result.turns);
            plays[a]++; plays[b]++;
            if (result.winner === 0) { wins[a]++; firstPlayerWins += firstIsA ? 1 : 0; decided++; }
            else if (result.winner === 1) { wins[b]++; firstPlayerWins += firstIsA ? 0 : 1; decided++; }
        }
    }
}

console.log("取向        胜率      场次");
for (const name of names) {
    const rate = plays[name] ? (wins[name] / plays[name] * 100).toFixed(1) : "0.0";
    console.log(`${name.padEnd(10)}  ${rate.padStart(5)}%   ${plays[name]}`);
}
const avgTurns = allTurns.reduce((sum, value) => sum + value, 0) / allTurns.length;
console.log(`\n平均回合数：${avgTurns.toFixed(1)}（最短 ${Math.min(...allTurns)}，最长 ${Math.max(...allTurns)}）`);
console.log(`先手胜率：${(firstPlayerWins / Math.max(1, decided) * 100).toFixed(1)}%（已决出 ${decided} 局）`);
console.log("\n提示：先手胜率显著高于 50% 说明先后手不平衡；某个取向胜率压倒性领先说明卡池曲线偏斜。");

console.log("\n=== 陷阱结算统计 ===");
console.log(`攻击 ${trapStats.attacks} 次｜陷阱响应 ${trapStats.fired} 次（${(trapStats.fired / Math.max(1, trapStats.attacks) * 100).toFixed(1)}% 的攻击被响应）｜其中直接取消攻击 ${trapStats.canceled} 次`);
for (const [type, count] of Object.entries(trapStats.byType).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${type.padEnd(22)} ${count}`);
}
const eatenRows = Object.entries(trapStats.consumed).sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([n, count]) => `${n} 张 ${count} 次`).join("｜");
console.log(`  一次攻击吃掉的陷阱张数：${eatenRows || "无"}`);
const cancelRate = trapStats.canceled / Math.max(1, trapStats.fired);
console.log(cancelRate > 0.5
    ? "  「取消攻击」占响应比例超过一半：陷阱正在退化成零代价的免费防守。"
    : `  取消攻击占响应 ${(cancelRate * 100).toFixed(1)}%：多数陷阱靠效果赚资源，而不是直接废掉进攻。`);
