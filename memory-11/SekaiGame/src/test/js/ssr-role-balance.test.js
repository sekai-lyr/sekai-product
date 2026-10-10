import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { hasEffectHandler } from "../../main/resources/static/js/engine.js";

test("SSR怪兽为一项招牌技（可带一条支援余响）", () => {
    const cards = ALL_CARDS.filter(card => card.type === "monster" && card.rarity === "SSR");
    assert.ok(cards.length >= 40);
    for (const card of cards) {
        assert.ok(card.effects.length >= 1 && card.effects.length <= 2, `${card.name}效果数量异常`);
        for (const effect of card.effects) {
            assert.ok(hasEffectHandler(effect.type), `${card.name}存在无法执行的效果`);
            assert.ok(/同名此效果每回合1次：/u.test(effect.description) && effect.skillName && effect.trigger, `${card.name}触发说明不清晰`);
        }
    }
});

test("不同SSR仍保留多种战术方向", () => {
    const cards = ALL_CARDS.filter(card => card.type === "monster" && card.rarity === "SSR");
    const effectTypes = new Set(cards.flatMap(card => card.effects.map(effect => effect.action || effect.type)));
    assert.ok(effectTypes.size >= 8, `SSR机制种类不足：${effectTypes.size}`);
});
