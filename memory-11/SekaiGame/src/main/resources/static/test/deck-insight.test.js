import test from "node:test";
import assert from "node:assert/strict";
import { analyzeOpening } from "../js/deck-insight.js";
import { matchesDeckSearch, CardGameApp } from "../js/app.js";
import { buildSuggestedDeck, validateDeck } from "../js/deck.js";
import { ALL_CARDS } from "../js/catalog.js";

test("opening probability samples physical copies without replacement", () => {
    const low = { type: "monster", level: 4 };
    const spell = { type: "spell" };
    assert.equal(analyzeOpening([]).chance, 0);
    assert.equal(analyzeOpening(Array(40).fill(low)).chance, 100);
    assert.equal(analyzeOpening(Array(40).fill(spell)).chance, 0);
    assert.equal(analyzeOpening([low, ...Array(39).fill(spell)]).chance, 13);
    const result = analyzeOpening([...Array(12).fill(low), ...Array(28).fill(spell)]);
    assert.equal(result.low, 12);
    assert.equal(result.chance, 85);
    assert.equal(analyzeOpening([low]).chance, 100);
});

test("opening advice flags tribute-heavy decks without treating rarity as usability", () => {
    const result = analyzeOpening([...Array(30).fill({ type: "monster", level: 8, rarity: "UR" }), ...Array(10).fill({ type: "trap" })]);
    assert.equal(result.high, 30);
    assert.equal(result.low, 0);
    assert.ok(result.notes.some(note => note.includes("祭品")));
});

test("library and deck searches include skill names, localized attributes and AND terms", () => {
    const card = { id: "test", name: "伙伴", type: "monster", attribute: "water", rarity: "SR", effects: [{ skillName: "冰之契约", description: "冻结对手角色" }] };
    assert.equal(matchesDeckSearch(card, " 水  冻结 "), true);
    assert.equal(matchesDeckSearch(card, "冰之契约 sr"), true);
    assert.equal(matchesDeckSearch(card, "水 灼烧"), false);
    const context = { collectionFilters: { search: "冰之契约", member: "all", rarity: "all", type: "all", owned: "all" }, collection: { cards: {} } };
    assert.equal(CardGameApp.prototype.filterCollectionCard.call(context, card), true);
});

test("suggested decks provide a low-level opening and respect actual ownership", () => {
    const collection = { cards: Object.fromEntries(ALL_CARDS.map(card => [card.id, 1])) };
    const main = buildSuggestedDeck({ collection, cardDatabase: ALL_CARDS });
    assert.equal(main.length, 40);
    assert.equal(new Set(main).size, 40);
    assert.ok(main.map(id => ALL_CARDS.find(card => card.id === id)).filter(card => card.type === "monster" && card.level <= 4).length >= 16);
    assert.equal(validateDeck({ main }, ALL_CARDS, collection).valid, true);
});

test("suggested decks never pad scarce collections with forbidden or unowned copies", () => {
    const cards = [{ id: "boss", name: "boss", type: "monster", attack: 4000, level: 8 }, { id: "blocked", name: "blocked", type: "spell", deckLimit: 0 }, { id: "low", name: "low", type: "monster", level: 4 }];
    const collection = { cards: { boss: 3, blocked: 3, low: 1 } };
    const main = buildSuggestedDeck({ collection, cardDatabase: cards });
    assert.deepEqual([...main].sort(), ["boss", "low"]);
});
