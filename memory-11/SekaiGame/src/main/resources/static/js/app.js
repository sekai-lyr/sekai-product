import { configureDuelMotion } from "./duel-motion.js";
import { STRATEGY_DECKS, getStrategyDeck } from "./strategy-decks.js";
import { GAME_CONFIG } from "./constants.js";
/**
 * app.js - 游戏大厅、商店、收藏与卡组编辑器
 */
import {
    addArt,
    addCard,
    canCraft,
    craftCard,
    dismantleCard,
    getCardCount,
    getPityCount,
    incrementPity,
    resetPity,
    setSelectedArt,
    spendDuelPoints,
} from "./collection.js?v=1.7.0";
import { ALL_CARDS, getCardArts, getCardById, hydrateCardArt } from "./catalog.js?v=1.8.6-original";
import { NIGHTCORD_PACK, PACK_RATES, openPack, openTenPacks, applyDuplicateProtection } from "./packs.js?v=1.8.1";
import { buildSuggestedDeck, getCardCopyLimit, validateDeck } from "./deck.js?v=1.8.0";
import { saveData } from "./storage.js?v=1.7.4";
import { loadAuth } from "./auth.js";
import { createDeck as createServerDeck, craftCardServer, deleteDeck as deleteServerDeck, dismantleCardServer, openPackServer, saveUserCollection, updateDeck as updateServerDeck } from "./api.js?v=1.7.4";
import { cardArtHtml, cardEffectFieldsHtml, catalogCardHtml, escapeHtml, MEMBER_NAMES, TYPE_NAMES, rarityRank, sekaiCardBackHtml } from "./card-view.js?v=1.2.0-bca";
import { AI_STAGES, buildStageDeck, isStageUnlocked } from "./stages.js?v=1.8.2";
import { playDuelLaunch, playDimensionRecruitment } from "./card-ignition.js?v=1.0.7";
import { playSound, setSoundEnabled } from "./audio.js?v=1.0.0";
import { analyzeOpening } from "./deck-insight.js";
import { getCardPerformance } from "./card-performance.js?v=14-trap-atlas-webp";
import { playCardPerformance } from "./card-performance-fx.js?v=17-card-atlas-4x4";

const ROUTES = new Set(["home", "shop", "collection", "decks", "rules", "settings"]);// 注意：不要把这个别名叫做 NIGHTCORD_ONLY —— catalog.js 导出的同名常量只包含 80 张
// nightcord 卡，同名不同义极易混淆。

const GAME_PAGE_NAMES = { home: "主界面", shop: "世界回响", collection: "角色图鉴", decks: "卡组编成", rules: "决斗手册", settings: "游戏设置" };

function gameIcon(name) {
    const paths = {
        home: '<path d="M3 11 12 3l9 8M6 9v12h12V9M10 21v-7h4v7"/>',
        shop: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
        collection: '<rect x="7" y="3" width="13" height="17" rx="2"/><path d="M4 7H2v15h14M11 8h5M11 12h5M11 16h3"/>',
        decks: '<path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4"/>',
        rules: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-4-1-7-1-10 1Z"/>',
        settings: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="19" r="2"/>',
        duel: '<path d="m4 3 7 4 10 14M20 3l-7 4L3 21M3 15l6 6M15 21l6-6"/>',
        stage: '<path d="M4 21V3m0 2c6-6 10 6 16 0v10c-6 6-10-6-16 0"/>',
        room: '<circle cx="8" cy="8" r="4"/><path d="M1 22v-3a7 7 0 0 1 14 0v3M16 4a4 4 0 0 1 0 8m2 3a6 6 0 0 1 5 7"/>',
        play: '<path d="m8 4 12 8-12 8Z"/>',
        back: '<path d="m14 4-8 8 8 8"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.home}</svg>`;
}

const ALL_PLAYABLE_CARDS = ALL_CARDS;
const PACK_POOL = ALL_CARDS.filter(card => card.series !== "starter_ygo");

/**
 * 给可能永不完成的 Promise 加超时：PvP 服务器不回应时，界面不能永久停在
 * "正在连接服务器..."（按钮被禁用且没有重试机会）。
 */
function withTimeout(promise, milliseconds, message) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds)),
    ]);
}

