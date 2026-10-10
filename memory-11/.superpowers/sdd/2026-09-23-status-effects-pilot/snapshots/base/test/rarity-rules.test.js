import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_CARDS } from "../js/catalog.js";

const customCards = ALL_CARDS.filter(card => ["picture", "source_archive"].includes(card.series));

describe("自制卡稀有度规则分层", () => {
    it("每张自制卡都有唯一规则签名", () => {
        // 30 张试点卡刻意共用同一动作（如 M:bleed），规则差异转移到候选参数上；
        // 参数唯一性由 src/test/js/effect-diversity.test.js 全局锁定，这里把参数并入签名。
        const signatureOf = card => `${card.type}:${card.ruleSignature}:${JSON.stringify(card.effects[0]?.params || {})}`;
        assert.equal(new Set(customCards.map(signatureOf)).size, customCards.length);
    });

    it("每张自制卡只保留一项角色专属效果", () => {
        customCards
            .forEach(card => assert.equal(card.effects.length, 1, `${card.id} 应只有一项效果`));
    });

    it("所有自制卡效果都有描述和执行类型", () => {
        customCards.forEach(card => card.effects.forEach(cardEffect => {
            assert.ok(cardEffect.type);
            assert.ok(cardEffect.description);
        }));
    });
});
