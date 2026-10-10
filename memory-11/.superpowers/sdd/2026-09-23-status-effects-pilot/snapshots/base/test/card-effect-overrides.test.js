import test from "node:test";
import assert from "node:assert/strict";

import { applyPlayableRules } from "../js/card-rules.js";
import { ANIME_CARDS } from "../js/nightcord-cards.js";

test("奏响点亮天空与八千年的思念使用不同的角色专属单效果", () => {
    const memory = applyPlayableRules(ANIME_CARDS.find(card => card.id === "nc_sp_ur_001"));
    const sky = applyPlayableRules(ANIME_CARDS.find(card => card.id === "nc_sp_ss_005"));

    assert.deepEqual(memory.effects.map(effect => effect.action), ["recall"]);
    assert.deepEqual(sky.effects.map(effect => effect.action), ["chorus"]);
    assert.notEqual(sky.ruleSignature, memory.ruleSignature);
});
