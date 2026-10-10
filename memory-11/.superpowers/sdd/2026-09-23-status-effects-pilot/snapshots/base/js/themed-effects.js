import { createCardInstance } from "./model.js";
import { GAME_CONFIG, MONSTER_POSITION } from "./constants.js";
import { AILMENTS, DOMAIN_DEFS, applyAilment, ailmentStacks, ailmentValue, removeAilment, cleanseAilments, tickAilments, activeDomain } from "./status-effects.js";

// 领域规则文案：与引擎里 wuji/za_warudo/rojin/ongaku 的判定一一对应。
const DOMAIN_RULES_TEXT = {
    wuji: "直到对方回合结束，对方怪兽不能发动效果",
    za_warudo: "直到对方回合结束，对方全部怪兽不能攻击",
    rojin: "直到对方回合结束，自己受到的战斗伤害减半，另一半反弹给攻击者",
    ongaku: "直到对方回合结束，己方场上怪兽攻击力+500、对方场上怪兽攻击力-500",
};

// The same action definitions generate card text and resolve its actual rules.
// Targets are deterministic and described explicitly; no hidden random skill rolls.
// 每个动作都可携带 effect.params（count/limit/draw/heal/damage/amount/cost/attack/defense 中的部分字段），
// 卡面文字与引擎结算共用同一份参数，保证“写的”与“结算的”永远一致。
export const ACTION_DEFAULTS = {
    scout: { count: 3 },
    study: { count: 3 },
    prepare: { count: 2 },
    recover: { count: 1, limit: 4, draw: 0 },
    recycle: { count: 3, draw: 1 },
    deploy: { count: 1, limit: 4, heal: 0 },
    revive: { count: 1, limit: 4, heal: 0 },
    recall: { count: 1, draw: 0, heal: 0 },
    shelter: { amount: 0 },
    seal: { amount: 0 },
    sleep: { amount: 0 },
    freeze: { amount: 0 },
    poison: { damage: 600 },
    bomb: { damage: 0 },
    ignite: { stacks: 2, damage: 500 },
    venom: { stacks: 2, damage: 450 },
    bleed: { stacks: 2, damage: 400 },
    curse: { stacks: 1, damage: 700 },
    detonate: { stacks: 2, damage: 600 },
    paralyze: { count: 1, amount: 0, gamble: false },
    gamble: { draw: 2, heal: 800 },
    infinity: { reduce: 1000 },
    charge: { amount: 200 },
    burst: { cost: 700 },
    twin: { cost: 600 },
    pierce: { amount: 0 },
    ward: { amount: 0 },
    ambush: { count: 1 },
    token: { attack: 0, defense: 1000 },
    exchange: { limit: 4, draw: 0 },
    chorus: { count: 2, draw: 1, heal: 0 },
    sanctuary: { heal: 1000 },
    purify: { count: 1 },
    disarm: { count: 1, heal: 0 },
    mirror: { amount: 0 },
    timeStop: { cost: 1200 },
    domain: { field: "wuji", cost: 1200 },
    devour: { cost: 800 },
    inherit: { limit: 4 },
    intercept: {}, rescue: {}, reversal: {}, retreat: {}, reprisal: {}, returnSelf: {},
    exile: { turns: 2, penalty: 500, self: false },
};

const healClause = p => p.heal ? `，并恢复${p.heal}LP` : "";
const drawClause = p => p.draw ? `，然后抽${p.draw}张卡` : "";