export function matchesDeckSearch(card, keyword) {
    const query = String(keyword || "").trim().toLocaleLowerCase("zh-CN");
    if (!query) return true;
    const effectText = Array.isArray(card.effects)
        ? card.effects.map(effect => `${effect?.type || ""} ${effect?.skillName || ""} ${effect?.action || ""} ${effect?.description || ""}`).join(" ")
        : "";
    const searchable = [
        card.name,
        card.description,
        card.type,
        TYPE_NAMES[card.type],
        card.attribute,
        ({ fire: "炎 火", water: "水", wind: "风", earth: "地", light: "光", dark: "暗" })[card.attribute],
        card.rarity,
        card.race,
        effectText,
    ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
    return query.split(/\s+/u).every(term => searchable.includes(term));
}

export function deckBattleValue(card) {
    const designedValue = Number(card?.aiHints?.priority);
    // 卡池归一化会给所有卡补上 priority: 0，因此 0 表示"没有设计值"，
    // 必须继续走稀有度/攻守/效果估算，否则 263/368 张卡的战力恒为 0。
    if (Number.isFinite(designedValue) && designedValue > 0) return designedValue;
    const rarityValue = { N: 10, R: 25, SR: 45, SSR: 65, UR: 85 }[card?.rarity] || 0;
    const statValue = card?.type === "monster"
        ? ((Number(card.attack) || 0) + (Number(card.defense) || 0)) / 200
        : 0;
    const effectValue = Array.isArray(card?.effects) ? Math.min(card.effects.length * 3, 15) : 0;
    return rarityValue + statValue + effectValue;
}

export class CardGameApp {
    constructor(collection, { onStartDuel }) {
        this.collection = collection;
        this.onStartDuel = onStartDuel;
        this.shell = document.getElementById("app-shell");
        this.screenRoot = document.getElementById("screen-root");
        this.modalRoot = document.getElementById("modal-root");
        this.toastRoot = document.getElementById("toast-root");
        this.route = "home";
        this.collectionFilters = { search: "", member: "all", rarity: "all", type: "all", owned: "all" };
        this.selectedCollectionCardId = ALL_PLAYABLE_CARDS[0]?.id || null;
        this.deckDraft = null;
        this.deckSourceFilter = { search: "", type: "all", attribute: "all", rarity: "all", level: "all", owned: "owned" };
        this.deckViewFilter = "all";
        this.ignitionAnimation = null;
        this.launchAnimation = null;
        this.packAnimation = null;
        this.lobbyTimer = null;
        this.lobbySlideIndex = 0;
        this._onLobbyResize = () => this.applyLobbySlideFit();
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") window.addEventListener("resize", this._onLobbyResize);
        this.bindGlobalEvents();
        this.navigate("home");
    }

    bindGlobalEvents() {
        document.querySelectorAll(".sidebar [data-route]").forEach(button => {
            button.innerHTML = `<span class="game-nav-icon">${gameIcon(button.dataset.route)}</span><span>${GAME_PAGE_NAMES[button.dataset.route]}</span>`;
        });
        // 右侧功能键列：PV / 新手教学 / 每日首胜状态，进大厅只绑定一次。
        document.getElementById("home-pv")?.addEventListener("click", () => this.showPvModal());
        document.getElementById("home-tutorial")?.addEventListener("click", () => this.startTutorial());
        document.getElementById("rail-daily")?.addEventListener("click", () => {
            const done = this.collection.statistics?.firstWinToday === new Date().toDateString();
            this.toast(done ? "今日首胜已达成，明天继续并肩作战" : "今日首胜：赢得一场 AI 决斗可得 +300 次元币", done ? "success" : "info");
        });
        document.getElementById("game-back")?.addEventListener("click", () => this.navigate("home"));
        document.querySelectorAll("[data-route]").forEach(button => {
            button.addEventListener("click", () => this.navigate(button.dataset.route));
        });
        document.getElementById("brand-home")?.addEventListener("click", () => this.navigate("home"));
        this.modalRoot.addEventListener("click", event => {
            if (event.target === this.modalRoot || event.target.closest("[data-close-modal]")) this.closeModal();
        });
        document.getElementById("detail-overlay")?.addEventListener("click", event => {
            if (event.target === document.getElementById("detail-overlay") || event.target.closest("[data-detail-close]")) {
                document.getElementById("detail-overlay").classList.remove("active");
                document.body.classList.remove("battle-modal-open");
            }
        });
        document.addEventListener("error", event => {
            const img = event.target;
            if (!(img instanceof HTMLImageElement) || !img.closest(".art-media")) return;
            img.hidden = true;
            img.nextElementSibling?.classList.add("visible");
        }, true);
    }

    showCardDetail(card) {
        if (!card) return;
        const attr = card.attribute || card.element || "none";
        const typeName = card.type === "monster" ? "怪兽卡" : card.type === "spell" ? "魔法卡" : "陷阱卡";
        const raceName = { dragon: "龙族", warrior: "战士族", spellcaster: "魔法师族", beast: "兽族", machine: "机械族", fiend: "恶魔族", fairy: "天使族", rock: "岩石族", aqua: "水族", winged_beast: "鸟兽族", insect: "昆虫族" }[card.race] || "";
        const rarityName = { N: "普通", R: "稀有", SR: "超稀有", SSR: "传说", UR: "究极" }[card.rarity] || "";
        const monsterStats = card.type === "monster"
            ? ` · ATK ${Number(card.attack) || 0} · DEF ${Number(card.defense) || 0}`
            : "";
        document.getElementById("detail-name").textContent = card.name;
        document.getElementById("detail-type").textContent = `${typeName} · ${({ fire: "火", water: "水", wind: "风", earth: "地", light: "光", dark: "暗" })[attr] || ""}属性 · ${raceName} · Lv.${card.level || "?"} · ${rarityName}${monsterStats}`;
        document.getElementById("detail-desc").innerHTML = cardEffectFieldsHtml(card);
        document.getElementById("detail-card-display").innerHTML = `<div class="card detail-card">${cardArtHtml(card, "detail-art")}</div>`;
        document.getElementById("detail-overlay").classList.add("active");
        document.body.classList.add("battle-modal-open");
    }

    showShell() {
        this.shell.classList.remove("is-hidden");
        document.getElementById("battle-screen")?.classList.remove("active");
        this.renderTopbar();
    }

    hideShell() {
        this.stopLobbySlideshow();
        this.shell.classList.add("is-hidden");
    }

    navigate(route) {
        if (!ROUTES.has(route)) route = "home";
        this.cancelIgnitionAnimation();
        this.stopLobbySlideshow();
        // 离开收藏页时必须清掉搜索防抖定时器，否则 140ms 后它会把当前界面顶回收藏页。
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
        this.route = route;
        this.shell.dataset.page = route;
        this.screenRoot.scrollTop = 0;
        const pageName = document.getElementById("game-page-name");
        if (pageName) pageName.textContent = GAME_PAGE_NAMES[route];
        const back = document.getElementById("game-back");
        if (back) back.hidden = route === "home";
        this.showShell();
        document.querySelectorAll("[data-route]").forEach(button => {
            button.classList.toggle("active", button.dataset.route === route);
            if (button.dataset.route === route) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
        if (route === "home") this.renderHome();
        if (route === "shop") this.renderShop();
        if (route === "collection") this.renderCollection();
        // 再次进入卡组页时保留未保存的草稿（原实现传 true 会静默丢弃所有改动）。
        if (route === "decks") this.renderDeckEditor(false);
        if (route === "rules") this.renderRules();
        if (route === "settings") this.renderSettings();
    }

    cancelIgnitionAnimation() {
        this.ignitionAnimation?.cancel?.();
        this.launchAnimation?.cancel?.();
        this.packAnimation?.cancel?.();
        this.ignitionAnimation = null;
        this.launchAnimation = null;
        this.packAnimation = null;
    }

    renderTopbar() {
        const profile = this.collection.profile || { name: "决斗者", level: 1 };
        document.getElementById("profile-name").textContent = profile.name;
        document.getElementById("profile-level").textContent = `LV.${profile.level || 1}`;
        document.getElementById("coin-count").textContent = formatNumber(this.collection.currency.duelCoins || 0);
        document.getElementById("shard-count").textContent = formatNumber(Object.values(this.collection.currency.shards || {}).reduce((a, b) => a + b, 0));
        // RANK 区：等级 + 图鉴收集进度（真实数据）。
        const big = document.getElementById("profile-level-big");
        if (big) big.textContent = `LV.${profile.level || 1}`;
        const ownedCount = Object.values(this.collection.cards || {}).filter(count => Number(count) > 0).length;
        const percent = Math.min(100, Math.round(ownedCount / (ALL_PLAYABLE_CARDS.length || 1) * 100));
        const fill = document.getElementById("collection-progress-fill");
        if (fill) fill.style.width = `${percent}%`;
        const label = document.getElementById("collection-progress-label");
        if (label) label.textContent = `收集 ${percent}%`;
        const firstWin = this.collection.statistics?.firstWinToday === new Date().toDateString();
        document.getElementById("rail-daily-dot")?.classList.toggle("done", firstWin);
    }

    renderHome() {
        const deck = this.getSelectedDeck();
        const validation = deck ? validateDeck(deck, ALL_CARDS, this.collection) : { valid: false, errors: ["没有选择卡组"], stats: {} };
        const cover = getCardById(deck?.coverCardId);
        const deckHero = cover?.type === "monster" && cover.series !== "starter_ygo" ? cover : getCardById("water_009");
        // 主页放映：优先使用“选择放映”里指定的已拥有卡牌（可多选轮播），否则回退到出战卡组封面。
        const lobbyCards = this.getLobbyCards();
        const slides = lobbyCards.length ? lobbyCards : (deckHero ? [deckHero] : []);
        const heroCard = hydrateCardArt(slides[0], this.collection.selectedArtByCard);
        const rotating = lobbyCards.length > 1;
        const slideHtml = slides.map((card, index) => `<div class="lobby-slide${index === 0 ? " active" : ""}">${cardArtHtml(hydrateCardArt(card, this.collection.selectedArtByCard), "lobby-character-art", true).replace(/loading="lazy"/g, 'loading="eager"')}</div>`).join("");
        const dotsHtml = rotating ? `<div class="lobby-dots" id="lobby-dots">${lobbyCards.map((card, index) => `<button type="button" data-slide="${index}" aria-label="${escapeHtml(card.name)}" class="${index === 0 ? "active" : ""}"></button>`).join("")}</div>` : "";
        const firstWin = this.collection.statistics.firstWinToday === new Date().toDateString();
        const owned = Object.values(this.collection.cards).filter(count => count > 0).length;
        this.screenRoot.innerHTML = `
            <section class="game-lobby" aria-label="游戏主界面">
                <div class="lobby-scenery" aria-hidden="true"></div>
                <div class="lobby-particles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                <div class="lobby-character" aria-hidden="true">${slideHtml}<span class="lobby-sheen"></span></div>
                <div class="lobby-breeze" aria-hidden="true"></div>
                <div class="lobby-light" aria-hidden="true"></div>
                <div class="lobby-chapter"><span>SEKAI / ELEMENTAL DUEL</span><h1>次元决斗</h1><p>元素召唤</p><i></i>
                    <button class="lobby-change" id="home-change-art" type="button"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-4.5-4.5L7 20"/></svg><span>选择放映</span></button>
                    ${dotsHtml}
                </div>
                <div class="lobby-character-name"><span id="lobby-hero-mode">与你并肩 · ${rotating ? `轮播 1/${lobbyCards.length}` : "放映中"}</span><strong id="lobby-hero-name">${escapeHtml(heroCard?.name || "世界的伙伴")}</strong><p>准备好了吗？下一场决斗，一起出发。</p></div>
                <div class="lobby-actions">
                    <div class="lobby-daily"><span>每日首胜</span><strong>${firstWin ? "已达成" : "+300 次元币"}</strong><small>${firstWin ? "明天继续并肩作战" : "赢得一场 AI 决斗"}</small></div>
                    <button class="lobby-battle" id="home-start-duel" ${validation.valid ? "" : "disabled"}>
                        <span class="live-glow" aria-hidden="true"></span>
                        ${gameIcon("duel")}
                        <span><small>START DUEL</small><strong>开始决斗</strong><em>与 AI 对战</em></span>
                        <b>›</b>
                    </button>
                    <div class="lobby-sub">
                        <button class="lobby-adventure" id="home-stage-duel" ${validation.valid ? "" : "disabled"}>${gameIcon("stage")}<span><strong>关卡挑战</strong><small>跨越试炼</small></span></button>
                        <button class="lobby-adventure" id="home-pvp-create" ${validation.valid ? "" : "disabled"}>${gameIcon("room")}<span><strong>创建房间</strong><small>好友对战</small></span></button>
                        <button class="lobby-adventure" id="home-strategy-duel"><span><strong>战术试炼</strong><small>三套主题卡组免费试用</small></span></button>
                        <button class="lobby-adventure" id="home-pvp-join">${gameIcon("play")}<span><strong>加入房间</strong><small>输入房号</small></span></button>
                        <button class="lobby-deck" data-jump="decks"><span><small>出战卡组</small><strong>${escapeHtml(deck?.name || "尚未选择")}</strong></span><em>${deck?.main?.length || 0} 张 · ${validation.valid ? "就绪" : "调整"} →</em></button>
                    </div>
                    ${validation.valid ? "" : `<p class="lobby-invalid">${escapeHtml(validation.errors[0])}</p>`}
                </div>
                <button class="lobby-banner" data-jump="shop"><span class="lobby-banner-art" aria-hidden="true">${cardArtHtml(hydrateCardArt(getCardById("water_012") || heroCard), "", true)}</span><span><small>常驻招募</small><strong>世界回响</strong><em>十连必得 SR 或以上</em></span><b>›</b></button>
                <div class="lobby-collection-count"><strong>${owned}</strong><span>已收集角色与卡牌</span></div>
            </section>`;
        this.screenRoot.querySelector("#home-start-duel").addEventListener("click", () => this.startDuel());
        this.screenRoot.querySelector("#home-strategy-duel").addEventListener("click", () => this.showStrategyPractice());
        this.screenRoot.querySelector("#home-stage-duel").addEventListener("click", () => this.showStageModal());
        this.screenRoot.querySelector("#home-pvp-create").addEventListener("click", () => this.createPvpRoom());
        this.screenRoot.querySelector("#home-pvp-join").addEventListener("click", () => this.showJoinPvpModal());
        this.screenRoot.querySelector("#home-change-art").addEventListener("click", () => this.showLobbyCardPicker());
        this.screenRoot.querySelectorAll("#lobby-dots button").forEach(button => {
            button.addEventListener("click", () => this.showLobbySlide(Number(button.dataset.slide)));
        });
        if (rotating) this.startLobbySlideshow(lobbyCards);
        this.applyLobbySlideFit();
        this.bindJumpButtons();
    }

    /**
     * 卡面自适应：竖版卡图放进横版背景时，cover 会裁掉大半张图。
     * 若裁剪比例超过 12%，该 slide 改为 contain（完整显示）并把两侧渐隐，避免硬边。
     */
    applyLobbySlideFit() {
        const character = this.screenRoot?.querySelector(".lobby-character");
        if (!character) return;
        const boxW = character.clientWidth;
        const boxH = character.clientHeight;
        if (!boxW || !boxH) return;
        const boxAr = boxW / boxH;
        this.screenRoot.querySelectorAll(".lobby-slide").forEach(slide => {
            const img = slide.querySelector("img");
            if (!img) return;
            const apply = () => {
                const ar = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : boxAr;
                const crop = ar < boxAr ? 1 - ar / boxAr : 1 - boxAr / ar;
                // 只对“比容器更竖”的卡图启用完整显示；比容器更宽的图保持满幅（裁两侧更自然）。
                const fitContain = ar < boxAr && crop > 0.12;
                slide.classList.toggle("fit-contain", fitContain);
                if (!fitContain) return;
                const widthPct = Math.min(100, ar / boxAr * 100);
                slide.style.setProperty("--art-left", `${((100 - widthPct) / 2).toFixed(2)}%`);
                slide.style.setProperty("--fade", `${Math.max(4, widthPct * 0.08).toFixed(2)}%`);
            };
            if (img.complete && img.naturalWidth) apply();
            else img.addEventListener("load", apply, { once: true });
        });
    }

    /** 放映列表：settings.lobbyCardIds 中仍被拥有的卡牌（兼容旧的单张 lobbyCardId）。 */
    getLobbyCards() {
        const settings = this.collection.settings || {};
        const ids = Array.isArray(settings.lobbyCardIds) && settings.lobbyCardIds.length
            ? settings.lobbyCardIds
            : (settings.lobbyCardId ? [settings.lobbyCardId] : []);
        return [...new Set(ids)]
            .map(id => getCardById(id))
            .filter(card => card && getCardCount(this.collection, card.id) > 0);
    }

    setLobbyCards(cardIds) {
        const list = [...new Set((cardIds || []).filter(Boolean))];
        this.collection.settings ||= {};
        this.collection.settings.lobbyCardIds = list;
        this.collection.settings.lobbyCardId = list[0] || null;
        saveData(this.collection);
        this.closeModal();
        this.renderHome();
        const count = list.length;
        this.toast(count === 0 ? "已恢复默认放映" : count === 1 ? `放映已更换：${getCardById(list[0])?.name || ""}` : `已开启轮播：${count} 张卡牌`, "success");
    }

    /** 轮播：每 10 秒切一张；减少动态效果或系统减弱动态时不自动播放。 */
    startLobbySlideshow(cards) {
        this.stopLobbySlideshow();
        if (!Array.isArray(cards) || cards.length < 2) return;
        const prefersReduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (this.collection.settings?.reduceAnimations || prefersReduced) return;
        this.lobbySlideIndex = 0;
        this.lobbyTimer = setInterval(() => this.showLobbySlide(this.lobbySlideIndex + 1, cards.length), 10000);
    }

    stopLobbySlideshow() {
        if (this.lobbyTimer) clearInterval(this.lobbyTimer);
        this.lobbyTimer = null;
    }

    showLobbySlide(index, total = null) {
        const slides = this.screenRoot.querySelectorAll(".lobby-slide");
        if (!slides.length) return;
        const count = total || slides.length;
        const next = ((Number(index) || 0) % count + count) % count;
        this.lobbySlideIndex = next;
        slides.forEach((slide, i) => slide.classList.toggle("active", i === next));
        this.screenRoot.querySelectorAll("#lobby-dots button").forEach((dot, i) => dot.classList.toggle("active", i === next));
        const mode = this.screenRoot.querySelector("#lobby-hero-mode");
        if (mode) mode.textContent = `与你并肩 · 轮播 ${next + 1}/${count}`;
        const nameEl = this.screenRoot.querySelector("#lobby-hero-name");
        const nextName = slides[next]?.querySelector("img")?.alt;
        if (nameEl && nextName) nameEl.textContent = nextName;
    }

    showLobbyCardPicker() {
        const ownedCards = ALL_PLAYABLE_CARDS
            .filter(card => getCardCount(this.collection, card.id) > 0 && (card.type === "monster" || card.image))
            .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name, "zh-CN"));
        let chosen = this.getLobbyCards().map(card => card.id);
        this.openModal(`
            <section class="modal-panel lobby-picker">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <span class="eyebrow">HOME DISPLAY</span>
                <h2>选择放映卡牌</h2>
                <p class="lobby-picker-copy" id="lobby-picker-summary"></p>
                <div class="lobby-picker-grid">
                    <button class="lobby-pick lobby-pick-default" data-lobby-card="" type="button"><span>默认放映</span><small>跟随出战卡组封面</small></button>
                    ${ownedCards.map(card => {
                        const picked = hydrateCardArt(card, this.collection.selectedArtByCard);
                        return `<button class="lobby-pick" data-lobby-card="${escapeHtml(card.id)}" type="button" title="${escapeHtml(card.name)}">
                            <img src="${escapeHtml(picked.thumbnail || picked.image)}" alt="${escapeHtml(card.name)}" loading="lazy">
                            <span>${escapeHtml(card.name)}</span>
                        </button>`;
                    }).join("")}
                </div>
                ${ownedCards.length ? "" : `<p class="empty-copy">账户中还没有可用于放映的卡牌，先去招募吧。</p>`}
                <div class="modal-actions">
                    <button class="secondary-action" id="lobby-art-random" ${ownedCards.length ? "" : "disabled"} type="button">随机一张</button>
                    <button class="secondary-action" id="lobby-art-clear" type="button">清空</button>
                    <button class="secondary-action" data-close-modal type="button">取消</button>
                    <button class="primary-action" id="lobby-art-apply" type="button">确认放映</button>
                </div>
            </section>`);
        const summary = this.modalRoot.querySelector("#lobby-picker-summary");
        const refresh = () => {
            this.modalRoot.querySelectorAll("[data-lobby-card]").forEach(button => {
                const id = button.dataset.lobbyCard;
                const index = chosen.indexOf(id);
                const isDefault = id === "" && chosen.length === 0;
                button.classList.toggle("selected", index >= 0 || isDefault);
                let badge = button.querySelector(".pick-order");
                if (index >= 0) {
                    if (!badge) { badge = document.createElement("span"); badge.className = "pick-order"; button.appendChild(badge); }
                    badge.textContent = String(index + 1);
                } else badge?.remove();
            });
            if (summary) {
                summary.textContent = chosen.length === 0
                    ? "当前：默认放映（跟随出战卡组封面）。可多选卡牌开启自动轮播。"
                    : chosen.length === 1
                        ? "当前：固定放映 1 张。再选几张即可开启每 10 秒自动轮播。"
                        : `已选 ${chosen.length} 张：每 10 秒自动轮播，主页圆点可手动切换。`;
            }
        };
        this.modalRoot.querySelectorAll("[data-lobby-card]").forEach(button => {
            button.addEventListener("click", () => {
                const id = button.dataset.lobbyCard;
                if (!id) { chosen = []; refresh(); return; }
                chosen = chosen.includes(id) ? chosen.filter(item => item !== id) : [...chosen, id];
                refresh();
            });
        });
        this.modalRoot.querySelector("#lobby-art-random")?.addEventListener("click", () => {
            if (!ownedCards.length) return;
            chosen = [ownedCards[Math.floor(Math.random() * ownedCards.length)].id];
            refresh();
        });
        this.modalRoot.querySelector("#lobby-art-clear")?.addEventListener("click", () => { chosen = []; refresh(); });
        this.modalRoot.querySelector("#lobby-art-apply")?.addEventListener("click", () => this.setLobbyCards(chosen));
        refresh();
    }

    playHomeLaunch(onComplete) {
        const root = this.screenRoot.querySelector("[data-ignition-root]");
        const done = typeof onComplete === "function" ? onComplete : () => {};
        if (!root) {
            done();
            return;
        }
        this.launchAnimation?.cancel?.();
        this.launchAnimation = playDuelLaunch(root, {
            reducedMotion: this.collection.settings?.reduceAnimations,
            onComplete: done,
        });
    }

    // 项目 PV：全屏内嵌播放浮层（关闭即销毁 iframe，停止动画与声音）
    showPvModal() {
        if (document.querySelector(".pv-modal-root")) return;
        const root = document.createElement("div");
        root.className = "pv-modal-root";
        root.innerHTML = `
            <div class="pv-modal-frame" role="dialog" aria-label="SEKAI DUEL PV">
                <iframe class="pv-modal-iframe" src="pv.html" title="SEKAI DUEL PV" allow="autoplay"></iframe>
                <button class="pv-modal-close" type="button" aria-label="关闭 PV">✕ 关闭</button>
            </div>`;
        const close = () => { root.remove(); document.removeEventListener("keydown", onKey); };
        const onKey = e => { if (e.key === "Escape") close(); };
        root.addEventListener("click", e => { if (e.target === root) close(); });
        root.querySelector(".pv-modal-close").addEventListener("click", close);
        document.addEventListener("keydown", onKey);
        document.body.appendChild(root);
    }

    renderShop() {
        // 迟到的异步回调（开包揭晓等）不得把用户此刻正在看的其它界面顶掉。
        if (this.route !== "shop") return;
        const pity = getPityCount(this.collection, NIGHTCORD_PACK.id);
        const cover = hydrateCardArt(getCardById("nc_sp_ur_001"), this.collection.selectedArtByCard);
        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">SEKAI MELODY</span><h1>世界回响招募</h1><p>以次元币奏响旋律，与不同世界的角色相遇。</p></div></section>
            <section class="shop-layout">
                <article class="featured-pack rarity-UR">
                    <div class="featured-pack-image">${cardArtHtml(cover, "pack-cover-art", true)}<div class="pack-logo"><span>SEKAI MELODY</span><strong>世界回响</strong></div></div>
                    <div class="featured-pack-content">
                        <div class="pack-tags"><span>${PACK_POOL.length}张基础卡</span><span>全卡池</span><span>UR ${formatPercent(PACK_RATES.UR)}</span></div>
                        <h2>次元全明星卡池</h2>
                        <p>单抽获得1张卡；十连获得10张并至少包含1张SR。最晚第50抽获得UR。</p>
                        <div class="pity-block"><div><span>UR保底</span><strong>${pity} / 50</strong></div><div class="progress-track"><span style="width:${Math.min(100, pity / 50 * 100)}%"></span></div></div>
                        <div class="purchase-row">
                            <button class="pack-buy" data-open-count="1"><span>单次召唤 · 1张</span><strong>300 次元币</strong></button>
                            <button class="pack-buy featured" data-open-count="10"><span>十连召唤 · 10张</span><strong>2700 次元币</strong></button>
                        </div>
                    </div>
                </article>
                <aside class="shop-side">
                    <article class="dashboard-panel"><span class="eyebrow">BALANCE</span><div class="big-currency">${formatNumber(this.collection.currency.duelCoins)}</div><p>当前次元币</p></article>
                    <article class="dashboard-panel probability-list"><span class="eyebrow">PROBABILITY</span><div><span>N</span><strong>${formatPercent(PACK_RATES.N)}</strong></div><div><span>R</span><strong>${formatPercent(PACK_RATES.R)}</strong></div><div><span>SR</span><strong>${formatPercent(PACK_RATES.SR)}</strong></div><div><span>SSR</span><strong>${formatPercent(PACK_RATES.SSR)}</strong></div><div><span>UR</span><strong>${formatPercent(PACK_RATES.UR)}</strong></div></article>
                </aside>
            </section>`;
        this.screenRoot.querySelectorAll("[data-open-count]").forEach(button => {
            button.addEventListener("click", () => this.confirmPackOpen(Number(button.dataset.openCount)));
        });
    }

    confirmPackOpen(count) {
        const cost = count === 10 ? NIGHTCORD_PACK.tenCost.duelCoins : NIGHTCORD_PACK.cost.duelCoins;
        const balance = this.collection.currency.duelCoins;
        this.openModal(`
            <section class="modal-panel purchase-confirm">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <span class="eyebrow">PURCHASE CONFIRMATION</span>
                <h2>${count === 10 ? "十连召唤 · 10张" : "单次召唤 · 1张"}</h2>
                <div class="purchase-math"><div><span>消耗</span><strong>${formatNumber(cost)}</strong></div><div><span>当前</span><strong>${formatNumber(balance)}</strong></div><div><span>抽取后</span><strong>${formatNumber(Math.max(0, balance - cost))}</strong></div></div>
                ${balance < cost ? `<p class="validation-line">次元币不足，还差 ${formatNumber(cost - balance)}。</p>` : ""}
                <div class="modal-actions"><button class="secondary-action" data-close-modal>取消</button><button class="primary-action" id="confirm-pack-open" ${balance < cost ? "disabled" : ""}>确认抽取</button></div>
            </section>`);
        this.modalRoot.querySelector("#confirm-pack-open")?.addEventListener("click", event => {
            // 立刻关闭确认框，避免在等待服务器响应期间被再次点击导致重复扣费/重复开包。
            const button = event.currentTarget;
            if (button) button.disabled = true;
            this.closeModal();
            this.openPacks(count);
        });
    }

    async openPacks(count) {
        // 重入锁：一次开包请求未结束前不再受理新的开包。
        if (this.packOpening) return;
        this.packOpening = true;
        try {
            await this._openPacks(count);
        } finally {
            this.packOpening = false;
        }
    }

    async _openPacks(count) {
        const cost = count === 10 ? NIGHTCORD_PACK.tenCost.duelCoins : NIGHTCORD_PACK.cost.duelCoins;
        const auth = loadAuth();
        if (auth?.userId) {
            const serverResult = await openPackServer(auth.userId, "nightcord", count);
            if (!serverResult.success) {
                this.toast(serverResult.reason || "卡包开启失败", "error");
                return;
            }
            const serverCards = (serverResult.cards || [])
                .map(item => getCardById(item.id))
                .filter(Boolean);
            if (serverCards.length === 0) {
                this.toast("服务器没有返回有效卡牌", "error");
                return;
            }
            const reveals = serverCards.map(card => this.collectPulledCard(card));
            this.collection.currency.duelCoins = Number(serverResult.duelCoins ?? Math.max(0, this.collection.currency.duelCoins - cost));
            if (serverResult.shards) this.collection.currency.shards = { ...this.collection.currency.shards, ...serverResult.shards };
            if (serverResult.pityCounters) this.collection.pityCounters = serverResult.pityCounters;
            this.collection.statistics.packsOpened = Number(serverResult.packsOpened ?? (this.collection.statistics.packsOpened + count));
            saveData(this.collection);
            this.renderTopbar();
            this.showPackAnimation(reveals, count);
            return;
        }
        if (!spendDuelPoints(this.collection, cost)) {
            this.toast("次元币不足", "error");
            return;
        }
        const pity = getPityCount(this.collection, NIGHTCORD_PACK.id);
        const opened = count === 10
            ? openTenPacks(NIGHTCORD_PACK, PACK_POOL, undefined, pity)
            : openPack(NIGHTCORD_PACK, PACK_POOL, undefined, pity);
        if (!opened.success) {
            this.collection.currency.duelCoins += cost;
            this.toast(opened.reason || "卡包开启失败", "error");
            return;
        }
        // 重复保护：整包没有新卡时替换一张未拥有的卡（详见 packs.applyDuplicateProtection）
        const protection = applyDuplicateProtection(opened.cards, PACK_POOL, this.collection);
        const finalCards = protection.cards;

        const reveals = finalCards.map(card => this.collectPulledCard(card));
        const gotUR = finalCards.some(card => card.rarity === "UR");
        if (count === 10) {
            // openTenPacks 已经逐包维护了正确的保底计数（命中归零，之后每包 +1）。
            // 之前只要本批出现过 UR 就把计数强制写 0，会丢掉同一批里 UR 之后开掉
            // 的包数（最多 9 包保底进度）。
            this.collection.pityCounters[NIGHTCORD_PACK.id] = {
                packsSinceUR: Number(opened.packsSinceUR) || 0,
            };
        } else if (gotUR) {
            resetPity(this.collection, NIGHTCORD_PACK.id);
        } else {
            incrementPity(this.collection, NIGHTCORD_PACK.id);
        }
        this.collection.statistics.packsOpened += count;
        saveData(this.collection);
        await this.syncCollectionToServer();
        this.renderTopbar();
        this.showPackAnimation(reveals, count);
    }

    collectPulledCard(card) {
        const previousCount = getCardCount(this.collection, card.id);
        const addResult = addCard(this.collection, card.id, 1, ALL_CARDS);
        const variants = getCardArts(card.id);
        const art = variants.length ? variants[Math.floor(Math.random() * variants.length)] : null;
        const newArt = art ? addArt(this.collection, art.artId) : false;
        if (art && !this.collection.selectedArtByCard[card.id]) setSelectedArt(this.collection, card.id, art.artId);
        return {
            card: hydrateCardArt(card, art ? { [card.id]: art.artId } : this.collection.selectedArtByCard),
            newCard: previousCount === 0,
            newArt,
            shards: addResult.shardsEarned,
        };
    }

    showPackAnimation(reveals, count) {
        const highest = [...reveals].sort((a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity))[0]?.card.rarity || "N";
        const previewCards = reveals.slice(0, 10);
        // 整齐一排：最高稀有度的卡换到正中间，其余等高等距排开、无歪斜
        // （原先的扇形排布高低角度不一，聚光时显得凌乱）
        let heroIndex = previewCards.findIndex(item => item.card.rarity === highest);
        const ordered = [...previewCards];
        if (heroIndex >= 0) {
            const [hero] = ordered.splice(heroIndex, 1);
            ordered.splice(Math.floor(ordered.length / 2), 0, hero);
            heroIndex = ordered.indexOf(hero);
        }
        const slotCount = ordered.length;
        const heroItem = heroIndex >= 0 ? ordered[heroIndex] : null;
        const mobile = window.innerWidth < 760;
        const columns = count === 10 ? 5 : 1;
        const cardWidth = Math.min(mobile ? 66 : 146, (window.innerWidth - 56) / columns - 12);
        const spacing = cardWidth + (mobile ? 10 : 22);
        const previewPositions = ordered.map((_, index) => [
            (index % columns - (Math.min(columns, slotCount) - 1) / 2) * spacing,
            count === 10 ? (Math.floor(index / columns) - .5) * cardWidth * 1.55 : 0,
        ]);
        // Use an existing character as the opening host; never present it as an extra reward.
        const hostCard = hydrateCardArt(ALL_CARDS.find(card => card.id === "water_009") || heroItem?.card);
        const art = (card, className) => cardArtHtml(card, className, true).replaceAll('loading="lazy"', 'loading="eager"');
        const elementPaths = [
            "M28 3C33 16 44 18 43 32A19 19 0 016 32C6 22 16 18 18 10C19 19 24 20 25 27C31 20 32 13 28 3Z",
            "M25 3C19 14 7 26 7 35A18 18 0 0043 35C43 25 31 13 25 3Z",
            "M4 38C6 13 23 5 47 6C43 30 27 46 8 40L34 18Z",
            "M25 5L45 22L38 45H12L5 22Z",
            "M25 1L31 18L49 25L31 31L25 49L18 31L1 25L18 18Z",
            "M34 3A23 23 0 103 34A24 24 0 0047 23A20 20 0 0134 3Z",
        ];
        const elementField = elementPaths.map((path, index) =>
            `<span class="melody-element element-${index}" style="--element-index:${index}" aria-hidden="true"><svg viewBox="0 0 50 50"><path d="${path}"/></svg></span>`).join("");
        const petals = Array.from({ length: 22 }, (_, index) =>
            `<i style="--x:${(index * 29 + 3) % 100}%;--y:${(index * 17) % 100}%;--tilt:${index * 37}deg"></i>`).join("");
        const flipRail = ordered.map((item, index) => {
            const [x, y] = previewPositions[index];
            return `<div class="pack-flip-card rarity-${escapeHtml(item.card.rarity)}" style="--result-width:${cardWidth}px" data-pack-x="${x}" data-pack-y="${y}">
                <div class="pack-flip-inner">
                    <div class="pack-flip-back">${sekaiCardBackHtml({ label: "SEKAI" })}</div>
                    <div class="pack-flip-face">${art(item.card, "pack-preview-art")}<span class="pack-flip-rarity">${escapeHtml(item.card.rarity)}</span></div>
                </div>
            </div>`;
        }).join("");
        this.openModal(`
            <section class="recruitment-cinema" id="pack-opening-stage" role="dialog" aria-modal="true" aria-label="世界回响招募演出" data-rarity="${escapeHtml(highest)}">
                <div class="melody-paper" aria-hidden="true"></div>
                <div class="melody-petals" aria-hidden="true">${petals}</div>
                <div class="melody-opening" aria-hidden="true">
                    <div class="melody-host-shadow">${art(hostCard, "melody-host-art")}</div>
                    <div class="melody-host">${art(hostCard, "melody-host-art")}</div>
                    <div class="melody-title"><span>次元决斗 · 元素召唤</span><h2>世界回响</h2><p>让心意，奏成旋律。</p></div>
                    <div class="melody-staff"><i></i><i></i><i></i><i></i><i></i><b>♪</b><b>♫</b><b>♩</b></div>
                </div>
                <div class="melody-gather" aria-hidden="true">${elementField}<div class="melody-orb"><span>♪</span></div></div>
                <div class="melody-flight" aria-hidden="true"><div class="melody-cloud cloud-one"></div><div class="melody-cloud cloud-two"></div><div class="melody-trail"></div><div class="melody-flying-card">${sekaiCardBackHtml({ label: "SEKAI" })}</div></div>
                <div class="melody-cutins" aria-hidden="true"><div>${art(hostCard, "melody-cutin-art")}</div><div>${art(hostCard, "melody-cutin-art")}</div></div>
                <div class="melody-reveal" aria-hidden="true">
                    <div class="melody-reveal-echo">${art(heroItem?.card, "melody-reveal-art")}</div>
                    <div class="melody-reveal-picture">${art(heroItem?.card, "melody-reveal-art")}</div>
                    <div class="melody-reveal-ink"></div>
                    <div class="melody-reveal-caption"><span>${escapeHtml(highest)}</span><h2>${escapeHtml(heroItem?.card?.name || "")}</h2><p>${escapeHtml(TYPE_NAMES[heroItem?.card?.type] || "角色")} · 世界回响</p></div>
                </div>
                <div class="melody-white" aria-hidden="true"></div>
                <div class="pack-flip-rail" aria-label="抽取预览">${flipRail}</div>
                <div class="melody-result-title"><span>世界回响</span><h2>与你相遇</h2><p>获得 ${count} 张卡牌</p></div>
                <div class="pack-stage-actions"><button class="primary-action" id="reveal-pack-results" hidden>查看结果</button><button class="secondary-action" id="skip-pack-animation">跳过演出</button></div>
            </section>`);
        const stage = this.modalRoot.querySelector("#pack-opening-stage");
        const skipToResults = () => {
            this.packAnimation?.cancel?.();
            this.showPackResults(reveals, count);
        };
        this.packAnimation = playDimensionRecruitment(stage, {
            reducedMotion: this.collection.settings?.reduceAnimations,
            heroCard: heroItem?.card || null,
            highestRarity: highest,
            onComplete: () => {
                const revealButton = stage.querySelector("#reveal-pack-results");
                revealButton.hidden = false;
                revealButton.focus({ preventScroll: true });
            },
        });
        this.modalRoot.querySelector("#skip-pack-animation")?.addEventListener("click", skipToResults);
        this.modalRoot.querySelector("#reveal-pack-results")?.addEventListener("click", () => this.showPackResults(reveals, count));
    }

    showPackResults(reveals, count) {
        const summary = reveals.reduce((acc, item) => {
            acc[item.card.rarity] = (acc[item.card.rarity] || 0) + 1;
            acc.newCards += item.newCard ? 1 : 0;
            acc.newArts += item.newArt ? 1 : 0;
            acc.shards += item.shards || 0;
            return acc;
        }, { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, newCards: 0, newArts: 0, shards: 0 });
        const sorted = [...reveals].sort((a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity));
        this.modalRoot.innerHTML = `
            <section class="modal-panel pack-results-panel">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <div class="section-heading"><div><span class="eyebrow">SUMMON RESULTS</span><h2>${count === 10 ? "十连召唤结果" : "单次召唤结果"}</h2></div><div class="result-summary"><span>R ${summary.R}</span><span>SR ${summary.SR}</span><span>SSR ${summary.SSR}</span><span>UR ${summary.UR}</span></div></div>
                <div class="pack-result-grid">${sorted.map(item => `
                    <article class="result-card rarity-${escapeHtml(item.card.rarity)}">
                        ${cardArtHtml(item.card, "result-art")}
                        <div class="result-card-copy"><span>${escapeHtml(item.card.rarity)} · ${escapeHtml(TYPE_NAMES[item.card.type])}</span><strong>${escapeHtml(item.card.name)}</strong><small>${item.newCard ? "NEW CARD" : item.newArt ? "NEW ART" : item.shards ? `重复 · +${item.shards}碎片` : "已拥有"}</small></div>
                    </article>`).join("")}</div>
                <div class="pack-result-footer"><div><strong>${summary.newCards}</strong><span>新卡</span></div><div><strong>${summary.newArts}</strong><span>新插画</span></div><div><strong>${summary.shards}</strong><span>碎片</span></div><button class="primary-action" data-close-modal>完成</button></div>
            </section>`;
        this.renderShop();
    }

    renderCollection() {
        // 同上：搜索防抖定时器与制作/分解请求的迟到回调都可能落在这里。
        if (this.route !== "collection") return;
        const filtered = ALL_CARDS
            .filter(card => this.filterCollectionCard(card))
            .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name, "zh-CN"));
        const selectedBase = filtered.find(card => card.id === this.selectedCollectionCardId) || filtered[0];
        const selected = hydrateCardArt(selectedBase, this.collection.selectedArtByCard);
        const owned = getCardCount(this.collection, selected?.id);
        const arts = selected ? getCardArts(selected.id) : [];

        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">CARD LIBRARY</span><h1>角色图鉴</h1><p>已拥有 ${Object.keys(this.collection.cards).filter(cardId => (this.collection.cards[cardId] || 0) > 0 && getCardById(cardId)).length} / ${ALL_CARDS.length} 种卡牌。</p></div></section>
            <section class="collection-layout">
                <div class="collection-browser">
                    <div class="filter-bar">
                        <label class="search-control"><span>搜索</span><input id="collection-search" value="${escapeHtml(this.collectionFilters.search)}" placeholder="卡名、技能、效果 · 空格组合搜索"></label>
                        ${selectHtml("collection-member", "成员", this.collectionFilters.member, [["all", "全部"], ["ena", "东云绘名"], ["kanade", "宵崎奏"], ["mafuyu", "朝比奈真冬"], ["mizuki", "晓山瑞希"], ["group", "四人共同"]])}
                        ${selectHtml("collection-rarity", "稀有度", this.collectionFilters.rarity, [["all", "全部"], ["N", "N"], ["R", "R"], ["SR", "SR"], ["SSR", "SSR"], ["UR", "UR"]])}
                        ${selectHtml("collection-type", "类型", this.collectionFilters.type, [["all", "全部"], ["monster", "角色"], ["spell", "魔法"], ["trap", "陷阱"]])}
                        ${selectHtml("collection-owned", "状态", this.collectionFilters.owned, [["all", "全部"], ["yes", "已拥有"], ["no", "未拥有"]])}
                    </div>
                    <div class="collection-results"><span>找到 ${filtered.length} / ${ALL_CARDS.length} 种卡牌</span><button type="button" class="text-action" id="collection-reset">重置筛选</button></div>
                    <div class="collection-grid">${filtered.map(card => catalogCardHtml(hydrateCardArt(card, this.collection.selectedArtByCard), getCardCount(this.collection, card.id))).join("") || "<p class='empty-copy'>没有符合条件的卡牌，试试减少关键词或重置筛选。</p>"}</div>
                </div>
                <aside class="collection-detail">
                    ${selected ? `
                        ${cardArtHtml(selected, "detail-art-wide", true)}
                        <div class="detail-copy"><span class="eyebrow">${escapeHtml(selected.rarity)} · ${escapeHtml(MEMBER_NAMES[selected.member] || TYPE_NAMES[selected.type])}</span><h2>${escapeHtml(selected.name)}</h2>${cardEffectFieldsHtml(selected)}
                        <div class="detail-stats"><div><span>拥有</span><strong>${owned}</strong></div>${selected.type === "monster" ? `<div><span>ATK</span><strong>${selected.attack}</strong></div><div><span>DEF</span><strong>${selected.defense}</strong></div>` : `<div><span>类型</span><strong>${escapeHtml(TYPE_NAMES[selected.type])}</strong></div>`}</div>
                        <div class="detail-actions"><button class="secondary-action" id="craft-card" ${canCraft(this.collection, selected.id, ALL_CARDS).canCraft ? "" : "disabled"}>制作1张 · ${canCraft(this.collection, selected.id, ALL_CARDS).cost || "—"}碎片</button><button class="secondary-action" id="dismantle-card" ${owned > 0 ? "" : "disabled"}>分解1张 · +${({ N: 5, R: 15, SR: 50, SSR: 100, UR: 200 })[selected.rarity] || 5}碎片</button></div>
                        <p class="empty-copy">当前 ${selected.rarity} 碎片：${this.collection.currency.shards?.[selected.rarity] || 0} · 同名卡最多拥有3张</p>
                        <div class="art-selector"><div class="section-heading"><h3>已解锁插画</h3><span>${arts.filter(art => this.collection.artCollection[art.artId]).length}/${arts.length}</span></div><div class="art-strip">${arts.map(art => `<button class="art-choice ${this.collection.selectedArtByCard[selected.id] === art.artId ? "selected" : ""} ${this.collection.artCollection[art.artId] ? "" : "locked"}" data-art-id="${escapeHtml(art.artId)}" ${this.collection.artCollection[art.artId] ? "" : "disabled"}><img src="${escapeHtml(art.thumbnail || art.image)}" alt="${escapeHtml(selected.name)}插画" loading="lazy"></button>`).join("") || "<p class='empty-copy'>暂无插画。</p>"}</div></div></div>` : ""}
                </aside>
            </section>`;

        this.bindCollectionControls();
        if (selected) {
            const preview = document.createElement("button");
            preview.type = "button";
            preview.className = "secondary-action";
            preview.id = "preview-card-performance";
            preview.textContent = "查看专属演出";
            preview.addEventListener("click", () => this.showCardPerformance(selected));
            this.screenRoot.querySelector(".detail-actions")?.prepend(preview);
        }
        this.screenRoot.querySelectorAll(".catalog-card").forEach(card => {
            card.addEventListener("click", () => {
                this.selectedCollectionCardId = card.dataset.cardId;
                this.renderCollection();
            });
            card.addEventListener("contextmenu", e => { e.preventDefault(); this.showCardDetail(getCardById(card.dataset.cardId)); });
        });
        this.screenRoot.querySelectorAll("[data-art-id]").forEach(button => button.addEventListener("click", () => {
            setSelectedArt(this.collection, selected.id, button.dataset.artId);
            saveData(this.collection);
            this.renderCollection();
        }));
        this.screenRoot.querySelector("#craft-card")?.addEventListener("click", async () => {
            const auth = loadAuth();
            if (auth?.userId) {
                const result = await craftCardServer(auth.userId, selected.id);
                if (!result.success) {
                    this.toast(result.reason || "制作失败", "error");
                    return;
                }
                this.collection.cards[selected.id] = result.count || 1;
                this.collection.currency.shards = { ...this.collection.currency.shards, ...(result.shards || {}) };
                saveData(this.collection);
                this.toast(`制作成功：${selected.name}`, "success");
                this.renderCollection();
                return;
            }
            const result = craftCard(this.collection, selected.id, ALL_CARDS);
            this.toast(result.success ? `制作成功：${selected.name}` : result.reason, result.success ? "success" : "error");
            if (result.success) {
                saveData(this.collection);
                this.syncCollectionToServer();
            }
            this.renderCollection();
        });
        this.screenRoot.querySelector("#dismantle-card")?.addEventListener("click", async () => {
            const auth = loadAuth();
            if (auth?.userId) {
                const result = await dismantleCardServer(auth.userId, selected.id);
                if (!result.success) {
                    this.toast(result.reason || "分解失败", "error");
                    return;
                }
                const nextCount = getCardCount(this.collection, selected.id) - 1;
                if (nextCount > 0) this.collection.cards[selected.id] = nextCount;
                else delete this.collection.cards[selected.id];
                this.collection.currency.shards = { ...this.collection.currency.shards, ...(result.shards || {}) };
                saveData(this.collection);
                this.toast(`分解成功：+${result.shardsEarned || 0} ${selected.rarity}碎片`, "success");
                this.renderCollection();
                return;
            }
            const result = dismantleCard(this.collection, selected.id, ALL_CARDS);
            this.toast(result.success ? `分解成功：+${result.shards} ${selected.rarity}碎片` : result.reason, result.success ? "success" : "error");
            if (result.success) {
                saveData(this.collection);
                this.syncCollectionToServer();
            }
            this.renderCollection();
        });
    }

    showCardPerformance(card) {
        const profile = getCardPerformance(card);
        if (!profile) return;
        const phases = card.type === "monster" ? [["summon","登场"],["attack","攻击"],["tribute","祭品汇聚"]] : [["activate","发动"]];
        this.openModal(`<section class="modal-panel performance-preview" role="dialog" aria-modal="true" aria-labelledby="performance-title"><button class="modal-close" data-close-modal aria-label="关闭">×</button><span class="eyebrow">CHARACTER PERFORMANCE</span><h2 id="performance-title">${escapeHtml(card.name)}</h2><div class="performance-stage"><div class="performance-material">素材 A</div><div class="performance-source">${cardArtHtml(card, "performance-art", true)}</div><div class="performance-target">目标</div></div><div class="modal-actions">${phases.map(([phase,label]) => `<button type="button" class="secondary-action" data-performance-phase="${phase}">${label}</button>`).join("")}</div><p class="performance-caption" aria-live="polite">选择演出，预览图形、轨迹与节奏。</p><p class="empty-copy">${escapeHtml(profile.note)}</p>${profile.source ? `<a href="${escapeHtml(profile.source)}" target="_blank" rel="noopener noreferrer">官方角色资料 ↗</a>` : ""}<p class="empty-copy">祭品演出不等同于原著合体或融合召唤；预览不消耗卡牌。</p></section>`);
        this.modalRoot.querySelectorAll("[data-performance-phase]").forEach(button => button.addEventListener("click", async () => {
            const panel = button.closest(".performance-preview");
            const phase = button.dataset.performancePhase;
            const source = panel.querySelector(".performance-source");
            const target = phase === "attack" ? panel.querySelector(".performance-target") : source;
            const spec = profile[phase] || profile.summon;
            panel.querySelector(".performance-caption").textContent = `${spec.title}：${spec.beats.join(" → ")}`;
            const buttons = [...panel.querySelectorAll("[data-performance-phase]")];
            buttons.forEach(item => { item.disabled = true; });
            try { await playCardPerformance(card, phase, source, target, [panel.querySelector(".performance-material"), panel.querySelector(".performance-target")]); }
            finally { buttons.forEach(item => { item.disabled = false; }); }
        }));
    }

    async syncCollectionToServer() {
        const auth = loadAuth();
        if (!auth?.userId) return null;
        const result = await saveUserCollection(auth.userId, {
            cards: this.collection.cards,
        });
        if (!result.success) this.toast("云端收藏同步失败，数据已保存在本机", "error");
        return result;
    }

    filterCollectionCard(card) {
        const f = this.collectionFilters;
        if (!matchesDeckSearch(card, f.search)) return false;
        if (f.member !== "all" && card.member !== f.member) return false;
        if (f.rarity !== "all" && card.rarity !== f.rarity) return false;
        if (f.type !== "all" && card.type !== f.type) return false;
        const owned = getCardCount(this.collection, card.id) > 0;
        if (f.owned === "yes" && !owned) return false;
        if (f.owned === "no" && owned) return false;
        return true;
    }

    bindCollectionControls() {
        this.screenRoot.querySelector("#collection-reset")?.addEventListener("click", () => {
            clearTimeout(this.searchTimer);
            this.collectionFilters = { search: "", member: "all", rarity: "all", type: "all", owned: "all" };
            this.renderCollection();
        });
        const mapping = {
            "collection-search": "search",
            "collection-member": "member",
            "collection-rarity": "rarity",
            "collection-type": "type",
            "collection-owned": "owned",
        };
        for (const [id, key] of Object.entries(mapping)) {
            const element = this.screenRoot.querySelector(`#${id}`);
            element?.addEventListener(id === "collection-search" ? "input" : "change", () => {
                this.collectionFilters[key] = element.value;
                if (id === "collection-search") clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => {
                    this.renderCollection();
                    if (id === "collection-search") {
                        const next = this.screenRoot.querySelector("#collection-search");
                        next?.focus();
                        next?.setSelectionRange(next.value.length, next.value.length);
                    }
                }, id === "collection-search" ? 140 : 0);
            });
        }
    }

    renderDeckEditor(resetDraft = false) {
        // 保存/删除卡组后的迟到回调不应在其它界面重绘卡组编辑器。
        if (this.route !== "decks") return;
        const deck = this.getSelectedDeck();
        if (resetDraft) this.deckDraft = deck ? clone(deck) : null;
        else if (!this.deckDraft) this.deckDraft = deck ? clone(deck) : null;
        else if (!this.deckDraft.isNew && this.deckDraft.id !== deck?.id) this.deckDraft = deck ? clone(deck) : null;
        const validation = this.deckDraft ? validateDeck(this.deckDraft, ALL_CARDS, this.collection) : { valid: false, errors: ["没有卡组"], stats: {} };
        const counts = countIds(this.deckDraft?.main || []);
        const sf = this.deckSourceFilter;
        const vf = this.deckViewFilter;

        // 左侧：按筛选条件过滤可用卡牌
        let available = ALL_PLAYABLE_CARDS.filter(card => {
            const owned = getCardCount(this.collection, card.id) > 0;
            if (sf.owned === "owned") return owned;
            if (sf.owned === "unowned") return !owned;
            return true;
        });
        available = available.filter(card => matchesDeckSearch(card, sf.search));
        if (sf.type !== "all") available = available.filter(c => c.type === sf.type);
        if (sf.attribute !== "all") available = available.filter(c => c.attribute === sf.attribute);
        if (sf.rarity !== "all") available = available.filter(c => c.rarity === sf.rarity);
        if (sf.level !== "all") available = available.filter(c => c.type === "monster" && Number(c.level) === Number(sf.level));
        available.sort((a, b) => deckBattleValue(b) - deckBattleValue(a)
            || rarityRank(b.rarity) - rarityRank(a.rarity)
            || a.name.localeCompare(b.name, "zh-CN"));

        // 右侧：按类型分类显示卡组内卡牌
        let deckCards = Object.entries(counts).map(([id, count]) => ({ card: hydrateCardArt(getCardById(id), this.collection.selectedArtByCard), count })).filter(item => item.card);
        if (vf !== "all") deckCards = deckCards.filter(item => item.card.type === vf);

        // 统计
        const allDeckCards = Object.entries(counts).map(([id, count]) => ({ card: getCardById(id), count })).filter(item => item.card);
        const monsterCount = allDeckCards.filter(i => i.card.type === "monster").reduce((s, i) => s + i.count, 0);
        const spellCount = allDeckCards.filter(i => i.card.type === "spell").reduce((s, i) => s + i.count, 0);
        const trapCount = allDeckCards.filter(i => i.card.type === "trap").reduce((s, i) => s + i.count, 0);
        const totalCards = this.deckDraft?.main.length || 0;
        const opening = analyzeOpening(allDeckCards.flatMap(({ card, count }) => Array(count).fill(card)));

        // 左侧筛选按钮
        const typeFilters = [
            { key: "all", label: "全部" },
            { key: "monster", label: "角色" },
            { key: "spell", label: "魔法" },
            { key: "trap", label: "陷阱" },
        ];
        const attrFilters = [
            { key: "all", label: "全属性" },
            { key: "fire", label: "炎", color: "#ff6b35" },
            { key: "water", label: "水", color: "#4da6ff" },
            { key: "wind", label: "风", color: "#7ddf64" },
            { key: "earth", label: "地", color: "#c8a951" },
            { key: "light", label: "光", color: "#ffe066" },
            { key: "dark", label: "暗", color: "#b388ff" },
        ];
        const rarityFilters = [
            { key: "all", label: "全稀有" },
            { key: "UR", label: "UR", color: "#ff8c00" },
            { key: "SSR", label: "SSR", color: "#cc44ff" },
            { key: "SR", label: "SR", color: "#4488ff" },
            { key: "R", label: "R", color: "#44bb44" },
            { key: "N", label: "N", color: "#888" },
        ];
        const levelFilters = [
            { key: "all", label: "全部星级" },
            ...Array.from({ length: 10 }, (_, index) => ({ key: String(index + 1), label: `${index + 1}星` })),
        ];
        const ownershipFilters = [
            { key: "owned", label: "已拥有" },
            { key: "unowned", label: "未拥有" },
            { key: "all", label: "全部卡牌" },
        ];
        // 右侧分类
        const viewFilters = [
            { key: "all", label: `全部 (${totalCards})` },
            { key: "monster", label: `角色 (${monsterCount})` },
            { key: "spell", label: `魔法 (${spellCount})` },
            { key: "trap", label: `陷阱 (${trapCount})` },
        ];

        const makeFilterButtons = (items, activeKey, dataAttr) =>
            items.map(f => `<button class="deck-filter-btn ${f.key === activeKey ? "active" : ""}" data-${dataAttr}="${f.key}" ${f.color ? `style="--accent:${f.color}"` : ""}>${f.label}</button>`).join("");

        this.screenRoot.innerHTML = `
            <section class="screen-heading deck-heading">
                <div><span class="eyebrow">DECK CONSTRUCTION</span><h1>卡组编成</h1><p>从已拥有的卡牌中构筑40至60张主卡组。</p></div>
                <div class="deck-status"><strong>${totalCards}/60</strong><span class="status-pill ${validation.valid ? "ok" : "bad"}">${validation.valid ? "卡组合法" : "卡组不合法"}</span></div>
            </section>
            <section class="deck-editor-layout">
                <div class="deck-source">
                    <div class="section-heading"><div><span class="eyebrow">OWNED CARDS</span><h2>可用卡牌</h2></div><span>${available.length}种</span></div>
                    <label class="search-control deck-search-control"><span>关键词</span><input id="deck-card-search" value="${escapeHtml(sf.search || "")}" placeholder="搜索卡名、效果、属性或类型" autocomplete="off"></label>
                    <div class="deck-filter-row">${makeFilterButtons(ownershipFilters, sf.owned, "source-owned")}</div>
                    <div class="deck-filter-row">${makeFilterButtons(typeFilters, sf.type, "source-type")}</div>
                    <div class="deck-filter-row deck-level-filter">${makeFilterButtons(levelFilters, sf.level, "source-level")}</div>
                    <div class="deck-filter-row">${makeFilterButtons(attrFilters, sf.attribute, "source-attr")}</div>
                    <div class="deck-filter-row">${makeFilterButtons(rarityFilters, sf.rarity, "source-rarity")}</div>
                    <div class="deck-source-grid">${available.map(card => catalogCardHtml(hydrateCardArt(card, this.collection.selectedArtByCard), getCardCount(this.collection, card.id), { compact: true })).join("") || "<p class='empty-copy'>没有匹配的卡牌。</p>"}</div>
                </div>
                <div class="deck-workspace">
                    <div class="deck-name-row"><select id="deck-select" aria-label="选择卡组">${this.deckDraft?.isNew ? `<option value="" selected>新卡组草稿</option>` : ""}${this.collection.decks.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === this.deckDraft?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select><input id="deck-name-input" value="${escapeHtml(this.deckDraft?.name || "")}" aria-label="卡组名称" placeholder="输入卡组名称"><button class="secondary-action" id="new-deck" ${this.collection.decks.length >= 3 ? "disabled" : ""}>新建卡组</button><button class="secondary-action" id="delete-deck" ${this.collection.decks.length <= 1 || this.deckDraft?.isNew ? "disabled" : ""}>删除卡组</button><button class="secondary-action" id="reset-starter">恢复入门卡组</button></div>
                    ${validation.errors.length ? `<div class="deck-errors">${validation.errors.slice(0, 3).map(error => `<p>${escapeHtml(error)}</p>`).join("")}</div>` : ""}
                    <section class="deck-insight" aria-label="卡组起手分析"><header><strong>起手作战笔记</strong><span>按初始5张手牌估算</span></header><dl><div><dt>1–4星角色</dt><dd>${opening.low} 张 · ${opening.lowRatio}%</dd></div><div><dt>5星以上角色</dt><dd>${opening.high} 张</dd></div><div><dt>起手可直接通常召唤</dt><dd>${opening.total >= 5 ? `${opening.chance}%` : "—"}</dd></div></dl>${opening.notes.map(note => `<p>${escapeHtml(note)}</p>`).join("")}${opening.combos.length ? `<h4>关键组合与资源</h4>${opening.combos.map(note => `<p>${escapeHtml(note)}</p>`).join("")}` : ""}<p>以空场、通常召唤次数未使用且无对手干扰为前提，只计算初始5张中至少1张1–4星角色；不计重抽、后手抽卡、检索和特殊召唤，不代表胜率。</p></section>
                    <div class="deck-filter-row">${makeFilterButtons(viewFilters, vf, "view-type")}</div>
                    <div class="deck-card-list">${deckCards.map(({ card, count }) => `<article class="deck-list-item" data-card-id="${escapeHtml(card.id)}">${cardArtHtml(card, "deck-list-art")}<div><span>${escapeHtml(card.rarity)} · ${escapeHtml(TYPE_NAMES[card.type])}</span><strong>${escapeHtml(card.name)}</strong></div><div class="deck-count-control"><button data-deck-remove="${escapeHtml(card.id)}">−</button><strong>${count}</strong><button data-deck-add="${escapeHtml(card.id)}">＋</button></div></article>`).join("") || "<p class='empty-copy'>该分类下没有卡牌。</p>"}</div>
                    <footer class="deck-editor-footer"><div class="deck-breakdown"><span>角色 ${monsterCount}</span><span>魔法 ${spellCount}</span><span>陷阱 ${trapCount}</span></div><button class="primary-action" id="save-deck">保存卡组</button></footer>
                </div>
            </section>`;

        // 绑定左侧卡牌点击
        this.screenRoot.querySelectorAll(".deck-source .catalog-card").forEach(card => {
            card.title = "点击加入卡组，右键查看详情";
            card.addEventListener("click", () => this.addCardToDraft(card.dataset.cardId));
            card.addEventListener("contextmenu", e => { e.preventDefault(); this.showCardDetail(getCardById(card.dataset.cardId)); });
        });
        // 绑定右侧卡组内卡牌右键
        this.screenRoot.querySelectorAll(".deck-list-item").forEach(item => {
            item.addEventListener("contextmenu", e => { e.preventDefault(); this.showCardDetail(getCardById(item.dataset.cardId)); });
        });
        // 绑定加减按钮
        this.screenRoot.querySelectorAll("[data-deck-add]").forEach(button => button.addEventListener("click", () => this.addCardToDraft(button.dataset.deckAdd)));
        this.screenRoot.querySelectorAll("[data-deck-remove]").forEach(button => button.addEventListener("click", () => this.removeCardFromDraft(button.dataset.deckRemove)));
        // 绑定功能按钮
        this.screenRoot.querySelector("#save-deck")?.addEventListener("click", () => this.saveDeckDraft());
        this.screenRoot.querySelector("#new-deck")?.addEventListener("click", () => this.createNewDeck());
        this.screenRoot.querySelector("#delete-deck")?.addEventListener("click", () => this.deleteCurrentDeck());
        this.screenRoot.querySelector("#deck-name-input")?.addEventListener("input", event => {
            if (this.deckDraft) this.deckDraft.name = event.target.value;
        });
        this.screenRoot.querySelector("#deck-select")?.addEventListener("change", event => {
            const selected = this.collection.decks.find(item => item.id === event.target.value);
            if (!selected) return;
            this.collection.selectedDeckId = selected.id;
            this.deckDraft = clone(selected);
            saveData(this.collection);
            this.renderDeckEditor(false);
        });
        this.screenRoot.querySelector("#reset-starter")?.addEventListener("click", () => {
            if (!this.deckDraft) return;
            const main = buildSuggestedDeck({ collection: this.collection, cardDatabase: ALL_CARDS, size: 40 });
            this.deckDraft.main = main;
            this.deckDraft.extra = [];
            this.deckDraft.side = [];
            this.deckDraft.coverCardId = main[0] || null;
            this.renderDeckEditor(false);
        });
        // 绑定左侧筛选
        this.screenRoot.querySelectorAll("[data-source-type]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.type = btn.dataset.sourceType; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelectorAll("[data-source-level]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.level = btn.dataset.sourceLevel; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelectorAll("[data-source-attr]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.attribute = btn.dataset.sourceAttr; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelectorAll("[data-source-rarity]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.rarity = btn.dataset.sourceRarity; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelectorAll("[data-source-owned]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.owned = btn.dataset.sourceOwned; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelector("#deck-card-search")?.addEventListener("input", event => {
            this.deckSourceFilter.search = event.target.value;
            this.renderDeckEditor(false);
            const nextInput = this.screenRoot.querySelector("#deck-card-search");
            nextInput?.focus();
            nextInput?.setSelectionRange(nextInput.value.length, nextInput.value.length);
        });
        // 绑定右侧分类
        this.screenRoot.querySelectorAll("[data-view-type]").forEach(btn => btn.addEventListener("click", () => { this.deckViewFilter = btn.dataset.viewType; this._resetDeckScroll(); this.renderDeckEditor(false); }));


    }

    _resetDeckScroll() {
        if (!this.screenRoot) return;
        requestAnimationFrame(() => {
            const el = this.screenRoot.querySelector(".deck-source-grid");
            if (el) el.scrollTop = 0;
            const cl = this.screenRoot.querySelector(".deck-card-list");
            if (cl) cl.scrollTop = 0;
        });
    }

    addCardToDraft(cardId) {
        if (!this.deckDraft) return;
        const scroll = this._captureDeckScroll();
        const card = getCardById(cardId);
        if (!card || card.enabled === false) return this.toast("该卡牌不可用", "error");
        const count = this.deckDraft.main.filter(id => id === cardId).length;
        const owned = getCardCount(this.collection, cardId);
        if (owned <= 0) return this.toast("你尚未拥有该卡牌", "error");
        const copyLimit = getCardCopyLimit(card);
        if (this.deckDraft.main.length >= 60) return this.toast("主卡组最多60张", "error");
        if (count >= copyLimit) return this.toast(`${card?.name || "该卡"}最多只能携带${copyLimit}张`, "error");
        if (count >= owned) return this.toast("拥有数量不足", "error");
        this.deckDraft.main.push(cardId);
        this.renderDeckEditor(false);
        this._restoreDeckScroll(scroll);
    }

    removeCardFromDraft(cardId) {
        if (!this.deckDraft) return;
        const scroll = this._captureDeckScroll();
        const index = this.deckDraft.main.lastIndexOf(cardId);
        if (index >= 0) this.deckDraft.main.splice(index, 1);
        this.renderDeckEditor(false);
        this._restoreDeckScroll(scroll);
    }

    async saveDeckDraft() {
        if (!this.deckDraft) return;
        const auth = loadAuth();
        if (auth?.userId && !this.collection.inventorySynced) {
            return this.toast("服务器库存尚未同步，请刷新页面后重试", "error");
        }
        this.deckDraft.name = this.screenRoot.querySelector("#deck-name-input")?.value.trim() || "未命名卡组";
        const validation = validateDeck(this.deckDraft, ALL_CARDS, this.collection);
        if (!validation.valid) return this.toast(validation.errors[0], "error");
        this.deckDraft.coverCardId = this.deckDraft.coverCardId && this.deckDraft.main.includes(this.deckDraft.coverCardId)
            ? this.deckDraft.coverCardId
            : this.deckDraft.main[0];
        if (auth?.userId) {
            const existing = this.collection.decks.find(deck => deck.id === this.deckDraft.id);
            const result = existing
                ? await updateServerDeck(this.deckDraft.id, {
                    name: this.deckDraft.name,
                    coverCardId: this.deckDraft.coverCardId,
                    main: this.deckDraft.main,
                    extra: this.deckDraft.extra || [],
                    side: this.deckDraft.side || [],
                })
                : await createServerDeck(auth.userId, this.deckDraft.name, this.deckDraft.coverCardId, this.deckDraft.main);
            if (!result.success) return this.toast(result.reason || "服务器保存失败", "error");
            if (!existing && result.id) this.deckDraft.id = result.id;
        }
        delete this.deckDraft.isNew;
        this.deckDraft.updatedAt = Date.now();
        const index = this.collection.decks.findIndex(deck => deck.id === this.deckDraft.id);
        if (index >= 0) this.collection.decks[index] = clone(this.deckDraft);
        else this.collection.decks.push(clone(this.deckDraft));
        this.collection.selectedDeckId = this.deckDraft.id;
        saveData(this.collection);
        this.toast("卡组已保存并设为主卡组", "success");
        this.renderTopbar();
        this.renderDeckEditor(true);
    }

    createNewDeck() {
        if (this.collection.decks.length >= 3) return this.toast("每个用户最多保存3副卡组", "error");
        const id = "deck_" + Date.now();
        const newDeck = { id, name: "新卡组", coverCardId: null, main: [], extra: [], side: [], isNew: true, createdAt: Date.now(), updatedAt: Date.now() };
        this.deckDraft = clone(newDeck);
        this.toast("已创建新卡组", "success");
        this.renderDeckEditor(false);
    }

    _captureDeckScroll() {
        const nameInput = this.screenRoot?.querySelector("#deck-name-input");
        if (nameInput && this.deckDraft) this.deckDraft.name = nameInput.value;
        return {
            source: this.screenRoot?.querySelector(".deck-source-grid")?.scrollTop || 0,
            deck: this.screenRoot?.querySelector(".deck-card-list")?.scrollTop || 0,
        };
    }

    _restoreDeckScroll(scroll) {
        requestAnimationFrame(() => {
            const source = this.screenRoot?.querySelector(".deck-source-grid");
            const deck = this.screenRoot?.querySelector(".deck-card-list");
            if (source) source.scrollTop = scroll.source;
            if (deck) deck.scrollTop = scroll.deck;
        });
    }

    async deleteCurrentDeck() {
        if (!this.deckDraft || this.collection.decks.length <= 1) return;
        const index = this.collection.decks.findIndex(d => d.id === this.deckDraft.id);
        if (index < 0) return;
        const auth = loadAuth();
        if (auth?.userId) {
            const result = await deleteServerDeck(this.deckDraft.id);
            if (!result.success) return this.toast(result.reason || "服务器删除失败", "error");
        }
        this.collection.decks.splice(index, 1);
        this.collection.selectedDeckId = this.collection.decks[0]?.id || null;
        this.deckDraft = null;
        saveData(this.collection);
        this.toast("卡组已删除", "success");
        this.renderDeckEditor(true);
    }

    renderRules() {
        const detailedRules = [
            ["01", "胜利与失败", `双方初始${GAME_CONFIG.START_LP}LP、起手${GAME_CONFIG.START_HAND_SIZE}张；先攻首回合不额外抽卡。对方LP归零或抽卡时无牌可抽则获胜；同时归零为平局。`],
            ["02", "回合流程", "抽卡 → 准备 → 主要阶段1 → 战斗 → 主要阶段2 → 结束。先攻首回合不能攻击，临时效果在注明的阶段清理。"],
            ["03", "召唤与祭品", "每回合通常召唤或盖放合计1次。1～4星无需祭品；5～6星解放1只；7～12星解放2只。怪兽区最多5只。"],
            ["04", "特殊与翻转", "特殊召唤不占通常召唤次数，但必须满足效果。里侧守备怪兽满足翻转召唤条件后可主动翻开；被攻击时先翻开参与伤害计算，翻转效果在该次伤害计算后处理。"],
            ["05", "魔法卡", "通常魔法发动后进入墓地，场地魔法持续生效。带目标的魔法必须选择合法目标；目标提前离场时该部分不结算。大部分魔法无需代价；少数禁术级魔法写有「支付XXXLP」，LP不足时不会发动、也不会消耗这张卡。"],
            ["06", "陷阱卡", "陷阱须先盖放并经过一次回合交换，之后可选择响应攻击（按后场顺序最多连锁 2 张陷阱），或在自己的主要阶段主动翻开结算。陷阱被发动时，对方可以连锁发动响应陷阱（最多 3 层）。先处理无效、破坏、回手、反伤或减伤，再进行伤害计算。"],
            ["07", "怪兽效果", "登场、连携与终式按卡面文字顺序结算。手动效果需点击发动；标有“1回合1次”的效果每回合只能使用一次。"],
            ["08", "战斗伤害", "攻击表示互相战斗：较弱者被破坏，其控制者承受差值；同攻且大于0时双方破坏，双方0攻则均不破坏。攻击守备表示：攻击力较高通常只破坏目标，贯穿效果才造成差值伤害；较低时攻击方承受差值，但攻击者不会因此被破坏；相等则均不破坏、不扣LP。直接攻击须满足对方无怪兽及卡牌限制。"],
            ["09", "保护与除外", "不会被战斗破坏仍会计算伤害，也不防效果破坏、回手或除外。暂时除外的卡在文字注明的时点返回。"],
            ["10", "共鸣", "场上存在至少2名不同Nightcord成员时进入共鸣。不同卡会追加抽牌、保护、伤害或反击，具体以卡面文字为准。"],
            ["11", "卡组构筑", "主卡组40～60张，同名卡最多3张；额外与副卡组各最多15张。高星怪需要足够低星怪作为祭品。"],
            ["12", "稀有度", "N偏基础，R强化单一战术，SR形成两段组合，SSR拥有完整连锁，UR可改变场面；稀有度越高不代表无条件取胜。"],
            ["13", "AI关卡", "越高关卡拥有越强牌池、更多Boss与更多行动次数。第三关起使用祭品召唤，高关卡会保留陷阱并优先处理威胁。"],
            ["14", "收藏与联机", "未拥有卡可预览但不能组入卡组。联机对局通过房间同步操作与状态。对局中请保持页面连接；当前版本不保证刷新后恢复对局。"],
            ["15", "角色卡的“强度”", "强度不是攻击力，也不是稀有度。它是部分角色卡在召唤成功时临时计算出的效果数值：卡面会明确写出“基础值＋统计数量×成长值”，最低按1计算且最高1800。随后“蓄势、固守、冲击”等效果会使用这个数值结算。"],
            ["16", "蓄势、固守、冲击、治愈", "蓄势＝此卡攻击力上升强度；固守＝此卡守备力上升强度；冲击＝给予对方相当于强度70%的效果伤害；治愈＝己方恢复等同强度的LP。"],
            ["17", "压制、封锁、墓地净化", "压制＝降低对方攻击力最高怪兽的攻击力；封锁＝对方全部怪兽本回合不能攻击；墓地净化＝从对方墓地除外卡牌，被除外的卡不再位于墓地。"],
            ["18", "具现化、手牌重构、攻守逆转", "具现化＝特殊召唤1只衍生物；手牌重构＝丢弃1张手牌后抽2张；攻守逆转＝交换对方攻击力最高怪兽的攻击力与守备力。"],
            ["19", "击退与全体庇护", "击退＝将对方攻击力最低的怪兽返回持有者手牌，不视为破坏；全体庇护＝己方怪兽本回合不会被战斗破坏，但仍可能受到战斗伤害，也仍可被效果破坏、回手或除外。"],
            ["20", "起手重抽", "开局抽完 5 张后可以重抽一次：把起手手牌洗回卡组并重新抽 5 张。AI 只在自己也没有可立刻打出的牌（没有 4 星以下怪兽、也没有魔法）时才重抽。联机对局暂不启用，以免双方随机序列不同步。"],
            ["21", "抽卡重复保护", "一包 8 张如果全部是已经拥有的卡，系统会把其中一张换成尚未拥有的卡（优先同稀有度），避免开出全是重复的空包。"],
            ["23", "本项目自定义规则", `本作使用自动阶段推进、角色主动技和简化陷阱响应，不是完整官方赛事规则。${GAME_CONFIG.ALLOW_SUMMON_TURN_POSITION_CHANGE ? "当前允许召唤当回合、尚未攻击时手动变更表示；官方规则通常不允许召唤当回合手动变更。" : "当前不允许召唤当回合手动变更表示。"}起手重抽与Nightcord共鸣也属于本项目玩法。`],
            ["24", "取消与确认", "仅选择攻击者、尚未确认攻击时，可以取消回到主要阶段1；攻击已经确认或发生陷阱响应后，不能靠取消退回主要阶段1。已进行战斗后出牌会进入主要阶段2，之后不能再次进入战斗。目标与祭品选择在确认前可以取消，恢复原阶段；选卡和响应窗口需完成后才能结束回合。"],
            ["25", "预览与结算日志", `预览只估算公开场面，不包含后续响应；盖放目标不显示隐藏数值。点击决斗日志，再展开「查看结算明细」，可查看宣言数值、战斗伤害、包含触发效果的LP变化与卡牌去向。结束阶段手牌上限为${GAME_CONFIG.END_HAND_LIMIT}张。`],
            ["22", "新手教学", "首页「新手教学」会用一副固定卡组带你走一遍召唤、盖放陷阱、结束回合、陷阱时机、攻击与起手重抽。教学不消耗卡组、不计入战绩、随时可跳过。"],
        ].sort((a, b) => Number(a[0]) - Number(b[0]));
        this.screenRoot.innerHTML = `<section class="screen-heading"><div><span class="eyebrow">DUEL MANUAL</span><h1>决斗手册</h1><p>从第一次召唤，到属于你的胜利。</p></div></section>
            <section class="game-manual"><aside class="manual-index"><span>CONTENTS</span><h2>每一步，都有答案</h2>${detailedRules.map(([number, title]) => `<button data-manual-target="rule-${number}"><small>${number}</small>${title}</button>`).join("")}</aside><div class="manual-pages">${detailedRules.map(([number, title, body], index) => `<details class="rule-panel" id="rule-${number}" ${index < 2 ? "open" : ""}><summary><span>${number}</span><h2>${title}</h2><b>＋</b></summary><p>${body}</p></details>`).join("")}</div></section>`;
        this.screenRoot.querySelectorAll("[data-manual-target]").forEach(button => button.addEventListener("click", () => {
            const rule = this.screenRoot.querySelector("#" + button.dataset.manualTarget);
            rule.open = true;
            rule.scrollIntoView({ behavior: this.collection.settings.reduceAnimations ? "instant" : "smooth", block: "start" });
        }));
    }

    renderSettings() {
        const settings = this.collection.settings;
        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">SYSTEM</span><h1>设置</h1><p>视觉与操作选项保存在本地浏览器中。</p></div></section>
            <div class="settings-layout"><aside class="settings-portrait"><span>YOUR PLAY, YOUR WAY</span><h2>让每一场决斗<br>更合你的节奏。</h2><p>声音 · 画面 · 操作</p></aside><section class="settings-panel">
                <label class="setting-row"><div><strong>音效</strong><span>出牌、召唤、战斗与招募时播放音效。</span></div><input type="checkbox" id="setting-sound" ${settings.soundEnabled !== false ? "checked" : ""}></label>
                <label class="setting-row"><div><strong>减少动态效果</strong><span>降低卡包和战斗中的动画强度。</span></div><input type="checkbox" id="setting-reduce" ${settings.reduceAnimations ? "checked" : ""}></label>
                <label class="setting-row"><div><strong>动画速度</strong><span>控制决斗演出与AI行动速度，不改变规则结算。</span></div><select id="setting-speed"><option value="0.7">慢速</option><option value="1">正常</option><option value="1.5">快速 1.5×</option><option value="2">极速 2×</option></select></label>
                <label class="setting-row"><div><strong>演出画质</strong><span>低画质减少装饰粒子和震屏，保留角色招式与目标反馈。</span></div><select id="setting-quality"><option value="auto">自动（手机优先流畅）</option><option value="high">完整演出</option><option value="low">低画质</option></select></label>
                <label class="setting-row"><div><strong>决斗日志</strong><span>控制战场右侧日志面板的显示。</span></div><input type="checkbox" id="setting-log" ${settings.logLevel !== 0 ? "checked" : ""}></label>
                <button class="primary-action" id="save-settings">保存设置</button>
            </section></div>`;
        const speed = this.screenRoot.querySelector("#setting-speed");
        speed.value = String(settings.animationSpeed || 1);
        this.screenRoot.querySelector("#setting-quality").value = settings.effectQuality || "auto";
        this.screenRoot.querySelector("#save-settings")?.addEventListener("click", () => {
            settings.soundEnabled = this.screenRoot.querySelector("#setting-sound").checked;
            settings.reduceAnimations = this.screenRoot.querySelector("#setting-reduce").checked;
            settings.animationSpeed = Number(speed.value);
            settings.effectQuality = this.screenRoot.querySelector("#setting-quality").value;
            configureDuelMotion(settings);
            settings.logLevel = this.screenRoot.querySelector("#setting-log").checked ? 1 : 0;
            saveData(this.collection);
            setSoundEnabled(settings.soundEnabled);
            document.body.classList.toggle("reduce-motion", settings.reduceAnimations);
            document.body.classList.toggle("hide-duel-log", settings.logLevel === 0);
            if (settings.soundEnabled) playSound("uiClick");
            this.toast("设置已保存", "success");
        });
    }

    /**
     * 新手教学：不需要玩家先有合法卡组，卡组与起手都由 tutorial.js 指定，
     * 因此这里是唯一一个"不做卡组校验"的决斗入口——这是刻意的。
     */
    startTutorial() {
        this.hideShell();
        playSound("reveal");
        this.onStartDuel({ mode: "tutorial" });
    }

    showStrategyPractice() {
        const options = STRATEGY_DECKS.map(deck => `<option value="${deck.id}">${escapeHtml(deck.name)}</option>`).join("");
        this.openModal(`<section class="modal-panel strategy-practice" role="dialog" aria-modal="true" aria-labelledby="strategy-title">
            <button class="modal-close" data-close-modal aria-label="关闭">×</button><span class="eyebrow">TACTICAL TRIAL</span><h2 id="strategy-title">战术试炼</h2>
            <p>借用完整40张卡组体验三种战术，无需拥有卡牌。本模式不消耗收藏、不发奖励、不计战绩。</p>
            <div class="strategy-selectors"><label>我方卡组<select id="strategy-player">${options}</select></label><label>对手卡组<select id="strategy-opponent">${options}</select></label></div>
            <div id="strategy-guide"></div><button type="button" class="primary-action" id="start-strategy-practice">开始试炼</button>
        </section>`);
        const playerSelect = this.modalRoot.querySelector("#strategy-player");
        const opponentSelect = this.modalRoot.querySelector("#strategy-opponent");
        opponentSelect.value = "charge";
        const renderGuide = () => {
            const deck = getStrategyDeck(playerSelect.value), opponent = getStrategyDeck(opponentSelect.value);
            this.modalRoot.querySelector("#strategy-guide").innerHTML = `<h3>${escapeHtml(deck.name)}</h3><p>${escapeHtml(deck.plan)}</p><p><strong>起手思路：</strong>${escapeHtml(deck.opening)}</p><p><strong>自身弱点：</strong>${escapeHtml(deck.counter)}</p>
                <details open><summary>核心卡与代价</summary>${deck.core.map(id => { const card = getCardById(id); return `<article class="strategy-core"><strong>${escapeHtml(card.name)}</strong><p>${escapeHtml(card.strategyDesign?.tradeoff || "按卡面条件发动")}</p><p>${escapeHtml(card.description)}</p></article>`; }).join("")}</details>
                <details><summary>完整40张卡表</summary><ul>${[...new Set(deck.main)].map(id => `<li>${escapeHtml(getCardById(id).name)} × ${deck.main.filter(x => x === id).length}</li>`).join("")}</ul></details>
                <p><strong>对手：${escapeHtml(opponent.name)}</strong> · ${escapeHtml(opponent.plan)}</p><p><strong>应对建议：</strong>${escapeHtml(opponent.counter)}</p>`;
        };
        playerSelect.addEventListener("change", renderGuide); opponentSelect.addEventListener("change", renderGuide); renderGuide();
        this.modalRoot.querySelector("#start-strategy-practice").addEventListener("click", () => {
            const deck = getStrategyDeck(playerSelect.value), opponentDeck = getStrategyDeck(opponentSelect.value);
            if (!validateDeck(deck, ALL_CARDS).valid || !validateDeck(opponentDeck, ALL_CARDS).valid) return this.toast("试炼卡组校验失败", "error");
            this.closeModal(); this.hideShell(); this.onStartDuel({ mode: "practice", deck, opponentDeck });
        });
    }

    startDuel(stage = null) {
        const deck = this.getSelectedDeck();
        if (!deck) return this.toast("请先选择卡组", "error");
        const validation = validateDeck(deck, ALL_CARDS, this.collection);
        if (!validation.valid) return this.toast(validation.errors[0], "error");
        this.hideShell();
        this.onStartDuel(stage
            ? { mode: "ai", deck, stage, opponentDeck: buildStageDeck(stage) }
            : { mode: "training", deck });
    }

    showStageModal() {
        const cards = AI_STAGES.map(stage => {
            const unlocked = isStageUnlocked(this.collection, stage);
            const cleared = Boolean(this.collection.stageProgress?.[stage.id]?.cleared);
            return `<button class="stage-choice ${cleared ? "cleared" : ""}" data-stage-id="${stage.id}" ${unlocked ? "" : "disabled"}>
                <span class="stage-order">${unlocked ? stage.order : "🔒"}</span>
                <span><strong>${escapeHtml(stage.name)}</strong><small>${escapeHtml(stage.opponent)} · ${stage.difficulty.toUpperCase()}</small></span>
                <span class="stage-reward">${cleared ? "已通关" : `胜利 +${stage.reward}币`}</span>
            </button>`;
        }).join("");
        this.openModal(`<section class="modal-panel stage-modal">
            <button class="modal-close" data-close-modal aria-label="关闭">×</button>
            <span class="eyebrow">AI CHALLENGE</span><h2>决斗关卡</h2>
            <p>通关当前关卡后解锁下一关。难度、卡组强度与奖励逐关提升。</p>
            <div class="stage-list">${cards}</div>
        </section>`);
        this.modalRoot.querySelectorAll("[data-stage-id]").forEach(button => button.addEventListener("click", () => {
            const stage = AI_STAGES.find(item => item.id === button.dataset.stageId);
            if (!stage) return;
            this.closeModal();
            this.playHomeLaunch(() => this.startDuel(stage));
        }));
    }

    async createPvpRoom() {
        const decks = this.collection.decks || [];
        const selectedId = this.collection.selectedDeckId || decks[0]?.id;
        const deck = decks.find(d => d.id === selectedId) || decks[0];
        if (!deck) return this.toast("请先选择卡组", "error");
        this.openModal(`
            <section class="modal-panel purchase-confirm">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <span class="eyebrow">PVP ROOM</span>
                <h2>创建对战房间</h2>
                <label class="auth-field"><span>选择卡组</span>
                    <select id="pvp-create-deck-select">
                        ${decks.map(d => `<option value="${escapeHtml(d.id)}" ${d.id === selectedId ? "selected" : ""}>${escapeHtml(d.name)} (${d.main.length}张)</option>`).join("")}
                    </select>
                </label>
                <p class="validation-line" id="pvp-status"></p>
                <div class="modal-actions"><button class="secondary-action" data-close-modal>取消</button><button class="primary-action" id="pvp-create-confirm">创建房间</button></div>
            </section>`);
        this.modalRoot.querySelector("#pvp-create-confirm")?.addEventListener("click", async () => {
            const deckId = this._pvpModalEl("pvp-create-deck-select")?.value;
            const selectedDeck = this.collection.decks.find(d => d.id === deckId);
            if (!selectedDeck) return;
            const validation = validateDeck(selectedDeck, ALL_CARDS, this.collection);
            if (!validation.valid) { this._setPvpStatus("pvp-status", validation.errors[0]); return; }
            this._setPvpStatus("pvp-status", "正在连接服务器...");
            const confirmButton = this._pvpModalEl("pvp-create-confirm");
            if (confirmButton) confirmButton.disabled = true;
            try {
                const { PvPClient } = await import("./pvp.js?v=1.1.0");
                const pvp = new PvPClient();
                this._pvpClient = pvp;
                await withTimeout(pvp.connect(), 10000, "连接服务器超时，请确认 pvp-server 已启动");
                pvp.onError = (msg) => {
                    // 错误回执后必须恢复按钮，否则玩家会永久卡在"正在连接服务器..."。
                    const button = this._pvpModalEl("pvp-create-confirm");
                    if (button) button.disabled = false;
                    if (!this._setPvpStatus("pvp-status", `错误: ${msg}`)) this.toast(msg || "PvP连接失败", "error");
                };
                pvp.onRoomCreated = (roomId) => {
                    const status = this._pvpModalEl("pvp-status");
                    if (status) status.innerHTML = `房间号: <strong style="color:var(--accent);font-size:20px">${roomId}</strong><br>将此号码分享给朋友，等待加入...`;
                };
                pvp.onRoomJoined = (roomId, opponentName) => {
                    this._setPvpStatus("pvp-status", `${opponentName} 加入了房间！正在准备决斗...`);
                    pvp.setDeck(selectedDeck.main);
                };
                pvp.onGameStart = (info) => {
                    pvp.onError = msg => this.toast(msg || "PvP同步失败", "error");
                    this.closeModal();
                    this.playHomeLaunch(() => {
                        this.hideShell();
                        this.toast(`${info.opponentName} 已加入！你是${info.yourIndex === info.firstPlayer ? "先攻" : "后攻"}`, "success");
                        this.onStartDuel({ mode: "pvp", deck: selectedDeck, pvpClient: pvp, gameInfo: info });
                    });
                };
                const name = this.collection.profile?.name || "Player";
                pvp.createRoom(name);
            } catch (e) {
                // 弹窗可能已被关闭（closeModal 清空了 modalRoot），这里必须判空。
                const button = this._pvpModalEl("pvp-create-confirm");
                if (button) button.disabled = false;
                if (!this._setPvpStatus("pvp-status", `PvP服务器未启动或连接失败：${e?.message || e}`)) {
                    this.toast("PvP服务器未启动，请先运行 pvp-server.mjs", "error");
                }
                this._pvpClient?.destroy?.();
                this._pvpClient = null;
            }
        });
    }

    _pvpModalEl(id) {
        // 弹窗内的元素会随 closeModal() 一起从 DOM 移除，所有查询都必须判空。
        return this.modalRoot.querySelector(`#${id}`);
    }

    _setPvpStatus(id, text) {
        const element = this._pvpModalEl(id);
        if (!element) return false;
        element.textContent = text;
        return true;
    }

    showJoinPvpModal() {
        const decks = this.collection.decks || [];
        const selectedId = this.collection.selectedDeckId || decks[0]?.id;
        this.openModal(`
            <section class="modal-panel purchase-confirm">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <span class="eyebrow">JOIN PVP</span>
                <h2>加入对战房间</h2>
                <label class="auth-field"><span>房间号</span><input id="pvp-room-input" placeholder="输入朋友给的房间号"></label>
                <label class="auth-field"><span>选择卡组</span>
                    <select id="pvp-deck-select">
                        ${decks.map(d => `<option value="${escapeHtml(d.id)}" ${d.id === selectedId ? "selected" : ""}>${escapeHtml(d.name)} (${d.main.length}张)</option>`).join("")}
                    </select>
                </label>
                <p class="validation-line" id="pvp-join-status"></p>
                <div class="modal-actions"><button class="secondary-action" data-close-modal>取消</button><button class="primary-action" id="pvp-join-confirm">加入</button></div>
            </section>`);
        this.modalRoot.querySelector("#pvp-join-confirm")?.addEventListener("click", async () => {
            const roomId = this._pvpModalEl("pvp-room-input")?.value.trim();
            if (!roomId) { this._setPvpStatus("pvp-join-status", "请输入房间号"); return; }
            const deckId = this._pvpModalEl("pvp-deck-select")?.value;
            const deck = this.collection.decks.find(d => d.id === deckId);
            if (!deck) { this._setPvpStatus("pvp-join-status", "请选择卡组"); return; }
            const validation = validateDeck(deck, ALL_CARDS, this.collection);
            if (!validation.valid) { this._setPvpStatus("pvp-join-status", validation.errors[0]); return; }
            this._setPvpStatus("pvp-join-status", "正在连接...");
            const confirmButton = this._pvpModalEl("pvp-join-confirm");
            if (confirmButton) confirmButton.disabled = true;
            try {
                const { PvPClient } = await import("./pvp.js?v=1.1.0");
                const pvp = new PvPClient();
                this._pvpClient = pvp;
                await withTimeout(pvp.connect(), 10000, "连接服务器超时，请确认 pvp-server 已启动");
                pvp.onError = (msg) => {
                    const button = this._pvpModalEl("pvp-join-confirm");
                    if (button) button.disabled = false;
                    if (!this._setPvpStatus("pvp-join-status", `错误: ${msg}`)) this.toast(msg || "PvP连接失败", "error");
                };
                pvp.onRoomJoined = (rid, opponentName) => {
                    this._setPvpStatus("pvp-join-status", `已加入房间！等待房主开始...`);
                    pvp.setDeck(deck.main);
                };
                pvp.onGameStart = (info) => {
                    pvp.onError = msg => this.toast(msg || "PvP同步失败", "error");
                    this.closeModal();
                    this.playHomeLaunch(() => {
                        this.hideShell();
                        this.toast(`${info.opponentName} 的房间！你是${info.yourIndex === info.firstPlayer ? "先攻" : "后攻"}`, "success");
                        this.onStartDuel({ mode: "pvp", deck, pvpClient: pvp, gameInfo: info });
                    });
                };
                const name = this.collection.profile?.name || "Player";
                pvp.joinRoom(roomId, name);
            } catch (e) {
                document.getElementById("pvp-join-status").textContent = "PvP服务器未启动";
            }
        });
    }

    onStartPvp(pvpClient, deck, gameInfo) {
        // 这是唯一进入决斗但不做卡组校验的入口，必须补上与其它入口一致的校验，
        // 否则任何调用方都能用非法卡组开局。
        const validation = validateDeck(deck, ALL_CARDS, this.collection);
        if (!validation.valid) return this.toast(validation.errors[0], "error");
        this.playHomeLaunch(() => {
            this.hideShell();
            this.onStartDuel({ mode: "pvp", deck, pvpClient, gameInfo });
        });
    }

    getSelectedDeck() {
        return this.collection.decks.find(deck => deck.id === this.collection.selectedDeckId) || this.collection.decks[0] || null;
    }

    bindJumpButtons() {
        this.screenRoot.querySelectorAll("[data-jump]").forEach(button => button.addEventListener("click", () => this.navigate(button.dataset.jump)));
    }

    bindCardDetailClicks() {
        this.screenRoot.querySelectorAll(".catalog-card").forEach(element => element.addEventListener("click", () => {
            this.selectedCollectionCardId = element.dataset.cardId;
            this.navigate("collection");
        }));
    }

    openModal(html) {
        this.modalRoot.innerHTML = html;
        this.modalRoot.classList.add("active");
    }

    closeModal() {
        this.packAnimation?.cancel?.();
        this.packAnimation = null;
        this.modalRoot.classList.remove("active");
        this.modalRoot.innerHTML = "";
    }

    toast(message, type = "info") {
        const element = document.createElement("div");
        element.className = `toast ${type}`;
        element.textContent = message;
        this.toastRoot.appendChild(element);
        requestAnimationFrame(() => element.classList.add("visible"));
        setTimeout(() => {
            element.classList.remove("visible");
            setTimeout(() => element.remove(), 220);
        }, 2400);
    }
}

function selectHtml(id, label, selected, options) {
    return `<label class="select-control"><span>${escapeHtml(label)}</span><select id="${escapeHtml(id)}">${options.map(([value, text]) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
}

function countIds(ids) {
    return ids.reduce((map, id) => {
        map[id] = (map[id] || 0) + 1;
        return map;
    }, {});
}

function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("zh-CN");
}

function formatPercent(value) {
    const percent = Number(value || 0) * 100;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}
