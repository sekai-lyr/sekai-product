/**
 * catalog.js - 游戏使用的完整卡牌目录与插画映射
 */
import { cardDatabase as ELEMENT_CARDS } from "./cards.js";
import { ANIME_CARDS } from "./nightcord-cards.js";
import { NIGHTCORD_ART, getArtById, getDefaultArt } from "./nightcord-art.js";
import { normalizeCardPool } from "./card-rules.js";

const MEMBER_FALLBACK = {
    group: "nc_sp_ur_001",
};

// Do not allow authored flavour text to introduce an engine feature that does
// not exist.  This is also the single source used by deck building and duels.
export const ALL_CARDS = normalizeCardPool([...ELEMENT_CARDS, ...ANIME_CARDS]);
export const NIGHTCORD_ONLY = ALL_CARDS.filter(card => card.series === "nightcord");

export function getCardById(cardId) {
    return ALL_CARDS.find(card => card.id === cardId) || null;
}

export function getCardArts(cardId) {
    return NIGHTCORD_ART[cardId] ? [...NIGHTCORD_ART[cardId]] : [];
}

function getFallbackArt(card) {
    const fallbackId = MEMBER_FALLBACK[card.member] || MEMBER_FALLBACK.group;
    return getDefaultArt(fallbackId);
}

export function hydrateCardArt(card, selectedArtByCard = {}) {
    if (!card) return null;
    if (card.series !== "nightcord") return { ...card };

    const selectedId = selectedArtByCard?.[card.id];
    const selected = selectedId ? getArtById(selectedId) : null;
    const art = selected || getDefaultArt(card.id) || getFallbackArt(card);

    if (!art) return { ...card };
    return {
        ...card,
        image: art.image,
        thumbnail: art.thumbnail || art.image,
        selectedArtId: art.artId,
        objectPosition: art.objectPosition || "center",
        artRarity: art.artRarity || "default",
        foil: !!art.foil,
        limitedArt: !!art.limited,
    };
}

export function hydrateCards(cards, selectedArtByCard = {}) {
    return cards.map(card => hydrateCardArt(card, selectedArtByCard));
}

export function buildCardMap(selectedArtByCard = {}) {
    return new Map(ALL_CARDS.map(card => [card.id, hydrateCardArt(card, selectedArtByCard)]));
}
