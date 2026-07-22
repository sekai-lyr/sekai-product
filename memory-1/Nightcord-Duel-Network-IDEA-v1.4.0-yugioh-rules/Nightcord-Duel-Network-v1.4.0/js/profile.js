/**
 * profile.js - 新存档初始化与默认收藏
 */
import { createDefaultCollection } from "./collection.js";
import { getDefaultDecks, NIGHTCORD_STARTER_DECK } from "./decks.js";
import { getCardArts } from "./catalog.js";

export function createNewProfile() {
    const collection = createDefaultCollection();
    collection.version = 2;
    collection.profile = { name: "决斗者", level: 1, xp: 0 };
    collection.decks = getDefaultDecks();
    collection.selectedDeckId = collection.decks[0]?.id || null;

    for (const cardId of NIGHTCORD_STARTER_DECK.main) {
        collection.cards[cardId] = (collection.cards[cardId] || 0) + 1;
        const art = getCardArts(cardId)[0];
        if (art) {
            collection.artCollection[art.artId] = 1;
            collection.selectedArtByCard[cardId] ||= art.artId;
        }
    }
    return collection;
}

export function ensureProfile(collection) {
    const data = collection || createNewProfile();
    data.profile ||= { name: "决斗者", level: 1, xp: 0 };
    data.decks ||= getDefaultDecks();
    if (data.decks.length === 0) data.decks = getDefaultDecks();
    data.selectedDeckId ||= data.decks[0].id;
    data.cards ||= {};
    data.artCollection ||= {};
    data.selectedArtByCard ||= {};

    // 旧版本存档若还没有Nightcord卡组，自动补充一副可直接游玩的入门卡组。
    const existingStarter = data.decks.find(deck => deck.id === NIGHTCORD_STARTER_DECK.id);
    if (!existingStarter) {
        data.decks.unshift(getDefaultDecks()[0]);
        data.selectedDeckId = NIGHTCORD_STARTER_DECK.id;
    } else if (existingStarter.main.length < 40) {
        // v1.4规则升级：旧30张入门卡组自动迁移为40张合法卡组。
        existingStarter.main = [...NIGHTCORD_STARTER_DECK.main];
        existingStarter.extra = [...(NIGHTCORD_STARTER_DECK.extra || [])];
        existingStarter.side ||= [];
        existingStarter.updatedAt = Date.now();
    }
    const starterCounts = NIGHTCORD_STARTER_DECK.main.reduce((counts, id) => {
        counts[id] = (counts[id] || 0) + 1;
        return counts;
    }, {});
    for (const [cardId, required] of Object.entries(starterCounts)) {
        if ((data.cards[cardId] || 0) < required) data.cards[cardId] = required;
        const art = getCardArts(cardId)[0];
        if (art) {
            data.artCollection[art.artId] ||= 1;
            data.selectedArtByCard[cardId] ||= art.artId;
        }
    }
    data.currency ||= { duelCoins: 2000, shards: { N: 0, R: 0, SR: 0, UR: 0 } };
    data.currency.shards ||= { N: 0, R: 0, SR: 0, UR: 0 };
    data.statistics ||= { packsOpened: 0, duelsPlayed: 0, wins: 0, losses: 0, draws: 0, firstWinToday: null };
    data.pityCounters ||= {};
    data.claimedRewards ||= {};
    return data;
}
