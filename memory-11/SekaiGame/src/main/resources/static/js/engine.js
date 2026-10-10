import { battleSnapshot, battleReport } from "./battle-report.js";
/**
 * engine.js
 * 规则引擎 —— 次元决斗：元素召唤
 */

import { ELEMENT_STRONG } from "./cards.js";
import { GAME_CONFIG, PHASE, MONSTER_POSITION, DURATION } from "./constants.js";
import { createCardInstance, shuffleArray } from "./model.js";
import { themedEffectHandlers, canResolveThemedEffect, resolveThemedTurnEnd, purgeOrphanDomainBuffs, ATTACK_FIZZLING_ACTIONS } from "./themed-effects.js";
import { activeDomain } from "./status-effects.js";

// ======================== Nightcord 共鸣系统 ========================
const NIGHTCORD_MEMBERS = ["ena", "kanade", "mafuyu", "mizuki"];

export function getUniqueNightcordMembers(player) {
    const members = new Set();
    for (const card of player.monsterZone) {
        if (card.series === "nightcord" && NIGHTCORD_MEMBERS.includes(card.member)) {
            members.add(card.member);
        }
    }
    return members;
}

export function hasResonance(player, requiredMembers = 2) {
    return getUniqueNightcordMembers(player).size >= requiredMembers;
}

// ======================== 工具函数 ========================
function safe(v) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0; }

function getEffectTrigger(effect) {
    return effect?.trigger || effect?.event || "manual";
}

function canSpecialSummon(player) {
    return !player.cannotSpecialSummonThisTurn;
}

function getAttackLimit(monster) {
    return monster.doubleAttackThisTurn || monster.attackTwiceThisTurn ? 2 : 1;
}

/**
 * 战斗期可调规则。做成可导出的配置对象，是为了让平衡实验室能直接跑 A/B 实验
 * （scripts/self-play-balance.mjs --traps=1|2），而不是改代码再跑一遍。
 */
export const BATTLE_RULES = {
    /**
     * 一次攻击最多允许几张盖放陷阱连锁响应（按后场顺序，2 = 允许一轮二连）。
     * 实测这一项对胜率格局几乎无影响（限制 1 与 2 的统计完全一致），
     * 因为多数攻击响应陷阱会直接取消攻击，链上第二张通常没有机会结算。
     */
    maxResponseTraps: 2,
    /**
     * 每回合最多无效化几次攻击（0 = 不限制）。
     *
     * 这里是"卡牌数据修完之后"仍然保留的规则级旋钮：无效化本身是合法的防守手段，
     * 但如果不设上限，堆陷阱的构筑可以整场不让对手的攻击落地。
     * 第五轮把陷阱卡池的无效化占比从 84.4% 降到 26.7%（详见 OPTIMIZATION_REPORT.md），
     * 平衡实验室里"取消攻击"占陷阱响应的比例随之从 100% 降到 11.9%，
     * 因此**默认仍然不限制**；需要更硬的上限时改这里，或用
     * `node scripts/self-play-balance.mjs --negate=1` 直接复测。
     */
    maxAttackNegationsPerTurn: 0,
    /** 无效化一次攻击需要额外支付的 LP（0 = 免费）。理由同上。 */
    attackNegationLpCost: 0,
};

/**
 * 陷阱连锁规则：
 * - 同一响应窗口最多 2 张陷阱依次发动（原实现第一张之后直接 break）；
 * - 陷阱发动可以被对方用 onOpponentEffect 陷阱连锁响应，最多 3 层，防止无限循环。
 */
const CHAIN_RULES = {
    maxReactivePerWindow: 2,
    maxChainDepth: 3,
};

/** 会"无效化本次攻击"的效果类型（数据型 + themed 动作型）。 */
const NEGATION_EFFECT_TYPES = new Set(["cancelAttackAndReturn", "cannotAttack", "counterDestroy", "counterAndDamage", "destroyAllAttackers", "destroyAttacker", "reflectDamage", "returnToHand"]);

function isNegationEffect(effect) {
    if (!effect) return false;
    if (NEGATION_EFFECT_TYPES.has(effect.type)) return true;
    return effect.type === "themedAction" && ATTACK_FIZZLING_ACTIONS.has(effect.action);
}

/** 这张盖放陷阱是否属于"无效化攻击"类（导出以便卡池平衡测试守住占比）。 */
export function isNegationTrap(card) {
    const effects = card?.effects?.length ? card.effects : card?.effect ? [card.effect] : [];
    return effects.some(isNegationEffect);
}

/**
 * 决定"自身攻击力/守备力上升"效果真正作用的对象：
 * 怪兽自身效果 → 该怪兽；战斗响应陷阱 → 本次战斗的守方怪兽；
 * 指定目标的魔法卡 → 选定的怪兽；兜底为效果来源卡。
 */
function resolveStatBuffTarget(ctx) {
    if (ctx.card?.type === "monster") return ctx.card;
    if (ctx.event === "onAttacked") {
        // 战斗响应陷阱：只能强化守方怪兽。注意 ctx.target 是"攻击怪兽"，
        // 直接攻击时 ctx.defenderMonster 会是字符串 "player"，
        // 两种情况都不能当成强化对象（否则会给攻击方 +500，反而帮了对手）。
        return ctx.defenderMonster?.type === "monster" ? ctx.defenderMonster : null;
    }
    if (ctx.target?.type === "monster") return ctx.target;
    return null;
}

/**
 * 攻守数值修正必须登记到 permanentBuffs/tempEffects：
 * Player._recalcCardStats() 会在每个回合边界把 currentAttack/currentDefense
 * 重算为"基础值 + 已登记的修正"，只改字段本身的修正会在回合结束时被抹掉
 * （例如"攻击力下降500"失效）。
 */
function applyStatChange(card, stat, delta, { temporary = false } = {}) {
    if (!card || typeof card !== "object" || !Number.isFinite(delta) || delta === 0) return;
    const field = stat === "attack" ? "currentAttack" : "currentDefense";
    card[field] = safe((card[field] || 0) + delta);
    if (temporary) {
        card.tempEffects = card.tempEffects || [];
        card.tempEffects.push({ type: stat, value: delta, duration: DURATION.UNTIL_END_TURN, source: "effect" });
    } else {
        card.permanentBuffs = card.permanentBuffs || [];
        card.permanentBuffs.push({ type: stat, value: delta, source: "effect" });
    }
}

function markAttackUsed(monster) {    monster.attacksMadeThisTurn = (Number(monster.attacksMadeThisTurn) || 0) + 1;
    monster.hasAttackedThisTurn = true;
    monster.canAttack = monster.attacksMadeThisTurn < getAttackLimit(monster)
        && !monster.cannotAttack
        && monster.position === MONSTER_POSITION.ATTACK;
}

/** 无下限（infinity）：状态未到期时，返回该怪兽参与的战斗应给其控制者减免的伤害值。 */
function infinityReduction(card, turn) {
    return Number(card?.themedState?.infinityUntil) >= turn ? Number(card.themedState.infinityReduce) || 0 : 0;
}

/**
 * 破坏杀·罗针：减半后领域持有者实际承受的战斗伤害（另一半向上取整反弹）。
 * 纯函数，predictBattle 与 attack 共用同一取整规则，保证预览结论等于结算结果。
 */
function rojinHalved(damage) {
    return damage > 0 ? damage - Math.ceil(damage / 2) : damage;
}

function destroyMonster(owner, monster, engine, cause = "effect") {
    const idx = owner.monsterZone.indexOf(monster);
    if (idx === -1) return false;
    const isDestruction = cause === "battle" || cause === "effect";
    if (isDestruction && monster.themedState?.shelterUntil >= engine?.state.turn) {
        delete monster.themedState.shelterUntil;
        monster.position = MONSTER_POSITION.DEFENSE;
        monster.canAttack = false;
        return false;
    }
    if (isDestruction && cause === "battle"
        && (monster.cannotBeDestroyedByBattle || monster.destructionPreventedThisTurn)) return false;
    if (isDestruction && cause === "effect" && monster.cannotBeDestroyedByEffect) return false;

    if (isDestruction) {
        const curseStacks = Number(monster.themedState?.statuses?.curse) || 0;
        if (curseStacks > 0) owner.takeDamage((Number(monster.themedState.curseDamage) || 0) * curseStacks);
    }

    owner.monsterZone.splice(idx, 1);
    const revivesToHand = isDestruction
        && monster.effects?.some(e => e.type === "reviveToHand" || e.type === "REVIVE_TO_HAND");
    if (revivesToHand) {
        resetCardState(monster);
        owner.hand.push(monster);
    } else {
        monster.canAttack = false;
        monster.hasAttackedThisTurn = true;
        monster.attacksMadeThisTurn = getAttackLimit(monster);
        if (!monster.isToken) owner.graveyard.push(monster);
        monster.themedState = {};
    }

    if (!engine) return true;
    const event = {
        sourceCard: monster,
        sourcePlayer: owner,
        destroyedCard: monster,
        sentCard: monster,
        cause,
    };
    if (!revivesToHand) {
        engine.emit("onSentToGraveyard", event);
        engine.triggerEvent("onSentToGraveyard", event);
    }
    if (isDestruction) {
        engine.emit("onDestroyed", event);
        engine.triggerEvent("onDestroyed", event);
        const ownTrapResult = engine._resolveReactiveTraps(owner, "onCardDestroyed", event);
        const opposingOwner = engine.state.players.find(player => player !== owner);
        const opposingTrapResult = engine._resolveReactiveTraps(opposingOwner, "onCardDestroyed", event);
        if (ownTrapResult || opposingTrapResult) event.trapMessage = [ownTrapResult, opposingTrapResult].filter(Boolean).join("，");
        if (cause === "battle") {
            engine.emit("onDestroyByBattle", event);
            engine.triggerEvent("onDestroyByBattle", event);
        }
    }
    return true;
}

function resetCardState(card) {
    card.themedState = {};
    card.currentAttack = card.attack || 0;
    card.currentDefense = card.defense || card.health || 0;
    card.currentHealth = card.defense || card.health || 0;
    card.position = MONSTER_POSITION.ATTACK;
    card.faceUp = true;
    card.canAttack = false;
    card.hasAttackedThisTurn = false;
    card.positionChangedThisTurn = false;
    card.tempEffects = [];
    card.permanentBuffs = [];
    card.cannotAttack = false;
    card.cannotBeTargeted = false;
    card.cannotBeAttacked = false;
    card.cannotBeDestroyedByBattle = false;
    card.cannotBeDestroyedByEffect = false;
    card.preventsBattleDamage = false;
    card.attackLocked = false;
    card.attacksMadeThisTurn = 0;
    card.doubleAttackThisTurn = false;
}

function sendMonsterToGraveyard(owner, monster, engine, cause = "tribute") {
    return destroyMonster(owner, monster, engine, cause);
}

// ======================== 统一事件分发 ========================
class EventBus {
    constructor() { this.listeners = {}; }
    on(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }
    off(event, fn) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    }
    emit(event, data) {
        if (!this.listeners[event]) return;
        for (const fn of this.listeners[event]) fn(data);
    }
    clear() { this.listeners = {}; }
}

// ======================== 通用目标选择器 ========================
export function resolveTargets(engine, player, targetSpec) {
    if (!targetSpec) return [];
    const opp = player === engine.state.currentPlayer ? engine.state.opponentPlayer : engine.state.currentPlayer;
    const owner = targetSpec.owner === "self" ? player : (targetSpec.owner === "opponent" ? opp : null);
    const zone = targetSpec.zone || "monster";
    let candidates = [];

    if (zone === "monster") {
        candidates = owner ? [...owner.monsterZone] : [...player.monsterZone, ...opp.monsterZone];
    } else if (zone === "hand") {
        candidates = owner ? [...owner.hand] : [...player.hand];
    } else if (zone === "graveyard") {
        candidates = owner ? [...owner.graveyard] : [...player.graveyard];
    } else if (zone === "spellTrap") {
        candidates = owner ? [...owner.spellTrapZone] : [];
    } else if (zone === "field") {
        candidates = owner ? [...owner.monsterZone, ...owner.spellTrapZone] : [];
    }

    // 应用过滤器
    if (targetSpec.filters) {
        const f = targetSpec.filters;
        candidates = candidates.filter(c => {
            if (f.attribute && !f.attribute.includes(c.attribute)) return false;
            if (f.race && !f.race.includes(c.race)) return false;
            if (f.minLevel && (c.level || 0) < f.minLevel) return false;
            if (f.maxLevel && (c.level || 0) > f.maxLevel) return false;
            if (f.minAttack && (c.currentAttack || 0) < f.minAttack) return false;
            if (f.maxAttack && (c.currentAttack || 0) > f.maxAttack) return false;
            if (f.type && c.type !== f.type) return false;
            if (f.series && c.series !== f.series) return false;
            return true;
        });
    }

    // 选择方式
    const selector = targetSpec.selector || "all";
    const count = targetSpec.count || 1;
    // selector=all 表示非指定对象的群体效果；其它选择器必须排除效果对象抗性。
    if (selector !== "all") candidates = candidates.filter(card => !card.cannotBeTargeted);

    if (selector === "all") return candidates;
    if (selector === "random") { const shuffled = [...candidates].sort(() => engine._random() - 0.5); return shuffled.slice(0, count); }
    if (selector === "highestAttack") { candidates.sort((a, b) => (b.currentAttack || 0) - (a.currentAttack || 0)); return candidates.slice(0, count); }
    if (selector === "lowestAttack") { candidates.sort((a, b) => (a.currentAttack || 0) - (b.currentAttack || 0)); return candidates.slice(0, count); }
    return candidates.slice(0, count);
}

