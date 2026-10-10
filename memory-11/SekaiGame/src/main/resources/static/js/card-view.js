import { DOMAIN_DEFS } from "./status-effects.js";

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

const EFFECT_TRIGGER_NAMES = {
    onSummon: "召唤成功时",
    onTurnEnd: "自己的结束阶段",
    onDestroyed: "被破坏时",
    onAttacked: "被攻击时",
    onAttack: "攻击时",
    onFlip: "翻开时",
    manual: "主要阶段主动发动",
    passive: "持续生效",
};

function cleanEffectDescription(effect) {
    return String(effect?.description || "")
        .replace(/^(?:通常召唤成功时|主要阶段|被破坏送入墓地时|自己的结束阶段|对方攻击宣言时)，同名此效果每回合1次：/u, "")
        .replace(/^【(?:登场技|连携技|终结技)·[^】]+】/u, "")
        .replace(/^(?:召唤成功时|被破坏时|被攻击时|攻击时|翻开时|主要阶段主动发动|发动时|持续生效)[：:]/u, "")
        .trim();
}

function stableCardSeed(value = "") {
    let seed = 2166136261;
    for (const character of String(value)) {
        seed ^= character.codePointAt(0);
        seed = Math.imul(seed, 16777619) >>> 0;
    }
    return seed;
}

export function cardEffectFieldsHtml(card) {
    const effects = Array.isArray(card?.effects) ? card.effects.filter(Boolean) : [];
    if (!effects.length) {
        const fallback = card?.description || (card?.type === "monster" ? "通常怪兽：没有额外卡牌效果。" : "暂无效果说明。");
        return `<div class="detail-effect-empty">${escapeHtml(fallback)}</div>`;
    }
    const stageLabels = ["登场技", "连携技", "终结技"];
    return `<div class="detail-effect-fields">${effects.map((effect, index) => {
        const isStagedMonster = card?.type === "monster" && effects.length === 3;
        const label = effect.skillLabel || (isStagedMonster ? stageLabels[index] : `效果 ${index + 1}`);
        const skillName = effect.skillName || "卡牌效果";
        const trigger = EFFECT_TRIGGER_NAMES[effect.trigger] || "效果结算时";
        const description = cleanEffectDescription(effect) || "执行该技能效果。";
        const limit = effect.oncePerTurn ? `<span class="detail-effect-limit">${effect.hardOncePerTurn ? "同名此效果每回合1次" : "每回合1次"}</span>` : "";
        return `<section class="detail-effect-field" data-skill-stage="${escapeHtml(effect.skillStage || "effect")}">
            <div class="detail-effect-heading"><span class="detail-effect-label">${escapeHtml(label)}</span><strong>${escapeHtml(skillName)}</strong>${limit}</div>
            <div class="detail-effect-trigger">触发：${escapeHtml(trigger)}</div>
            <div class="detail-effect-text">${escapeHtml(description)}</div>
        </section>`;
    }).join("")}${card.strategyDesign ? `<details class="detail-strategy"><summary>战术定位与反制</summary><p>${escapeHtml(card.strategyDesign.role)}</p><p>代价：${escapeHtml(card.strategyDesign.tradeoff)}</p><p>反制：${escapeHtml(card.strategyDesign.counter)}</p>${card.strategyDesign.adaptation ? `<p>${escapeHtml(card.strategyDesign.adaptation)}。来源状态：待核验。</p>` : ""}</details>` : ""}</div>`;
}

export function cardRuleStatusHtml(card, turn = null) {
    const state = card.themedState || {};
    const labels = [];
    // 第二条参数是状态色 class 后缀（见 style.css 的 .card-rule-status .status-*）。
    const push = (text, statusClass = "") => labels.push(statusClass
        ? `<span class="status-${statusClass}">${escapeHtml(text)}</span>`
        : escapeHtml(text));
    if (state.charges) push(`蓄力 ${state.charges}/3`);
    const statuses = state.statuses || {};
    const ailmentNames = { burn: "灼烧", venom: "剧毒", bleed: "出血", curse: "诅咒" };
    for (const [id, name] of Object.entries(ailmentNames)) {
        const stacks = Number(statuses[id]) || 0;
        if (stacks > 0) push(`${name}×${stacks}`, id);
    }
    if (state.exile) push("异界归来", "exile");
    if (state.domain) {
        const domainName = DOMAIN_DEFS[state.domain.id]?.name;
        push(domainName ? `领域·${domainName}` : "领域", "domain");
    }
    if (state.paralyzedUntil != null && (turn == null || state.paralyzedUntil >= turn)) push("麻痹");
    if (state.infinityUntil != null && (turn == null || state.infinityUntil >= turn)) push("无下限");
    for (const [key, text] of [["poisonTurn", "毒印"], ["bombTurn", "延迟爆破"], ["sealedUntil", "效果无效"], ["frozenUntil", "冻结"], ["shelterUntil", "庇护1次"], ["wardUntil", "不可取对象"], ["piercingUntil", "贯穿"]]) {
        if (state[key] != null && (turn == null || !key.endsWith("Until") || state[key] >= turn)) push(text);
    }
    return labels.length ? `<div class="card-rule-status" aria-label="卡牌状态">${labels.join(" · ")}</div>` : "";
}

