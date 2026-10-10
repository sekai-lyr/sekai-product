import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { describeThemedAction } from "../../main/resources/static/js/themed-effects.js";

test("每张卡的主效果文本与整卡说明全部互不相同", () => {
    const seenPrimary = new Map();
    const seenCard = new Map();
    for (const card of ALL_CARDS) {
        const primary = (card.effects || [])[0];
        if (primary) {
            const text = `${primary.trigger || ""}|${primary.description || ""}`;
            assert.equal(seenPrimary.has(text), false, `${card.name} 与 ${seenPrimary.get(text)} 主效果文本重复`);
            seenPrimary.set(text, card.name);
        }
        const full = card.description || "";
        assert.equal(seenCard.has(full), false, `${card.name} 与 ${seenCard.get(full)} 整卡说明重复`);
        seenCard.set(full, card.name);
    }
});

test("自制卡的效果文字与引擎参数一致（卡面即结算）", () => {
    for (const card of ALL_CARDS.filter(item => item.series !== "starter_ygo")) {
        for (const effect of card.effects || []) {
            if (effect.type !== "themedAction") continue;
            const text = describeThemedAction(effect);
            assert.ok(text.length > 0, `${card.name}缺少动作文字`);
            assert.ok((effect.description || "").includes(text), `${card.name}卡面文字与参数不一致`);
        }
    }
});

test("同一动作的每张卡主效果参数组合唯一（支援余响允许共用模板）", () => {
    const groups = new Map();
    for (const card of ALL_CARDS.filter(item => item.series !== "starter_ygo")) {
        const primary = (card.effects || [])[0];
        if (!primary || primary.type !== "themedAction") continue;
        const key = `${primary.trigger}|${primary.action}`;
        if (!groups.has(key)) groups.set(key, new Map());
        const used = groups.get(key);
        const params = JSON.stringify(primary.params || {});
        assert.equal(used.has(params), false, `${card.name} 与 ${used.get(params)} 的「${primary.action}」参数重复`);
        used.set(params, card.name);
    }
});