// ======================== 效果处理器映射 ========================
const effectHandlers = {
    ...themedEffectHandlers,
    signatureTechnique(ctx) {
        const protocol = ctx.effect?.protocol || {};
        const seed = Number(protocol.seed || 0) >>> 0;
        const allyCount = ctx.player.monsterZone.length;
        const graveCount = ctx.player.graveyard.length;
        const handCount = ctx.player.hand.length;
        const turn = Math.max(1, Number(ctx.gameState.turn || 1));
        const scales = [allyCount, graveCount, handCount, turn, Math.abs(ctx.player.lp - ctx.opponent.lp) / 500];
        const scale = Math.max(1, Math.floor(scales[protocol.scale % scales.length] || 1));
        const amount = Math.min(1800, safe((protocol.base || 180) + scale * (protocol.step || 90)));
        // 签名技由召唤触发，没有玩家选择的目标；需要目标的动作必须自己解析出敌方
        // 目标，否则"封锁攻击/攻守逆转/击退回手"会静默变成空转。
        const enemyTargets = ctx.opponent.monsterZone
            .filter(monster => !monster.cannotBeTargeted)
            .sort((a, b) => (b.currentAttack || 0) - (a.currentAttack || 0))
            .slice(0, 1);
        const withEnemyTarget = { ...ctx, targets: enemyTargets, target: enemyTargets[0] || null };
        const actions = [
            () => { ctx.card.currentAttack += amount; return `专属蓄势：攻击力上升${amount}`; },
            () => { ctx.card.currentDefense += amount; return `专属架势：守备力上升${amount}`; },
            () => { ctx.opponent.takeDamage(Math.floor(amount * .7)); return `共鸣冲击：造成${Math.floor(amount * .7)}点伤害`; },
            () => { ctx.player.heal(amount); return `记忆回响：恢复${amount}LP`; },
            () => effectHandlers.debuffEnemyAttack({ ...ctx, value: amount }),
            () => effectHandlers.lockAttack({ ...withEnemyTarget, value: 1 }),
            () => effectHandlers.banishEnemyGraveyard({ ...ctx, value: 1 + seed % 2 }),
            () => effectHandlers.tokenSummon({ ...ctx, value: Math.min(1400, 400 + amount) }),
            () => effectHandlers.discardAndDraw({ ...ctx, value: 1 }),
            () => effectHandlers.swapAttackDefense(withEnemyTarget),
            () => effectHandlers.returnToHand(withEnemyTarget),
            () => effectHandlers.protectAllies({ ...ctx, value: 1 }),
        ];
        const first = protocol.primary % actions.length;
        let second = protocol.secondary % actions.length;
        if (second === first) second = (second + 1) % actions.length;
        const messages = [actions[first](), actions[second]()].filter(Boolean);
        ctx.card.signatureProtocol = protocol.id;
        return messages.join("；");
    },
    // ---- 旧效果兼容 ----
    damageAllEnemyMonsters(ctx) {
        const opp = ctx.opponent;
        const targets = [...opp.monsterZone];
        let destroyed = 0;
        for (const m of targets) {
            m.currentDefense = safe(m.currentDefense - ctx.value);
            if (m.currentDefense <= 0 && destroyMonster(opp, m, ctx.engine)) destroyed++;
        }
        return `对对方全部怪兽造成${ctx.value}点伤害${destroyed ? `，${destroyed}只被破坏` : ""}`;
    },
    // 援军/城壁等战斗响应陷阱写的是"己方怪兽"，而 ctx.card 是陷阱卡本身，
    // 必须改写到本次战斗的守方怪兽，否则加成落在墓地里的陷阱卡上、整卡失效。
    buffSelfAttack(ctx) {
        const recipient = resolveStatBuffTarget(ctx);
        if (!recipient) return "没有可强化的怪兽";
        // 战斗响应（援军）只强化本次战斗，按"直到回合结束"登记；
        // 其它情况（怪兽自身效果）按永久修正登记。
        applyStatChange(recipient, "attack", ctx.value, { temporary: ctx.event === "onAttacked" });
        return `${recipient.name}攻击力上升${ctx.value}`;
    },
    buffSelfDefense(ctx) {
        const recipient = resolveStatBuffTarget(ctx);
        if (!recipient) return "没有可强化的怪兽";
        applyStatChange(recipient, "defense", ctx.value, { temporary: ctx.event === "onAttacked" });
        return `${recipient.name}守备力上升${ctx.value}`;
    },
    healPlayer(ctx) { ctx.player.heal(ctx.value); return `恢复${ctx.value}LP`; },
    // 游戏王座：抽2张，1魔1怪额外抽1张，当回合不能战斗
    gameThroneDraw(ctx) {
        const count = ctx.value || 2;
        const drawn = [];
        for (let i = 0; i < count; i++) {
            const r = ctx.engine.drawCard(ctx.player);
            if (r.card) drawn.push(r.card);
        }
        // 检查是否1张魔法+1张怪兽
        const hasSpell = drawn.some(c => c.type === "spell");
        const hasMonster = drawn.some(c => c.type === "monster");
        let extraMsg = "";
        if (hasSpell && hasMonster) {
            const r = ctx.engine.drawCard(ctx.player);
            if (r.card) extraMsg = `，触发额外抽卡（1魔1怪匹配）`;
        }
        // 当回合跳过战斗阶段
        ctx.player.skipBattlePhase = true;
        return `抽了${drawn.length}张卡${extraMsg}；当回合跳过战斗阶段`;
    },

    // 月光传讯（旧版兼容）
    drawCards(ctx) { let n = 0; for (let i = 0; i < ctx.value; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) n++; } return `抽了${n}张卡`; },
    debuffEnemyAttack(ctx) {
        const opp = ctx.opponent;
        // 没有手动指定目标时的兜底必须选"攻击力最高"的怪兽，与卡面一致
        // （之前用的是 < 比较，实际弱化的是攻击力最低的那只）。
        const target = ctx.target || (opp.monsterZone.length > 0
            ? opp.monsterZone.reduce((a, b) => (a.currentAttack || 0) > (b.currentAttack || 0) ? a : b)
            : null);
        if (target) {
            applyStatChange(target, "attack", -Math.abs(Number(ctx.value) || 0));
            return `${target.name}攻击力下降${ctx.value}`;
        }
        return "没有可弱化的目标";
    },
    debuffEnemyDefense(ctx) {
        const target = ctx.target || ctx.opponent.monsterZone[0];
        if (!target) return "没有可弱化的目标";
        applyStatChange(target, "defense", -Math.abs(Number(ctx.value) || 0));
        if (target.currentDefense <= 0) {
            const destroyed = destroyMonster(ctx.opponent, target, ctx.engine);
            return destroyed
                ? `${target.name}守备力下降${ctx.value}并被破坏`
                : `${target.name}守备力下降${ctx.value}，但不能被效果破坏`;
        }
        return `${target.name}守备力下降${ctx.value}`;
    },
    debuffAllEnemyAttack(ctx) { ctx.opponent.monsterZone.forEach(m => m.currentAttack = Math.max(0, m.currentAttack - ctx.value)); return `对方全部怪兽攻击力下降${ctx.value}`; },
    buffAllAlliesAttack(ctx) { ctx.player.monsterZone.forEach(m => m.currentAttack += ctx.value); return `己方全部怪兽攻击力上升${ctx.value}`; },
    directDamage(ctx) { ctx.opponent.takeDamage(ctx.value); return `对${ctx.opponent.name}造成${ctx.value}点伤害`; },
    destroyAllEnemyMonsters(ctx) {
        const t = [...ctx.opponent.monsterZone];
        const destroyed = t.filter(m => destroyMonster(ctx.opponent, m, ctx.engine)).length;
        return `破坏了对方${destroyed}只怪兽${destroyed < t.length ? `，${t.length - destroyed}只受到抗性保护` : ""}`;
    },
    destroyTarget(ctx) {
        const target = ctx.target || ctx.opponent.monsterZone[0];
        if (target && !target.isPlayer && target.currentDefense !== undefined) {
            return destroyMonster(ctx.opponent, target, ctx.engine)
                ? `破坏了${target.name}`
                : `${target.name}不能被效果破坏`;
        }
        return "没有可破坏的目标";
    },
    damageBothPlayers(ctx) { ctx.player.takeDamage(ctx.value); ctx.opponent.takeDamage(ctx.value); return `双方各受${ctx.value}点伤害`; },
    damageAndHeal(ctx) {
        const target = ctx.target || ctx.opponent.monsterZone[0];
        // "对方玩家"伪目标（isPlayer）必须在处理怪兽之前分支，否则会因为
        // target.currentDefense 存在而被当成怪兽处理，结果既不掉 LP 也不回血。
        if (target?.isPlayer) {
            ctx.opponent.takeDamage(ctx.value);
            ctx.player.heal(ctx.value);
            return `对${ctx.opponent.name}造成${ctx.value}伤害，恢复${ctx.value}LP`;
        }
        if (target && target.currentDefense !== undefined) {
            const before = target.currentDefense;
            target.currentDefense = safe(target.currentDefense - ctx.value);
            const real = before - target.currentDefense;
            ctx.player.heal(real);
            let msg = `对${target.name}造成${real}伤害，恢复${real}LP`;
            if (target.currentDefense <= 0 && destroyMonster(ctx.opponent, target, ctx.engine)) msg += "，怪兽被破坏";
            return msg;
        }
        ctx.opponent.takeDamage(ctx.value); ctx.player.heal(ctx.value);
        return `造成${ctx.value}伤害并恢复${ctx.value}LP`;
    },
    reviveToHand(ctx) {
        const chars = ctx.player.graveyard.filter(c => c.type === "monster");
        // 优先使用玩家/效果选定的目标；没有指定目标时才退回"墓地最后一张"。
        const chosen = ctx.targets?.length ? ctx.targets[0] : ctx.target;
        const target = (chosen && chosen.type === "monster" && ctx.player.graveyard.includes(chosen))
            ? chosen
            : chars[chars.length - 1];
        if (target && target.type === "monster") {
            const idx = ctx.player.graveyard.indexOf(target);
            if (idx >= 0) { ctx.player.graveyard.splice(idx, 1); resetCardState(target); ctx.player.hand.push(target); return `复活了${target.name}到手牌`; }
        }
        return "墓地没有可复活的怪兽";
    },
    recoverMonster(ctx) {
        return effectHandlers.reviveToHand(ctx);
    },
    destroySpellTrap(ctx) {
        const limit = Math.max(1, Number(ctx.value) || 1);
        const targets = ctx.target ? [ctx.target] : [...ctx.opponent.spellTrapZone].slice(0, limit);
        const destroyed = [];
        for (const target of targets) {
            const index = ctx.opponent.spellTrapZone.indexOf(target);
            if (!target || index < 0) continue;
            ctx.opponent.spellTrapZone.splice(index, 1);
            target.faceDown = false;
            target.canActivate = false;
            ctx.opponent.graveyard.push(target);
            destroyed.push(target.name);
        }
        return destroyed.length ? `破坏了${destroyed.join("、")}` : "对方场上没有可破坏的魔法或陷阱卡";
    },
    destroyAllEnemySpellTraps(ctx) {
        const targets = [...ctx.opponent.spellTrapZone];
        for (const target of targets) {
            const index = ctx.opponent.spellTrapZone.indexOf(target);
            if (index < 0) continue;
            ctx.opponent.spellTrapZone.splice(index, 1);
            target.faceDown = false;
            target.canActivate = false;
            ctx.opponent.graveyard.push(target);
        }
        return targets.length > 0
            ? `破坏了对方全部${targets.length}张魔法或陷阱卡`
            : "对方场上没有魔法或陷阱卡";
    },
    banishEnemyGraveyard(ctx) {
        const count = Math.max(1, Number(ctx.value) || 1);
        const targets = ctx.opponent.graveyard.splice(
            Math.max(0, ctx.opponent.graveyard.length - count),
            count,
        );
        for (const target of targets) {
            resetCardState(target);
            ctx.opponent.banished.push(target);
        }
        return targets.length > 0
            ? `从对方墓地除外了${targets.length}张卡`
            : "对方墓地没有可除外的卡";
    },
    reflectDamage(ctx) {
        if (ctx.event === "onAttacked" && ctx.attacker) {
            // 卡面声明的效果值优先（例如"反弹500点伤害"），未声明时才退回攻击力，
            // 否则一张 500 点的反伤卡会按攻击怪兽的完整攻击力结算。
            const declared = Math.max(0, Number(ctx.value) || 0);
            const reflected = declared > 0 ? declared : Math.max(0, ctx.engine.getEffectiveAttack(ctx.attacker));
            ctx.attackerOwner.takeDamage(reflected);
            return `攻击无效并反弹${reflected}点伤害`;
        }
        return "镜面反射准备就绪";
    },
    counterAndDamage(ctx) {
        if (ctx.event === "onAttacked" && ctx.attacker) {
            if (ctx.battle) ctx.battle.canceled = true;
            const damage = Math.max(0, Number(ctx.value) || 0);
            ctx.attackerOwner.takeDamage(damage);
            return `攻击无效，并反击${damage}点伤害`;
        }
        return "反击准备就绪";
    },
    reduceDamage(ctx) {
        return ctx.event === "onAttacked"
            ? `本次战斗伤害减少${Math.max(0, Number(ctx.value) || 0)}`
            : "减伤屏障准备就绪";
    },
    destroyAttacker(ctx) {
        if (ctx.event === "onAttacked" && ctx.attacker) {
            destroyMonster(ctx.attackerOwner, ctx.attacker, ctx.engine);
            return `破坏了${ctx.attacker.name}`;
        }
        return "冰封牢笼准备就绪";
    },
    // 神圣防护罩－反射镜力－：攻击无效，并破坏对方全部攻击表示怪兽
    destroyAllAttackers(ctx) {
        if (ctx.event !== "onAttacked" || !ctx.attacker) return "反击准备就绪";
        if (ctx.battle) ctx.battle.canceled = true;
        const owner = ctx.attackerOwner;
        const targets = [...owner.monsterZone].filter(monster => monster.position === MONSTER_POSITION.ATTACK);
        const destroyed = targets.filter(monster => destroyMonster(owner, monster, ctx.engine)).length;
        return `攻击无效，并破坏了对方${destroyed}只攻击表示怪兽`;
    },
    lifesteal(ctx) { return "吸血准备就绪"; },

    // ---- 蓝絮猫女仆 凯伊效果 ----
    // 效果①：特殊召唤/召唤成功后，对方必须先攻击其他怪兽
    priorityTarget(ctx) {
        ctx.card.priorityTarget = true;
        return "对方必须优先攻击其他怪兽";
    },
    // 效果②：1回合1次，无后场盖卡时攻击+value，有后场盖卡时守备+value
    conditionalBuff(ctx) {
        const hasBackrow = ctx.player.spellTrapZone.some(c => c.faceDown);
        if (hasBackrow) {
            ctx.card.currentDefense = safe(ctx.card.currentDefense + ctx.value);
            return `守备力上升${ctx.value}`;
        } else {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + ctx.value);
            return `攻击力上升${ctx.value}`;
        }
    },
    // 效果③：被战斗破坏时，从卡组将1只等级N以下水属性怪兽加入手牌
    searchWaterMonster(ctx) {
        const maxLevel = ctx.value || 4;
        const candidates = ctx.player.deck.filter(c =>
            c.type === "monster" && c.attribute === "water" && (c.level || 0) <= maxLevel
        );
        if (candidates.length === 0) return "卡组中没有符合条件的怪兽";
        // AI随机选，玩家可后续扩展为选择界面
        const picked = candidates[Math.floor(ctx.engine._random() * candidates.length)];
        const idx = ctx.player.deck.indexOf(picked);
        if (idx >= 0) {
            ctx.player.deck.splice(idx, 1);
            ctx.player.hand.push(picked);
            return `从卡组将${picked.name || "水属性怪兽"}加入手牌`;
        }
        return "搜索失败";
    },

    // ---- 里间雨效果 ----
    // 效果①：召唤/反转召唤时，对方不能将此卡作为效果对象（直到回合结束）
    targetProtect(ctx) {
        ctx.card.cannotBeTargeted = true;
        // 回合结束时清除（通过tempEffects追踪）
        ctx.card.tempEffects.push({ type: "targetProtect", value: 1, duration: "untilEndTurn", source: ctx.card });
        return "对方不能将此卡作为效果对象";
    },
    // 效果②：对方攻击时切换守备表示并强制攻击其他怪兽；无其他怪兽时守备+400
    switchDefenseRedirect(ctx) {
        ctx.card.attackRedirector = true;
        ctx.card.redirectValue = ctx.value || 400;
        return "攻击时将切换守备表示并强制对方攻击其他怪兽";
    },
    // 效果③：被战斗破坏时，后场1张盖卡回手
    bounceBackrow(ctx) {
        const faceDowns = ctx.player.spellTrapZone.filter(c => c.faceDown);
        if (faceDowns.length === 0) return "后场没有盖放的卡";
        const picked = faceDowns[Math.floor(ctx.engine._random() * faceDowns.length)];
        const idx = ctx.player.spellTrapZone.indexOf(picked);
        if (idx >= 0) {
            ctx.player.spellTrapZone.splice(idx, 1);
            resetCardState(picked);
            ctx.player.hand.push(picked);
            return `将${picked.name || "盖卡"}返回手牌`;
        }
        return "回手失败";
    },

    // ---- 宫崎奏效果 ----
    // 效果①：召唤/反转召唤时，墓地1张水属性回卡组底 + 效果对象保护
    recycleWaterAndProtect(ctx) {
        // 回收墓地水属性卡
        const waterCards = ctx.player.graveyard.filter(c => c.attribute === "water");
        let msg = "";
        if (waterCards.length > 0) {
            const picked = waterCards[Math.floor(ctx.engine._random() * waterCards.length)];
            const idx = ctx.player.graveyard.indexOf(picked);
            if (idx >= 0) {
                ctx.player.graveyard.splice(idx, 1);
                ctx.player.deck.push(picked);
                msg = `将${picked.name || "水属性卡"}回卡组底`;
            }
        } else {
            msg = "墓地没有水属性卡";
        }
        // 效果对象保护
        ctx.card.cannotBeTargeted = true;
        ctx.card.tempEffects.push({ type: "targetProtect", value: 1, duration: "untilEndTurn", source: ctx.card });
        return msg + "，对方不能将此卡作为效果对象";
    },
    // 效果②：对方回合对方发动效果时，数值增减减半；非数值效果则对方丢1张手牌
    effectDisruptor(ctx) {
        ctx.card.effectDisruptor = true;
        return "效果干扰就绪";
    },
    // 效果③：被战斗破坏时，场上1只Lv4以下怪兽攻守+250
    buffAllyOnDestroy(ctx) {
        const candidates = ctx.player.monsterZone.filter(m => m !== ctx.card && (m.level || 0) <= 4);
        if (candidates.length === 0) return "没有符合条件的怪兽";
        // AI随机选，玩家可后续扩展为选择界面
        const target = candidates[Math.floor(ctx.engine._random() * candidates.length)];
        target.currentAttack = safe(target.currentAttack + ctx.value);
        target.currentDefense = safe(target.currentDefense + ctx.value);
        target.permanentBuffs.push({ type: "attack", value: ctx.value, source: "buffAllyOnDestroy" });
        target.permanentBuffs.push({ type: "defense", value: ctx.value, source: "buffAllyOnDestroy" });
        return `${target.name || "怪兽"}攻击力和守备力各上升${ctx.value}`;
    },

    // 山田凉效果①：墓地1张魔法卡放回卡组顶端，抽1卡
    recycleSpellDraw(ctx) {
        const spells = ctx.player.graveyard.filter(c => c.type === "spell");
        if (spells.length === 0) return "墓地没有魔法卡";
        // AI随机选，玩家可后续扩展为选择界面
        const picked = spells[Math.floor(ctx.engine._random() * spells.length)];
        const idx = ctx.player.graveyard.indexOf(picked);
        if (idx >= 0) {
            ctx.player.graveyard.splice(idx, 1);
            ctx.player.deck.unshift(picked);
        }
        const r = ctx.engine.drawCard(ctx.player);
        return `将${picked.name || "魔法卡"}放回卡组顶端，${r.card ? "抽1张卡" : "牌库已空"}`;
    },

    // 山田凉效果②：融合素材时可用手牌魔法卡代替怪兽素材（标记效果，融合召唤时检查）
    fusionSubstituteSpell(ctx) {
        ctx.card.fusionSubstituteSpell = true;
        return "融合素材时可用手牌魔法卡代替";
    },

    // 青蓝妆者效果：手牌1张魔法送墓，从卡组拿1张魔法（本回合不能发动）
    searchSpellByDiscard(ctx) {
        const handSpells = ctx.player.hand.filter(c => c.type === "spell" && c !== ctx.card);
        if (handSpells.length === 0) return "手牌没有魔法卡";
        // AI随机丢弃1张魔法卡
        const discarded = handSpells[Math.floor(ctx.engine._random() * handSpells.length)];
        const didx = ctx.player.hand.indexOf(discarded);
        if (didx >= 0) ctx.player.hand.splice(didx, 1);
        ctx.player.graveyard.push(discarded);
        // 从卡组搜索1张魔法卡
        const deckSpells = ctx.player.deck.filter(c => c.type === "spell");
        if (deckSpells.length === 0) { return `将${discarded.name || "魔法卡"}送入墓地，但卡组没有魔法卡`; }
        const picked = deckSpells[Math.floor(ctx.engine._random() * deckSpells.length)];
        const pidx = ctx.player.deck.indexOf(picked);
        if (pidx >= 0) ctx.player.deck.splice(pidx, 1);
        ctx.player.hand.push(picked);
        // 标记本回合不能发动
        picked.cannotActivateThisTurn = true;
        return `将${discarded.name || "魔法卡"}送入墓地，从卡组拿了${picked.name || "魔法卡"}（本回合不能发动）`;
    },

    // 朝比奈真冬效果：丢弃1手牌，对方1只怪兽至下个结束阶段不能攻击
    discardToDisableAttack(ctx) {
        if (ctx.player.hand.length === 0) return "手牌不足";
        // 丢弃1张手牌
        const discarded = ctx.player.hand.pop();
        ctx.player.graveyard.push(discarded);
        // 选择对方1只怪兽禁止攻击
        const targets = ctx.targets || [];
        if (targets.length === 0) {
            // 没有手动选择则选攻击力最高的
            const oppMonsters = ctx.opponent.monsterZone;
            if (oppMonsters.length === 0) { ctx.player.graveyard.pop(); ctx.player.hand.push(discarded); return "对方场上没有怪兽"; }
            const target = oppMonsters.reduce((a, b) => (a.currentAttack || 0) > (b.currentAttack || 0) ? a : b);
            target.cannotAttack = true;
            target.attackDisabledUntilEndPhase = true;
            return `丢弃${discarded.name || "手牌"}，${target.name}直至对方下个结束阶段无法攻击`;
        }
        const target = targets[0];
        target.cannotAttack = true;
        target.attackDisabledUntilEndPhase = true;
        return `丢弃${discarded.name || "手牌"}，${target.name}直至对方下个结束阶段无法攻击`;
    },

    // ---- UR 陷阱卡效果 ----

    // 暮雨长街的独行：攻击无效+额外回手
    cancelAttackAndReturn(ctx) {
        const attacker = ctx.target;
        if (attacker && attacker.type === "monster") {
            attacker.cancelAttack = true;
            const opp = ctx.opponent;
            // 如果对方本回合已攻击2次以上，额外回手1只攻击过的怪兽
            if (opp.monsterZone.filter(m => m.hasAttackedThisTurn).length >= (ctx.value || 2)) {
                const attackers = opp.monsterZone.filter(m => m.hasAttackedThisTurn && m !== attacker);
                if (attackers.length > 0) {
                    const returnTarget = attackers[0];
                    const idx = opp.monsterZone.indexOf(returnTarget);
                    if (idx >= 0) {
                        opp.monsterZone.splice(idx, 1);
                        resetCardState(returnTarget);
                        opp.hand.push(returnTarget);
                        return `攻击无效，${returnTarget.name}返回对方手牌`;
                    }
                }
            }
            return "本次攻击无效";
        }
        return "攻击无效";
    },

    // 寒岭汤泉的憩息：移除墓地1张卡使破坏无效
    preventDestructionByBanish(ctx) {
        const player = ctx.player;
        if (player.graveyard.length === 0) return "墓地没有卡可以移除";
        const removed = player.graveyard.pop();
        const target = ctx.target;
        if (target && target.type === "monster") {
            target.cannotBeDestroyedByBattle = true;
            target.destructionPreventedThisTurn = true;
            return `移除${removed.name || "墓地卡"}，${target.name}本回合不会被战斗破坏`;
        }
        return "移除了1张墓地卡";
    },

    // 澄湖栈桥的余晖：寄存墓地卡+回收
    trapStackAndRecover(ctx) {
        const trapCard = ctx.card;
        if (!trapCard._stacked) trapCard._stacked = [];
        // 寄存刚送入墓地的卡
        const recentGrave = ctx.player.graveyard[ctx.player.graveyard.length - 1];
        if (recentGrave && trapCard._stacked.length < (ctx.value || 2)) {
            const idx = ctx.player.graveyard.indexOf(recentGrave);
            if (idx >= 0) {
                ctx.player.graveyard.splice(idx, 1);
                trapCard._stacked.push(recentGrave);
                return `将${recentGrave.name || "卡牌"}寄存（${trapCard._stacked.length}/${ctx.value || 2}）`;
            }
        }
        return "寄存已满或没有可寄存的卡";
    },

    // 夏空校舍的流云：暂时除外对方怪兽
    temporaryBanish(ctx) {
        const opp = ctx.opponent;
        const targets = resolveTargets(ctx.engine, ctx.player, ctx.targetSpec || { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        if (targets.length === 0) return "没有可除外的怪兽";
        const target = targets[0];
        const idx = opp.monsterZone.indexOf(target);
        if (idx >= 0) {
            opp.monsterZone.splice(idx, 1);
            if (!ctx.player._tempBanished) ctx.player._tempBanished = [];
            ctx.player._tempBanished.push({
                card: target,
                returnTurn: ctx.engine.state.turn + 1,
                ownerIndex: ctx.engine.state.players.indexOf(opp),
            });
            target.cannotAttack = true;
            return `${target.name}被暂时除外，回合结束时返还`;
        }
        return "除外失败";
    },

    // 星降神篱的祈愿：无效对方效果
    negateCounterEffect(ctx) {
        const target = ctx.target;
        if (target) {
            target.effectNegated = true;
            return `无效了${target.name || "对方"}的效果`;
        }
        return "无效了对方的效果";
    },

    // ---- 新通用效果处理器 ----
    modifyStat(ctx) {
        const targets = ctx.targets || [];
        for (const t of targets) {
            if (t.currentAttack !== undefined) t.currentAttack = safe(t.currentAttack + (ctx.value || 0));
            if (t.currentDefense !== undefined) t.currentDefense = safe(t.currentDefense + (ctx.value || 0));
        }
        return targets.length > 0 ? `修改了${targets.length}只怪兽的数值` : "没有目标";
    },
    destroyAll(ctx) {
        const opp = ctx.opponent;
        const t = [...opp.monsterZone];
        t.forEach(m => destroyMonster(opp, m, ctx.engine));
        return `破坏了对方${t.length}只怪兽`;
    },
    specialSummonFromGraveyard(ctx) {
        const target = ctx.target;
        if (!target || target.type !== "monster") return "没有可复活的怪兽";
        if (!canSpecialSummon(ctx.player)) return "当回合不能特殊召唤";
        const idx = ctx.player.graveyard.indexOf(target);
        if (idx === -1) return "目标不在墓地";
        if (ctx.player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) return "怪兽区已满";
        ctx.player.graveyard.splice(idx, 1);
        resetCardState(target);
        // 游戏王规则没有“召唤疲劳”：非先攻首回合，特殊召唤的攻击表示怪兽本回合即可攻击。
        target.canAttack = !ctx.engine.state.firstTurn && !ctx.player.skipBattlePhase;
        target.faceUp = true;
        target.position = MONSTER_POSITION.ATTACK;
        target.setTurn = ctx.engine.state.turn;
        target.positionChangedThisTurn = false;
        ctx.player.monsterZone.push(target);
        const specialResult = ctx.engine._emitSpecialSummon(ctx.player, target, "graveyard");
        return `从墓地特殊召唤了${target.name}${specialResult ? `，${specialResult}` : ""}`;
    },
    negateEffect(ctx) { return "效果无效化准备就绪"; },
    cannotAttack(ctx) {
        if (ctx.event === "onAttacked" && ctx.attackerOwner) {
            // 这类战斗陷阱的文本只限制“攻击怪兽”本身，不能把同一方
            // 其它仍未攻击的怪兽一起锁死。
            const attacker = ctx.attacker;
            if (attacker && ctx.attackerOwner.monsterZone.includes(attacker)) {
                attacker.cannotAttack = true;
                attacker.canAttack = false;
                return `${attacker.name}本回合不能再次攻击`;
            }
            return "本次攻击无效";
        }
        const targets = ctx.targets || [];
        targets.forEach(t => {
            t.cannotAttack = true;
            t.canAttack = false;
        });
        return targets.length > 0 ? `封锁了${targets.length}只怪兽的攻击` : "没有目标";
    },
    cannotBeAttacked(ctx) {
        const targets = ctx.targets || [];
        targets.forEach(t => { t.cannotBeAttacked = true; });
        return targets.length > 0 ? `${targets.length}只怪兽本回合不能被攻击` : "没有目标";
    },
    cannotBeDestroyedByBattle(ctx) {
        const targets = ctx.targets || [];
        targets.forEach(t => { t.cannotBeDestroyedByBattle = true; });
        return targets.length > 0 ? `${targets.length}只怪兽本回合不会被战斗破坏` : "没有目标";
    },
    cannotBeDestroyedByEffect(ctx) {
        const targets = ctx.targets || [];
        targets.forEach(t => { t.cannotBeDestroyedByEffect = true; });
        return targets.length > 0 ? `${targets.length}只怪兽本回合不会被效果破坏` : "没有目标";
    },
    changePosition(ctx) {
        const targets = ctx.targets || [];
        targets.forEach(t => {
            if (t.position === MONSTER_POSITION.ATTACK) t.position = MONSTER_POSITION.DEFENSE;
            else t.position = MONSTER_POSITION.ATTACK;
            t.positionChangedThisTurn = true;
            t.canAttack = false;
        });
        return targets.length > 0 ? `改变了${targets.length}只怪兽的表示形式` : "没有目标";
    },
    returnToHand(ctx) {
        const targets = ctx.targets || [];
        const opp = ctx.opponent;
        let returned = 0;
        const returnedCards = [];
        for (const t of [...targets]) {
            const idx = opp.monsterZone.indexOf(t);
            if (idx >= 0) {
                opp.monsterZone.splice(idx, 1);
                resetCardState(t);
                if (opp.hand.length < GAME_CONFIG.MAX_HAND_SIZE) {
                    opp.hand.push(t);
                } else {
                    opp.graveyard.push(t);
                }
                returnedCards.push(t);
                returned++;
            }
        }
        // 记录被返回的卡牌，供控制器播放动画
        ctx._returnedCards = returnedCards;
        return returned > 0 ? `将${returned}只怪兽返回手牌` : "没有目标";
    },
    searchDeck(ctx) {
        const deck = ctx.player.deck;
        if (deck.length === 0) return "牌库为空";
        const f = ctx.targetSpec?.filters || {};
        const found = deck.find(c => {
            if (f.attribute && !f.attribute.includes(c.attribute)) return false;
            if (f.type && c.type !== f.type) return false;
            if (f.series && c.series !== f.series) return false;
            return true;
        });
        if (!found) return "牌库中没有符合条件的卡牌";
        deck.splice(deck.indexOf(found), 1);
        if (ctx.player.hand.length < GAME_CONFIG.MAX_HAND_SIZE) {
            ctx.player.hand.push(found);
        } else {
            ctx.player.graveyard.push(found);
        }
        return `从牌库中检索了${found.name}`;
    },
    discardCards(ctx) {
        const opp = ctx.opponent;
        const count = ctx.value || 1;
        let discarded = 0;
        for (let i = 0; i < count && opp.hand.length > 0; i++) {
            const idx = Math.floor(ctx.engine._random() * opp.hand.length);
            const card = opp.hand.splice(idx, 1)[0];
            opp.graveyard.push(card);
            discarded++;
        }
        return discarded > 0 ? `对方丢弃了${discarded}张手牌` : "对方没有手牌";
    },
    directAttackDamage(ctx) {
        ctx.opponent.takeDamage(ctx.value);
        return `对${ctx.opponent.name}造成${ctx.value}点直接伤害`;
    },
    preventDamage(ctx) {
        const targets = ctx.targets || [];
        targets.forEach(t => { t.preventsBattleDamage = true; });
        return targets.length > 0 ? `${targets.length}只怪兽本回合不受战斗伤害` : "没有目标";
    },
    tokenSummon(ctx) {
        if (!canSpecialSummon(ctx.player)) return "当回合不能特殊召唤";
        if (ctx.player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) return "怪兽区已满";
        const token = createCardInstance({
            id: "token_" + ctx.engine._random().toString(36).slice(2, 6),
            name: "衍生物",
            type: "monster",
            attribute: "none",
            race: "rock",
            level: 1,
            attack: ctx.value || 500,
            defense: ctx.value || 500,
            rarity: "N",
            effect: null,
            description: "衍生物",
            // 衍生物被破坏时不进入墓地、也不能作为召唤素材，必须带 isToken 标记。
            isToken: true,
        });
        // 衍生物同样遵循无召唤疲劳规则；卡牌效果可再单独附加“不能攻击”。
        token.canAttack = !ctx.engine.state.firstTurn && !ctx.player.skipBattlePhase;
        token.setTurn = ctx.engine.state.turn;
        token.positionChangedThisTurn = false;
        ctx.player.monsterZone.push(token);
        const specialResult = ctx.engine._emitSpecialSummon(ctx.player, token, "token");
        return `特殊召唤了衍生物 (ATK/${token.currentAttack} DEF/${token.currentDefense})${specialResult ? `，${specialResult}` : ""}`;
    },
    additionalNormalSummon(ctx) {
        const count = Math.max(1, Number(ctx.value) || 1);
        ctx.player.additionalNormalSummon += count;
        return `本回合追加${count}次通常召唤`;
    },
    gainAttackByCount(ctx) {
        const count = ctx.player.monsterZone.length;
        const gain = count * (ctx.value || 300);
        ctx.card.currentAttack = safe(ctx.card.currentAttack + gain);
        return `攻击力上升${gain}（场上${count}只怪兽）`;
    },
    oncePerTurn(ctx) { return "一回合一次效果已使用"; },

    // ---- Nightcord 专属效果 ----

    // 绘名：支付LP造成伤害
    lifeCostBurst(ctx) {
        const costEff = ctx.card.effects?.find(e => e.costEffect);
        if (costEff?.costEffect?.type === "payLife") {
            ctx.player.takeDamage(costEff.costEffect.value);
        }
        const targets = resolveTargets(ctx.engine, ctx.player, ctx.targetSpec || { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        if (targets.length > 0) {
            const t = targets[0];
            t.currentDefense = safe(t.currentDefense - 800);
            let msg = `支付LP并对${t.name}造成800伤害`;
            if (t.currentDefense <= 0) { destroyMonster(ctx.opponent, t, ctx.engine); msg += "，怪兽被破坏"; }
            return msg;
        }
        ctx.opponent.takeDamage(800);
        return "支付LP并对对方造成800伤害";
    },

    // 绘名：自身低攻时强化
    selfDestructBurst(ctx) {
        if (ctx.card.currentAttack < 1000) {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + 1500);
            return "自身攻击力低于1000，攻击力上升1500";
        }
        return "自身攻击力不低于1000，效果未发动";
    },

    // 绘名：低生命时增伤 + 四人共鸣清场
    lowHpBurst(ctx) {
        let msg = "";
        if (ctx.player.lp < 4000) {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + 1000);
            msg = "LP低于4000，攻击力上升1000";
        }
        if (hasResonance(ctx.player, 4)) {
            const opp = ctx.opponent;
            const targets = [...opp.monsterZone];
            targets.forEach(m => destroyMonster(opp, m, ctx.engine));
            msg += (msg ? "，" : "") + `四人共鸣！破坏了对方${targets.length}只怪兽`;
        }
        return msg || "效果未满足条件";
    },

    // 绘名：终极爆发
    ultimateBurst(ctx) {
        const costEff = ctx.card.effects?.find(e => e.costEffect);
        if (costEff?.costEffect?.type === "payLife") {
            ctx.player.takeDamage(costEff.costEffect.value);
        }
        ctx.opponent.takeDamage(1500);
        let msg = "支付LP并对对方造成1500伤害";
        if (hasResonance(ctx.player, 2)) {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + 800);
            msg += "，共鸣：攻击力上升800";
        }
        return msg;
    },

    // 共鸣爆发：基础伤害 + 共鸣直伤
    resonanceBurst(ctx) {
        const targets = resolveTargets(ctx.engine, ctx.player, { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        let msg = "";
        if (targets.length > 0) {
            const t = targets[0];
            t.currentDefense = safe(t.currentDefense - ctx.value);
            msg = `对${t.name}造成${ctx.value}伤害`;
            if (t.currentDefense <= 0) { destroyMonster(ctx.opponent, t, ctx.engine); msg += "，怪兽被破坏"; }
        } else {
            ctx.opponent.takeDamage(ctx.value);
            msg = `对对方造成${ctx.value}伤害`;
        }
        if (hasResonance(ctx.player, 2)) {
            ctx.opponent.takeDamage(700);
            msg += "，共鸣：对对方造成700伤害";
        }
        return msg;
    },

    // 共鸣增强：buff所有Nightcord怪兽
    resonanceBoost(ctx) {
        let count = 0;
        for (const m of ctx.player.monsterZone) {
            if (m.series === "nightcord") {
                m.currentAttack = safe(m.currentAttack + ctx.value);
                count++;
            }
        }
        return count > 0 ? `${count}只Nightcord怪兽攻击力上升${ctx.value}` : "没有Nightcord怪兽";
    },

    // 奏：恢复 + 抽牌
    healAndDraw(ctx) {
        ctx.player.heal(500);
        ctx.engine.drawCard(ctx.player);
        return "恢复500LP，抽1张卡";
    },

    // 奏：终极抽牌
    ultimateDraw(ctx) {
        let n = 0;
        for (let i = 0; i < 4; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) n++; }
        let msg = `抽了${n}张卡`;
        if (hasResonance(ctx.player, 2)) {
            ctx.player.heal(1000);
            msg += "，共鸣：恢复1000LP";
        }
        return msg;
    },

    // 共同：groupDraw
    groupDraw(ctx) {
        let n = 0;
        for (let i = 0; i < ctx.value; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) n++; }
        let msg = `抽了${n}张卡`;
        if (hasResonance(ctx.player, 2)) {
            const r2 = ctx.engine.drawCard(ctx.player);
            if (r2.card) { n++; msg += "，共鸣：再抽1张"; }
        }
        return msg;
    },

    // 共同：groupBuff
    groupBuff(ctx) {
        ctx.player.monsterZone.forEach(m => { m.currentAttack = safe(m.currentAttack + ctx.value); });
        let msg = `己方全部怪兽攻击力上升${ctx.value}`;
        if (hasResonance(ctx.player, 2)) {
            ctx.player.monsterZone.forEach(m => { m.currentAttack = safe(m.currentAttack + 200); });
            msg += "，共鸣：额外上升200";
        }
        return msg;
    },

    // 共同：resonancePower — 三重共鸣清场
    resonancePower(ctx) {
        if (hasResonance(ctx.player, 3)) {
            const opp = ctx.opponent;
            const targets = [...opp.monsterZone];
            targets.forEach(m => destroyMonster(opp, m, ctx.engine));
            return `三重共鸣！破坏了对方${targets.length}只怪兽`;
        }
        return "未满足三重共鸣条件";
    },

    // 共同：终极团体 — 四人共鸣清场+直伤
    ultimateGroup(ctx) {
        if (hasResonance(ctx.player, 4)) {
            const opp = ctx.opponent;
            const targets = [...opp.monsterZone];
            targets.forEach(m => destroyMonster(opp, m, ctx.engine));
            ctx.opponent.takeDamage(1000);
            return `四人共鸣！破坏了对方${targets.length}只怪兽，对对方造成1000伤害`;
        }
        return "未满足四人共鸣条件";
    },

    // 真冬：全场冻结
    freezeAll(ctx) {
        ctx.opponent.monsterZone.forEach(m => {
            m.currentAttack = Math.max(0, m.currentAttack - 500);
            m.cannotAttack = true;
        });
        return `对方全部怪兽攻击力下降500且不能攻击`;
    },

    // 真冬：破坏最弱
    destroyWeakest(ctx) {
        const opp = ctx.opponent;
        if (opp.monsterZone.length === 0) return "对方场上没有怪兽";
        const weakest = opp.monsterZone.reduce((a, b) => a.currentAttack < b.currentAttack ? a : b);
        destroyMonster(opp, weakest, ctx.engine);
        return `破坏了${weakest.name}`;
    },

    // 真冬：共鸣冻结
    resonanceFreeze(ctx) {
        ctx.opponent.monsterZone.forEach(m => {
            m.currentAttack = Math.max(0, m.currentAttack - ctx.value);
        });
        let msg = `对方全部怪兽攻击力下降${ctx.value}`;
        if (hasResonance(ctx.player, 3)) {
            const opp = ctx.opponent;
            const targets = [...opp.monsterZone];
            targets.forEach(m => { m.currentDefense = safe(m.currentDefense - 800); if (m.currentDefense <= 0) destroyMonster(opp, m, ctx.engine); });
            msg += `，三重共鸣：对对方全部怪兽造成800伤害`;
        }
        return msg;
    },

    // 真冬：削弱+破坏弱者+共鸣全场破坏
    destroyAllWeakened(ctx) {
        ctx.opponent.monsterZone.forEach(m => {
            m.currentAttack = Math.max(0, m.currentAttack - ctx.value);
        });
        const weak = ctx.opponent.monsterZone.filter(m => m.currentAttack < 1000);
        weak.forEach(m => destroyMonster(ctx.opponent, m, ctx.engine));
        let msg = `对方全部怪兽攻击力下降${ctx.value}，${weak.length}只被破坏`;
        if (hasResonance(ctx.player, 4)) {
            const rest = [...ctx.opponent.monsterZone];
            rest.forEach(m => destroyMonster(ctx.opponent, m, ctx.engine));
            msg += `，四人共鸣：破坏了剩余${rest.length}只怪兽`;
        }
        return msg;
    },

    // 真冬：终极冻结
    ultimateFreeze(ctx) {
        ctx.opponent.monsterZone.forEach(m => {
            m.currentAttack = Math.max(0, m.currentAttack - ctx.value);
            m.cannotAttack = true;
        });
        ctx.opponent.takeDamage(400);
        return `对方全部怪兽攻击力下降${ctx.value}且不能攻击，对方受到400伤害`;
    },

    // 瑞希：复制上一张魔法
    copyLastSpell(ctx) {
        // 简化实现：抽1张卡作为补偿
        ctx.engine.drawCard(ctx.player);
        let msg = "复制了上一张魔法卡效果（简化：抽1张卡）";
        if (hasResonance(ctx.player, 2)) {
            ctx.engine.drawCard(ctx.player);
            msg += "，共鸣：再抽1张";
        }
        return msg;
    },

    // 瑞希：全体攻守互换
    swapAttackDefense(ctx) {
        const targets = ctx.targets || ctx.opponent.monsterZone;
        let count = 0;
        for (const t of targets) {
            if (t.currentAttack !== undefined && t.currentDefense !== undefined) {
                const tmp = t.currentAttack;
                t.currentAttack = t.currentDefense;
                t.currentDefense = tmp;
                count++;
            }
        }
        return count > 0 ? `交换了${count}只怪兽的攻守` : "没有目标";
    },

    // 瑞希：重定向攻击
    redirectAttack(ctx) {
        return "选择对方一只怪兽，本回合其攻击必须攻击己方另一只怪兽";
    },

    // 瑞希：多重返回
    returnMultiple(ctx) {
        const opp = ctx.opponent;
        const targets = [...opp.monsterZone].slice(0, Math.max(1, Number(ctx.value) || 2));
        let returned = 0;
        for (const t of targets) {
            const idx = opp.monsterZone.indexOf(t);
            if (idx >= 0) {
                opp.monsterZone.splice(idx, 1);
                resetCardState(t);
                if (opp.hand.length < GAME_CONFIG.MAX_HAND_SIZE) opp.hand.push(t);
                else opp.graveyard.push(t);
                returned++;
            }
        }
        return returned > 0 ? `将${returned}只怪兽返回手牌` : "没有目标";
    },

    // 瑞希：共鸣重定向
    resonanceRedirect(ctx) {
        const opp = ctx.opponent;
        if (hasResonance(ctx.player, 2)) {
            const targets = [...opp.monsterZone];
            let returned = 0;
            for (const t of targets) {
                const idx = opp.monsterZone.indexOf(t);
                if (idx >= 0) {
                    opp.monsterZone.splice(idx, 1);
                    resetCardState(t);
                    if (opp.hand.length < GAME_CONFIG.MAX_HAND_SIZE) opp.hand.push(t);
                    else opp.graveyard.push(t);
                    returned++;
                }
            }
            return `共鸣：将${returned}只怪兽返回手牌`;
        }
        // 单体返回
        const target = opp.monsterZone.reduce((a, b) => a.currentAttack > b.currentAttack ? a : b, opp.monsterZone[0]);
        if (target) {
            const idx = opp.monsterZone.indexOf(target);
            opp.monsterZone.splice(idx, 1);
            resetCardState(target);
            if (opp.hand.length < GAME_CONFIG.MAX_HAND_SIZE) opp.hand.push(target);
            else opp.graveyard.push(target);
            return `将${target.name}返回手牌`;
        }
        return "没有目标";
    },

    // 瑞希：终极重定向+直伤
    ultimateRedirect(ctx) {
        const opp = ctx.opponent;
        const targets = [...opp.monsterZone];
        let returned = 0;
        for (const t of targets) {
            const idx = opp.monsterZone.indexOf(t);
            if (idx >= 0) {
                opp.monsterZone.splice(idx, 1);
                resetCardState(t);
                if (opp.hand.length < GAME_CONFIG.MAX_HAND_SIZE) opp.hand.push(t);
                else opp.graveyard.push(t);
                returned++;
            }
        }
        let msg = `将${returned}只怪兽返回手牌`;
        if (hasResonance(ctx.player, 4)) {
            ctx.opponent.takeDamage(1000);
            msg += "，四人共鸣：对对方造成1000伤害";
        }
        return msg;
    },

    // 瑞希：终极复制
    ultimateCopy(ctx) {
        const targets = resolveTargets(ctx.engine, ctx.player, { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        if (targets.length > 0) {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + targets[0].currentAttack);
            return `复制了${targets[0].name}的攻击力，攻击力上升${targets[0].currentAttack}`;
        }
        return "没有可复制的目标";
    },

    // 奏：保护己方
    protectAllies(ctx) {
        ctx.player.monsterZone.forEach(m => { m.cannotBeDestroyedByBattle = true; });
        let msg = "己方全部怪兽本回合不会被战斗破坏";
        if (hasResonance(ctx.player, 2)) {
            ctx.player.heal(1000);
            msg += "，共鸣：恢复1000LP";
        }
        return msg;
    },

    // 奏：完全恢复
    fullRecovery(ctx) {
        ctx.player.heal(1500);
        ctx.player.monsterZone.forEach(m => {
            m.currentDefense = m.defense || m.health || 0;
            m.currentHealth = m.defense || m.health || 0;
        });
        let msg = "恢复1500LP，己方怪兽恢复满血";
        if (hasResonance(ctx.player, 4)) {
            const chars = ctx.player.graveyard.filter(c => c.type === "monster").slice(0, 3);
            for (const c of chars) {
                const idx = ctx.player.graveyard.indexOf(c);
                if (idx >= 0) { ctx.player.graveyard.splice(idx, 1); resetCardState(c); ctx.player.hand.push(c); }
            }
            msg += `，四人共鸣：从墓地返回${chars.length}只怪兽到手牌`;
        }
        return msg;
    },

    // 陷阱：反击破坏
    counterDestroy(ctx) {
        const attacker = ctx.target;
        if (attacker && attacker.type === "monster") {
            destroyMonster(ctx.opponent, attacker, ctx.engine);
            let msg = `破坏了${attacker.name}`;
            if (hasResonance(ctx.player, 2)) {
                ctx.opponent.takeDamage(500);
                msg += "，共鸣：对对方造成500伤害";
            }
            return msg;
        }
        return "没有可破坏的目标";
    },

    // 真冬：削弱并条件破坏
    debuffAndDestroy(ctx) {
        const targets = resolveTargets(ctx.engine, ctx.player, { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        if (targets.length > 0) {
            const t = targets[0];
            t.currentAttack = Math.max(0, t.currentAttack - ctx.value);
            let msg = `${t.name}攻击力下降${ctx.value}`;
            if (hasResonance(ctx.player, 2) && t.currentAttack < 800) {
                destroyMonster(ctx.opponent, t, ctx.engine);
                msg += "，共鸣：怪兽被破坏";
            }
            return msg;
        }
        return "没有目标";
    },

    // ---- SSR魔法卡专用效果 ----

    // 回复前N回合丢失的生命值并抽卡
    recoverRecentDamage(ctx) {
        const turnsBack = ctx.value || 3;
        // 简化实现：回复一个固定量（每回合损失平均400LP）+ 抽1卡
        const healed = turnsBack * 400;
        ctx.player.heal(healed);
        const r = ctx.engine.drawCard(ctx.player);
        return `回复了前${turnsBack}回合的生命值（约${healed}LP），${r.card ? "抽1张卡" : "牌库已空"}`;
    },

    // 本回合增益+回合结束永久削弱
    buffThenDebuff(ctx) {
        const targets = ctx.targets || [];
        const buffValue = ctx.value || 400;
        // 效果数据写在 eff.penalty 上（ctx.effect），ctx.effects 是卡牌数据的字段名。
        const penalty = Math.max(0, Number(ctx.effect?.penalty ?? ctx.card?.effects?.[0]?.penalty ?? 700) || 0);
        for (const t of targets) {
            if (t.currentAttack === undefined) continue;
            t.currentAttack = safe(t.currentAttack + buffValue);
            if (penalty > 0) {
                // 用临时增益记录本回合的提升，并在结束时永久扣除 penalty：
                // 直接写 currentAttack 会被 _recalcCardStats() 依据基础攻击力覆盖。
                t.tempEffects = t.tempEffects || [];
                t.tempEffects.push({ type: "attack", value: buffValue + penalty, duration: DURATION.UNTIL_END_TURN, source: "buffThenDebuff" });
                t.permanentBuffs = t.permanentBuffs || [];
                t.permanentBuffs.push({ type: "attack", value: -penalty, source: "buffThenDebuff" });
            }
        }
        return `${targets.length}只怪兽攻击力+${buffValue}（回合结束时永久-${penalty}）`;
    },

    // 回复生命+抽卡（增强版）
    healAndDrawV2(ctx) {
        const healValue = ctx.value || 2000;
        const drawCount = ctx.effects?.[0]?.draw || 1;
        ctx.player.heal(healValue);
        let drawn = 0;
        for (let i = 0; i < drawCount; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) drawn++; }
        return `回复${healValue}LP，抽${drawn}张卡`;
    },

    // 抽取对方手牌（类型判定）
    snatchCards(ctx) {
        const count = ctx.value || 2;
        const opp = ctx.opponent;
        if (opp.hand.length === 0) return "对方没有手牌";
        const stolen = [];
        for (let i = 0; i < count && opp.hand.length > 0; i++) {
            const idx = Math.floor(ctx.engine._random() * opp.hand.length);
            stolen.push(opp.hand.splice(idx, 1)[0]);
        }
        // 判断类型是否相同
        const types = stolen.map(c => c.type);
        const allSame = types.every(t => t === types[0]);
        if (allSame) {
            // 类型相同：归还对方，魔法失败
            for (const c of stolen) { opp.hand.push(c); }
            return `抽取了对方${count}张手牌，但类型全部相同（${types[0]}），魔法失败，手牌已归还`;
        } else {
            // 类型不同：归自己所有，魔法成功
            for (const c of stolen) { ctx.player.hand.push(c); }
            return `抽取了对方${count}张手牌，类型不同，魔法成功！获得对方卡牌`;
        }
    },

    // 回收手牌再抽（己方或对方）
    recycleAndDraw(ctx) {
        const owner = ctx.effects?.[0]?.owner === "opponent" ? ctx.opponent : ctx.player;
        const handCount = owner.hand.length;
        if (handCount === 0) return `${owner.name}没有手牌`;
        // 将手牌送入墓地
        for (const c of [...owner.hand]) { owner.graveyard.push(c); }
        owner.hand = [];
        // 抽相同数量
        let drawn = 0;
        for (let i = 0; i < handCount; i++) { const r = ctx.engine.drawCard(owner); if (r.card) drawn++; }
        return `${owner.name}将${handCount}张手牌送入墓地，抽取了${drawn}张新卡`;
    },

    // ---- UR魔法卡专用效果 ----

    // 交换双方手牌
    swapHands(ctx) {
        const tempHand = [...ctx.player.hand];
        ctx.player.hand = [...ctx.opponent.hand];
        ctx.opponent.hand = tempHand;
        return "交换了双方的手牌";
    },

    // 封锁对方怪兽攻击（本回合）
    lockAttack(ctx) {
        const count = ctx.value || 2;
        const opp = ctx.opponent;
        // 通过target spec自动选择目标
        let targets = ctx.targets || [];
        if (targets.length === 0 && ctx.targetSpec) {
            targets = resolveTargets(ctx.engine, ctx.player, ctx.targetSpec);
        }
        targets = targets.filter(m => !m.attackLocked);
        if (targets.length === 0) return "没有可封锁的怪兽";
        for (const t of targets) {
            t.cannotAttack = true;
            t.canAttack = false;
        }
        return `封锁了${targets.length}只怪兽本回合的攻击（${targets.map(t => t.name).join("、")}）`;
    },

    // 场地魔法：水属性怪兽ATK/DEF+value，对方变守备需丢1手牌
    fieldWaterBuff(ctx) {
        const owner = ctx.player;
        const buffValue = ctx.value || 450;
        // 只清除本效果的旧buff，不清除其他场地效果的buff
        for (const m of owner.monsterZone) {
            m.permanentBuffs = m.permanentBuffs.filter(b => b.source !== "fieldWaterBuff");
        }
        // 重新应用
        for (const m of owner.monsterZone) {
            if (m.attribute === "water") {
                m.currentAttack = safe(m.currentAttack + buffValue);
                m.currentDefense = safe(m.currentDefense + buffValue);
                m.permanentBuffs.push({ type: "attack", value: buffValue, source: "fieldWaterBuff" });
                m.permanentBuffs.push({ type: "defense", value: buffValue, source: "fieldWaterBuff" });
            }
        }
        // 标记：对方变守备需丢1手牌
        owner.fieldSpellDiscardCost = true;
        return `场地魔法效果：水属性怪兽ATK/DEF+${buffValue}，对方变守备需丢1手牌`;
    },

    // 场地魔法：大海场景 + 水属性怪兽ATK/DEF+value
    fieldOceanScene(ctx) {
        const owner = ctx.player;
        const buffValue = ctx.value || 450;
        // 只清除本效果的旧buff，不清除其他场地效果的buff
        for (const m of owner.monsterZone) {
            m.permanentBuffs = m.permanentBuffs.filter(b => b.source !== "fieldOceanScene");
        }
        // 重新应用
        for (const m of owner.monsterZone) {
            if (m.attribute === "water") {
                m.currentAttack = safe(m.currentAttack + buffValue);
                m.currentDefense = safe(m.currentDefense + buffValue);
                m.permanentBuffs.push({ type: "attack", value: buffValue, source: "fieldOceanScene" });
                m.permanentBuffs.push({ type: "defense", value: buffValue, source: "fieldOceanScene" });
            }
        }
        return `场地魔法生效：大海场景展开，水属性怪兽ATK/DEF+${buffValue}`;
    },

    // 复活墓地中最后进入的怪兽（旧版兼容）
    reviveRecentGraveyard(ctx) {
        if (!canSpecialSummon(ctx.player)) return "当回合不能特殊召唤";
        let targetIndex = -1;
        for (let index = ctx.player.graveyard.length - 1; index >= 0; index--) {
            if (ctx.player.graveyard[index]?.type === "monster") {
                targetIndex = index;
                break;
            }
        }
        if (targetIndex < 0) return "墓地没有怪兽可以复活";
        const [target] = ctx.player.graveyard.splice(targetIndex, 1);
        resetCardState(target);
        target.faceUp = true;
        target.position = "attack";
        target.setTurn = ctx.engine.state.turn;
        target.positionChangedThisTurn = false;
        if (ctx.player.monsterZone.length < 5) {
            ctx.player.monsterZone.push(target);
            const specialResult = ctx.engine._emitSpecialSummon(ctx.player, target, "graveyard");
            return `复活了${target.name}到场上${specialResult ? `，${specialResult}` : ""}`;
        }
        ctx.player.hand.push(target);
        return `复活了${target.name}到手牌（场上已满）`;
    },

    // 八千年的思念：复活最近2回合怪兽，当回合不能攻击/作为素材
    reviveRecentGraveyardV2(ctx) {
        if (!canSpecialSummon(ctx.player)) return "当回合不能特殊召唤";
        const candidates = ctx.player.graveyard.filter(c => c.type === "monster");
        if (candidates.length === 0) return "墓地没有符合条件的怪兽";
        const target = candidates[candidates.length - 1];
        const idx = ctx.player.graveyard.indexOf(target);
        ctx.player.graveyard.splice(idx, 1);
        resetCardState(target);
        target.faceUp = true;
        target.position = "attack";
        // 当回合不能攻击
        target.cannotAttack = true;
        target.canAttack = false;
        // 当回合不能用作各类召唤素材（通过标记追踪）
        target.cannotUseAsMaterial = true;
        target.setTurn = ctx.engine.state.turn;
        target.positionChangedThisTurn = false;
        if (ctx.player.monsterZone.length < 5) {
            ctx.player.monsterZone.push(target);
            ctx.engine._lastRevivedCard = target;
            const specialResult = ctx.engine._emitSpecialSummon(ctx.player, target, "graveyard");
            return `从墓地特殊召唤了${target.name}（当回合不能攻击/作为素材）${specialResult ? `，${specialResult}` : ""}`;
        }
        ctx.player.hand.push(target);
        return `从墓地特殊召唤了${target.name}到手牌（场上已满）`;
    },

    // 放学后的茶会：回复过去3回合失去的LP + 抽1卡 + 当回合不能直接攻击
    recoverAndDrawV2(ctx) {
        const turnsBack = ctx.value || 3;
        const healed = turnsBack * 400;
        ctx.player.heal(healed);
        const r = ctx.engine.drawCard(ctx.player);
        // 当回合我方怪兽不能直接攻击
        ctx.player.noDirectAttackThisTurn = true;
        return `回复了前${turnsBack}回合的生命值（约${healed}LP），${r.card ? "抽1张卡" : "牌库已空"}；当回合我方怪兽不能直接攻击`;
    },

    // 夜刻萦音的永续热忱：回复2000LP + 抽1卡 + 当回合不能特殊召唤
    healDrawNoSpecial(ctx) {
        const healValue = ctx.value || 2000;
        const drawCount = ctx.effects?.[0]?.draw || 1;
        ctx.player.heal(healValue);
        let drawn = 0;
        for (let i = 0; i < drawCount; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) drawn++; }
        // 当回合不能特殊召唤
        ctx.player.cannotSpecialSummonThisTurn = true;
        return `回复${healValue}LP，抽${drawn}张卡；当回合不能特殊召唤`;
    },

    // 月下传讯：丢弃2张手牌 + 抽3张 + 当回合跳过战斗阶段
    discardAndDraw(ctx) {
        const discardCount = ctx.value || 2;
        const drawCount = ctx.drawValue || 3;
        // 丢弃手牌
        let discarded = 0;
        for (let i = 0; i < discardCount && ctx.player.hand.length > 0; i++) {
            const idx = Math.floor(ctx.engine._random() * ctx.player.hand.length);
            ctx.player.graveyard.push(ctx.player.hand.splice(idx, 1)[0]);
            discarded++;
        }
        if (discarded < discardCount) return `手牌不足，需要丢弃${discardCount}张但只有${discarded}张`;
        // 抽卡
        let drawn = 0;
        for (let i = 0; i < drawCount; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) drawn++; }
        // 只有魔法卡版本带有“跳过战斗阶段”的代价。部分怪兽登场效果也复用
        // 该处理器，但卡面只写“丢弃并抽牌”，不能因此封锁己方全场攻击。
        const skipsBattle = ctx.card?.type === "spell" || ctx.sourceCard?.type === "spell";
        if (skipsBattle) ctx.player.skipBattlePhase = true;
        return `丢弃了${discarded}张手牌，抽了${drawn}张卡${skipsBattle ? "；当回合跳过战斗阶段" : ""}`;
    },

    // 沉睡的蓝调：双方全部手牌送墓 + 各自抽送墓数量的卡 + 当回合不能从手牌发动怪兽效果
    mutualHandRefresh(ctx) {
        const selfCount = ctx.player.hand.length;
        const oppCount = ctx.opponent.hand.length;
        // 己方手牌送墓
        for (const c of [...ctx.player.hand]) { ctx.player.graveyard.push(c); }
        ctx.player.hand = [];
        // 对方手牌送墓
        for (const c of [...ctx.opponent.hand]) { ctx.opponent.graveyard.push(c); }
        ctx.opponent.hand = [];
        // 各自抽卡
        let selfDrawn = 0;
        for (let i = 0; i < selfCount; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) selfDrawn++; }
        let oppDrawn = 0;
        for (let i = 0; i < oppCount; i++) { const r = ctx.engine.drawCard(ctx.opponent); if (r.card) oppDrawn++; }
        // 当回合双方不能从手牌发动怪兽效果
        ctx.player.noHandMonsterEffectThisTurn = true;
        ctx.opponent.noHandMonsterEffectThisTurn = true;
        return `双方手牌全部送入墓地（己方${selfCount}张，对方${oppCount}张），各自抽${selfDrawn}/${oppDrawn}张卡；当回合双方不能从手牌发动怪兽效果`;
    },

    // 双倍攻击
    doubleAttack(ctx) {
        const targets = ctx.targets || [];
        if (targets.length === 0) return "没有选择怪兽";
        targets[0].doubleAttackThisTurn = true;
        return `${targets[0]?.name || "怪兽"}本回合可以攻击两次`;
    },
    attackTwice(ctx) {
        return effectHandlers.doubleAttack(ctx);
    },

    // 支付LP破坏怪兽
    sacrificeDestroy(ctx) {
        const cost = Math.floor(ctx.player.lp * (ctx.value / 100));
        ctx.player.takeDamage(cost);
        const opp = ctx.opponent;
        const targets = [...opp.monsterZone].slice(0, 2);
        targets.forEach(m => destroyMonster(opp, m, ctx.engine));
        return `支付${cost}LP，破坏了${targets.length}只怪兽`;
    },

    // 猜谜游戏（旧版兼容）
    guessGame(ctx) {
        const guess = ctx.engine._random() > 0.5 ? "有刺" : "无刺";
        const aiGuess = ctx.engine._random() > 0.5 ? "有刺" : "无刺";
        if (guess === aiGuess) {
            ctx.engine.drawCard(ctx.player);
            return `对方猜对了（${aiGuess}），发动者抽1张卡`;
        } else {
            const pMonsters = [...ctx.player.monsterZone];
            const oMonsters = [...ctx.opponent.monsterZone];
            pMonsters.forEach(m => destroyMonster(ctx.player, m, ctx.engine));
            oMonsters.forEach(m => destroyMonster(ctx.opponent, m, ctx.engine));
            return `对方猜错了（${aiGuess}，实际是${guess}），双方怪兽区全破坏`;
        }
    },

    // 有刺无刺V2：猜对抽1卡，猜错全场破坏 + 当回合不能特殊召唤
    guessGameV2(ctx) {
        const guess = ctx.engine._random() > 0.5 ? "有刺" : "无刺";
        const aiGuess = ctx.engine._random() > 0.5 ? "有刺" : "无刺";
        let msg;
        if (guess === aiGuess) {
            ctx.engine.drawCard(ctx.player);
            msg = `对方猜对了（${aiGuess}），发动者抽1张卡`;
        } else {
            const pMonsters = [...ctx.player.monsterZone];
            const oMonsters = [...ctx.opponent.monsterZone];
            pMonsters.forEach(m => destroyMonster(ctx.player, m, ctx.engine));
            oMonsters.forEach(m => destroyMonster(ctx.opponent, m, ctx.engine));
            msg = `对方猜错了（${aiGuess}，实际是${guess}），双方怪兽区全破坏`;
        }
        // 当回合不能特殊召唤
        ctx.player.cannotSpecialSummonThisTurn = true;
        return msg + "；当回合不能特殊召唤";
    },

    // 融合召唤
    fusionSummon(ctx) {
        if (!canSpecialSummon(ctx.player)) return "当回合不能特殊召唤";
        // 简化实现：检查手牌或场上是否有两只怪兽，特殊召唤一只高星怪兽
        // 山田凉效果②：融合素材时可用手牌魔法卡代替怪兽素材
        const fieldMonsters = ctx.player.monsterZone.filter(c => c.type === "monster");
        const handMonsters = ctx.player.hand.filter(c => c.type === "monster");
        const handSpells = ctx.player.hand.filter(c => c.type === "spell");
        const hasSpellSubstitute = fieldMonsters.some(c => c.fusionSubstituteSpell) || handMonsters.some(c => c.fusionSubstituteSpell);

        // 如果有融合替代效果，可以用1张魔法卡代替1只怪兽
        const availableMonsters = [...fieldMonsters, ...handMonsters].filter(m => !m.cannotUseAsMaterial);
        if (hasSpellSubstitute && handSpells.length > 0) {
            // 需要至少1只怪兽 + 1张魔法卡
            if (availableMonsters.length < 1) return "没有怪兽可用于融合";
        } else {
            if (availableMonsters.length < 2) return "场上和手牌怪兽不足2只，无法融合";
        }

        // 从场上选第一只怪兽
        const fuse1 = availableMonsters[0];
        let fuse2;
        const usedSpellSubstitute = hasSpellSubstitute && handSpells.length > 0 && availableMonsters.length < 2;

        if (usedSpellSubstitute) {
            // 用魔法卡代替第二只怪兽
            fuse2 = handSpells[0];
        } else {
            // 正常融合：第二只怪兽
            fuse2 = availableMonsters.find(m => m !== fuse1);
        }

        const materials = [fuse1, fuse2];
        const releasedSlots = materials.filter(material => ctx.player.monsterZone.includes(material)).length;
        if (ctx.player.monsterZone.length - releasedSlots >= GAME_CONFIG.MAX_MONSTER_ZONE) return "没有可用的怪兽区域";
        // 融合素材是送墓而非破坏：不触发被破坏效果，也不能直接消失。
        for (const material of materials) {
            if (ctx.player.monsterZone.includes(material)) {
                sendMonsterToGraveyard(ctx.player, material, ctx.engine, "fusion");
            } else {
                ctx.player.hand.splice(ctx.player.hand.indexOf(material), 1);
                resetCardState(material);
                ctx.player.graveyard.push(material);
                const event = { sourcePlayer:ctx.player, sourceCard:material, sentCard:material, cause:"fusion" };
                ctx.engine.emit("onSentToGraveyard", event);
                ctx.engine.triggerEvent("onSentToGraveyard", event);
            }
        }

        // 合体后的怪兽
        const atk1 = fuse1?.type === "monster" ? (fuse1?.attack || 0) : 0;
        const def1 = fuse1?.type === "monster" ? (fuse1?.defense || 0) : 0;
        const atk2 = fuse2?.type === "monster" ? (fuse2?.attack || 0) : 0;
        const def2 = fuse2?.type === "monster" ? (fuse2?.defense || 0) : 0;
        const fusedAtk = (atk1 + atk2) * 1.5 + (usedSpellSubstitute ? 300 : 0);
        const fusedDef = (def1 + def2) * 1.2 + (usedSpellSubstitute ? 200 : 0);
        const lv1 = fuse1?.type === "monster" ? (fuse1?.level || 1) : 1;
        const lv2 = fuse2?.type === "monster" ? (fuse2?.level || 1) : 1;
        const fusedLevel = Math.min(12, lv1 + lv2);

        const fusionMonster = createCardInstance({
            id: "fusion_" + Date.now(),
            name: `${fuse1?.name || "?"} & ${fuse2?.name || "?"}`,
            type: "monster",
            attribute: fuse1?.attribute || fuse2?.attribute || "dark",
            race: "warrior",
            level: fusedLevel,
            attack: Math.floor(fusedAtk),
            defense: Math.floor(fusedDef),
            rarity: "UR",
            effects: [],
        });
        fusionMonster.currentAttack = Math.floor(fusedAtk);
        fusionMonster.currentDefense = Math.floor(fusedDef);
        fusionMonster.currentHealth = fusionMonster.currentDefense;
        fusionMonster.faceUp = true;
        fusionMonster.position = MONSTER_POSITION.ATTACK;
        fusionMonster.canAttack = !ctx.engine.state.firstTurn && !ctx.player.skipBattlePhase;
        fusionMonster.setTurn = ctx.engine.state.turn;

        ctx.player.monsterZone.push(fusionMonster);
        const specialResult = ctx.engine._emitSpecialSummon(ctx.player, fusionMonster, "fusion");
        const substituteMsg = usedSpellSubstitute ? "（魔法卡作为融合素材）" : "";
        return `融合召唤了${fusionMonster.name}${substituteMsg} (ATK/${fusionMonster.attack} DEF/${fusionMonster.defense})${specialResult ? `，${specialResult}` : ""}`;
    },
};