export function cardVisualEffectHtml(card) {
    if (card?.rarity === "R") return "";
    const attr = escapeHtml(card?.attribute || card?.element || "none");
    const rarity = String(card?.rarity || "N").toUpperCase();
    // SSR / UR 额外加一层漂浮光尘，做出"动态皮肤"的层次感
    const motes = rarity === "SSR" || rarity === "UR"
        ? `<span class="card-live-motes" aria-hidden="true"></span>`
        : "";
    return `<span class="card-breeze-overlay" aria-hidden="true"></span>`
        + `<span class="card-live-aura" data-elem="${attr}" aria-hidden="true"></span>`
        + motes;
}

/**
 * 统一卡背。全项目复用同一份：对手手牌、卡组堆、墓地堆、里侧盖牌、
 * 卡序列表背面、卡包翻面与名场面抽卡飞行卡背。
 *
 * 画面本身是一张真实立绘（金色镂空边框 + 蓝色晶核），由
 * `scripts/build-card-back.py` 把白底换成深空底、清掉边框外的线稿残渣，
 * 输出为 `assets/cardbacks/sekai-card-back.webp`，由 CSS 铺满整个卡面。
 * 这里只负责叠一层缓慢流动的虹彩与底部标签。
 *
 * @param {{tag?:string, label?:string}} options label 会叠加在卡背底部（如 SET / TRAP）
 */
export function sekaiCardBackHtml(options = {}) {
    const label = options.label ? `<span class="sekai-back-label">${escapeHtml(options.label)}</span>` : "";
    return `<span class="sekai-card-back" aria-hidden="true"><span class="sekai-card-back-sheen"></span>${label}</span>`;
}

export function cardVisualImageClass(card) {
    return card?.rarity === "R" ? "" : "card-breeze-image";
}

export function cardVisualMotionStyle(card) {
    if (card?.rarity === "R") return "";
    const seed = stableCardSeed(`${card?.id || ""}:${card?.name || ""}:${card?.image || card?.thumbnail || ""}`);
    return `--card-breeze-delay:-${((seed % 7000) / 1000).toFixed(3)}s;`;
}

export function cardArtHtml(card, className = "", preferFull = false) {
    // 默认用 320px 缩略图；需要大图时用 640px 版本；originalImage 作为加载失败的回退。
    const src = preferFull
        ? (card?.fullImage || card?.image || card?.thumbnail || "")
        : (card?.image || card?.thumbnail || "");
    const pos = escapeHtml(card?.objectPosition || "center");
    const fallback = escapeHtml(card?.originalImage || "");
    if (!src) {
        return `<div class="art-placeholder ${className}"><span>${escapeHtml(card?.name?.slice(0, 1) || "?")}</span>${cardVisualEffectHtml(card)}</div>`;
    }
    return `<div class="art-media ${className}">
        <img class="${cardVisualImageClass(card)}" src="${escapeHtml(src)}" data-fallback-src="${fallback}" alt="${escapeHtml(card.name)}" loading="lazy" decoding="async" style="object-position:${pos};${cardVisualMotionStyle(card)}">
        <div class="art-placeholder art-fallback"><span>${escapeHtml(card?.name?.slice(0, 1) || "?")}</span></div>
        ${cardVisualEffectHtml(card)}
    </div>`;
}

export function catalogCardHtml(card, owned = 0, options = {}) {
    const compact = options.compact ? " compact" : "";
    const locked = owned <= 0 ? " locked" : "";
    const starter = card.series === "starter_ygo" ? " starter-ygo-card" : "";
    return `<article class="catalog-card bca-card-frame rarity-${escapeHtml(card.rarity)}${starter}${compact}${locked}" data-card-id="${escapeHtml(card.id)}" data-rarity="${escapeHtml(card.rarity)}" data-card-type="${escapeHtml(card.type)}" data-attribute="${escapeHtml(card.attribute || "none")}" data-member="${escapeHtml(card.member || "")}" data-series="${escapeHtml(card.series || "")}">
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
    // UR 必须高于 SSR（与 rarity-rules.js 的 {N:0,R:1,SR:2,SSR:3,UR:4}、分解/制作
    // 价值表一致）。两者同为 3 时排序把它们视为同级，抽到 UR 的卡包演出会显示"SSR"。
    return { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 }[rarity] ?? 0;
}
