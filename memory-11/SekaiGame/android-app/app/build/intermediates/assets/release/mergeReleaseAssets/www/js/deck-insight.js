// Exact 5-card combination probability; each physical card can satisfy several roles.
export function openingGroupChance(cards, groups) {
    if (!cards.length || !groups.length) return 0;
    const draws = Math.min(5, cards.length), full = (1 << groups.length) - 1;
    const ways = Array.from({ length: draws + 1 }, () => Array(1 << groups.length).fill(0));
    ways[0][0] = 1;
    cards.forEach((card, index) => {
        const mask = groups.reduce((bits, accepts, i) => bits | (accepts(card) ? 1 << i : 0), 0);
        for (let n = Math.min(draws, index + 1); n > 0; n--)
            for (let prior = 0; prior <= full; prior++) ways[n][prior | mask] += ways[n - 1][prior];
    });
    return Math.round(100 * ways[draws][full] / ways[draws].reduce((sum, n) => sum + n, 0));
}

const hasAction = (card, action) => card.effects?.some(effect => effect.action === action);
function comboNotes(cards) {
    const notes = [];
    const ignite = card => hasAction(card, "ignite"), combust = card => hasAction(card, "combust");
    if (cards.some(ignite) || cards.some(combust)) {
        notes.push(cards.some(ignite) && cards.some(combust)
            ? `点燃 → 引爆：起手同时持有两类卡的概率约${openingGroupChance(cards, [ignite, combust])}%；需要先建立场面、支付点燃费用，目标须仍有灼烧。抽齐不代表当回合可完成。`
            : `灼烧组合缺少${cards.some(ignite) ? "引爆" : "点燃"}角色；请补齐配合，或明确采用持续消耗打法。`);
    }
    if (cards.some(card => hasAction(card, "railgun") || hasAction(card, "tempoStrike")))
        notes.push("蓄力 → 释放：保留准备回合的保护手段；离场会失去蓄力，美琴需要两次蓄力与700LP，善逸准备时放弃攻击。");
    if (cards.some(card => hasAction(card, "ensemble") || hasAction(card, "chorus"))) {
        const attributes = new Set(cards.filter(card => card.type === "monster").map(card => card.attribute));
        notes.push(`合奏：卡组含${attributes.size}种怪兽属性；需要不同属性同时留场。舞台接力另需墓地怪兽并放弃攻击，牌库属性数不等于场面条件。`);
    }
    const recovery = cards.filter(card => card.effects?.some(effect => ["recover", "recycle", "sanctuary", "ensemble", "revive"].includes(effect.action))).length;
    if (recovery) notes.push(`墓地资源：${recovery}张卡依赖回收、复活或墓地费用；起手墓地为空，注意这些效果会争夺同一批资源。`);
    if (cards.some(card => hasAction(card, "purify"))) notes.push("净化可清除己方异常状态并干扰对方墓地；发动前比较持续伤害、墓地价值与LP费用。");
    return notes;
}

// Count physical copies, not distinct names. The deck is sampled without replacement.
export function analyzeOpening(cards) {
    const total = cards.length;
    const low = cards.filter(card => card.type === "monster" && Number(card.level) >= 1 && Number(card.level) <= 4).length;
    const high = cards.filter(card => card.type === "monster" && Number(card.level) >= 5).length;
    const draws = Math.min(5, total);
    let miss = 1;
    for (let i = 0; i < draws; i++) miss *= Math.max(0, total - low - i) / (total - i);
    const chance = total ? Math.round((1 - miss) * 100) : 0;
    const notes = [];
    if (!total) notes.push("加入卡牌后，可查看起手构成。");
    else {
        if (!low) notes.push("没有1–4星角色；请确认能通过特殊召唤等方式建立初始场面。");
        else if (chance < 80) notes.push("起手可能缺少低星角色，可增加1–4星角色或配合检索、特殊召唤。");
        if (high > low) notes.push("高星角色多于低星角色；上级召唤需要祭品，注意保留展开手段。");
        if (!cards.some(card => card.type === "trap")) notes.push("没有陷阱；请确认卡组具备对手回合的应对方式。");
        if (!notes.length) notes.push("低星角色供给较稳定；继续检查技能费用、同名次数限制与连携条件。");
    }
    return { total, low, high, chance, lowRatio: total ? Math.round(low / total * 100) : 0, notes, combos: comboNotes(cards) };
}
