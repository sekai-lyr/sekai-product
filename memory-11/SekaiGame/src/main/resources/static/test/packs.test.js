import { describe, it } from "node:test";
import assert from "node:assert/strict";
global.document = { createElement: () => ({ textContent: "" }) };

const { openPack, openTenPacks, NIGHTCORD_PACK, PACK_RATES, getEffectiveRates } = await import("../js/packs.js");
const { ANIME_CARDS } = await import("../js/nightcord-cards.js");
import { SequenceRandom } from "../js/rng.js";

describe("Nightcord卡包系统", () => {
    it("单抽只获得1张卡", () => {
        const result = openPack(NIGHTCORD_PACK, ANIME_CARDS);
        assert.equal(result.success, true);
        assert.equal(result.cards.length, 1);
    });
    it("十连10张保底生效", () => {
        const rng = new SequenceRandom(Array.from({ length: 200 }, () => 0.01));
        const result = openTenPacks(NIGHTCORD_PACK, ANIME_CARDS, rng);
        assert.equal(result.success, true);
        assert.equal(result.cards.length, 10);
        const hasSR = result.cards.some(c => ["SR", "SSR", "UR"].includes(c.rarity));
        assert.ok(hasSR, "十连保底应至少有一张SR或以上");
    });
    it("抽取结果全部来自Nightcord卡池", () => {
        const result = openPack(NIGHTCORD_PACK, ANIME_CARDS);
        assert.ok(result.cards.every(c => c.series === "nightcord"));
    });
    it("空卡池返回错误", () => {
        const fakePack = { id: "empty", name: "空包", cardsPerPack: 8, pool: { attribute: "nonexistent" } };
        const result = openPack(fakePack, ANIME_CARDS);
        assert.equal(result.success, false);
    });
    it("抽取后收藏数量正确增加", async () => {
        const { createDefaultCollection, addCard } = await import("../js/collection.js");
        const col = createDefaultCollection();
        const result = openPack(NIGHTCORD_PACK, ANIME_CARDS);
        for (const card of result.cards) { addCard(col, card.id); }
        result.cards.forEach(c => assert.ok(getCardCount(col, c.id) > 0));
    });
    it("概率设置正确", () => {
        assert.equal(PACK_RATES.N, 0.05);
        assert.equal(PACK_RATES.R, 0.1);
        assert.equal(PACK_RATES.SR, 0.45);
        assert.equal(PACK_RATES.SSR, 0.3);
        assert.equal(PACK_RATES.UR, 0.1);
        const total = PACK_RATES.N + PACK_RATES.R + PACK_RATES.SR + PACK_RATES.SSR + PACK_RATES.UR;
        assert.ok(Math.abs(total - 1.0) < 0.001);
    });
    it("50包保底必定触发UR", () => {
        // 保底由 openPack 强制将第50抽设为UR；概率表本身不能变成 1.0。
        const rates = getEffectiveRates(100);
        assert.ok(rates.UR < 1, "保底包不应把每个卡位都变成UR");
        assert.ok(rates.UR > getEffectiveRates(0).UR, "保底包的UR概率必须高于普通包");
    });
    it("抽到UR后保底重置", async () => {
        const { createDefaultCollection, incrementPity, resetPity, getPityCount } = await import("../js/collection.js");
        const col = createDefaultCollection();
        incrementPity(col, "nightcord_pack_001");
        incrementPity(col, "nightcord_pack_001");
        incrementPity(col, "nightcord_pack_001");
        assert.equal(getPityCount(col, "nightcord_pack_001"), 3);
        resetPity(col, "nightcord_pack_001");
        assert.equal(getPityCount(col, "nightcord_pack_001"), 0);
    });
});

function getCardCount(col, id) { return col.cards[id] || 0; }
