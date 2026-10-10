import { createCardInstance } from "./model.js";
import { GAME_CONFIG, MONSTER_POSITION } from "./constants.js";

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
    devour: { cost: 800 },
    inherit: { limit: 4 },
    intercept: {}, rescue: {}, reversal: {}, retreat: {}, reprisal: {}, returnSelf: {},
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
    purify: p => `将对方墓地最后${p.count}张卡除外`,
    disarm: p => `破坏对方后场最后${p.count}张盖放的魔法或陷阱${healClause(p)}`,
    intercept: () => "这次攻击无效",
    mirror: p => `这次攻击无效；将攻击怪兽变为守备表示${p.amount ? `，其攻击力下降${p.amount}` : ""}`,
    rescue: () => "这次攻击无效；将自己墓地最后一只4星以下怪兽加入手牌",
    reversal: () => "这次攻击无效；将攻击怪兽的攻击力与守备力交换，直到回合结束",
    retreat: () => "这次攻击无效；将自己攻击力最低的表侧怪兽返回手牌",
    reprisal: () => "这次攻击无效；给攻击怪兽放置毒印，本回合结束时其控制者受到600伤害",
    returnSelf: () => "自己被破坏送入墓地后，支付800LP，将自身加入手牌；同名效果每回合只能使用1次",
    inherit: p => `自己被破坏送入墓地后，将卡组第一只与自身同属性的${p.limit}星以下怪兽加入手牌`,
    devour: p => `支付${p.cost}LP；抽2张卡`,
    timeStop: p => `支付${p.cost}LP；对方全部表侧怪兽直到下个回合结束不能攻击或手动改变表示形式`,
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
        case "burst": return p.lp > par.cost && !!enemy(ctx);
        case "charge": return p.monsterZone.includes(c) && (c.themedState?.charges || 0) < 3;
        case "twin": return p.monsterZone.includes(c) && p.lp > par.cost;
        case "pierce": case "ward": return p.monsterZone.includes(c);
        case "ambush": return p.spellTrapZone.length < GAME_CONFIG.MAX_SPELL_TRAP_ZONE && !!last(p.graveyard, x => x.type === "trap" && x !== c);
        case "token": return space;
        case "exchange": return !p.cannotSpecialSummonThisTurn && !!ally(ctx) && p.hand.some(x => lowMonster(x, par.limit));
        case "chorus": return new Set(p.monsterZone.filter(x => x.faceUp).map(x => x.attribute)).size >= par.count && p.deck.length >= Math.max(1, par.draw || 0);
        case "sanctuary": return p.graveyard.some(x => x !== c);
        case "purify": return ctx.opponent.graveyard.length > 0;
        case "disarm": return ctx.opponent.spellTrapZone.some(x => x.faceDown);
        case "returnSelf": return p.graveyard.includes(c) && p.lp > 800;
        case "inherit": return p.graveyard.includes(c) && p.deck.some(x => lowMonster(x, par.limit) && x.attribute === c.attribute);
        case "devour": return p.lp > par.cost && p.deck.length >= 2;
        case "timeStop": return p.lp > par.cost && ctx.opponent.monsterZone.some(x => x.faceUp);
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
                for (const card of lastN(p.banished, par.count)) moveReset(ctx, card, p.banished, p.hand);
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

export function resolveThemedTurnEnd(engine) {
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
            for (const key of ["sealedUntil", "frozenUntil", "shelterUntil", "piercingUntil", "wardUntil"]) {
                if (s[key] != null && s[key] <= turn) { delete s[key]; if (key === "wardUntil") c.cannotBeTargeted = false; }
            }
        }
    }
}