// 模板即卡面：不带参数时渲染成各动作原本的文字。
export const ACTION_TEMPLATES = {
    scout: p => `展示卡组顶${p.count}张卡，将其中第一张怪兽加入手牌，其余按原顺序放回卡组底`,
    study: p => `展示卡组顶${p.count}张卡，将其中第一张魔法加入手牌，其余按原顺序放回卡组底`,
    prepare: p => `将卡组顶${p.count}张卡送入墓地`,
    recover: p => `将自己墓地最后${p.count}只${p.limit}星以下怪兽加入手牌${drawClause(p)}${healClause(p)}`,
    recycle: p => `将自己墓地最后${p.count}张卡按原顺序放回卡组底，抽${p.draw}张卡`,
    deploy: p => `将手牌中第一只${p.limit}星以下怪兽特殊召唤为守备表示，其效果直到回合结束无效${healClause(p)}`,
    revive: p => `将自己墓地最后${p.count}只${p.limit}星以下怪兽特殊召唤为守备表示，其效果直到回合结束无效${healClause(p)}`,
    recall: p => `将自己除外区最后${p.count}张卡加入手牌${drawClause(p)}${healClause(p)}`,
    shelter: p => `自己攻击力最低的表侧怪兽获得1次破坏替代：将其改为守备表示，直到下个回合结束有效${p.amount ? `，其攻击力上升${p.amount}` : ""}`,
    seal: p => `对方攻击力最高的可取对象表侧怪兽效果无效，直到本回合结束${p.amount ? `，其攻击力下降${p.amount}` : ""}`,
    sleep: p => `将对方攻击力最高的可取对象表侧怪兽变为里侧守备表示${p.amount ? `，其守备力下降${p.amount}` : ""}`,
    freeze: p => `将对方攻击力最高的可取对象表侧怪兽变为守备表示，直到下个回合结束不能攻击或手动改变表示形式${p.amount ? `，其攻击力下降${p.amount}` : ""}`,
    poison: p => `给对方攻击力最高的可取对象表侧怪兽放置毒印；本回合结束时，其控制者受到${p.damage}伤害，并移除毒印`,
    bomb: p => `给对方攻击力最高的可取对象表侧怪兽放置爆破标记；本回合结束时${p.damage ? `给予其控制者${p.damage}伤害并` : ""}破坏该怪兽，提前离场则标记失效`,
    ignite: p => `给对方攻击力最高的可取对象表侧怪兽放置${p.stacks}层灼烧；其控制者每个结束阶段受到${p.damage}×层数伤害，随后层数-1（上限3层）`,
    venom: p => `给对方攻击力最高的可取对象表侧怪兽放置${p.stacks}层剧毒（上限3层）；剧毒怪兽的控制者每个结束阶段受到${p.damage}×层数伤害，且其所有回复减半；剧毒不会自然消失`,
    bleed: p => `给对方攻击力最高的可取对象表侧怪兽放置${p.stacks}层出血；出血怪兽每次参与战斗后，其控制者受到${p.damage}×层数伤害，随后层数-1`,
    curse: p => `给对方攻击力最高的可取对象表侧怪兽施加诅咒：其效果无效、不能作为上级召唤的祭品；被破坏时其控制者受到${p.damage}×层数伤害`,
    detonate: p => `给对方攻击力最高的可取对象表侧怪兽放置${Math.max(1, p.stacks)}层灼烧，然后立即引爆其身上全部灼烧层数：每层使其控制者受到${p.damage}点伤害；若其带有剧毒，同时引爆剧毒：每层给对方全体表侧怪兽的守备力下降300，守备力变为0的破坏`,
    paralyze: p => p.gamble
        ? `抛硬币：正面则麻痹对方攻击力最高的可取对象表侧怪兽（直到下个回合结束不能攻击或改变表示形式）；反面则其攻击力下降${p.amount}直到回合结束`
        : p.count === "all"
            ? "对方全部表侧怪兽麻痹：直到下个回合结束不能攻击或改变表示形式"
            : "将对方攻击力最高的可取对象表侧怪兽麻痹：直到下个回合结束不能攻击或改变表示形式",
    gamble: p => `抛硬币：正面则抽${p.draw}张卡；反面则回复${p.heal}LP`,
    infinity: p => `直到下个回合结束，自身不会成为对方效果的对象，且受到的战斗伤害减少${p.reduce}`,
    charge: p => `自身获得1个蓄力指示物（最多3个），攻击力上升${p.amount}；移除指示物时失去对应的提升`,
    burst: p => `支付${p.cost}LP；将对方攻击力最高的可取对象表侧怪兽除外`,
    twin: p => `支付${p.cost}LP；自身本回合可以攻击2次`,
    pierce: p => `自身本回合获得贯穿守备的战斗伤害${p.amount ? `，其攻击力上升${p.amount}` : ""}`,
    ward: p => `自身直到下个回合结束不能成为效果对象${p.amount ? `，其守备力上升${p.amount}` : ""}`,
    ambush: p => `将自己墓地最后${p.count}张陷阱盖放到后场，本回合不能发动`,
    token: p => `特殊召唤1只${p.attack}攻${p.defense}守、1星的守备衍生物，不能作为上级召唤的祭品`,
    exchange: p => `将自己攻击力最低的表侧怪兽返回手牌，再将手牌第一只${p.limit}星以下怪兽特殊召唤为守备表示${drawClause(p)}`,
    chorus: p => `自己场上有至少${p.count}种属性的表侧怪兽时，抽${p.draw}张卡${healClause(p)}`,
    sanctuary: p => `将自己墓地最后1张卡除外；恢复${p.heal}LP`,
    purify: p => `将对方墓地最后${p.count}张卡除外，并清除己方场上怪兽的全部异常状态`,
    disarm: p => `破坏对方后场最后${p.count}张盖放的魔法或陷阱${healClause(p)}`,
    intercept: () => "这次攻击无效",
    mirror: p => `这次攻击无效；将攻击怪兽变为守备表示${p.amount ? `，其攻击力下降${p.amount}` : ""}`,
    rescue: () => "这次攻击无效；将自己墓地最后一只4星以下怪兽加入手牌",
    reversal: () => "这次攻击无效；将攻击怪兽的攻击力与守备力交换，直到回合结束",
    retreat: () => "这次攻击无效；将自己攻击力最低的表侧怪兽返回手牌",
    reprisal: () => "这次攻击无效；给攻击怪兽放置毒印，本回合结束时其控制者受到600伤害",
    returnSelf: () => "自己被破坏送入墓地后，支付800LP，将自身加入手牌；同名效果每回合只能使用1次",
    exile: p => p.self
        ? `支付800LP，改为进入异界区；下一个自己的结束阶段以守备表示回到场上（攻击力下降${p.penalty}，可累计）、效果封印1回合`
        : `将对方攻击力最高的可取对象表侧怪兽送入异界区；${p.turns}个结束阶段后回到场上（守备表示、攻击力下降${p.penalty}、效果封印1回合）`,
    inherit: p => `自己被破坏送入墓地后，将卡组第一只与自身同属性的${p.limit}星以下怪兽加入手牌`,
    devour: p => `支付${p.cost}LP；抽2张卡`,
    timeStop: p => `支付${p.cost}LP；对方全部表侧怪兽直到下个回合结束不能攻击或手动改变表示形式`,
    domain: p => {
        const def = DOMAIN_DEFS[p.field] || DOMAIN_DEFS.wuji;
        return `支付${p.cost}LP，展开领域「${def.name}」：${DOMAIN_RULES_TEXT[p.field] || ""}`;
    },
};

