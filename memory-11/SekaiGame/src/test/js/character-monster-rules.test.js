import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";

test("迪亚哥·骇人恶兽只保留恐龙化这一项角色专属效果", () => {
    const card = ALL_CARDS.find(item => item.id === "picture_ex_017");
    assert.ok(card);
    assert.equal(card.effects[0].action, "token");
    assert.equal(card.effects.filter(effect => effect.action === "token").length, 1);
    assert.equal(card.effects[0].skillName, "恐龙化");
    assert.match(card.description, /恐龙化/);
    assert.doesNotMatch(card.description, /锋芒觉醒|领域威压|弱点处刑/);
});
