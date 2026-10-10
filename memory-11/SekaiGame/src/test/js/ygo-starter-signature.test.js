import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { hasEffectHandler } from "../../main/resources/static/js/engine.js";

const starter = ALL_CARDS.filter(card => card.series === "starter_ygo");

test("60张入门卡每张都只有1个可结算效果", () => {
    assert.equal(starter.length, 60);
    for (const card of starter) {
        assert.equal(card.effects.length, 1, `${card.name}应只有1个效果`);
        const [effect] = card.effects;
        assert.ok(effect.type && hasEffectHandler(effect.type), `${card.name}效果没有对应处理器`);
        assert.ok(effect.description, `${card.name}缺少效果说明`);
    }
});

test("36张通常怪兽各有一个互不重复的原作招式", () => {
    const monsters = starter.filter(card => card.type === "monster");
    assert.equal(monsters.length, 36);
    const names = monsters.map(card => card.effects[0].skillName);
    assert.ok(names.every(Boolean), "通常怪兽缺少招式名");
    assert.equal(new Set(names).size, names.length, "招式名必须互不相同");
    for (const card of monsters) assert.ok(card.effects[0].skillLabel, `${card.name}缺少技能标签`);
});

test("入门怪兽招牌效果之间不存在完全相同的机制组合", () => {
    const monsters = starter.filter(card => card.type === "monster");
    const signatures = monsters.map(card => {
        const effect = card.effects[0];
        return JSON.stringify({ trigger: effect.trigger, type: effect.type, value: effect.value, target: effect.target || null });
    });
    assert.equal(new Set(signatures).size, signatures.length, "存在完全相同的入门效果组合");
});