export function hasEffectHandler(effectType) {
    return typeof effectHandlers[effectType] === "function";
}

/**
 * 主题动作的目标类型：玩家手动发动时可手选目标（AI/无 UI 环境仍走默认"最高/最低"）。
 * 群体动作与自我强化保持 none。
 */
function themedActionTargetType(effect) {
    const params = effect?.params || {};
    switch (effect?.action) {
        case "freeze": case "sleep": case "poison": case "bomb": case "ignite":
        case "venom": case "bleed": case "curse": case "detonate": case "seal":
        case "burst": case "railgun": case "combust":
            return "enemy_monster";
        case "paralyze":
            return params.count === "all" ? "none" : "enemy_monster";
        case "exile":
            return params.self ? "none" : "enemy_monster";
        case "shelter": case "ward": case "exchange":
            return "self_monster";
        default:
            return "none";
    }
}

// ======================== 规则引擎 ========================
export class GameEngine {
    constructor(gameState, rng = null) {
        this.state = gameState;
        this.rng = rng; // 可注入的 RNG：PvP 模式下使用 seeded RNG
        this.eventBus = new EventBus();
        this._setupDefaultListeners();
    }

    /** 返回 [0,1) 随机数，PvP 模式下使用同步 RNG */
    _random() {
        if (typeof this.rng === "function") return this.rng();
        if (this.rng && typeof this.rng.next === "function") return this.rng.next();
        return Math.random();
    }

