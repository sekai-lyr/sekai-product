/**
 * decks.js - 预设主题卡组、AI卡组和Nightcord新玩家卡组
 */

import { createDeck } from "./deck.js";

// 二次元魔法卡入门卡组 (40张)
export const NIGHTCORD_STARTER_DECK = {
    id: "nightcord_starter",
    name: "二次元魔法入门卡组",
    coverCardId: "nc_sp_ur_001",
    description: "二次元角色魔法卡入门卡组。包含UR和SSR魔法卡。",
    difficulty: "easy",
    strategy: "balanced",
    main: [
        // 水属性怪兽（新卡）
        "water_007", "water_007", "water_007",
        "water_008", "water_008", "water_008",
        "water_009", "water_009", "water_009",
        "water_010", "water_010", "water_010",
        "water_011", "water_011", "water_011",
        "dark_006", "dark_006", "dark_006",
        // 22 张不同的魔法/陷阱；合计正好 40 张，且没有同名超过 3 张。
        "nc_sp_ur_001", "nc_sp_ur_002", "nc_sp_ur_003", "nc_sp_ur_004",
        "nc_sp_ur_005", "nc_sp_ur_006", "nc_sp_ur_007", "nc_sp_ur_008",
        "nc_sp_ur_009", "nc_sp_ur_010", "nc_sp_ur_011", "nc_sp_ur_012",
        "nc_sp_ss_001", "nc_sp_ss_002", "nc_sp_ss_003", "nc_sp_ss_004",
        "nc_sp_ss_005", "nc_sp_ss_006", "nc_tr_001", "nc_tr_002",
        "nc_tr_003", "nc_tr_004",
    ],

    extra: [],
};

export const PRESET_DECKS = [
    NIGHTCORD_STARTER_DECK,
];

export function getDefaultDecks() {
    return PRESET_DECKS.map(d => ({
        id: d.id, name: d.name, coverCardId: d.coverCardId,
        main: [...d.main], extra: [...(d.extra || [])], side: [],
        createdAt: Date.now(), updatedAt: Date.now(),
    }));
}

export function getAIDeck(difficulty = "normal") {
    const filtered = PRESET_DECKS.filter(d => d.difficulty === difficulty);
    if (filtered.length === 0) return PRESET_DECKS[0];
    return filtered[Math.floor(Math.random() * filtered.length)];
}

// 获取Nightcord新玩家卡组
export function getNightcordStarterDeck() {
    return { ...NIGHTCORD_STARTER_DECK, main: [...NIGHTCORD_STARTER_DECK.main] };
}
