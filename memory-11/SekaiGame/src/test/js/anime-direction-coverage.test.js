import assert from "node:assert/strict";
import test from "node:test";
import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { ANIME_DESIGN_DIRECTIONS, rarityPowerBudget } from "../../main/resources/static/js/anime-direction-profiles.js";

test("308张自制卡覆盖全部92个动漫设计方向，60张游戏王基础卡不参与", () => {
    const custom = ALL_CARDS.filter(card => card.series !== "starter_ygo");
    const starter = ALL_CARDS.filter(card => card.series === "starter_ygo");
    assert.equal(custom.length, 308);
    assert.equal(starter.length, 60);
    const covered = new Set(custom.map(card => card.designNotes?.direction));
    assert.deepEqual(ANIME_DESIGN_DIRECTIONS.filter(direction => !covered.has(direction)), []);
    assert.equal(ANIME_DESIGN_DIRECTIONS.length, 92);
    assert.equal(starter.some(card => card.rulesVersion === "2026-09-anime-directions-v5"), false);
});

test("效果强度预算随稀有度严格递增", () => {
    const order = ["N", "R", "SR", "SSR", "UR"].map(rarityPowerBudget);
    for (let index = 1; index < order.length; index++) assert.ok(order[index] > order[index - 1]);
});
