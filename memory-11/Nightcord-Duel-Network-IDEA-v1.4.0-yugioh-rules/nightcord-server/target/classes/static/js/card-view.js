/** UI安全渲染辅助。 */
export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export const MEMBER_NAMES = {
    ena: "东云绘名",
    kanade: "宵崎奏",
    mafuyu: "朝比奈真冬",
    mizuki: "晓山瑞希",
    group: "Nightcord",
};

export const TYPE_NAMES = { monster: "角色", spell: "魔法", trap: "陷阱" };

export function cardArtHtml(card, className = "", preferFull = false) {
    const src = preferFull ? (card?.image || card?.thumbnail || "") : (card?.thumbnail || card?.image || "");
    const pos = escapeHtml(card?.objectPosition || "center");
    if (!src) {
        return `<div class="art-placeholder ${className}"><span>${escapeHtml(card?.name?.slice(0, 1) || "?")}</span></div>`;
    }
    return `<div class="art-media ${className}">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(card.name)}" loading="lazy" decoding="async" style="object-position:${pos}">
        <div class="art-placeholder art-fallback"><span>${escapeHtml(card?.name?.slice(0, 1) || "?")}</span></div>
    </div>`;
}

export function catalogCardHtml(card, owned = 0, options = {}) {
    const compact = options.compact ? " compact" : "";
    const locked = owned <= 0 ? " locked" : "";
    return `<article class="catalog-card rarity-${escapeHtml(card.rarity)}${compact}${locked}" data-card-id="${escapeHtml(card.id)}">
        ${cardArtHtml(card, "catalog-art")}
        <div class="catalog-gradient"></div>
        <div class="catalog-meta">
            <div class="catalog-kicker"><span>${escapeHtml(TYPE_NAMES[card.type] || card.type)}</span><span>${escapeHtml(card.rarity)}</span></div>
            <strong>${escapeHtml(card.name)}</strong>
            <div class="catalog-stats">${card.type === "monster" ? `ATK ${Number(card.attack || 0)} · DEF ${Number(card.defense || 0)}` : escapeHtml(card.description)}</div>
        </div>
        <span class="owned-count">×${owned}</span>
    </article>`;
}

export function rarityRank(rarity) {
    return { N: 0, R: 1, SR: 2, UR: 3, SSR: 3 }[rarity] ?? 0;
}
