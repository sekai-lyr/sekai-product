import assert from "node:assert/strict";
import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";

const monsters = ALL_CARDS.filter(card => card.type === "monster" && card.rarity !== "N" && card.series !== "starter_ygo");
const usedSkillNames = new Map();
const SECONDARY_NAMES = new Set(["余响·寻找", "余响·构思", "余响·蓄势", "余响·守护"]);
const STRATEGY_SECONDARY_NAMES = { picture_ex_084: "青瓷寻伴", picture_ex_086: "雪原澄音", water_010: "低音合奏", picture_ex_094: "主唱的决意", picture_ex_095: "失真蓄音", picture_ssr7_010: "电荷积蓄" };
for (const card of monsters) {
    const secondaryAllowed = card.rarity === "SSR" || card.rarity === "UR" || card.strategyDesign;
    assert.ok(card.effects.length >= 1 && card.effects.length <= (secondaryAllowed ? 2 : 1), `${card.name}效果数量异常`);
    for (const effect of card.effects) {
        assert.ok(effect.type === "themedAction" && effect.action, `${card.name}缺少可结算的动作`);
        assert.ok(effect.skillLabel && effect.hardOncePerTurn, `${card.name}技能缺少时机或限制`);
        assert.ok(effect.description?.length <= 130, `${card.name}单条效果说明过长`);
        assert.ok(!/锋芒觉醒|领域威压|弱点处刑/u.test(effect.skillName || ""), `${card.name}仍使用旧的随机三段模板`);
    }
    const [primary] = card.effects;
    assert.equal(usedSkillNames.has(primary.skillName), false, `${card.name}与${usedSkillNames.get(primary.skillName)}技能名重复`);
    usedSkillNames.set(primary.skillName, card.name);
    for (const extra of card.effects.slice(1)) {
        assert.ok(STRATEGY_SECONDARY_NAMES[card.id] ? extra.skillName === STRATEGY_SECONDARY_NAMES[card.id] : SECONDARY_NAMES.has(extra.skillName), `${card.name}的支援余响名称不在既定集合内`);
    }
}

console.log(`single signature rules passed: ${monsters.length} cards`);
