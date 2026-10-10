import test from "node:test";
import assert from "node:assert/strict";
import { ALL_CARDS } from "../js/catalog.js";
import { CARD_PERFORMANCES, getCardPerformance, performanceGeometry } from "../js/card-performance.js";
import { PERFORMANCE_SHAPES } from "../js/card-performance-fx.js";
import { GameState, Player, createCardInstance } from "../js/model.js";
import { GameEngine } from "../js/engine.js";

test("every card has renderable, distinct geometry and choreography including N/R", () => {
    assert.equal(CARD_PERFORMANCES.length, ALL_CARDS.length);
    assert.equal(new Set(CARD_PERFORMANCES.map(performanceGeometry)).size, ALL_CARDS.length);
    for (const card of ALL_CARDS) {
        const p = getCardPerformance(card);
        assert.ok(PERFORMANCE_SHAPES.includes(p.motif), card.id);
        assert.ok(PERFORMANCE_SHAPES.includes(p.accent), card.id);
        assert.ok(p.colors.every(color => /^#[0-9a-f]{6}$/i.test(color)), card.id);
        assert.equal(getCardPerformance(card.name), p);
        assert.equal(p.applicable.includes("attack"), card.type === "monster");
        assert.equal(Boolean(p.source), p.evidence === "official-character-adaptation");
    }
});

test("character concepts take priority over generic attribute effects", () => {
    for (const p of CARD_PERFORMANCES) {
        if (/空条承太郎|白金之星/.test(p.name)) assert.equal(p.motif, "fist");
        if (/宵崎奏/.test(p.name)) assert.equal(p.motif, "note");
        if (/迪亚哥/.test(p.name) && !/THE WORLD/i.test(p.name)) assert.equal(p.motif, "claw");
        if (/雪之下雪乃/.test(p.name)) assert.equal(p.motif, "petal");
    }
});

test("fusion materials reach graveyard without triggering destruction", () => {
    const state = new GameState();
    state.players = [new Player("A", []), new Player("B", [])];
    state.phase = "main_1"; state.turn = 3; state.firstTurn = false;
    const player = state.players[0];
    const engine = new GameEngine(state);
    const make = id => createCardInstance({ id, name:id, type:"monster", level:4, attack:1000, defense:800, effects:[] });
    const a = make("a"), b = make("b");
    player.monsterZone = [a]; player.hand = [b];
    let destroyed = 0, sent = 0;
    engine.eventBus.on("onDestroyed", () => destroyed++);
    engine.eventBus.on("onSentToGraveyard", () => sent++);
    engine._executeEffect(player, { name:"融合", type:"spell" }, { type:"fusionSummon" });
    assert.equal(player.monsterZone.length, 1);
    assert.equal(player.hand.length, 0);
    assert.ok(player.graveyard.includes(a) && player.graveyard.includes(b));
    assert.equal(destroyed, 0);
    assert.equal(sent, 2);
});