    _setupDefaultListeners() {
        // 默认监听器可以在需要时扩展
    }

    // ---------- 事件系统 ----------
    emit(eventType, data) {
        this.state.logEvent(eventType, data);
        this.eventBus.emit(eventType, { ...data, engine: this, gameState: this.state });
    }

    /**
     * 将游戏事件交给卡牌效果层。emit 只负责日志和外部监听器，
     * 这样同一个事件不会因为 UI 监听而被重复结算。
     */
    triggerEvent(eventType, data = {}) {
        if (eventType === "onTurnStart" || eventType === "onTurnEnd") {
            const player = data.player;
            if (!player) return null;
            const sources = [...player.monsterZone.filter(card => card.faceUp), ...(player.fieldZone ? [player.fieldZone] : [])];
            const messages = sources
                .map(card => this.triggerAllEffects(player, card, eventType, data))
                .filter(Boolean);
            return messages.join("，") || null;
        }

        const sourceCard = data.sourceCard || data.summonedCard || data.destroyedCard;
        const sourcePlayer = data.sourcePlayer || data.owner;
        if (!sourceCard || !sourcePlayer) return null;
        return this.triggerAllEffects(sourcePlayer, sourceCard, eventType, data);
    }

    /** 结算非攻击类盖放陷阱。玩家的陷阱由 UI 确认后结算，AI 默认发动。 */
    _resolveReactiveTraps(owner, triggerType, eventContext = {}) {
        if (!owner || triggerType === "onAttacked" || this._resolvingReactiveTrap) return "";
        const eligible = this._eligibleReactiveTraps(owner, triggerType, eventContext);
        if (eligible.length === 0) return "";
        // 玩家的陷阱：不在结算中途用浏览器原生弹窗打断，改为在此刻（尚无任何副作用）
        // 挂起并请求 UI 确认；玩家勾选后由 resolveReactiveTrapConfirm 继续结算。
        if (typeof this.trapConfirmHandler === "function" && owner === this.state.players[0]
            && !(this._trapDecisionCache instanceof Set)) {
            this._pendingReactiveTrapConfirm = { owner, triggerType, eventContext, traps: eligible };
            this.trapConfirmHandler({ traps: eligible, triggerType });
            return "";
        }
        return this._runReactiveTraps(owner, triggerType, eventContext, eligible);
    }

