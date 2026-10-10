/**
 * decks.js - 预设主题卡组、AI卡组和Nightcord新玩家卡组
 */

import { createDeck } from "./deck.js";

export const AI_FALLBACK_DECK = {
    id: "ai_fallback",
    name: "AI基础卡组",
    coverCardId: "water_010",
    difficulty: "normal",
    strategy: "balanced",
    // 必须满足 deck.js 的校验：40～60 张、同名卡最多 3 张。
    // 旧版本对 6 种卡各放了 4 张，导致这个"预设卡组"本身是非法卡组。
    main: [
        "water_007", "water_007", "water_007", "water_008", "water_008", "water_008",
        "water_009", "water_009", "water_009", "water_010", "water_010", "water_010",
        "water_011", "water_011", "water_011", "dark_006", "dark_006", "dark_006",
        "nc_sp_ur_001", "nc_sp_ur_002", "nc_sp_ur_003", "nc_sp_ur_004",
        "nc_sp_ur_005", "nc_sp_ur_006", "nc_sp_ur_007", "nc_sp_ur_008",
        "nc_sp_ur_001", "nc_sp_ur_002", "nc_sp_ur_003", "nc_sp_ur_004",
        "nc_sp_ur_005", "nc_sp_ur_006", "nc_sp_ur_007", "nc_sp_ur_008",
        "nc_tr_001", "nc_tr_002", "nc_tr_003", "nc_tr_004",
        "nc_tr_005", "nc_tr_001",
    ],
    extra: [],
};

export const NIGHTCORD_STARTER_DECK = AI_FALLBACK_DECK;
export const PRESET_DECKS = [];

export function getDefaultDecks() {
    return PRESET_DECKS.map(d => ({
        id: d.id, name: d.name, coverCardId: d.coverCardId,
        main: [...d.main], extra: [...(d.extra || [])], side: [],
        createdAt: Date.now(), updatedAt: Date.now(),
    }));
}

/**
 * 入门卡组：离线（无后端）新档必须至少有一副 40 张的合法卡组，
 * 否则无法进入决斗，也就无法赚币/开包，形成死循环。
 */
export function getStarterDeck() {
    return {
        id: "starter_deck",
        name: "入门卡组",
        coverCardId: AI_FALLBACK_DECK.coverCardId,
        main: [...AI_FALLBACK_DECK.main],
        extra: [], side: [],
        createdAt: Date.now(), updatedAt: Date.now(),
    };
}

export function getAIDeck(difficulty = "normal") {
    const filtered = PRESET_DECKS.filter(d => d.difficulty === difficulty);
    if (filtered.length === 0) return AI_FALLBACK_DECK;
    return filtered[Math.floor(Math.random() * filtered.length)];
}