export function themedActionParams(effect) {
    return { ...(ACTION_DEFAULTS[effect?.action] || {}), ...(effect?.params || {}) };
}

/** 把动作与参数渲染成卡面文字；引擎结算与卡面共用同一份参数。 */
export function describeThemedAction(effect) {
    const template = ACTION_TEMPLATES[effect?.action];
    return template ? template(themedActionParams(effect)) : "";
}

export const ACTION_TEXT = Object.fromEntries(
    Object.entries(ACTION_TEMPLATES).map(([action, template]) => [action, template(themedActionParams({ action }))]),
);
// 唯一真相：哪些主题行动会"让这次攻击无效"。
// 引擎用它判断一张盖放陷阱是否属于无效化陷阱，实现则在下面对应的 switch case 里。
// 两者必须同源——分开维护时，新增行动会被引擎算作无效化陷阱、却按普通效果结算。
export const ATTACK_NEGATING_ACTIONS = new Set(["intercept", "mirror", "rescue", "reversal", "retreat", "reprisal"]);
// 卡面没有写"无效"，但在攻击响应窗口里会让这次攻击直接消失的行动：
// 攻击怪兽被翻成里侧守备（sleep）或被固定为守备且不能攻击（freeze）之后，
// 引擎会在结算前判定"攻击者已不能攻击"并按攻击取消处理（见 engine.attack 的取消判定）。
// 平衡统计与无效化上限必须把它们算进来，否则"没写无效但实际无效"的卡会绕过所有限制。
export const ATTACK_FIZZLING_ACTIONS = new Set([...ATTACK_NEGATING_ACTIONS, "sleep", "freeze"]);

const lowMonster = (c, limit = 4) => c.type === "monster" && Number(c.level) <= limit;
/** 净化类门槛用：卡上是否挂着任意一种异常状态。 */
const hasAilments = card => Object.keys(AILMENTS).some(id => ailmentStacks(card, id) > 0);
const last = (zone, predicate = () => true) => [...zone].reverse().find(predicate);
function lastN(zone, count, predicate = () => true) {
    return [...zone].reverse().filter(predicate).slice(0, Math.max(1, count)).reverse();
}
function enemy(ctx) {
    return ctx.opponent.monsterZone.filter(c => c.faceUp && !c.cannotBeTargeted)
        .sort((a, b) => b.currentAttack - a.currentAttack)[0];
}
function ally(ctx) {
    return ctx.player.monsterZone.filter(c => c.faceUp)
        .sort((a, b) => a.currentAttack - b.currentAttack)[0];
}
function move(card, from, to) {
    const index = from.indexOf(card);
    if (index < 0) return false;
    from.splice(index, 1);
    to.push(card);
    return true;
}
/**
 * 把卡从墓地/除外区搬回手牌或卡组时必须清掉它上一次在场时的运行时状态
 * （攻守修正、已受伤数值、表示形式），否则它会带着旧战斗数据"复活"。
 */