    _eligibleReactiveTraps(owner, triggerType, eventContext = {}) {
        return owner.spellTrapZone.filter(card => {
            if (card.type !== "trap" || !card.faceDown || !card.canActivate || card.setTurn >= this.state.turn) return false;
            return (card.effects || []).some(effect => getEffectTrigger(effect) === triggerType
                && (!effect.cost || this._checkCost(owner, effect.cost, { dryRun: true }).ok)
                && (effect.type !== "themedAction" || this.canActivateThemedEffect(owner, card, effect, eventContext)));
        });
    }

    _runReactiveTraps(owner, triggerType, eventContext = {}, eligible = null) {
        if (!Array.isArray(eligible)) eligible = this._eligibleReactiveTraps(owner, triggerType, eventContext);
        const depth = Number(eventContext.chainDepth) || 0;
        if (depth > CHAIN_RULES.maxChainDepth) return "";
        const messages = [];
        this._resolvingReactiveTrap = true;
        let activated = 0;
        try {
            for (const trap of eligible) {
                if (activated >= CHAIN_RULES.maxReactivePerWindow) break;
                const shouldActivate = this._trapDecide(owner, trap, triggerType, eventContext);
                if (!shouldActivate) continue;
                const effects = (trap.effects || []).filter(effect => getEffectTrigger(effect) === triggerType);
                const index = owner.spellTrapZone.indexOf(trap);
                if (index < 0) continue;
                owner.spellTrapZone.splice(index, 1);
                trap.faceDown = false;
                trap.canActivate = false;
                const paidCosts = [];
                for (const effect of effects) {
                    if (!effect.cost) continue;
                    if (this._checkCost(owner, effect.cost).ok) paidCosts.push(this.describeCost(effect.cost));
                }
                const result = this.triggerAllEffects(owner, trap, triggerType, { ...eventContext, reactiveTrap: true });
                owner.graveyard.push(trap);
                this.emit("onTrapActivated", { owner, trap, triggerType, sourceCard: trap, sourcePlayer: owner });
                const costSuffix = paidCosts.length ? `（${paidCosts.join("，")}）` : "";
                messages.push(`发动陷阱【${trap.name}】${costSuffix}${result ? `，${result}` : ""}`);
                activated++;
                // 陷阱响应陷阱：对方可用 onOpponentEffect 陷阱继续连锁（深度受限，避免循环）。
                if (depth + 1 <= CHAIN_RULES.maxChainDepth) {
                    const rival = owner === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
                    const chain = this._resolveReactiveTraps(rival, "onOpponentEffect", {
                        ...eventContext,
                        activatedCard: trap,
                        sourceCard: trap,
                        sourcePlayer: owner,
                        chainDepth: depth + 1,
                    });
                    if (chain) messages.push(chain);
                }
            }
        } finally {
            this._resolvingReactiveTrap = false;
        }
        return messages.join("，");
    }

    /** 玩家在确认浮层勾选后继续结算挂起的响应陷阱；期间消失/失效的陷阱自动跳过。 */
    resolveReactiveTrapConfirm(selectedIds = []) {
        const pending = this._pendingReactiveTrapConfirm;
        this._pendingReactiveTrapConfirm = null;
        if (!pending) return "";
        this._trapDecisionCache = new Set(selectedIds);
        try {
            return this._runReactiveTraps(pending.owner, pending.triggerType, pending.eventContext);
        } finally {
            this._trapDecisionCache = null;
        }
    }

    /**
     * 陷阱发动决策：确认浮层的勾选缓存优先（一次攻击/响应窗口内的决策），
     * 其次回退到同步 decider（兼容旧接口与测试），默认发动。
     */
    _trapDecide(owner, trap, triggerType, eventContext) {
        if (this._trapDecisionCache instanceof Set) return this._trapDecisionCache.has(trap.instanceId);
        if (typeof this.trapActivationDecider === "function") {
            return this.trapActivationDecider({ owner, trap, triggerType, eventContext }) !== false;
        }
        return true;
    }

    takePendingBattleTrapConfirm() {
        const pending = this.pendingBattleTrapConfirm;
        this.pendingBattleTrapConfirm = null;
        return pending || null;
    }

    armTrapDecisions(selectedIds = []) {
        this._trapDecisionCache = new Set(selectedIds);
    }

    clearTrapDecisions() {
        this._trapDecisionCache = null;
    }

    _emitSpecialSummon(player, card, reason = "effect") {
        const event = {
            sourceCard: card,
            sourcePlayer: player,
            summonedCard: card,
            specialSummon: true,
            reason,
        };
        this.emit("onSpecialSummon", event);
        return this.triggerEvent("onSpecialSummon", event);
    }

    // ---------- 元素克制 ----------
    getElementBonus() {
        // 游戏王式战斗不使用属性克制倍率，属性仅用于卡牌效果与构筑。
        return 1;
    }

    // ---------- 回合流程 ----------
    startTurn({ skipDraw = false } = {}) {
        this.state.turn++;
        this._restoreTemporaryBanishments();
        const player = this.state.currentPlayer;
        player.resetTurnState();
        // 盖放卡必须经过至少一次回合交换才可以发动。
        for (const owner of this.state.players) {
            owner.spellTrapZone.forEach(card => {
                if (card.faceDown) card.canActivate = card.setTurn < this.state.turn;
            });
        }
        // 场地魔法持续效果：每回合重新应用
        if (player.fieldZone && player.fieldZone.effects) {
            player.fieldSpellDiscardCost = false; // 先清除，由场地效果重新设置
            for (const eff of player.fieldZone.effects) {
                if (eff.trigger === "field" || eff.type?.startsWith("field")) {
                    this._executeEffect(player, player.fieldZone, eff);
                }
            }
        }
        this.state.phase = PHASE.DRAW;
        this.emit("onTurnStart", { player });
        this.triggerEvent("onTurnStart", { player });
        if (skipDraw) return { success: true, skipped: true, message: "先攻首回合跳过抽卡" };
        return this.drawCard(player);
    }

    _restoreTemporaryBanishments() {
        for (const holder of this.state.players) {
            const pending = holder._tempBanished || [];
            const remaining = [];
            for (const entry of pending) {
                if ((entry.returnTurn || Infinity) > this.state.turn) {
                    remaining.push(entry);
                    continue;
                }
                const owner = this.state.players[entry.ownerIndex];
                const card = entry.card;
                if (!owner || !card || owner.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) {
                    remaining.push(entry);
                    continue;
                }
                resetCardState(card);
                card.faceUp = true;
                card.faceDown = false;
                card.position = MONSTER_POSITION.ATTACK;
                card.setTurn = this.state.turn;
                card.canAttack = owner === this.state.currentPlayer
                    && !this.state.firstTurn
                    && !owner.skipBattlePhase;
                owner.monsterZone.push(card);
            }
            holder._tempBanished = remaining;
        }
    }

    advancePhase() {
        const order = [PHASE.DRAW, PHASE.STANDBY, PHASE.MAIN_1, PHASE.BATTLE, PHASE.MAIN_2, PHASE.END];
        const idx = order.indexOf(this.state.phase);
        // 目标选择/祭品选择等不在正常顺序内的阶段：indexOf 返回 -1，
        // 不加这层判断会被当成"还能前进"而把阶段跳回抽卡阶段。
        if (idx < 0) return;
        if (idx < order.length - 1) {
            this.state.phase = order[idx + 1];
            if (this.state.phase === PHASE.END) this.endTurn();
        }
    }

    endTurn() {
        if (this.state.gameOver) return;
        this.state.phase = PHASE.END;
        const player = this.state.currentPlayer;
        this.emit("onTurnEnd", { player });
        this.triggerEvent("onTurnEnd", { player });
        resolveThemedTurnEnd(this, player);
        for (const owner of this.state.players) {
            for (const card of owner.monsterZone) {
                card.tempEffects = (card.tempEffects || []).filter(effect => effect.duration !== DURATION.UNTIL_END_TURN);
                owner._recalcCardStats(card);
                card.doubleAttackThisTurn = false;
                // 回合级攻击记账必须一起清零：只清 doubleAttackThisTurn 会留下
                // attacksMadeThisTurn=2 / limit=1 的不一致状态。
                card.attacksMadeThisTurn = 0;
                card.hasAttackedThisTurn = false;
            }
        }
        // 朝比奈真冬的封锁持续到"持有者自己的结束阶段"：只在这里解除，而不在回合
        // 开始时解除，否则被封锁的怪兽在它自己的回合立刻恢复，封锁等于无效。
        player.monsterZone.forEach(card => { card.attackDisabledUntilEndPhase = false; });
        this.discardToEndLimit(player);
        // 先把所有"待选择"状态清掉，再做游戏结束判定：否则在对局因结束阶段的毒印/
        // 爆破伤害中断时，pendingTribute 等脏状态会被留在场上进入终局状态。
        this.state.pendingBattleReplay = null;
        this.state.selectedAttacker = null;
        this.state.pendingAction = null;
        this.state.validTargets = [];
        this.state.pendingTribute = null;
        this.state.tributeNeeded = 0;
        this.state.tributeSelected = [];
        if (this.checkGameOver()) return;
        this.state.switchPlayer();
        this.state.firstTurn = false;
    }

    drawCard(player) {
        const result = player.drawCard();
        if (result.card && this.state.phase !== PHASE.DRAW && !this._resolvingReactiveTrap) {
            const opponent = this.state.players.find(owner => owner !== player);
            const trapResult = this._resolveReactiveTraps(opponent, "onOpponentDraw", {
                drawnCard: result.card, sourceCard: result.card, sourcePlayer: player,
            });
            if (trapResult) result.message += `，${trapResult}`;
        }
        return result;
    }

    /**
     * 起手重抽（每个决斗者一次）：把手牌洗回卡组，再抽同样数量的卡。
     * 实测从真实卡池随机组的 40 张卡组里，39.2% 的起手只有需要祭品的怪兽，
     * 而空场时连盖放高星怪兽都做不到——重抽是消除这类"开局即失速"最便宜的手段。
     *
     * 关键细节：先只洗"剩下的卡组"并抽牌，再把换下去的手牌洗回卡组。
     * 如果直接把 5 张放回 40 张里重抽，很容易又抽回 2~3 张同样的牌
     * （期望重叠 5×5/20≈1.25 张），玩家会觉得重抽没用；
     * 这样处理后重抽必定拿到与原来不同的 5 张。
     * 洗牌使用引擎随机源（PvP 下是共享种子），保证可复现。
     */
    mulligan(player, handSize = GAME_CONFIG.START_HAND_SIZE) {
        if (!player || this.state.gameOver) return { success: false, cards: [], count: 0 };
        const returned = player.hand.splice(0, player.hand.length);
        player.deck = shuffleArray(player.deck, () => this._random());
        const drawn = [];
        for (let i = 0; i < handSize && player.deck.length > 0; i++) {
            const result = player.drawCard();
            if (result.card) drawn.push(result.card);
        }
        player.deck = shuffleArray([...player.deck, ...returned], () => this._random());
        return { success: true, cards: drawn, count: drawn.length };
    }

    resetFieldCard(card) { resetCardState(card); }
    destroyFieldMonster(owner, card) {
        const destroyed = destroyMonster(owner, card, this);
        // 领域源卡被效果破坏时立即清算它留下的 ongaku 攻防修。
        purgeOrphanDomainBuffs(this);
        return destroyed;
    }
    _themedContext(player, card, effect, eventContext = {}) {
        return { ...eventContext, player, card, effect, engine: this, gameState: this.state,
            opponent: this.state.players.find(owner => owner !== player) };
    }
    getMonsterEffectAvailability(player, card, index) {
        const blocked = reason => ({ canActivate: false, reason });
        const effect = card?.effects?.[index];
        if (this.state.gameOver || player !== this.state.currentPlayer) return blocked("等待自己的回合");
        if (![PHASE.MAIN_1, PHASE.MAIN_2].includes(this.state.phase)) return blocked("只能在主要阶段发动");
        if (!player.monsterZone.includes(card) || !card.faceUp || effect?.trigger !== "manual") return blocked("需要己方表侧怪兽的主动技");
        if (card.effectNegated || card.themedState?.sealedUntil >= this.state.turn) return blocked("效果已被无效或封印");
        if (Number(card.themedState?.statuses?.curse) > 0) return blocked("诅咒中，不能发动效果");
        if (activeDomain(this, this.state.opponentPlayer, "wuji")) return blocked("对方领域封锁怪兽效果");
        if (player.themedUses?.[`${card.id}:${index}`] === this.state.turn || (!card.rulesVersion && card.oncePerTurnUsed)) return blocked("本回合已发动");
        const cost = this._checkCost(player, effect.cost, { dryRun: true });
        if (!cost.ok) return blocked(cost.reason);
        if (!this._checkEffectCondition(player, effect.condition)) return blocked("未满足卡面发动条件");
        if (effect.action === "railgun" && (card.themedState?.charges || 0) < (effect.params?.charges || 2)) return blocked(`蓄力不足：${card.themedState?.charges || 0}/${effect.params?.charges || 2}`);
        if (effect.action === "charge" && card.themedState?.charges >= 3) return blocked("蓄力已达上限 3");
        if (effect.action === "ensemble" && card.hasAttackedThisTurn) return blocked("本回合已攻击，不能用攻击机会换取补给");
        const targetType = this.getEffectTargetType(effect);
        if (targetType !== "none" && !this.getValidTargets(player, effect).length) return blocked(effect.action === "combust" ? "需要已灼烧的合法表侧目标" : "没有合法目标");
        if (effect.type === "themedAction" && !this.canActivateThemedEffect(player, card, effect)) return blocked("资源或场面条件不足，请查看下方技能说明");
        return { canActivate: true, reason: "本回合可发动" };
    }

    canActivateThemedEffect(player, card, effect, eventContext = {}) {
        const index = card.effects.indexOf(effect);
        if (player.themedUses?.[`${card.id}:${index}`] === this.state.turn) return false;
        if (card.themedState?.sealedUntil >= this.state.turn) return false;
        return canResolveThemedEffect(this._themedContext(player, card, effect, eventContext));
    }

    // ---------- 通常召唤/盖放 ----------
    getTributeNeeded(level) {
        if (level >= 7) return 2;
        if (level >= 5) return 1;
        return 0;
    }

