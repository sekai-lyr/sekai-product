// js/status-effects.js
// 状态模块：异常状态（灼烧/剧毒/出血/诅咒）与领域定义及结算。

export const AILMENTS = {
    burn:  { label: "灼烧", max: 3, valueKey: "burnDamage",  decay: true },
    venom: { label: "剧毒", max: 3, valueKey: "venomDamage", decay: false },
    bleed: { label: "出血", max: 3, valueKey: "bleedDamage", decay: false },
    curse: { label: "诅咒", max: 3, valueKey: "curseDamage", decay: false },
};

export const DOMAIN_DEFS = {
    wuji:      { name: "无量空处", title: "領域展開 · 無量空處", cost: 1200, blocksEffects: true, color: "#cfd6ff", accent: "#0c0d1a" },
    za_warudo: { name: "白金之星·世界", title: "スタープラチナ・ザ・ワールド", cost: 1000, blocksAttacks: true, color: "#ffe06b", accent: "#2b1f00" },
    rojin:     { name: "破坏杀·罗针", title: "破壊殺・羅針", cost: 800, deflectHalf: true, color: "#ff5d67", accent: "#2a0a0c" },
    ongaku:    { name: "苍穹音浪", title: "苍穹音浪", cost: 600, allyAttack: 500, enemyAttack: -500, color: "#63ddff", accent: "#3a0b4f" },
};

function statuses(card) {
    if (!card) return null;
    card.themedState ||= {};
    card.themedState.statuses ||= {};
    return card.themedState.statuses;
}

export function applyAilment(card, id, stacks = 1, value = 0) {
    const def = AILMENTS[id];
    const map = statuses(card);
    if (!def || !map) return 0;
    map[id] = Math.min(def.max, (Number(map[id]) || 0) + Math.max(1, Number(stacks) || 1));
    if (value) card.themedState[def.valueKey] = Number(value) || 0;
    return map[id];
}

export function ailmentStacks(card, id) {
    return Number(card?.themedState?.statuses?.[id]) || 0;
}

export function ailmentValue(card, id) {
    const def = AILMENTS[id];
    return def ? Number(card?.themedState?.[def.valueKey]) || 0 : 0;
}

export function removeAilment(card, id) {
    if (!card?.themedState) return;
    if (card.themedState.statuses) delete card.themedState.statuses[id];
    // 叠层清空时数值字段也必须清掉，避免残留旧伤害值被后续结算再次读取。
    const def = AILMENTS[id];
    if (def) delete card.themedState[def.valueKey];
}

export function cleanseAilments(card) {
    if (!card?.themedState) return;
    delete card.themedState.statuses;
    // 净化是清除全部异常状态，四个数值字段一并清空。
    for (const def of Object.values(AILMENTS)) delete card.themedState[def.valueKey];
}

/** 结束阶段：结算 endingPlayer 场上灼烧/剧毒（伤害+衰减）。返回演出事件数组。 */
export function tickAilments(engine, endingPlayer) {
    const events = [];
    for (const card of [...endingPlayer.monsterZone]) {
        const burn = ailmentStacks(card, "burn");
        if (burn > 0) {
            const damage = ailmentValue(card, "burn") * burn;
            endingPlayer.takeDamage(damage);
            events.push({ card, status: "burn", damage });
            engine.emit("onStatusTick", { card, status: "burn", damage });
            if (AILMENTS.burn.decay) {
                const next = burn - 1;
                if (next > 0) card.themedState.statuses.burn = next;
                else removeAilment(card, "burn");
            }
        }
        const venom = ailmentStacks(card, "venom");
        if (venom > 0) {
            const damage = ailmentValue(card, "venom") * venom;
            endingPlayer.takeDamage(damage);
            events.push({ card, status: "venom", damage });
            engine.emit("onStatusTick", { card, status: "venom", damage });
        }
    }
    return events;
}

/** 某玩家场上是否存在指定领域（源卡在场即生效，直到 until 回合）。 */
export function activeDomain(engine, player, key = null) {
    const turn = engine?.state?.turn ?? 0;
    for (const card of player?.monsterZone || []) {
        const domain = card.themedState?.domain;
        if (!domain || domain.until < turn) continue;
        if (!key || domain.id === key) return { card, domain, def: DOMAIN_DEFS[domain.id] };
    }
    return null;
}