function moveReset(ctx, card, from, to) {
    if (!card) return false;
    ctx.engine.resetFieldCard(card);
    return move(card, from, to);
}
function summon(ctx, card, from, { seal = true } = {}) {
    from.splice(from.indexOf(card), 1);
    ctx.engine.resetFieldCard(card);
    card.position = MONSTER_POSITION.DEFENSE;
    card.setTurn = ctx.gameState.turn;
    // deploy/revive 的卡面写明"其效果直到回合结束无效"；exchange 换上的怪兽没有
    // 这条限制，不能一并封印。
    card.themedState = seal ? { sealedUntil: ctx.gameState.turn } : {};
    ctx.player.monsterZone.push(card);
    ctx.engine._emitSpecialSummon(ctx.player, card);
}
function applyTempStat(owner, card, stat, delta) {
    if (!card || !delta) return;
    const field = stat === "attack" ? "currentAttack" : "currentDefense";
    card[field] = Math.max(0, (card[field] || 0) + delta);
    card.tempEffects = card.tempEffects || [];
    card.tempEffects.push({ type: stat, value: delta, duration: "untilEndTurn", source: "themedTuning" });
    owner?._recalcCardStats?.(card);
}
function applyPermanentStat(owner, card, stat, delta) {
    if (!card || !delta) return;
    const field = stat === "attack" ? "currentAttack" : "currentDefense";
    card[field] = Math.max(0, (card[field] || 0) + delta);
    card.permanentBuffs = card.permanentBuffs || [];
    card.permanentBuffs.push({ type: stat, value: delta, source: "themedTuning" });
    owner?._recalcCardStats?.(card);
}
export function canResolveThemedEffect(ctx) {
    const { effect: e, player: p, card: c } = ctx;
    if (e.type !== "themedAction") return true;
    const par = themedActionParams(e);
    const space = p.monsterZone.length < GAME_CONFIG.MAX_MONSTER_ZONE && !p.cannotSpecialSummonThisTurn;
    switch (e.action) {
        case "scout": case "study": case "prepare": return p.deck.length > 0;
        case "recover": return p.graveyard.some(x => x !== c && lowMonster(x, par.limit));
        case "recycle": return p.graveyard.filter(x => x !== c).length >= par.count;
        case "deploy": return space && p.hand.some(x => lowMonster(x, par.limit));
        case "revive": return space && p.graveyard.some(x => x !== c && lowMonster(x, par.limit));
        case "recall": return p.banished.length >= par.count;
        case "shelter": return !!ally(ctx);
        case "seal": case "sleep": case "freeze": case "poison": case "bomb": return !!enemy(ctx);
        case "ignite": case "venom": return !!enemy(ctx);
        case "bleed": case "curse": return !!enemy(ctx);
        case "detonate": return !!enemy(ctx);
        case "paralyze": return !!enemy(ctx);
        case "gamble": return true;
        case "infinity": return p.monsterZone.includes(c);
        case "burst": return p.lp > par.cost && !!enemy(ctx);
        case "charge": return p.monsterZone.includes(c) && (c.themedState?.charges || 0) < 3;
        case "twin": return p.monsterZone.includes(c) && p.lp > par.cost;
        case "pierce": case "ward": return p.monsterZone.includes(c);
        case "ambush": return p.spellTrapZone.length < GAME_CONFIG.MAX_SPELL_TRAP_ZONE && !!last(p.graveyard, x => x.type === "trap" && x !== c);
        case "token": return space;
        case "exchange": return !p.cannotSpecialSummonThisTurn && !!ally(ctx) && p.hand.some(x => lowMonster(x, par.limit));
        case "chorus": return new Set(p.monsterZone.filter(x => x.faceUp).map(x => x.attribute)).size >= par.count && p.deck.length >= Math.max(1, par.draw || 0);
        case "sanctuary": return p.graveyard.some(x => x !== c);
        case "purify": return ctx.opponent.graveyard.length > 0 || p.monsterZone.some(hasAilments);
        case "disarm": return ctx.opponent.spellTrapZone.some(x => x.faceDown);
        case "returnSelf": return p.graveyard.includes(c) && p.lp > 800;
        // 自身异界在 onDestroyed 触发时卡已在墓地；直接以场上形态结算时从怪兽区取卡。
        case "exile": return par.self
            ? (p.monsterZone.includes(c) || p.graveyard.includes(c)) && p.lp > 800
            : !!enemy(ctx);
        case "inherit": return p.graveyard.includes(c) && p.deck.some(x => lowMonster(x, par.limit) && x.attribute === c.attribute);
        case "devour": return p.lp > par.cost && p.deck.length >= 2;
        case "timeStop": return p.lp > par.cost && ctx.opponent.monsterZone.some(x => x.faceUp);
        case "domain": return p.monsterZone.includes(c) && p.lp > (par.cost || DOMAIN_DEFS[par.field]?.cost || 0);
        case "intercept": case "mirror": case "rescue": case "reversal": case "retreat": case "reprisal": return !!ctx.battle;
        default: return false;
    }
}