    normalSummon(player, cardIndex, position = "attack", faceDown = false) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (player !== this.state.currentPlayer) return { success: false, message: "只能在自己的回合召唤" };
        // normalSummonUsed is the authoritative turn flag. Keeping the
        // check independent from normalSummonTurn also preserves the
        // explicit reset used by effects and controller integrations.
        const summonedThisTurn = player.normalSummonUsed;
        if (summonedThisTurn && player.additionalNormalSummon <= 0) return { success: false, message: "本回合已进行过通常召唤" };
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) return { success: false, message: "只能在主要阶段召唤" };

        const card = player.hand[cardIndex];
        if (!card) return { success: false, message: "卡牌不存在" };
        if (card.type !== "monster") return { success: false, message: "只能召唤怪兽卡" };
        if (!faceDown && position !== MONSTER_POSITION.ATTACK) {
            return { success: false, message: "通常召唤只能为攻击表示，守备表示请盖放" };
        }
        if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE && this.getTributeNeeded(card.level) === 0) return { success: false, message: "怪兽区已满" };

        const needed = this.getTributeNeeded(card.level);
        if (player.monsterZone.length < needed) return { success: false, message: `需要${needed}只祭品，场上只有${player.monsterZone.length}只` };

        if (needed > 0) {
            this.state.pendingTribute = { player, cardIndex, card, needed, selected: [], previousPhase: this.state.phase, setFaceDown: faceDown };
            this.state.phase = PHASE.TRIBUTE_SELECT;
            this.state.tributeNeeded = needed;
            this.state.tributeSelected = [];
            return { success: true, message: `需要选择${needed}只祭品`, needsTribute: true, tributeNeeded: needed };
        }

        return this._executeSummon(player, cardIndex, position, faceDown);
    }

    selectTribute(card) {
        const pt = this.state.pendingTribute;
        if (!pt) return { success: false, message: "没有待处理的祭品选择" };
        if (!pt.player.monsterZone.includes(card)) return { success: false, message: "只能选择己方场上的怪兽作为祭品" };
        if (card.cannotUseAsMaterial) return { success: false, message: `${card.name}不能用作召唤素材` };
        if (Number(card?.themedState?.statuses?.curse) > 0) return { success: false, message: "被诅咒的怪兽不能作为祭品" };
        if (pt.selected.includes(card)) {
            pt.selected = pt.selected.filter(c => c !== card);
            return { success: true, message: `取消选择${card.name}` };
        }
        if (pt.selected.length >= pt.needed) return { success: false, message: "已选满祭品" };
        pt.selected.push(card);
        return { success: true, message: `选择了${card.name} (${pt.selected.length}/${pt.needed})` };
    }

    confirmTribute(position = "attack", faceDown = false) {
        const pt = this.state.pendingTribute;
        if (!pt) return { success: false, message: "没有待处理的祭品选择" };
        if (pt.player !== this.state.currentPlayer) return { success: false, message: "只能在自己的回合确认祭品" };
        if (pt.selected.length !== pt.needed) return { success: false, message: `还需要选择${pt.needed - pt.selected.length}只祭品` };
        if (pt.selected.some(card => !pt.player.monsterZone.includes(card) || card.cannotUseAsMaterial) || !pt.player.hand.includes(pt.card)) return { success: false, message: "祭品或召唤卡已经不在原区域" };
        for (const tribute of pt.selected) { sendMonsterToGraveyard(pt.player, tribute, this, "tribute"); }
        const wasSetFaceDown = pt.setFaceDown;
        this.state.pendingTribute = null;
        this.state.phase = pt.previousPhase || PHASE.MAIN_1;
        return this._executeSummon(pt.player, pt.player.hand.indexOf(pt.card), wasSetFaceDown ? MONSTER_POSITION.DEFENSE : position, wasSetFaceDown || faceDown);
    }

    cancelTribute() {
        if (!this.state.pendingTribute) return;
        this.state.phase = this.state.pendingTribute?.previousPhase || PHASE.MAIN_1;
        this.state.pendingTribute = null;
        this.state.tributeNeeded = 0;
        this.state.tributeSelected = [];
    }

    _executeSummon(player, cardIndex, position, faceDown) {
        const card = player.hand[cardIndex];
        player.hand.splice(cardIndex, 1);
        if (player.normalSummonUsed && player.additionalNormalSummon > 0) {
            player.additionalNormalSummon--;
        }
        card.position = faceDown ? MONSTER_POSITION.DEFENSE : position;
        card.faceUp = !faceDown;
        // 游戏王中通常召唤没有召唤疲劳：除先攻首回合或卡牌限制外，
        // 攻击表示怪兽在召唤当回合即可进入战斗阶段攻击。
        card.canAttack = !faceDown && !this.state.firstTurn && position === MONSTER_POSITION.ATTACK && !player.skipBattlePhase;
        // 一张卡可能先作为祭品/被效果送回卡组后再被抽到并召唤，destroyMonster 等
        // 路径会给离场的卡写入攻击计数。若只清 hasAttackedThisTurn 而不清
        // attacksMadeThisTurn，重新上场后 canAttack 为 true 却会在 attack() 中被
        // "本回合不能攻击" 拦下（UI 显示可攻击但攻击失败）。
        card.hasAttackedThisTurn = false;
        card.attacksMadeThisTurn = 0;
        card.positionChangedThisTurn = false;
        card.doubleAttackThisTurn = false;
        card.wasFlipSummoned = false;
        card.setTurn = this.state.turn;
        player.monsterZone.push(card);
        player.normalSummonUsed = true;
        player.normalSummonTurn = this.state.turn;

        let msg = faceDown ? `盖放了${card.name}` : `通常召唤了${card.name}`;
        const summonEvent = { sourceCard: card, sourcePlayer: player, summonedCard: card };
        this.emit("onSummon", summonEvent);

        if (!faceDown) {
            const effResult = this.triggerEvent("onSummon", summonEvent);
            if (effResult) msg += `，${effResult}`;
            const opponent = this.state.players.find(owner => owner !== player);
            const trapResult = this._resolveReactiveTraps(opponent, "onOpponentSummon", summonEvent);
            if (trapResult) msg += `，${trapResult}`;
        }
        return { success: true, message: msg, card };
    }

    // ---------- 魔法卡发动 ----------
    activateSpell(player, cardIndex, selectedTarget = null) {
        this._lastRevivedCard = null;
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (player !== this.state.currentPlayer) return { success: false, message: "只能在自己的回合发动魔法" };
        const card = player.hand[cardIndex];
        if (!card || card.type !== "spell") return { success: false, message: "不是魔法卡" };
        if (card.cannotActivateThisTurn) return { success: false, message: `${card.name}本回合不能发动` };
        const inMainPhase = this.state.phase === PHASE.MAIN_1 || this.state.phase === PHASE.MAIN_2;
        const resolvingSelection = selectedTarget && (this.state.phase === PHASE.TARGET_SELECT || this.state.phase === PHASE.GRAVEYARD_SELECT);
        if (!inMainPhase && !resolvingSelection) return { success: false, message: "只能在主要阶段发动魔法" };

        if (card.rulesVersion) {
            const playable = this.canPlayEffect(player, card);
            if (!playable.canPlay) return { success: false, message: playable.reason || "条件、资源不足或同名效果本回合已使用" };
        }
        const primaryEffect = card.effect || card.effects?.[0];
        const targetType = this.getEffectTargetType(primaryEffect);
        const requiresTarget = !["none", "enemy_player", "self_player", "both_players"].includes(targetType);
        if (requiresTarget && !selectedTarget) {
            return { success: false, needsTarget: true, message: "请选择合法目标", targetType };
        }
        if (requiresTarget) {
            const validTargets = this.getValidTargets(player, primaryEffect);
            const valid = validTargets.some(target => {
                if (target === selectedTarget) return true;
                if (target?.instanceId && selectedTarget?.instanceId) return target.instanceId === selectedTarget.instanceId;
                return false;
            });
            if (!valid) return { success: false, message: "目标已经失效或不是合法目标" };
        }

        // 先"干跑"校验全部成本：任意一项不足就整体失败，避免出现"已经支付了第一个
        // 效果的代价，却因为后面的检查失败导致这张卡根本没发动"的资源损失。
        // 干跑时排除这张卡自身：发动中的卡已经离开手牌，不能同时充当自己的弃牌代价。
        if (card.effects) {
            for (const eff of card.effects) {
                if (!eff.cost) continue;
                const costCheck = this._checkCost(player, eff.cost, { dryRun: true, exclude: card });
                if (!costCheck.ok) return { success: false, message: costCheck.reason };
            }
        }

        player.hand.splice(cardIndex, 1);

        // 确认可以发动后再实际支付代价，并且只支付本次真正会结算的效果的代价。
        // 付费文案回传进发动消息：玩家能看到 LP 为什么少了，而不是只看到卡效结算。
        const paidCosts = [];
        const payTrigger = card.isFieldSpell ? "field" : "manual";
        if (card.effects) {
            for (const eff of card.effects) {
                if (eff.cost && getEffectTrigger(eff) === payTrigger) {
                    if (this._checkCost(player, eff.cost).ok) paidCosts.push(this.describeCost(eff.cost));
                }
            }
        }
        const costSuffix = paidCosts.length ? `（${paidCosts.join("，")}）` : "";

        // 场地魔法处理：放入场地卡槽，替换旧场地卡
        if (card.isFieldSpell) {
            if (player.fieldZone) {
                player.graveyard.push(player.fieldZone);
            }
            player.fieldZone = card;
            card.faceDown = false;
            const result = this.triggerAllEffects(player, card, "field");
            return { success: true, message: `发动了场地魔法${card.name}${costSuffix}${result ? "，" + result : ""}`, card, isFieldSpell: true };
        }

        const result = selectedTarget
            ? this.triggerEffect(player, card, selectedTarget)
            : this.triggerAllEffects(player, card, "manual");
        player.graveyard.push(card);
        const opponent = this.state.players.find(owner => owner !== player);
        const trapResult = this._resolveReactiveTraps(opponent, "onOpponentSpell", {
            activatedCard: card, sourceCard: card, sourcePlayer: player,
        });
        return { success: true, message: `发动了${card.name}${costSuffix}${result ? "，" + result : ""}${trapResult ? "，" + trapResult : ""}`, card };
    }

    /** 代价的统一文案：发动消息、战斗日志与陷阱结算共用，避免把弃牌误报成"支付0LP"。 */
    describeCost(cost) {
        if (!cost) return "";
        if (cost.type === "payLife") return `支付${cost.value}LP`;
        if (cost.type === "discard") return `丢弃${cost.value}张手牌`;
        return "";
    }

    _checkCost(player, cost, { dryRun = false, exclude = null } = {}) {
        if (!cost) return { ok: true };
        switch (cost.type) {
            case "payLife":
                if (player.lp <= cost.value) return { ok: false, reason: `LP不足（需要${cost.value}，当前${player.lp}）` };
                if (!dryRun) player.takeDamage(cost.value);
                return { ok: true };
            case "discard": {
                // 可支付的手牌要排除"正在发动的卡"本身；支付前再校验一次数量，
                // 否则干跑通过、支付时手牌已空会往墓地里塞 undefined。
                const payable = () => exclude ? player.hand.filter(item => item !== exclude) : player.hand;
                if (payable().length < cost.value) {
                    return { ok: false, reason: cost.value > 1 ? `手牌不足（需要丢弃${cost.value}张）` : "手牌不足" };
                }
                if (dryRun) return { ok: true };
                for (let i = 0; i < cost.value; i++) {
                    const pool = payable();
                    if (pool.length === 0) break;
                    const picked = pool[Math.floor(this._random() * pool.length)];
                    player.graveyard.push(player.hand.splice(player.hand.indexOf(picked), 1)[0]);
                }
                return { ok: true };
            }
            default:
                return { ok: true };
        }
    }

    _checkEffectCondition(player, condition) {
        if (!condition) return true;
        const opponent = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        if (condition.opponentMinMonsterCount && opponent.monsterZone.length < condition.opponentMinMonsterCount) return false;
        if (condition.opponentMinSpellTrapCount && opponent.spellTrapZone.length < condition.opponentMinSpellTrapCount) return false;
        if (condition.selfMinGraveyardMonsters) {
            const count = player.graveyard.filter(card => card.type === "monster").length;
            if (count < condition.selfMinGraveyardMonsters) return false;
        }
        if (condition.allyMinCount && player.monsterZone.length < condition.allyMinCount) return false;
        return true;
    }

    // ---------- 盖放 ----------
    setCard(player, cardIndex) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (player !== this.state.currentPlayer) return { success: false, message: "只能在自己的回合盖放卡牌" };
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) return { success: false, message: "只能在主要阶段盖放卡牌" };
        const card = player.hand[cardIndex];
        if (!card) return { success: false, message: "卡牌不存在" };

        if (card.type === "trap" || card.type === "spell") {
            if (player.spellTrapZone.length >= GAME_CONFIG.MAX_SPELL_TRAP_ZONE) return { success: false, message: "魔法陷阱区已满" };
            player.hand.splice(cardIndex, 1);
            card.faceDown = true;
            card.canActivate = false;
            card.setTurn = this.state.turn;
            player.spellTrapZone.push(card);
            return { success: true, message: `盖放了${card.name}`, card };
        }

        // 里侧守备盖放怪兽
        if (card.type === "monster") {
            if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE && this.getTributeNeeded(card.level) === 0) return { success: false, message: "怪兽区已满" };
            const summonedThisTurn = player.normalSummonUsed;
            if (summonedThisTurn && player.additionalNormalSummon <= 0) return { success: false, message: "本回合已进行过通常召唤" };

            const needed = this.getTributeNeeded(card.level);
            if (player.monsterZone.length < needed) return { success: false, message: `需要${needed}只祭品，场上只有${player.monsterZone.length}只` };

            if (needed > 0) {
                this.state.pendingTribute = { player, cardIndex, card, needed, selected: [], previousPhase: this.state.phase, setFaceDown: true };
                this.state.phase = PHASE.TRIBUTE_SELECT;
                this.state.tributeNeeded = needed;
                this.state.tributeSelected = [];
                return { success: true, message: `需要选择${needed}只祭品`, needsTribute: true, tributeNeeded: needed };
            }

            return this._executeSummon(player, cardIndex, MONSTER_POSITION.DEFENSE, true);
        }

        return { success: false, message: "只能盖放魔法、陷阱或怪兽卡" };
    }

    // ---------- 盖放陷阱的主动翻开（自制规则：盖放一回合后可在主要阶段主动发动） ----------
    canActivateTrapManually(player, trap) {
        if (!trap || trap.type !== "trap") return { canActivate: false, reason: "这不是陷阱卡" };
        if (player !== this.state.currentPlayer) return { canActivate: false, reason: "只能在自己的回合主动翻开陷阱" };
        if (![PHASE.MAIN_1, PHASE.MAIN_2].includes(this.state.phase)) return { canActivate: false, reason: "只能在主要阶段主动翻开陷阱" };
        if (!player.spellTrapZone.includes(trap) || !trap.faceDown) return { canActivate: false, reason: "不是盖放状态的陷阱" };
        if (trap.setTurn >= this.state.turn) return { canActivate: false, reason: "盖放的回合不能发动" };
        if (trap.canActivate === false) return { canActivate: false, reason: "这张陷阱本回合不能发动" };
        return { canActivate: true, reason: "" };
    }

    activateSetTrap(player, trap) {
        const check = this.canActivateTrapManually(player, trap);
        if (!check.canActivate) return { success: false, message: check.reason };
        const effects = (trap.effects || []).filter(effect => effect.type === "themedAction"
            ? this.canActivateThemedEffect(player, trap, effect, { reactiveTrap: true, manualActivation: true })
            : getEffectTrigger(effect) === "manual");
        if (effects.length === 0) return { success: false, message: "当前不满足陷阱的发动条件" };
        const index = player.spellTrapZone.indexOf(trap);
        if (index < 0) return { success: false, message: "陷阱已经不在场上" };
        player.spellTrapZone.splice(index, 1);
        trap.faceDown = false;
        trap.canActivate = false;
        const messages = [];
        for (const effect of effects) {
            if (effect.cost && this._checkCost(player, effect.cost).ok) messages.push(this.describeCost(effect.cost));
            if (effect.type === "themedAction") {
                const effectIndex = (trap.effects || []).indexOf(effect);
                (player.themedUses ||= {})[`${trap.id}:${effectIndex}`] = this.state.turn;
            }
            const result = this._executeEffect(player, trap, effect, null, { reactiveTrap: true, manualActivation: true });
            if (result) messages.push(result);
        }
        player.graveyard.push(trap);
        this.emit("onTrapActivated", { owner: player, trap, triggerType: "manual", sourceCard: trap, sourcePlayer: player });
        // 主动翻开同样会引来对方的陷阱连锁。
        const rival = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        const chain = this._resolveReactiveTraps(rival, "onOpponentEffect", {
            activatedCard: trap, sourceCard: trap, sourcePlayer: player, chainDepth: 1,
        });
        if (chain) messages.push(chain);
        return { success: true, message: `主动翻开陷阱【${trap.name}】${messages.length ? `，${messages.join("，")}` : ""}`, card: trap };
    }

    canActivateSetSpell(player, card, selectedTarget = null) {
        if (!card || card.type !== "spell" || !card.faceDown) return { canActivate: false, reason: "这不是盖放的魔法卡" };
        if (player !== this.state.currentPlayer) return { canActivate: false, reason: "只能在自己的回合发动魔法" };
        if (!player.spellTrapZone.includes(card)) return { canActivate: false, reason: "该魔法卡不在你的后场" };
        if (card.setTurn >= this.state.turn && card.subtype === "quick_play") return { canActivate: false, reason: "速攻魔法盖放当回合不能发动" };
        if (this.state.currentPlayer !== player) return { canActivate: false, reason: "普通魔法只能在自己的回合发动" };
        // 与 activateSpell 保持一致：从目标选择界面确认时必须放行，否则"需要指定
        // 目标的盖放魔法"在 TARGET_SELECT/GRAVEYARD_SELECT 阶段会被直接拒绝，永远无法发动。
        const inMainPhase = this.state.phase === PHASE.MAIN_1 || this.state.phase === PHASE.MAIN_2;
        const resolvingSelection = !!selectedTarget
            && (this.state.phase === PHASE.TARGET_SELECT || this.state.phase === PHASE.GRAVEYARD_SELECT);
        if (!inMainPhase && !resolvingSelection) {
            return { canActivate: false, reason: "普通魔法只能在主要阶段发动" };
        }
        if (card.rulesVersion) {
            const playable = this.canPlayEffect(player, card);
            if (!playable.canPlay) return { canActivate: false, reason: playable.reason || "条件、资源不足或同名效果本回合已使用" };
        }
        const effect = card.effect || card.effects?.[0];
        const targetType = this.getEffectTargetType(effect);
        if (!["none", "enemy_player", "self_player", "both_players"].includes(targetType)
            && this.getValidTargets(player, effect).length === 0) {
            return { canActivate: false, reason: "没有合法目标" };
        }
        return { canActivate: true, reason: "" };
    }

    activateSetSpell(player, card, selectedTarget = null) {
        const check = this.canActivateSetSpell(player, card, selectedTarget);
        if (!check.canActivate) return { success: false, message: check.reason };
        const effect = card.effect || card.effects?.[0];
        const targetType = this.getEffectTargetType(effect);
        const requiresTarget = !["none", "enemy_player", "self_player", "both_players"].includes(targetType);
        if (requiresTarget && !selectedTarget) return { success: false, needsTarget: true, targetType, message: "请选择合法目标" };
        if (requiresTarget && !this.getValidTargets(player, effect)
            .some(target => target === selectedTarget || target.instanceId === selectedTarget?.instanceId)) {
            return { success: false, message: "目标已经失效或不是合法目标" };
        }
        if (card.rulesVersion) {
            // 与 activateSpell 相同的顺序：先干跑全部代价，确认付得起再实际支付。
            // 原来的实现只查第一段效果、并把所有失败都报成"LP不足"，弃牌类代价会被误报。
            const payTrigger = card.isFieldSpell ? "field" : "manual";
            for (const eff of card.effects || []) {
                if (!eff.cost) continue;
                const costCheck = this._checkCost(player, eff.cost, { dryRun: true });
                if (!costCheck.ok) return { success: false, message: costCheck.reason };
            }
            for (const eff of card.effects || []) {
                if (eff.cost && getEffectTrigger(eff) === payTrigger) this._checkCost(player, eff.cost);
            }
        }
        const paidCosts = card.rulesVersion
            ? (card.effects || []).filter(eff => eff.cost && getEffectTrigger(eff) === (card.isFieldSpell ? "field" : "manual")).map(eff => this.describeCost(eff.cost))
            : [];
        const costSuffix = paidCosts.length ? `（${paidCosts.join("，")}）` : "";
        const index = player.spellTrapZone.indexOf(card);
        if (index < 0) return { success: false, message: "盖放魔法已经不在场上" };
        player.spellTrapZone.splice(index, 1);
        card.faceDown = false;
        card.canActivate = false;
        if (card.isFieldSpell) {
            if (player.fieldZone) player.graveyard.push(player.fieldZone);
            player.fieldZone = card;
            const fieldMessage = this.triggerAllEffects(player, card, "field");
            return { success: true, message: `翻开发动场地魔法${card.name}${costSuffix}${fieldMessage ? `：${fieldMessage}` : ""}`, card, isFieldSpell: true };
        }
        const effectMessage = selectedTarget
            ? this.triggerEffect(player, card, selectedTarget)
            : this.triggerAllEffects(player, card, "manual");
        player.graveyard.push(card);
        return { success: true, message: `发动了${card.name}${costSuffix}：${effectMessage}`, card };
    }

    // ---------- 翻转召唤 ----------
    flipSummon(player, card) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (player !== this.state.currentPlayer) return { success: false, message: "只能在自己的回合翻转召唤" };
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) return { success: false, message: "只能在主要阶段翻转召唤" };
        if (!card) return { success: false, message: "没有选择怪兽" };
        if (card.faceUp) return { success: false, message: "该怪兽已经是表侧表示" };
        if (card.position !== MONSTER_POSITION.DEFENSE) return { success: false, message: "只能翻转里侧守备表示的怪兽" };
        if (card.setTurn === this.state.turn || card.themedState?.frozenUntil >= this.state.turn
            || card.themedState?.paralyzedUntil >= this.state.turn) return { success: false, message: "本回合盖放、冻结或麻痹的怪兽不能翻转召唤" };

        const idx = player.monsterZone.indexOf(card);
        if (idx === -1) return { success: false, message: "该怪兽不在场上" };

        // 翻转召唤变为表侧攻击表示，不占通常召唤次数。
        card.position = MONSTER_POSITION.ATTACK;
        card.canAttack = !this.state.firstTurn && !player.skipBattlePhase && !card.cannotAttack;
        card.faceUp = true;
        card.faceDown = false;
        card.wasFlipSummoned = true;
        card.positionChangedThisTurn = true;

        let msg = `翻转召唤了${card.name}`;
        // 触发翻转效果
        const flipEvent = { sourceCard: card, sourcePlayer: player, flippedCard: card };
        this.emit("onFlip", flipEvent);
        const flipResult = this.triggerEvent("onFlip", flipEvent);
        if (flipResult) msg += `，${flipResult}`;

        this.emit("onSummon", { sourceCard: card, sourcePlayer: player, summonedCard: card, isFlipSummon: true });
        return { success: true, message: msg, card };
    }

    // ---------- 手动攻守转换 ----------
    changePosition(player, card) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (player !== this.state.currentPlayer) return { success: false, message: "只能在自己的回合改变表示形式" };
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) return { success: false, message: "只能在主要阶段转换姿态" };
        if (!card) return { success: false, message: "没有选择怪兽" };
        if (!card.faceUp) return { success: false, message: "里侧怪兽不能手动转换姿态" };
        // 大师规则：召唤当回合不能变更表示形式（GAME_CONFIG.ALLOW_SUMMON_TURN_POSITION_CHANGE
        // 打开后放行，属于自制规则）。已经攻击过的怪兽由下面的分支给出更具体的提示。
        if (card.setTurn === this.state.turn && !card.hasAttackedThisTurn
            && !GAME_CONFIG.ALLOW_SUMMON_TURN_POSITION_CHANGE) {
            return { success: false, message: "本回合召唤或盖放的怪兽不能手动改变表示形式" };
        }
        if (card.themedState?.frozenUntil >= this.state.turn || card.themedState?.paralyzedUntil >= this.state.turn) return { success: false, message: "冻结或麻痹期间不能改变表示形式" };
        if (card.positionChangedThisTurn) return { success: false, message: "该怪兽本回合已经转换过姿态" };
        if (card.hasAttackedThisTurn) return { success: false, message: "已经攻击过的怪兽本回合不能转换姿态" };

        const idx = player.monsterZone.indexOf(card);
        if (idx === -1) return { success: false, message: "该怪兽不在场上" };

        // 场地魔法效果：变守备表示需丢1手牌（必须先确认怪兽确实在场，否则会白白
        // 丢掉一张手牌却什么都没发生）。
        const isSwitchingToDefense = card.position === MONSTER_POSITION.ATTACK;
        const opponent = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        if (isSwitchingToDefense && opponent.fieldSpellDiscardCost) {
            if (player.hand.length === 0) return { success: false, message: "场地魔法效果：变守备表示需丢弃1张手牌，但手牌不足" };
            const discarded = player.hand.pop();
            player.graveyard.push(discarded);
        }

        const oldPos = card.position;
        card.position = oldPos === MONSTER_POSITION.ATTACK ? MONSTER_POSITION.DEFENSE : MONSTER_POSITION.ATTACK;
        card.positionChangedThisTurn = true;
        // 未攻击的怪兽由守备转为攻击后可以攻击。
        card.canAttack = card.position === MONSTER_POSITION.ATTACK && !card.cannotAttack && !this.state.firstTurn && !player.skipBattlePhase;

        const posName = card.position === MONSTER_POSITION.ATTACK ? "攻击表示" : "守备表示";
        let msg = `${card.name}变为${posName}`;
        if (isSwitchingToDefense && opponent.fieldSpellDiscardCost) {
            msg += "（场地魔法效果：丢弃1张手牌）";
        }
        return { success: true, message: msg, card };
    }

    // ---------- 效果处理 ----------
    triggerAllEffects(player, card, triggerType, eventContext = {}) {
        if (this.state.gameOver || !card) return null;
        const resolvingMonsterTarget = !!eventContext.selectedTarget
            && (this.state.phase === PHASE.TARGET_SELECT || this.state.phase === PHASE.GRAVEYARD_SELECT);
        if (triggerType === "manual" && card.type === "monster" &&
            (player !== this.state.currentPlayer || !player.monsterZone.includes(card) || !card.faceUp ||
             (!resolvingMonsterTarget && ![PHASE.MAIN_1, PHASE.MAIN_2].includes(this.state.phase)))) return null;
        if (card.effectNegated || card.themedState?.sealedUntil >= this.state.turn) return null;
        if (Number(card.themedState?.statuses?.curse) > 0) return null;
        // 无量空处：player 的对手场上有激活领域时，player 的怪兽不能发动效果。
        // 卡面只写"对方怪兽不能发动效果"，魔法/陷阱不受影响（持有者自身也不受影响）。
        const opposingPlayer = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        if (card.type === "monster" && activeDomain(this, opposingPlayer, "wuji")) return null;
        const effects = card.effects || [];
        if (!effects.length && card.effect) return this._triggerLegacyEffect(player, card, triggerType, eventContext);
        const messages = [];
        for (const [index, eff] of effects.entries()) {
            if (getEffectTrigger(eff) !== triggerType) continue;
            if (eventContext.effectIndex != null && eventContext.effectIndex !== index) continue;
            if (!this._checkEffectCondition(player, eff.condition)) continue;
            const themed = eff.type === "themedAction";
            const key = `${card.id}:${index}`;
            if (themed && !this.canActivateThemedEffect(player, card, eff, eventContext)) continue;
            if (!themed && (eff.oncePerTurn || eff.limit?.oncePerTurn) && card.oncePerTurnUsed) continue;
            if (eff.limit?.phase && !eff.limit.phase.includes(this.state.phase)) continue;
            if (eff.limit?.onlyDuringOwnTurn && player !== this.state.currentPlayer) continue;
            // 怪兽的自带代价：手动发动与登场/离场等自闭触发都在这里支付；
            // 魔法的代价在 activateSpell 里支付，陷阱由响应链单独支付，不能重复扣。
            if (card.type === "monster" && eff.cost) {
                const paid = this._checkCost(player, eff.cost);
                if (!paid.ok) continue;
                messages.push(this.describeCost(eff.cost));
            }
            if (themed) (player.themedUses ||= {})[key] = this.state.turn;
            else if (eff.oncePerTurn || eff.limit?.oncePerTurn) card.oncePerTurnUsed = true;
            const selectedTarget = eventContext.selectedTarget ?? (triggerType === "onAttacked" ? eventContext.attacker : null);
            const result = this._executeEffect(player, card, eff, selectedTarget, eventContext);
            if (result) messages.push(result);
        }
        if (triggerType === "manual" && card.type === "monster" && !eventContext.reactiveTrap) {
            const opponent = this.state.players.find(owner => owner !== player);
            const trapResult = this._resolveReactiveTraps(opponent, "onOpponentEffect", {
                activatedCard: card, sourceCard: card, sourcePlayer: player,
            });
            if (trapResult) messages.push(trapResult);
        }
        return messages.join("，") || null;
    }

    _executeEffect(player, card, eff, selectedTarget = null, eventContext = {}) {
        const opp = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;

        // 检查效果处理器是否存在
        const handler = effectHandlers[eff.type];
        if (!handler) return null;

        // 构建上下文。玩家手动选择的目标优先于数据中的自动选择器。
        const targetSpec = eff.target;
        let targets = selectedTarget ? [selectedTarget] : [];
        if (!selectedTarget && targetSpec) {
            targets = resolveTargets(this, player, targetSpec);
        }

        const ctx = {
            ...eventContext,
            gameState: this.state,
            player,
            opponent: opp,
            sourcePlayer: player,
            sourceCard: card,
            card,
            target: targets[0] || null,
            targets,
            value: eff.value || 0,
            event: getEffectTrigger(eff),
            engine: this,
            targetSpec,
            duration: eff.duration,
            effect: eff,
        };

        // 宫崎奏效果②：对方回合对方发动效果时，数值增减减半；非数值效果则对方丢1张手牌
        const isOpponentTurn = player === this.state.opponentPlayer;
        if (isOpponentTurn && eff.type !== "effectDisruptor" && eff.type !== "recycleWaterAndProtect" && eff.type !== "buffAllyOnDestroy") {
            const disruptor = this.state.currentPlayer.monsterZone.find(m => m.effectDisruptor);
            if (disruptor && !disruptor._disruptionUsedThisTurn) {
                const statEffectTypes = [
                    "buffSelfAttack", "buffSelfDefense", "debuffEnemyAttack", "debuffAllEnemyAttack",
                    "buffAllAlliesAttack", "damageAllEnemyMonsters", "modifyStat", "damageTarget",
                    "damageAndHeal", "directDamage", "lifesteal", "healPlayer", "healAllAllies",
                ];
                const isStatEffect = statEffectTypes.includes(eff.type);
                if (!isStatEffect) {
                    // 非数值效果：执行后让对方丢1张手牌
                    const result = handler(ctx);
                    if (player.hand.length > 0) {
                        const discarded = player.hand.pop();
                        player.graveyard.push(discarded);
                        disruptor._disruptionUsedThisTurn = true;
                        return (result ? result + "，" : "") + `${player.name}被干扰丢弃了${discarded.name || "1张手牌"}`;
                    }
                    return result;
                }
                // 数值增减减半
                ctx.value = Math.floor(ctx.value / 2);
                ctx._disrupted = true;
                disruptor._disruptionUsedThisTurn = true;
            }
        }

        return handler(ctx);
    }

    _triggerLegacyEffect(player, card, triggerType = "manual", eventContext = {}) {
        const eff = card.effect;
        if (!eff) return null;
        if (getEffectTrigger(eff) !== triggerType) return null;
        const opp = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        const handler = effectHandlers[eff.type];
        if (!handler) return null;
        const ctx = {
            ...eventContext,
            gameState: this.state,
            player,
            opponent: opp,
            sourcePlayer: player,
            sourceCard: card,
            card,
            target: eventContext.selectedTarget || null,
            targets: eventContext.selectedTarget ? [eventContext.selectedTarget] : [],
            value: eff.value || 0,
            event: getEffectTrigger(eff),
            engine: this,
            targetSpec: null,
            duration: null,
        };
        return handler(ctx);
    }

    triggerEffect(player, card, selectedTarget = null) {
        return this.triggerAllEffects(player, card, "manual", { selectedTarget });
    }

    // ---------- 兼容旧的 getEffectTargetType ----------
    getEffectTargetType(effect) {
        if (!effect) return "none";
        if (effect.type === "themedAction") return themedActionTargetType(effect);
        const map = { damageTarget: "enemy_monster_or_player", destroyTarget: "enemy_monster", reviveToHand: "graveyard", recoverMonster: "graveyard", destroySpellTrap: "enemy_spell_trap", damageAndHeal: "enemy_monster_or_player", damageAllEnemyMonsters: "none", destroyAllEnemyMonsters: "none", buffSelfAttack: "none", buffSelfDefense: "none", healPlayer: "none", drawCards: "none", debuffEnemyAttack: "enemy_monster", debuffEnemyDefense: "enemy_monster", debuffAllEnemyAttack: "none", buffAllAlliesAttack: "none", directDamage: "enemy_player", damageBothPlayers: "none", reflectDamage: "none", counterAndDamage: "none", reduceDamage: "none", destroyAttacker: "none", lifesteal: "none", healAllAllies: "none", priorityTarget: "none", conditionalBuff: "none", searchWaterMonster: "none", targetProtect: "none", switchDefenseRedirect: "none", bounceBackrow: "none", recycleWaterAndProtect: "none", effectDisruptor: "none", buffAllyOnDestroy: "none", lockAttack: "enemy_monster", fieldWaterBuff: "none", fieldOceanScene: "none", reviveRecentGraveyardV2: "none", recoverAndDrawV2: "none", healDrawNoSpecial: "none", discardAndDraw: "none", mutualHandRefresh: "none", guessGameV2: "none", recycleSpellDraw: "none", fusionSubstituteSpell: "none", searchSpellByDiscard: "none", discardToDisableAttack: "enemy_monster", gameThroneDraw: "none", cancelAttackAndReturn: "enemy_monster", preventDestructionByBanish: "none", trapStackAndRecover: "none", temporaryBanish: "enemy_monster", negateCounterEffect: "enemy_monster_or_player" };
        if (effect.type === "specialSummonFromGraveyard") return "graveyard";
        return map[effect.type] || "none";
    }

    getValidTargets(player, effect) {
        const tt = this.getEffectTargetType(effect);
        const opp = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        // 卡面声明了 target（owner/selector/filters）时，合法目标必须以声明为准：
        // 否则"破坏攻击力最高/最低的怪兽"这类效果可以被改成攻击任意怪兽。
        if (effect?.target?.owner) {
            return resolveTargets(this, player, effect.target);
        }
        switch (tt) {
            case "enemy_monster": return [...opp.monsterZone].filter(m => !m.cannotBeTargeted
                && (effect?.type !== "themedAction" || m.faceUp)
                && (effect?.action !== "combust" || Number(m.themedState?.statuses?.burn) > 0));
            case "enemy_monster_or_player": return [...opp.monsterZone.filter(m => !m.cannotBeTargeted), { instanceId: "player_" + opp.name, isPlayer: true, name: opp.name, currentDefense: opp.lp }];
            case "self_monster": return effect?.type === "themedAction"
                ? player.monsterZone.filter(m => m.faceUp)
                : [...player.monsterZone];
            case "graveyard": return player.graveyard.filter(c => c.type === "monster");
            case "enemy_spell_trap": return [...opp.spellTrapZone];
            default: return [];
        }
    }

    canPlayEffect(player, card) {
        if (card.rulesVersion) {
            // 代价检查必须走 _checkCost：LP / 弃牌等不同类型的资源耗尽条件不同，
            // 用 player.lp > cost.value 统一判断会把弃牌代价误判成可用（或反之）。
            const failedCost = (card.effects || [])
                .filter(effect => effect.cost)
                .map(effect => this._checkCost(player, effect.cost, { dryRun: true, exclude: card }))
                .find(check => !check.ok);
            if (failedCost) return { canPlay: false, reason: failedCost.reason };
            const available = card.effects.some(effect =>
                effect.trigger === "manual" && this.canActivateThemedEffect(player, card, effect));
            return { canPlay: available, reason: available ? "" : "条件、资源不足或同名效果本回合已使用" };
        }
        if (!card.effect && (!card.effects || card.effects.length === 0)) return { canPlay: true, reason: "" };
        const tt = this.getEffectTargetType(card.effect || (card.effects && card.effects[0]));
        if (tt === "none" || tt === "enemy_player" || tt === "self_player" || tt === "both_players") return { canPlay: true, reason: "" };
        const targets = this.getValidTargets(player, card.effect || (card.effects && card.effects[0]));
        return targets.length > 0 ? { canPlay: true, reason: "" } : { canPlay: false, reason: "没有合法目标" };
    }

    // ---------- 攻击 ----------
    getEffectiveAttack(monster) {
        if (monster.position === MONSTER_POSITION.DEFENSE) return 0;
        if (monster.cannotAttack) return 0;
        return monster.currentAttack;
    }

    getEffectiveDefense(monster) { return monster.currentDefense; }

    /**
     * 攻击响应窗口。
     *
     * 原来的实现用 find() 只取第一张符合条件的盖放陷阱，等于"一次攻击只能有一张
     * 陷阱响应"——而全游戏 45 张陷阱全部只有 onAttacked 这一个触发时机，于是所有
     * 陷阱卡在实战里退化成同一种玩法。这里改成按连锁顺序结算**最多 2 张**陷阱，
     * 减伤累加、任意一张声明"无效攻击"即视为攻击被取消，保持单张响应时行为完全不变。
     */
    _resolveBattleTrap(attacker, target, attackerOwner, defenderOwner) {
        this._lastActivatedTrap = null;
        const attackEvent = { attacker, target, attackerOwner, defenderOwner };
        this.emit("onAttacked", attackEvent);

        // 只有声明了 onAttacked 的盖放陷阱才能响应攻击；不能因为后场第一张
        // 卡是手动魔法/其它触发时机，就被错误消耗。
        const negationCap = Math.max(0, Number(BATTLE_RULES.maxAttackNegationsPerTurn) || 0);
        const negationCost = Math.max(0, Number(BATTLE_RULES.attackNegationLpCost) || 0);
        const negationsUsed = Number(defenderOwner.attackNegationsThisTurn) || 0;
        const eligible = defenderOwner.spellTrapZone.filter(card => {
            if (card.type !== "trap" || !card.faceDown || !card.canActivate || card.setTurn >= this.state.turn) return false;
            const trapEffects = card.effects?.length ? card.effects : card.effect ? [card.effect] : [];
            // 高稀有度陷阱和魔法一样要付真实费用（卡面已写明）。付不起就不发动、
            // 也不消耗这张卡——否则"用不起的卡被系统白白浪费"是纯粹的负体验。
            const trapCost = trapEffects.find(effect => effect.cost)?.cost;
            if (trapCost && !this._checkCost(defenderOwner, trapCost, { dryRun: true }).ok) return false;
            if (isNegationTrap(card)) {
                // 本回合的无效化次数已用完，或付不起代价时，不消耗这张陷阱
                // （陷阱不会被浪费，留到下一个回合使用）。0 表示不限制/免费。
                if (negationCap > 0 && negationsUsed >= negationCap) return false;
                if (negationCost > 0 && defenderOwner.lp <= negationCost) return false;
            }
            return trapEffects.some(effect => getEffectTrigger(effect) === "onAttacked"
                && (effect.type !== "themedAction"
                    || this.canActivateThemedEffect(defenderOwner, card, effect, { ...attackEvent, battle: {} })));
        });
        if (eligible.length === 0) return { canceled: false, reduction: 0, message: "", chainLength: 0 };

        // 玩家后场的陷阱：挂起（此刻无任何副作用）等待 UI 确认，确认后由控制器
        // 恢复 selectedAttacker 并重放本次攻击（与战斗卷回重放同一模式）。
        if (typeof this.trapConfirmHandler === "function" && defenderOwner === this.state.players[0]
            && !(this._trapDecisionCache instanceof Set)) {
            const confirmWindow = eligible.slice(0, Math.max(1, Number(BATTLE_RULES.maxResponseTraps) || 1));
            this.pendingBattleTrapConfirm = { attacker, target, attackerOwner, defenderOwner, traps: confirmWindow };
            this.trapConfirmHandler({ traps: confirmWindow, triggerType: "onAttacked" });
            return { canceled: false, reduction: 0, message: "", chainLength: 0, pendingConfirm: true };
        }

        const battle = { canceled: false, reduction: 0 };
        const messages = [];
        let chainLength = 0;
        for (const trap of eligible.slice(0, Math.max(1, Number(BATTLE_RULES.maxResponseTraps) || 1))) {
            if (!this._trapDecide(defenderOwner, trap, "onAttacked", attackEvent)) {
                continue;
            }
            const effects = trap.effects?.length ? trap.effects : trap.effect ? [trap.effect] : [];
            const idx = defenderOwner.spellTrapZone.indexOf(trap);
            if (idx >= 0) defenderOwner.spellTrapZone.splice(idx, 1);
            trap.faceDown = false;
            trap.canActivate = false;
            defenderOwner.graveyard.push(trap);
            if (!this._lastActivatedTrap) this._lastActivatedTrap = trap; // 动画用第一张
            chainLength++;

            // 费用必须在效果结算前支付（卡面读作"支付600LP；<效果>"）。
            // 付不起的分支已在 eligible 过滤里排除，走到这里一定付得起。
            const paidCost = effects.find(effect => effect.cost)?.cost;
            if (paidCost) {
                this._checkCost(defenderOwner, paidCost);
                messages.push(this.describeCost(paidCost));
            }

            const effectMessage = this.triggerAllEffects(defenderOwner, trap, "onAttacked", {
                ...attackEvent,
                sourceCard: trap,
                sourcePlayer: defenderOwner,
                selectedTarget: attacker,
                defenderMonster: target,
                battle,
            });

            for (const effect of effects) {
                if (getEffectTrigger(effect) !== "onAttacked") continue;
                if (effect.type === "reduceDamage") {
                    battle.reduction += Math.max(0, Number(effect.value) || 0);
                }
                if (NEGATION_EFFECT_TYPES.has(effect.type)) {
                    battle.canceled = true;
                }
            }
            if (effects.some(effect => getEffectTrigger(effect) === "onAttacked" && effect.type === "destroyAttacker")
                && hasResonance(defenderOwner, 2)) {
                attackerOwner.takeDamage(500);
                messages.push("共鸣追加500点伤害");
            }
            messages.push(`发动陷阱【${trap.name}】${effectMessage ? `，${effectMessage}` : ""}`);
            // 记录本回合已用的无效化次数，并支付无效化代价
            if (isNegationTrap(trap) && battle.canceled) {
                defenderOwner.attackNegationsThisTurn = negationsUsed + 1;
                if (negationCost > 0) {
                    defenderOwner.takeDamage(negationCost);
                    messages.push(`支付${negationCost}LP`);
                }
            }
            // 已经有陷阱取消了这次攻击，后面的陷阱不再连锁（攻击对象已不存在）
            if (battle.canceled) break;
        }

        return {
            canceled: battle.canceled,
            reduction: battle.reduction,
            chainLength,
            message: `${defenderOwner.name}${messages.join("；")}`,
        };
    }

    discardToEndLimit(player, selectedInstanceIds = null) {
        return player.discardToLimit(GAME_CONFIG.END_HAND_LIMIT, selectedInstanceIds);
    }

    // ---------- 战斗结果预览 ----------
    /**
     * 预测一次攻击的结果（纯函数，不修改任何状态），供界面显示"这一击会发生什么"。
     * 规则必须与 attack() 保持一致：测试里用同一批场景交叉验证"预览结论 == 实际结算"，
     * 一旦两边逻辑漂移就会失败。
     */
    predictBattle(attacker, target) {
        if (!attacker) return null;
        if (target && target !== "player" && !target.faceUp) return {
            outcome: "unknown", damage: null, damageTo: null, targetDestroyed: null, attackerDestroyed: null,
            destroyed: null, text: "盖放目标：翻开前无法预估结果", conditional: true,
        };
        const attackerImmune = () => !!(attacker.cannotBeDestroyedByBattle || attacker.destructionPreventedThisTurn
            || attacker.themedState?.shelterUntil >= this.state.turn);
        const targetImmune = target && target !== "player"
            ? () => !!(target.cannotBeDestroyedByBattle || target.destructionPreventedThisTurn
                || target.themedState?.shelterUntil >= this.state.turn)
            : () => true;
        /** 统一返回结构：destroyed = 有无破坏（音效/动画用），另给两个明确的归属标记。 */
        const shape = (outcome, damage, damageTo, targetDestroyed, attackerDestroyed, text) => ({
            outcome, damage, damageTo, text: `${text}（未计响应效果）`, conditional: true,
            targetDestroyed, attackerDestroyed,
            destroyed: targetDestroyed || attackerDestroyed,
        });

        if (target === "player") {
            const damage = this.getEffectiveAttack(attacker);
            return shape("direct", damage, damage > 0 ? "defender" : null, false, false,
                damage > 0 ? `直接攻击 ${damage}` : "直接攻击（0 伤害）");
        }
        if (!target) return null;
        const atk = Math.max(0, attacker.currentAttack || 0);
        // 罗针（破坏杀·罗针）挂在守方场上时，守方承受的战斗伤害减半（与 attack 同一取整规则）。
        const defenderHasRojin = () => !!activeDomain(this, this.state.opponentPlayer, "rojin");

        if (target.position === MONSTER_POSITION.DEFENSE || !target.faceUp) {
            const def = Math.max(0, this.getEffectiveDefense(target));
            if (atk > def) {
                const piercing = attacker.themedState?.piercingUntil >= this.state.turn
                    || attacker.piercingDamage
                    || attacker.effects?.some(effect => effect.type === "piercingDamage");
                let damage = piercing && !target.preventsBattleDamage ? Math.max(0, atk - def) : 0;
                damage = Math.max(0, damage - infinityReduction(target, this.state.turn));
                if (damage > 0 && defenderHasRojin()) damage = rojinHalved(damage);
                const destroyed = !targetImmune();
                return shape(destroyed ? "destroy" : "none", damage, damage > 0 ? "defender" : null, destroyed, false,
                    destroyed ? (damage > 0 ? `破坏 · 贯穿 ${damage}` : "破坏") : `${target.name} 不受战斗破坏`);
            }
            if (atk === def) {
                return shape("none", 0, null, false, false, "同值 · 无事发生");
            }
            let damage = attacker.preventsBattleDamage ? 0 : Math.max(0, def - atk);
            damage = Math.max(0, damage - infinityReduction(attacker, this.state.turn));
            return shape("lose", damage, damage > 0 ? "attacker" : null, false, false,
                damage > 0 ? `我方受 ${damage} 点伤害` : "我方不受伤害");
        }

        const oppAtk = Math.max(0, target.currentAttack || 0);
        if (atk > oppAtk) {
            let damage = target.preventsBattleDamage ? 0 : Math.max(0, atk - oppAtk);
            damage = Math.max(0, damage - infinityReduction(target, this.state.turn));
            if (damage > 0 && defenderHasRojin()) damage = rojinHalved(damage);
            const destroyed = !targetImmune();
            return shape(destroyed ? "destroy" : "none", damage, damage > 0 ? "defender" : null, destroyed, false,
                destroyed ? `破坏 · ${damage} 伤害` : `${target.name} 不受战斗破坏`);
        }
        if (atk === oppAtk && atk === 0) {
            return shape("none", 0, null, false, false, "双方 0 攻 · 均不破坏");
        }
        if (atk === oppAtk) {
            const selfDestroyed = !attackerImmune();
            const destroyed = !targetImmune();
            return shape("mutual", 0, null, destroyed, selfDestroyed,
                selfDestroyed ? "同攻 · 双方破坏" : "同攻 · 我方不受破坏");
        }
        let damage = attacker.preventsBattleDamage ? 0 : Math.max(0, oppAtk - atk);
        damage = Math.max(0, damage - infinityReduction(attacker, this.state.turn));
        const selfDestroyed = !attackerImmune();
        return shape("lose", damage, damage > 0 ? "attacker" : null, false, selfDestroyed,
            selfDestroyed ? `我方被破坏 · 受 ${damage} 点伤害` : `我方受 ${damage} 点伤害`);
    }

    /**
     * 战斗结算开始前快照出血：层数与总伤害。
     * destroyMonster 会清空离场怪兽的 themedState，战斗后再读会丢失，因此必须先快照。
     */
    _snapshotBleed(monster) {
        const stacks = Number(monster?.themedState?.statuses?.bleed) || 0;
        if (!monster || stacks <= 0) return null;
        return { monster, stacks, damage: (Number(monster.themedState.bleedDamage) || 0) * stacks };
    }

    /**
     * 出血结算：怪兽每次参与战斗后，其控制者受到快照伤害，随后层数-1。
     * 仍在场才衰减；已被破坏的怪兽随离场清空状态，无需衰减。
     * 怪物战斗（攻守双方）与直接攻击（仅攻击者）共用；被取消/卷回的攻击不得调用。
     */
    _settleBleed(owner, snapshot) {
        if (!owner || !snapshot) return;
        const { monster, stacks, damage } = snapshot;
        owner.takeDamage(damage);
        this.emit("onStatusTick", { card: monster, status: "bleed", damage });
        if (!owner.monsterZone.includes(monster)) return;
        const next = stacks - 1;
        // 净化等效果可能在快照后清掉 themedState/statuses，衰减前必须兜底重建。
        if (next > 0) {
            if (!monster.themedState) monster.themedState = {};
            if (!monster.themedState.statuses) monster.themedState.statuses = {};
            monster.themedState.statuses.bleed = next;
        } else if (monster.themedState?.statuses) {
            delete monster.themedState.statuses.bleed;
        }
    }

    attack(attacker, target) {
        const before = battleSnapshot(this.state, attacker, target);
        const result = this._resolveAttack(attacker, target);
        if (result.success) {
            result.report = battleReport(this.state, before, attacker, target, result);
            this.emit("onBattleResolved", result.report);
        }
        return result;
    }

    _resolveAttack(attacker, target) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (this.state.firstTurn && GAME_CONFIG.FIRST_TURN_NO_BATTLE) return { success: false, message: "先攻第一回合不能攻击" };
        if (this.state.phase !== PHASE.BATTLE) return { success: false, message: "只能在战斗阶段攻击" };
        const attackerOwner = this.state.currentPlayer;
        if (!attackerOwner.monsterZone.includes(attacker)) return { success: false, message: "只能使用己方场上的怪兽攻击" };
        const replaying = this.state.pendingBattleReplay?.attackerId === attacker.instanceId;
        if (!replaying && (!attacker.canAttack || (Number(attacker.attacksMadeThisTurn) || 0) >= getAttackLimit(attacker))) {
            return { success: false, message: "该怪兽本回合不能攻击" };
        }
        if (!attacker.faceUp || attacker.position === MONSTER_POSITION.DEFENSE) return { success: false, message: "守备表示怪兽不能攻击" };
        if (attacker.cannotAttack || attackerOwner.skipBattlePhase || attacker.themedState?.frozenUntil >= this.state.turn
            || attacker.themedState?.paralyzedUntil >= this.state.turn
            || activeDomain(this, this.state.opponentPlayer, "za_warudo")) return { success: false, message: "该怪兽不能攻击" };
        // 放学后的茶会效果：当回合不能直接攻击玩家
        if (target === "player" && attackerOwner.noDirectAttackThisTurn) {
            return { success: false, message: "场地魔法效果：当回合不能直接攻击玩家" };
        }

        const defenderOwner = this.state.opponentPlayer;
        if (target === "player") {
            if (defenderOwner.monsterZone.length > 0) return { success: false, message: "对方场上有怪兽时不能直接攻击" };
        } else if (!target || !defenderOwner.monsterZone.includes(target)) {
            return { success: false, message: "目标怪兽不在对方场上" };
        }
        if (target && target !== "player" && target.cannotBeAttacked) {
            return { success: false, message: `${target.name}本回合不能被攻击` };
        }

        // 效果①优先攻击限制：如果目标有priorityTarget，且对方场上有其他怪兽，则必须先攻击其他怪兽
        if (target && target !== "player" && target.priorityTarget) {
            const defenderOwner = this.state.opponentPlayer;
            const otherMonsters = defenderOwner.monsterZone.filter(m => m !== target && m.faceUp);
            if (otherMonsters.length > 0) {
                return { success: false, message: `${target.name}受优先攻击保护，必须先攻击其他怪兽` };
            }
        }

        // 里间雨效果②：攻击重定向 —— 切换守备表示，强制攻击其他怪兽
        if (target && target !== "player" && target.attackRedirector && !target._redirectUsedThisTurn) {
            const defenderOwner = this.state.opponentPlayer;
            // 切换为守备表示
            target.position = MONSTER_POSITION.DEFENSE;
            target._redirectUsedThisTurn = true;
            // 找其他可被攻击的怪兽
            const otherMonsters = defenderOwner.monsterZone.filter(m => m !== target && m.faceUp);
            if (otherMonsters.length > 0) {
                // 强制攻击第一个其他怪兽
                const redirectTarget = otherMonsters[0];
                return { success: false, message: `${target.name}切换为守备表示，${attacker.name}必须攻击${redirectTarget.name}`, redirect: redirectTarget };
            } else {
                // 没有其他怪兽，守备力永久+400
                target.currentDefense = safe(target.currentDefense + (target.redirectValue || 400));
                target.permanentBuffs.push({ type: "defense", value: target.redirectValue || 400, source: "switchDefenseRedirect" });
                return { success: false, message: `${target.name}切换为守备表示，守备力上升${target.redirectValue || 400}` };
            }
        }

        const replay = this.state.pendingBattleReplay;
        this.state.pendingBattleReplay = null;
        const beforeDefenders = [...defenderOwner.monsterZone];
        const trapResult = replaying ? { canceled: false, reduction: replay.reduction, message: "战斗卷回，重新选择目标" }
            : this._resolveBattleTrap(attacker, target, attackerOwner, defenderOwner);
        if (trapResult.pendingConfirm) {
            return { success: false, message: "等待陷阱响应确认", pendingTrapConfirm: true };
        }
        if (!attackerOwner.monsterZone.includes(attacker) || !attacker.faceUp || attacker.position !== MONSTER_POSITION.ATTACK || attacker.cannotAttack) trapResult.canceled = true;
        const defendersChanged = beforeDefenders.length !== defenderOwner.monsterZone.length
            || beforeDefenders.some(card => !defenderOwner.monsterZone.includes(card));
        if (!trapResult.canceled && defendersChanged) {
            if (!replaying) markAttackUsed(attacker);
            this.state.pendingBattleReplay = { attackerId: attacker.instanceId, reduction: trapResult.reduction || 0 };
            return { success: true, message: `${trapResult.message}；攻击目标变化，请重新选择目标`, replay: true };
        }
        if (trapResult.canceled) {
            if (attackerOwner.monsterZone.includes(attacker)) {
                if (!replaying) markAttackUsed(attacker);
            }
            purgeOrphanDomainBuffs(this);
            return { success: true, message: trapResult.message, trap: true, trapCard: this._lastActivatedTrap, attackCanceled: true };
        }
        const reduction = trapResult.reduction || 0;
        const trapPrefix = trapResult.message ? `${trapResult.message}；` : "";
        const trapInfo = trapResult.message
            ? { trap: true, trapCard: this._lastActivatedTrap }
            : {};
        // 战斗结算（含破坏）开始前快照双方出血，保证被破坏怪兽的出血仍按参战时层数结算。
        const attackerBleed = this._snapshotBleed(attacker);
        const defenderBleed = target instanceof Object && target?.type === "monster" ? this._snapshotBleed(target) : null;

        if (target === "player") {
            const rawDamage = this.getEffectiveAttack(attacker);
            const damage = Math.max(0, rawDamage - reduction);
            defenderOwner.takeDamage(damage);
            if (!replaying) markAttackUsed(attacker);
            this.emit("onBattleDamage", { attacker, damage, target: "player", attackerOwner, defenderOwner });
            this._settleBleed(attackerOwner, attackerBleed);
            purgeOrphanDomainBuffs(this);
            return { success: true, message: `${trapPrefix}${attacker.name}直接攻击，造成${damage}点伤害`, damage, damageTo: damage > 0 ? "defender" : null, ...trapInfo };
        }

        const atkPower = Math.max(0, attacker.currentAttack || 0);
        let msg = `${trapPrefix}${attacker.name}攻击${target.name}`;
        let battleDamage = 0;
        let damageTo = null;
        // 供界面层区分"破坏"与"只是造成伤害"的音效/动画分层
        let destroyedSomething = false;
        let pendingFlip = null;

        if (target.position === MONSTER_POSITION.DEFENSE || !target.faceUp) {
            if (!target.faceUp) {
                target.faceUp = true;
                target.faceDown = false;
                msg += "，目标翻开为守备表示";
                const flipEvent = { sourceCard: target, sourcePlayer: defenderOwner, flippedCard: target, cause: "attack" };
                this.emit("onFlip", flipEvent);
                pendingFlip = flipEvent;
            }
            const defPower = this.getEffectiveDefense(target);
            if (atkPower > defPower) {
                const infinityGuard = infinityReduction(target, this.state.turn);
                // 罗针可能挂在被这次攻击破坏的怪兽上，destroyMonster 会清空 themedState，先取快照。
                const rojinShield = activeDomain(this, defenderOwner, "rojin");
                const preventsBattleDamage = target.preventsBattleDamage;
                const hasPiercing = attacker.themedState?.piercingUntil >= this.state.turn || attacker.piercingDamage || attacker.effects?.some(effect => effect.type === "piercingDamage");
                const destroyed = destroyMonster(defenderOwner, target, this, "battle");
                if (destroyed) destroyedSomething = true;
                battleDamage = hasPiercing && !preventsBattleDamage
                    ? Math.max(0, atkPower - defPower - reduction)
                    : 0;
                battleDamage = Math.max(0, battleDamage - infinityGuard);
                if (battleDamage > 0 && rojinShield) {
                    const halved = rojinHalved(battleDamage);
                    attackerOwner.takeDamage(battleDamage - halved);
                    battleDamage = halved;
                }
                if (battleDamage > 0) { defenderOwner.takeDamage(battleDamage); damageTo = "defender"; }
                msg += destroyed
                    ? `，守备怪兽被破坏${battleDamage > 0 ? `，贯穿造成${battleDamage}点伤害` : ""}`
                    : `，${target.name}不受战斗破坏${battleDamage > 0 ? `，贯穿造成${battleDamage}点伤害` : ""}`;
            } else if (atkPower === defPower) {
                msg += "，攻击力等于守备力，均不破坏且不受伤害";
            } else {
                // 守方陷阱的减伤只保护守方，不能减免攻击方自己承受的战斗伤害。
                battleDamage = attacker.preventsBattleDamage ? 0 : Math.max(0, defPower - atkPower);
                battleDamage = Math.max(0, battleDamage - infinityReduction(attacker, this.state.turn));
                attackerOwner.takeDamage(battleDamage);
                if (battleDamage > 0) damageTo = "attacker";
                msg += `，攻击方受到${battleDamage}点战斗伤害`;
            }
        } else {
            const defPower = Math.max(0, target.currentAttack || 0);
            if (atkPower > defPower) {
                battleDamage = target.preventsBattleDamage ? 0 : Math.max(0, atkPower - defPower - reduction);
                battleDamage = Math.max(0, battleDamage - infinityReduction(target, this.state.turn));
                if (battleDamage > 0 && activeDomain(this, defenderOwner, "rojin")) {
                    const halved = rojinHalved(battleDamage);
                    attackerOwner.takeDamage(battleDamage - halved);
                    battleDamage = halved;
                }
                defenderOwner.takeDamage(battleDamage);
                if (battleDamage > 0) damageTo = "defender";
                const destroyed = destroyMonster(defenderOwner, target, this, "battle");
                if (destroyed) destroyedSomething = true;
                msg += destroyed
                    ? `，${target.name}被破坏，对方受到${battleDamage}点战斗伤害`
                    : `，${target.name}不受战斗破坏，对方受到${battleDamage}点战斗伤害`;
            } else if (atkPower === defPower && atkPower === 0) {
                msg += "，双方攻击力均为0，均不破坏";
            } else if (atkPower === defPower) {
                const attackerDestroyed = destroyMonster(attackerOwner, attacker, this, "battle");
                const targetDestroyed = destroyMonster(defenderOwner, target, this, "battle");
                if (attackerDestroyed || targetDestroyed) destroyedSomething = true;
                msg += attackerDestroyed && targetDestroyed
                    ? "，攻击力相同，双方怪兽都被破坏"
                    : "，攻击力相同，未能破坏具有战斗抗性的怪兽";
            } else {
                const attackerInfinity = infinityReduction(attacker, this.state.turn);
                const preventsBattleDamage = attacker.preventsBattleDamage;
                const attackerDestroyed = destroyMonster(attackerOwner, attacker, this, "battle");
                if (attackerDestroyed) destroyedSomething = true;
                // 同上：减伤不适用于攻击方自身受到的战斗伤害。
                battleDamage = preventsBattleDamage ? 0 : Math.max(0, defPower - atkPower);
                battleDamage = Math.max(0, battleDamage - attackerInfinity);
                attackerOwner.takeDamage(battleDamage);
                if (battleDamage > 0) damageTo = "attacker";
                msg += attackerDestroyed
                    ? `，${attacker.name}被破坏，攻击方受到${battleDamage}点战斗伤害`
                    : `，${attacker.name}不受战斗破坏，攻击方受到${battleDamage}点战斗伤害`;
            }
        }

        if (pendingFlip) {
            const result = this.triggerEvent("onFlip", pendingFlip);
            if (result) msg += `，${result}`;
        }
        if (attackerOwner.monsterZone.includes(attacker)) {
            if (!replaying) markAttackUsed(attacker);
        }
        this.emit("onBattleDamage", { attacker, target, damage: battleDamage, damageTo, attackerOwner, defenderOwner });
        this._settleBleed(attackerOwner, attackerBleed);
        this._settleBleed(defenderOwner, defenderBleed);
        purgeOrphanDomainBuffs(this);
        return { success: true, message: msg, damage: battleDamage, damageTo, destroyed: destroyedSomething, ...trapInfo };
    }

    // ---------- 游戏结束 ----------
    checkSpecialVictory(player) {
        // 通用“五件套”特殊胜利接口。卡牌数据只要声明：
        // specialWinSet、specialWinPiece、specialWinRequired（默认5），
        // 手牌集齐同一套装的不同部件即可获胜。当前卡池未强行加入仿制卡。
        const sets = new Map();
        for (const card of player.hand) {
            if (!card?.specialWinSet || !card?.specialWinPiece) continue;
            const entry = sets.get(card.specialWinSet) || { pieces: new Set(), required: Number(card.specialWinRequired) || 5 };
            entry.pieces.add(card.specialWinPiece);
            entry.required = Number(card.specialWinRequired) || entry.required;
            sets.set(card.specialWinSet, entry);
        }
        for (const [setId, entry] of sets) {
            if (entry.pieces.size >= entry.required) return { success: true, setId, required: entry.required };
        }
        return { success: false };
    }

    checkGameOver() {
        if (this.state.gameOver) return true;

        const special0 = this.checkSpecialVictory(this.state.players[0]);
        const special1 = this.checkSpecialVictory(this.state.players[1]);
        if (special0.success || special1.success) {
            if (special0.success && special1.success) {
                this.state.winner = null;
                this.state.isDraw = true;
                this.state.winReason = "双方同时达成特殊胜利条件";
            } else {
                this.state.winner = special0.success ? 0 : 1;
                this.state.isDraw = false;
                this.state.winReason = `集齐特殊胜利套装（${(special0.success ? special0 : special1).required}个部件）`;
            }
            this.state.gameOver = true;
            return true;
        }

        const p0Dead = this.state.players[0].lp <= 0 || this.state.players[0].deckOut;
        const p1Dead = this.state.players[1].lp <= 0 || this.state.players[1].deckOut;
        if (p0Dead && p1Dead) { this.state.winner = null; this.state.isDraw = true; this.state.winReason = "双方同时满足败北条件"; this.state.gameOver = true; return true; }
        if (p0Dead) { this.state.winner = 1; this.state.winReason = this.state.players[0].deckOut ? "无牌可抽" : "LP归零"; this.state.gameOver = true; return true; }
        if (p1Dead) { this.state.winner = 0; this.state.winReason = this.state.players[1].deckOut ? "无牌可抽" : "LP归零"; this.state.gameOver = true; return true; }
        return false;
    }

    checkStateIntegrity() {
        const issues = []; const seen = new Set();
        for (const p of this.state.players) {
            if (!Number.isFinite(p.lp)) issues.push(`${p.name} LP无效: ${p.lp}`);
            if (p.monsterZone.length > GAME_CONFIG.MAX_MONSTER_ZONE) issues.push(`${p.name} 怪兽区超限`);
            if (p.spellTrapZone.length > GAME_CONFIG.MAX_SPELL_TRAP_ZONE) issues.push(`${p.name} 魔法陷阱区超限`);
            for (const zone of [{ n: "deck", c: p.deck }, { n: "hand", c: p.hand }, { n: "monster", c: p.monsterZone }, { n: "spellTrap", c: p.spellTrapZone }, { n: "graveyard", c: p.graveyard }]) {
                for (const card of zone.c) {
                    if (seen.has(card.instanceId)) issues.push(`${card.name} 跨区域重复`);
                    seen.add(card.instanceId);
                }
            }
        }
        if (issues.length > 0) console.error("=== 状态检查 ===", issues);
        return issues;
    }
}

const ELEMENT_NAMES_MAP = { fire: "火", water: "水", wind: "风", earth: "地", light: "光", dark: "暗" };
