/**
 * 陷阱卡池审计：弄清"堆陷阱 92.5% 胜率"到底来自哪些卡的哪些效果。
 * 只读分析，不改任何数据。
 */
import { ALL_CARDS } from "../SekaiGame/src/main/resources/static/js/catalog.js";

const NEGATION_EFFECT_TYPES = new Set(["cancelAttackAndReturn", "cannotAttack", "counterDestroy", "destroyAttacker", "reflectDamage", "returnToHand"]);
const NEGATION_THEMED_ACTIONS = new Set(["intercept", "mirror", "rescue", "reversal", "retreat", "reprisal"]);
const isNegationEffect = (effect) => {
    if (!effect) return false;
    if (NEGATION_EFFECT_TYPES.has(effect.type)) return true;
    return effect.type === "themedAction" && NEGATION_THEMED_ACTIONS.has(effect.action);
};
const effectsOf = (card) => (card?.effects?.length ? card.effects : card?.effect ? [card.effect] : []);
const isNegationTrap = (card) => effectsOf(card).some(isNegationEffect);

const pool = ALL_CARDS.filter((card) => card.enabled !== false && card.type);
const traps = pool.filter((card) => card.type === "trap");
const negTraps = traps.filter(isNegationTrap);

console.log(`卡池总数 ${pool.length}；陷阱 ${traps.length}；其中"无效化攻击"类 ${negTraps.length}（${(negTraps.length / traps.length * 100).toFixed(1)}%）`);

// 按 id 前缀归类来源
const sourceOf = (id) => {
    const m = /^([a-z]+(?:_[a-z]+)?)_/.exec(id || "");
    return m ? m[1] : "other";
};
const bySource = {};
for (const card of traps) {
    const src = sourceOf(card.id);
    bySource[src] = bySource[src] || { total: 0, negate: 0, actions: new Map(), sample: [] };
    bySource[src].total++;
    if (isNegationTrap(card)) bySource[src].negate++;
    for (const effect of effectsOf(card)) {
        const key = effect.type === "themedAction" ? `themed:${effect.action}` : effect.type;
        bySource[src].actions.set(key, (bySource[src].actions.get(key) || 0) + 1);
    }
    if (bySource[src].sample.length < 3) bySource[src].sample.push(card.name);
}
console.log("\n=== 陷阱来源分布 ===");
for (const [src, info] of Object.entries(bySource).sort((a, b) => b[1].total - a[1].total)) {
    const acts = [...info.actions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}×${v}`).join(" ");
    console.log(`${src.padEnd(20)} 共 ${String(info.total).padStart(3)} 无效化 ${String(info.negate).padStart(3)} | ${acts} | e.g. ${info.sample.join(" / ")}`);
}

// 效果类型整体分布（陷阱）
const allActions = new Map();
for (const card of traps) for (const effect of effectsOf(card)) {
    const key = effect.type === "themedAction" ? `themed:${effect.action}` : effect.type;
    allActions.set(key, (allActions.get(key) || 0) + 1);
}
console.log("\n=== 陷阱效果类型分布（按卡计数） ===");
for (const [key, count] of [...allActions.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${key.padEnd(28)} ${count}`);
}

// 平衡实验室的陷阱取向实际会抓走哪些卡（score = 效果数*100 + UR 30）
const byEffectCount = (c) => (effectsOf(c).length * 100) + (c.rarity === "UR" ? 30 : 0);
const ranked = [...traps].sort((a, b) => byEffectCount(b) - byEffectCount(a));
console.log("\n=== 陷阱取向会优先抓取的 20 张（按实验室打分） ===");
for (const card of ranked.slice(0, 20)) {
    console.log(`${isNegationTrap(card) ? "无效化" : "  其他"} | ${String(card.rarity).padEnd(2)} | ${card.name} | ${effectsOf(card).map((e) => e.type === "themedAction" ? `themed:${e.action}` : e.type).join("+")}`);
}
const top20neg = ranked.slice(0, 20).filter(isNegationTrap).length;
console.log(`→ 前 20 张里无效化类 ${top20neg} 张`);