function state(card) { return card.themedState ||= {}; }
// 衍生物实例 id 必须全局唯一：之前用 (回合, 事件数, 怪兽区数量) 组合，
// 而"吞食"/"撤回"等效果移除衍生物时不会产生事件，同一回合内可以再次满足
// 完全相同的组合，从而生成两个 instanceId 相同的衍生物（跨区域重复）。
let tokenSequence = 0;
export const themedEffectHandlers = {
    themedAction(ctx) {
        if (!canResolveThemedEffect(ctx)) return null;
        const { player: p, opponent: o, card: c, effect: e, gameState: game } = ctx;
        const par = themedActionParams(e);
        const target = enemy(ctx);
        switch (e.action) {
            case "scout": case "study": {
                const top = p.deck.splice(0, Math.max(1, par.count));
                const chosen = top.find(x => x.type === (e.action === "scout" ? "monster" : "spell"));
                if (chosen) p.hand.push(top.splice(top.indexOf(chosen), 1)[0]);
                p.deck.push(...top);
                return `${e.skillName}：${chosen ? `${chosen.name}加入手牌` : "没有符合类型的卡"}，其余放回卡组底`;
            }
            case "prepare": p.graveyard.push(...p.deck.splice(0, Math.max(1, par.count))); break;
            case "recover": {
                for (const card of lastN(p.graveyard, par.count, x => x !== c && lowMonster(x, par.limit))) moveReset(ctx, card, p.graveyard, p.hand);
                if (par.draw) for (let i = 0; i < par.draw; i++) p.drawCard();
                if (par.heal) p.heal(par.heal);
                break;
            }
            case "recycle": {
                const cards = p.graveyard.filter(x => x !== c).slice(-Math.max(1, par.count));
                for (const x of cards) moveReset(ctx, x, p.graveyard, p.deck);
                for (let i = 0; i < Math.max(1, par.draw); i++) p.drawCard(); break;
            }
            case "deploy": summon(ctx, p.hand.find(x => lowMonster(x, par.limit)), p.hand); if (par.heal) p.heal(par.heal); break;
            case "revive": {
                const revived = lastN(p.graveyard, par.count, x => x !== c && lowMonster(x, par.limit));
                for (const card of revived) if (p.monsterZone.length < GAME_CONFIG.MAX_MONSTER_ZONE) summon(ctx, card, p.graveyard);
                if (par.heal) p.heal(par.heal);
                break;
            }
            case "recall": {
                // 异界区的卡必须等回归倒计时，回收类效果一律跳过。
                for (const card of lastN(p.banished, par.count, x => !x.themedState?.exile)) moveReset(ctx, card, p.banished, p.hand);
                if (par.draw) for (let i = 0; i < par.draw; i++) p.drawCard();
                if (par.heal) p.heal(par.heal);
                break;
            }
            case "shelter": {
                const shielded = ally(ctx);
                state(shielded).shelterUntil = game.turn + 1;
                applyPermanentStat(p, shielded, "attack", par.amount);
                break;
            }
            case "seal": state(target).sealedUntil = game.turn; applyTempStat(o, target, "attack", -par.amount); break;
            case "sleep":
                ctx.engine.resetFieldCard(target);
                target.position = MONSTER_POSITION.DEFENSE;
                target.faceUp = false; target.faceDown = true;
                applyTempStat(o, target, "defense", -par.amount);
                target.setTurn = game.turn; break;
            case "freeze":
                target.position = MONSTER_POSITION.DEFENSE; target.canAttack = false;
                state(target).frozenUntil = game.turn + 1;
                applyTempStat(o, target, "attack", -par.amount);
                break;
            case "poison": state(target).poisonTurn = game.turn; state(target).poisonDamage = par.damage; break;
            case "bomb": state(target).bombTurn = game.turn; state(target).bombDamage = par.damage; break;
            case "ignite": applyAilment(target, "burn", par.stacks, par.damage); break;
            case "venom": applyAilment(target, "venom", par.stacks, par.damage); break;
            case "bleed": applyAilment(target, "bleed", par.stacks, par.damage); break;
            case "curse": applyAilment(target, "curse", par.stacks, par.damage); break;
            case "detonate": {
                // 先施加灼烧（至少1层）再引爆全部灼烧层数；剧毒同时扩散到对方全体表侧怪兽的守备。
                applyAilment(target, "burn", Math.max(1, par.stacks), par.damage);
                const burnStacks = ailmentStacks(target, "burn");
                if (burnStacks > 0) {
                    o.takeDamage(par.damage * burnStacks);
                    removeAilment(target, "burn");
                }
                const venomStacks = ailmentStacks(target, "venom");
                if (venomStacks > 0) {
                    const splash = 300 * venomStacks;
                    for (const x of o.monsterZone.filter(x => x.faceUp)) {
                        x.currentDefense = Math.max(0, (x.currentDefense || 0) - splash);
                        if (x.currentDefense <= 0) ctx.engine.destroyFieldMonster(o, x);
                    }
                    removeAilment(target, "venom");
                }
                break;
            }
            case "charge":
                state(c).charges = (state(c).charges || 0) + 1;
                applyPermanentStat(p, c, "attack", par.amount);
                break;
            case "burst":
                p.takeDamage(par.cost);
                ctx.engine.resetFieldCard(target);
                move(target, o.monsterZone, o.banished); break;
            case "twin":
                p.takeDamage(par.cost);
                c.doubleAttackThisTurn = true;
                // 攻击次数上限翻倍后必须同步刷新 canAttack，否则"已经攻击过一次"的
                // 怪兽第二次攻击仍然会被 attack() 拒绝，等于白付 600LP。
                c.canAttack = (Number(c.attacksMadeThisTurn) || 0) < 2
                    && !c.cannotAttack
                    && c.position === MONSTER_POSITION.ATTACK
                    && !(c.themedState?.frozenUntil >= game.turn);
                break;
            case "pierce": state(c).piercingUntil = game.turn; applyTempStat(p, c, "attack", par.amount); break;
            case "ward": state(c).wardUntil = game.turn + 1; c.cannotBeTargeted = true; applyTempStat(p, c, "defense", par.amount); break;
            case "paralyze": {
                const targets = par.count === "all" ? o.monsterZone.filter(x => x.faceUp) : [target].filter(Boolean);
                if (par.gamble) {
                    // 赌运：每次结算恰好调用一次 engine._random() 判定（PvP 共享种子下可复现），
                    // 结果广播 onCoinFlip；正面=麻痹、反面=降攻，与卡面两种走向一一对应。
                    const result = ctx.engine._random() < 0.5 ? "heads" : "tails";
                    ctx.engine.emit("onCoinFlip", { card: c, result });
                    if (result === "heads") {
                        for (const x of targets) { state(x).paralyzedUntil = game.turn + 1; x.canAttack = false; }
                    } else {
                        for (const x of targets) applyTempStat(o, x, "attack", -par.amount);
                    }
                    break;
                }
                for (const x of targets) { state(x).paralyzedUntil = game.turn + 1; x.canAttack = false; }
                break;
            }
            case "gamble": {
                // 先抛硬币：每次结算恰好调用一次 engine._random()，结果广播 onCoinFlip 供演出层读取。
                const result = ctx.engine._random() < 0.5 ? "heads" : "tails";
                ctx.engine.emit("onCoinFlip", { card: c, result });
                if (result === "heads") { for (let i = 0; i < Math.max(1, par.draw); i++) p.drawCard(); }
                else p.heal(par.heal);
                break;
            }
            case "infinity":
                state(c).infinityUntil = game.turn + 1;
                state(c).infinityReduce = par.reduce;
                c.cannotBeTargeted = true;
                break;
            case "ambush": {
                for (const trap of lastN(p.graveyard, par.count, x => x.type === "trap" && x !== c)) {
                    if (p.spellTrapZone.length >= GAME_CONFIG.MAX_SPELL_TRAP_ZONE) break;
                    ctx.engine.resetFieldCard(trap);
                    trap.faceDown = true; trap.faceUp = false; trap.canActivate = false; trap.setTurn = game.turn;
                    move(trap, p.graveyard, p.spellTrapZone);
                }
                break;
            }
            case "token": {
                const token = createCardInstance({ id: "themed_token", name: `${c.name}的替身`, type: "monster", level: 1, attribute: c.attribute, attack: par.attack, defense: par.defense, effects: [], isToken: true });
                token.instanceId = `token_${game.turn}_${++tokenSequence}`;
                token.position = MONSTER_POSITION.DEFENSE; token.cannotUseAsMaterial = true; token.setTurn = game.turn;
                p.monsterZone.push(token); break;
            }
            case "exchange": {
                const replacement = p.hand.find(x => lowMonster(x, par.limit));
                const outgoing = ally(ctx);
                ctx.engine.resetFieldCard(outgoing);
                if (outgoing.isToken) p.monsterZone.splice(p.monsterZone.indexOf(outgoing), 1);
                else move(outgoing, p.monsterZone, p.hand);
                // 换上的怪兽卡面没有"效果无效"的说明，不能沿用 deploy/revive 的封印。
                summon(ctx, replacement, p.hand, { seal: false });
                if (par.draw) for (let i = 0; i < par.draw; i++) p.drawCard();
                break;
            }
            case "chorus": {
                for (let i = 0; i < Math.max(1, par.draw); i++) p.drawCard();
                if (par.heal) p.heal(par.heal);
                break;
            }
            case "sanctuary": moveReset(ctx, last(p.graveyard, x => x !== c), p.graveyard, p.banished); p.heal(par.heal); break;
            case "purify": {
                for (const card of lastN(o.graveyard, par.count)) moveReset(ctx, card, o.graveyard, o.banished);
                // 增强：除外对方墓地的原有行为之外，同时净化己方场上怪兽的全部异常状态。
                for (const card of p.monsterZone) cleanseAilments(card);
                break;
            }
            // 只拆盖放的卡：已经翻开的魔法/陷阱不在"盖牌"范围内，避免把对手正在
            // 生效的永久魔法也一并算进来（本作没有永久魔法，但规则要写清楚）。
            case "disarm": {
                const sets = lastN(o.spellTrapZone, par.count, x => x.faceDown);
                for (const set of sets) {
                    move(set, o.spellTrapZone, o.graveyard);
                    set.faceDown = false; set.canActivate = false;
                }
                if (par.heal) p.heal(par.heal);
                break;
            }
            case "returnSelf": p.takeDamage(800); ctx.engine.resetFieldCard(c); move(c, p.graveyard, p.hand); break;
            case "exile": {
                if (par.self) {
                    p.takeDamage(800);
                    // 死亡回归：被破坏后卡已在墓地；直接以场上形态触发时从怪兽区送入异界区。
                    if (!move(c, p.monsterZone, p.banished)) move(c, p.graveyard, p.banished);
                    state(c).exile = { pendingEndPhases: Math.max(1, par.turns), penalty: par.penalty };
                } else {
                    // 入异界前清掉旧 statuses/domain，避免脏状态进除外区快照；累计的回归攻减保留。
                    const carried = (target.permanentBuffs || []).filter(buff => buff.source === "exileReturn");
                    ctx.engine.resetFieldCard(target);
                    move(target, o.monsterZone, o.banished);
                    target.permanentBuffs = carried;
                    state(target).exile = { pendingEndPhases: Math.max(1, par.turns), penalty: par.penalty };
                }
                break;
            }
            case "inherit": {
                const found = p.deck.find(x => lowMonster(x, par.limit) && x.attribute === c.attribute);
                move(found, p.deck, p.hand); break;
            }
            case "devour": {
                p.takeDamage(par.cost);
                p.drawCard(); p.drawCard(); break;
            }
            case "timeStop": {
                p.takeDamage(par.cost);
                for (const x of o.monsterZone.filter(x => x.faceUp)) {
                    state(x).frozenUntil = game.turn + 1; x.canAttack = false;
                }
                break;
            }
            case "domain": {
                const def = DOMAIN_DEFS[par.field] || DOMAIN_DEFS.wuji;
                const cost = Number(par.cost ?? def.cost);
                p.takeDamage(cost);
                // applied/sourceId 只存纯数据：PvP 快照会 JSON 序列化 themedState，
                // 存 {card, owner} 活对象会循环引用（源卡 buff 自身）并在往返后退化为陈旧对象。
                const domain = { id: par.field, until: game.turn + 1, sourceId: c.instanceId, applied: [] };
                state(c).domain = domain;
                const buff = (owner, value) => {
                    const ownerIndex = game.players.indexOf(owner);
                    for (const x of owner.monsterZone) {
                        x.permanentBuffs = [...(x.permanentBuffs || []), { type: "attack", value, source: "domainOngaku", sourceId: c.instanceId }];
                        owner._recalcCardStats(x);
                        domain.applied.push({ instanceId: x.instanceId, ownerIndex });
                    }
                };
                if (def.allyAttack) buff(p, def.allyAttack);
                if (def.enemyAttack) buff(o, def.enemyAttack);
                break;
            }
            // 这 6 个行动的原义就是"这次攻击无效"（见卡面文字）。
            // 以前这里写成 default 兜底：任何新增的主题行动都会**默认变成最强效果**
            // （直接取消这次攻击）。陷阱卡池里 84% 的卡都成了"无效化陷阱"，
            // 根因就是这个隐式默认。现在显式列出，未知行动按"不结算"处理。
            case "intercept": case "mirror": case "rescue": case "reversal": case "retreat": case "reprisal": {
                ctx.battle.canceled = true;
                const attacker = ctx.attacker;
                if (e.action === "mirror" && attacker) { attacker.position = MONSTER_POSITION.DEFENSE; attacker.canAttack = false; applyTempStat(ctx.attackerOwner, attacker, "attack", -par.amount); }
                if (e.action === "rescue") { const x = last(p.graveyard, lowMonster); if (x) moveReset(ctx, x, p.graveyard, p.hand); }
                if (e.action === "retreat") {
                    const x = ally(ctx);
                    if (x) { ctx.engine.resetFieldCard(x); if (x.isToken) p.monsterZone.splice(p.monsterZone.indexOf(x), 1); else move(x, p.monsterZone, p.hand); }
                }
                if (e.action === "reprisal" && attacker) state(attacker).poisonTurn = game.turn;
                if (e.action === "reversal" && attacker) {
                    const difference = attacker.currentDefense - attacker.currentAttack;
                    attacker.tempEffects.push({ type: "attack", value: difference, duration: "untilEndTurn" }, { type: "defense", value: -difference, duration: "untilEndTurn" });
                    [attacker.currentAttack, attacker.currentDefense] = [attacker.currentDefense, attacker.currentAttack];
                }
                break;
            }
            default: return null;
        }
        return `${e.skillName}：${describeThemedAction(e)}`;
    },
};

/**
 * 异界回归：只结算"结束回合的一方"的除外区，用剩余结束阶段数而不是回合数，
 * 避免依赖 turn 计数器的增减时机。怪兽区满时顺延（保留 1 个结束阶段余额）。
 */
export function resolveExileReturns(engine, player) {
    for (const card of [...player.banished]) {
        const exile = card.themedState?.exile;
        if (!exile) continue;
        exile.pendingEndPhases = (Number(exile.pendingEndPhases) || 0) - 1;
        if (exile.pendingEndPhases > 0) continue;
        if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) { exile.pendingEndPhases = 1; continue; }
        // resetFieldCard 会清空 themedState（含 exile 标记），先取出标记，回来后再写封印与新攻减。
        const carried = (card.permanentBuffs || []).filter(buff => buff.source === "exileReturn");
        engine.resetFieldCard(card);
        card.position = MONSTER_POSITION.DEFENSE;
        card.setTurn = engine.state.turn;
        card.permanentBuffs = [...carried, { type: "attack", value: -exile.penalty, source: "exileReturn" }];
        card.themedState = { sealedUntil: engine.state.turn + 1 };
        player._recalcCardStats?.(card);
        // 同一实例必须从除外区移除后入怪兽区，否则 checkStateIntegrity/PvP 快照会出现跨区域重复。
        move(card, player.banished, player.monsterZone);
        engine._emitSpecialSummon?.(player, card);
    }
}

export function resolveThemedTurnEnd(engine, endingPlayer) {
    // 结束阶段先结算结束方场上的灼烧/剧毒，再做既有的毒印/爆破/时限标记清理。
    if (endingPlayer) tickAilments(engine, endingPlayer);
    const turn = engine.state.turn;
    for (const p of engine.state.players) {
        for (const c of [...p.monsterZone]) {
            const s = c.themedState || {};
            if (s.poisonTurn === turn) { delete s.poisonTurn; const damage = Number(s.poisonDamage) || 600; delete s.poisonDamage; p.takeDamage(damage); engine.emit("onPoisonDamage", { card: c, damage }); }
            if (s.bombTurn === turn) {
                delete s.bombTurn;
                const damage = Number(s.bombDamage) || 0; delete s.bombDamage;
                if (damage) { p.takeDamage(damage); engine.emit("onPoisonDamage", { card: c, damage }); }
                engine.destroyFieldMonster(p, c);
            }
            for (const key of ["sealedUntil", "frozenUntil", "paralyzedUntil", "shelterUntil", "piercingUntil", "wardUntil", "infinityUntil"]) {
                if (s[key] != null && s[key] <= turn) { delete s[key]; if (key === "wardUntil" || key === "infinityUntil") c.cannotBeTargeted = false; }
            }
        }
    }
    // 领域按回合数到期：领域可能挂在任一方的怪兽上（不一定是结束回合的一方），双方都要遍历。
    for (const owner of engine.state.players) {
        for (const card of [...owner.monsterZone]) {
            const domain = card.themedState?.domain;
            if (!domain || domain.until > turn) continue;
            const sourceId = domain.sourceId || card.instanceId;
            for (const entry of domain.applied || []) {
                const holder = engine.state.players[entry.ownerIndex];
                const appliedCard = holder?.monsterZone?.find(x => x.instanceId === entry.instanceId);
                if (!appliedCard) continue;
                appliedCard.permanentBuffs = (appliedCard.permanentBuffs || []).filter(buff => buff.source !== "domainOngaku" || buff.sourceId !== sourceId);
                holder._recalcCardStats?.(appliedCard);
            }
            delete card.themedState.domain;
        }
    }
    // 源卡提前离场会带走 themedState.domain，留下没有来源的 domainOngaku 修正，兜底清算。
    purgeOrphanDomainBuffs(engine);
    // 回归放在时限清理之后：刚回归写入的 sealedUntil 不能被同一轮清理误删。
    if (endingPlayer) resolveExileReturns(engine, endingPlayer);
}

/**
 * 领域源卡提前离场（破坏/弹回/除外/换手等）时主题状态会被清空，
 * 只留下带 sourceId 的 domainOngaku 攻防修。扫描双方怪兽区，把找不到
 * "激活中同源领域"的残留修正移除并重算，保证最迟在结束阶段收敛。
 * 多份 ongaku 叠加时按 sourceId 区分来源，只清对应的一份。
 */
export function purgeOrphanDomainBuffs(engine) {
    const activeSourceIds = new Set();
    for (const owner of engine.state.players) {
        for (const card of owner.monsterZone) {
            const domain = card.themedState?.domain;
            if (domain && domain.until >= engine.state.turn) activeSourceIds.add(domain.sourceId || card.instanceId);
        }
    }
    for (const owner of engine.state.players) {
        for (const card of owner.monsterZone) {
            const buffs = card.permanentBuffs || [];
            const kept = buffs.filter(buff => buff.source !== "domainOngaku" || activeSourceIds.has(buff.sourceId));
            if (kept.length === buffs.length) continue;
            card.permanentBuffs = kept;
            owner._recalcCardStats?.(card);
        }
    }
}
