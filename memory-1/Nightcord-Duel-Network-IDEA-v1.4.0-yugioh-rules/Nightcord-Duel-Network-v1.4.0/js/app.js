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
} from "./collection.js";
import { ALL_CARDS, NIGHTCORD_ONLY, getCardArts, getCardById, hydrateCardArt } from "./catalog.js";
import { NIGHTCORD_PACK, openPack, openTenPacks } from "./packs.js";
import { validateDeck } from "./deck.js";
import { saveData } from "./storage.js";
import { cardArtHtml, catalogCardHtml, escapeHtml, MEMBER_NAMES, TYPE_NAMES, rarityRank } from "./card-view.js";

const ROUTES = new Set(["home", "collection", "decks", "rules", "settings"]);

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
        this.selectedCollectionCardId = NIGHTCORD_ONLY[0]?.id || null;
        this.deckDraft = null;
        this.bindGlobalEvents();
        this.navigate("home");
    }

    bindGlobalEvents() {
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
        document.getElementById("detail-name").textContent = card.name;
        document.getElementById("detail-type").textContent = `${typeName} · ${({ fire: "火", water: "水", wind: "风", earth: "地", light: "光", dark: "暗" })[attr] || ""}属性 · ${raceName} · Lv.${card.level || "?"} · ${rarityName}`;
        document.getElementById("detail-desc").textContent = card.description || "";
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
        this.shell.classList.add("is-hidden");
    }

    navigate(route) {
        if (!ROUTES.has(route)) route = "home";
        this.route = route;
        this.showShell();
        document.querySelectorAll("[data-route]").forEach(button => {
            button.classList.toggle("active", button.dataset.route === route);
        });
        if (route === "home") this.renderHome();
        if (route === "shop") this.renderShop();
        if (route === "collection") this.renderCollection();
        if (route === "decks") this.renderDeckEditor(true);
        if (route === "rules") this.renderRules();
        if (route === "settings") this.renderSettings();
    }

    renderTopbar() {
        const profile = this.collection.profile || { name: "决斗者", level: 1 };
        document.getElementById("profile-name").textContent = profile.name;
        document.getElementById("profile-level").textContent = `LV.${profile.level || 1}`;
        document.getElementById("coin-count").textContent = formatNumber(this.collection.currency.duelCoins || 0);
        document.getElementById("shard-count").textContent = formatNumber(Object.values(this.collection.currency.shards || {}).reduce((a, b) => a + b, 0));
    }

    renderHome() {
        const deck = this.getSelectedDeck();
        const validation = deck ? validateDeck(deck, ALL_CARDS, this.collection) : { valid: false, errors: ["没有选择卡组"], stats: {} };
        const cover = hydrateCardArt(getCardById(deck?.coverCardId || deck?.main?.[0]), this.collection.selectedArtByCard);
        const recentCards = Object.entries(this.collection.cards)
            .filter(([, count]) => count > 0)
            .slice(-4)
            .map(([id, count]) => ({ card: hydrateCardArt(getCardById(id), this.collection.selectedArtByCard), count }))
            .filter(item => item.card);
        const pity = getPityCount(this.collection, NIGHTCORD_PACK.id);

        this.screenRoot.innerHTML = `
            <section class="home-hero">
                <div class="hero-copy">
                    <span class="eyebrow">NIGHTCORD DUEL NETWORK</span>
                    <h1>让你的收藏，真正进入决斗。</h1>
                    <p>抽取主题卡牌、编辑主卡组，并在完整的回合制战场中挑战AI。</p>
                    <div class="hero-actions">
                        <button class="primary-action" id="home-start-duel" ${validation.valid ? "" : "disabled"}>开始决斗</button>
                        <button class="secondary-action" data-jump="decks">编辑卡组</button>
                    </div>
                    ${validation.valid ? "" : `<p class="validation-line">当前卡组不可用：${escapeHtml(validation.errors[0])}</p>`}
                </div>
                <div class="hero-art">${cover ? cardArtHtml(cover, "hero-cover", true) : ""}<div class="hero-vignette"></div></div>
            </section>

            <section class="dashboard-grid">
                <article class="dashboard-panel deck-panel">
                    <div class="panel-heading"><div><span class="eyebrow">MAIN DECK</span><h2>${escapeHtml(deck?.name || "未选择卡组")}</h2></div><span class="status-pill ${validation.valid ? "ok" : "bad"}">${validation.valid ? "可出战" : "需调整"}</span></div>
                    <div class="deck-summary">
                        <div><strong>${validation.stats?.total || deck?.main?.length || 0}</strong><span>卡牌</span></div>
                        <div><strong>${validation.stats?.monsters || 0}</strong><span>角色</span></div>
                        <div><strong>${validation.stats?.spells || 0}</strong><span>魔法</span></div>
                        <div><strong>${validation.stats?.traps || 0}</strong><span>陷阱</span></div>
                    </div>
                    <button class="text-action" data-jump="decks">查看卡组构成 →</button>
                </article>

                <article class="dashboard-panel mission-panel">
                    <div class="panel-heading"><div><span class="eyebrow">DAILY OBJECTIVE</span><h2>今日首次胜利</h2></div><span class="reward-number">+300</span></div>
                    <p>${this.collection.statistics.firstWinToday === new Date().toDateString() ? "今日奖励已领取。" : "在AI决斗中取得一次胜利即可获得额外决斗币。"}</p>
                    <div class="progress-track"><span style="width:${this.collection.statistics.firstWinToday === new Date().toDateString() ? 100 : 0}%"></span></div>
                </article>
            </section>

            <section class="recent-section">
                <div class="section-heading"><div><span class="eyebrow">COLLECTION</span><h2>最近拥有的卡牌</h2></div><button class="text-action" data-jump="collection">打开收藏 →</button></div>
                <div class="recent-grid">${recentCards.length ? recentCards.map(({ card, count }) => catalogCardHtml(card, count, { compact: true })).join("") : "<p class='empty-copy'>收藏还没有卡牌。</p>"}</div>
            </section>`;

        this.screenRoot.querySelector("#home-start-duel")?.addEventListener("click", () => this.startDuel());
        this.bindJumpButtons();
        this.bindCardDetailClicks();
    }

    renderShop() {
        const pity = getPityCount(this.collection, NIGHTCORD_PACK.id);
        const cover = hydrateCardArt(getCardById("nc_sp_ur_001"), this.collection.selectedArtByCard);
        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">CARD PACK SHOP</span><h1>卡包商店</h1><p>仅消耗游戏内决斗币，不涉及真实支付。</p></div></section>
            <section class="shop-layout">
                <article class="featured-pack rarity-UR">
                    <div class="featured-pack-image">${cardArtHtml(cover, "pack-cover-art", true)}<div class="pack-logo"><span>LIMITED SELECTION</span><strong>25时，Nightcord</strong></div></div>
                    <div class="featured-pack-content">
                        <div class="pack-tags"><span>60张基础卡</span><span>338种插画</span><span>UR 3%</span></div>
                        <h2>四名成员，共同组成一个主题系列。</h2>
                        <p>每包8张，第8张至少R。十包抽取至少包含一张SR或UR；最晚第50包获得UR。</p>
                        <div class="pity-block"><div><span>UR保底</span><strong>${pity} / 50</strong></div><div class="progress-track"><span style="width:${Math.min(100, pity / 50 * 100)}%"></span></div></div>
                        <div class="purchase-row">
                            <button class="pack-buy" data-open-count="1"><span>抽取1包</span><strong>1000 决斗币</strong></button>
                            <button class="pack-buy featured" data-open-count="10"><span>抽取10包</span><strong>9000 决斗币</strong></button>
                        </div>
                    </div>
                </article>
                <aside class="shop-side">
                    <article class="dashboard-panel"><span class="eyebrow">BALANCE</span><div class="big-currency">${formatNumber(this.collection.currency.duelCoins)}</div><p>当前决斗币</p></article>
                    <article class="dashboard-panel probability-list"><span class="eyebrow">PROBABILITY</span><div><span>N</span><strong>55%</strong></div><div><span>R</span><strong>30%</strong></div><div><span>SR</span><strong>12%</strong></div><div><span>UR</span><strong>3%</strong></div></article>
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
                <h2>抽取${count === 10 ? "10包" : "1包"}</h2>
                <div class="purchase-math"><div><span>消耗</span><strong>${formatNumber(cost)}</strong></div><div><span>当前</span><strong>${formatNumber(balance)}</strong></div><div><span>抽取后</span><strong>${formatNumber(Math.max(0, balance - cost))}</strong></div></div>
                ${balance < cost ? `<p class="validation-line">决斗币不足，还差 ${formatNumber(cost - balance)}。</p>` : ""}
                <div class="modal-actions"><button class="secondary-action" data-close-modal>取消</button><button class="primary-action" id="confirm-pack-open" ${balance < cost ? "disabled" : ""}>确认抽取</button></div>
            </section>`);
        this.modalRoot.querySelector("#confirm-pack-open")?.addEventListener("click", () => this.openPacks(count));
    }

    openPacks(count) {
        const cost = count === 10 ? NIGHTCORD_PACK.tenCost.duelCoins : NIGHTCORD_PACK.cost.duelCoins;
        if (!spendDuelPoints(this.collection, cost)) {
            this.toast("决斗币不足", "error");
            return;
        }
        const pity = getPityCount(this.collection, NIGHTCORD_PACK.id);
        const opened = count === 10
            ? openTenPacks(NIGHTCORD_PACK, NIGHTCORD_ONLY, undefined, pity)
            : openPack(NIGHTCORD_PACK, NIGHTCORD_ONLY, undefined, pity);
        if (!opened.success) {
            this.collection.currency.duelCoins += cost;
            this.toast(opened.reason || "卡包开启失败", "error");
            return;
        }

        const reveals = opened.cards.map(card => this.collectPulledCard(card));
        const gotUR = opened.cards.some(card => card.rarity === "UR");
        if (count === 10) {
            this.collection.pityCounters[NIGHTCORD_PACK.id] = { packsSinceUR: gotUR ? 0 : opened.packsSinceUR };
        } else if (gotUR) {
            resetPity(this.collection, NIGHTCORD_PACK.id);
        } else {
            incrementPity(this.collection, NIGHTCORD_PACK.id);
        }
        this.collection.statistics.packsOpened += count;
        saveData(this.collection);
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
        this.openModal(`
            <section class="pack-opening-stage rarity-${escapeHtml(highest)}" id="pack-opening-stage">
                <div class="pack-orbit"></div>
                <div class="digital-pack"><span>25:00</span><strong>NIGHTCORD</strong><small>${count === 10 ? "TEN PACKS" : "SELECTION PACK"}</small></div>
                <p>抽取结果已确定</p>
                <button class="primary-action" id="reveal-pack-results">揭晓结果</button>
            </section>`);
        this.modalRoot.querySelector("#reveal-pack-results")?.addEventListener("click", () => this.showPackResults(reveals, count));
    }

    showPackResults(reveals, count) {
        const summary = reveals.reduce((acc, item) => {
            acc[item.card.rarity] = (acc[item.card.rarity] || 0) + 1;
            acc.newCards += item.newCard ? 1 : 0;
            acc.newArts += item.newArt ? 1 : 0;
            acc.shards += item.shards || 0;
            return acc;
        }, { N: 0, R: 0, SR: 0, UR: 0, newCards: 0, newArts: 0, shards: 0 });
        const sorted = [...reveals].sort((a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity));
        this.modalRoot.innerHTML = `
            <section class="modal-panel pack-results-panel">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <div class="section-heading"><div><span class="eyebrow">PACK RESULTS</span><h2>${count === 10 ? "十包抽取结果" : "卡包抽取结果"}</h2></div><div class="result-summary"><span>N ${summary.N}</span><span>R ${summary.R}</span><span>SR ${summary.SR}</span><span>UR ${summary.UR}</span></div></div>
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
        const filtered = NIGHTCORD_ONLY
            .filter(card => this.filterCollectionCard(card))
            .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name, "zh-CN"));
        const selectedBase = getCardById(this.selectedCollectionCardId) || filtered[0] || NIGHTCORD_ONLY[0];
        const selected = hydrateCardArt(selectedBase, this.collection.selectedArtByCard);
        const owned = getCardCount(this.collection, selected?.id);
        const arts = selected ? getCardArts(selected.id) : [];

        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">CARD LIBRARY</span><h1>卡牌收藏</h1><p>已拥有 ${Object.keys(this.collection.cards).length} / ${NIGHTCORD_ONLY.length} 种Nightcord基础卡。</p></div></section>
            <section class="collection-layout">
                <div class="collection-browser">
                    <div class="filter-bar">
                        <label class="search-control"><span>搜索</span><input id="collection-search" value="${escapeHtml(this.collectionFilters.search)}" placeholder="输入卡名"></label>
                        ${selectHtml("collection-member", "成员", this.collectionFilters.member, [["all", "全部"], ["ena", "东云绘名"], ["kanade", "宵崎奏"], ["mafuyu", "朝比奈真冬"], ["mizuki", "晓山瑞希"], ["group", "四人共同"]])}
                        ${selectHtml("collection-rarity", "稀有度", this.collectionFilters.rarity, [["all", "全部"], ["N", "N"], ["R", "R"], ["SR", "SR"], ["UR", "UR"]])}
                        ${selectHtml("collection-type", "类型", this.collectionFilters.type, [["all", "全部"], ["monster", "角色"], ["spell", "魔法"], ["trap", "陷阱"]])}
                        ${selectHtml("collection-owned", "状态", this.collectionFilters.owned, [["all", "全部"], ["yes", "已拥有"], ["no", "未拥有"]])}
                    </div>
                    <div class="collection-grid">${filtered.map(card => catalogCardHtml(hydrateCardArt(card, this.collection.selectedArtByCard), getCardCount(this.collection, card.id))).join("") || "<p class='empty-copy'>没有符合条件的卡牌。</p>"}</div>
                </div>
                <aside class="collection-detail">
                    ${selected ? `
                        ${cardArtHtml(selected, "detail-art-wide", true)}
                        <div class="detail-copy"><span class="eyebrow">${escapeHtml(selected.rarity)} · ${escapeHtml(MEMBER_NAMES[selected.member] || "Nightcord")}</span><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.description)}</p>
                        <div class="detail-stats"><div><span>拥有</span><strong>${owned}</strong></div>${selected.type === "monster" ? `<div><span>ATK</span><strong>${selected.attack}</strong></div><div><span>DEF</span><strong>${selected.defense}</strong></div>` : `<div><span>类型</span><strong>${escapeHtml(TYPE_NAMES[selected.type])}</strong></div>`}</div>
                        <div class="detail-actions"><button class="secondary-action" id="craft-card" ${canCraft(this.collection, selected.id, ALL_CARDS).canCraft ? "" : "disabled"}>制作1张</button><button class="secondary-action" id="dismantle-card" ${owned > 0 ? "" : "disabled"}>分解1张</button></div>
                        <div class="art-selector"><div class="section-heading"><h3>已解锁插画</h3><span>${arts.filter(art => this.collection.artCollection[art.artId]).length}/${arts.length}</span></div><div class="art-strip">${arts.map(art => `<button class="art-choice ${this.collection.selectedArtByCard[selected.id] === art.artId ? "selected" : ""} ${this.collection.artCollection[art.artId] ? "" : "locked"}" data-art-id="${escapeHtml(art.artId)}" ${this.collection.artCollection[art.artId] ? "" : "disabled"}><img src="${escapeHtml(art.thumbnail || art.image)}" alt="${escapeHtml(selected.name)}插画" loading="lazy"></button>`).join("") || "<p class='empty-copy'>暂无插画。</p>"}</div></div></div>` : ""}
                </aside>
            </section>`;

        this.bindCollectionControls();
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
        this.screenRoot.querySelector("#craft-card")?.addEventListener("click", () => {
            const result = craftCard(this.collection, selected.id, ALL_CARDS);
            this.toast(result.success ? `制作成功：${selected.name}` : result.reason, result.success ? "success" : "error");
            if (result.success) saveData(this.collection);
            this.renderCollection();
        });
        this.screenRoot.querySelector("#dismantle-card")?.addEventListener("click", () => {
            const result = dismantleCard(this.collection, selected.id, ALL_CARDS);
            this.toast(result.success ? `分解成功：+${result.shards} ${selected.rarity}碎片` : result.reason, result.success ? "success" : "error");
            if (result.success) saveData(this.collection);
            this.renderCollection();
        });
    }

    filterCollectionCard(card) {
        const f = this.collectionFilters;
        if (f.search && !card.name.toLowerCase().includes(f.search.toLowerCase())) return false;
        if (f.member !== "all" && card.member !== f.member) return false;
        if (f.rarity !== "all" && card.rarity !== f.rarity) return false;
        if (f.type !== "all" && card.type !== f.type) return false;
        const owned = getCardCount(this.collection, card.id) > 0;
        if (f.owned === "yes" && !owned) return false;
        if (f.owned === "no" && owned) return false;
        return true;
    }

    bindCollectionControls() {
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
        const deck = this.getSelectedDeck();
        if (!this.deckDraft || resetDraft || this.deckDraft.id !== deck?.id) this.deckDraft = deck ? clone(deck) : null;
        const validation = this.deckDraft ? validateDeck(this.deckDraft, ALL_CARDS, this.collection) : { valid: false, errors: ["没有卡组"], stats: {} };
        const counts = countIds(this.deckDraft?.main || []);
        const available = NIGHTCORD_ONLY
            .filter(card => getCardCount(this.collection, card.id) > 0)
            .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name, "zh-CN"));
        const deckCards = Object.entries(counts).map(([id, count]) => ({ card: hydrateCardArt(getCardById(id), this.collection.selectedArtByCard), count })).filter(item => item.card);

        this.screenRoot.innerHTML = `
            <section class="screen-heading deck-heading"><div><span class="eyebrow">DECK CONSTRUCTION</span><h1>卡组编辑器</h1><p>从已拥有的卡牌中构筑40至60张主卡组。</p></div><div class="deck-status"><strong>${this.deckDraft?.main.length || 0}/60</strong><span class="status-pill ${validation.valid ? "ok" : "bad"}">${validation.valid ? "卡组合法" : "卡组不合法"}</span></div></section>
            <section class="deck-editor-layout">
                <div class="deck-source">
                    <div class="section-heading"><div><span class="eyebrow">OWNED CARDS</span><h2>可用卡牌</h2></div><span>${available.length}种</span></div>
                    <div class="deck-source-grid">${available.map(card => catalogCardHtml(hydrateCardArt(card, this.collection.selectedArtByCard), getCardCount(this.collection, card.id), { compact: true })).join("")}</div>
                </div>
                <div class="deck-workspace">
                    <div class="deck-name-row"><input id="deck-name-input" value="${escapeHtml(this.deckDraft?.name || "")}" aria-label="卡组名称"><button class="secondary-action" id="new-deck">新建卡组</button><button class="secondary-action" id="delete-deck" ${this.collection.decks.length <= 1 ? "disabled" : ""}>删除卡组</button><button class="secondary-action" id="reset-starter">恢复入门卡组</button></div>
                    ${validation.errors.length ? `<div class="deck-errors">${validation.errors.slice(0, 3).map(error => `<p>${escapeHtml(error)}</p>`).join("")}</div>` : ""}
                    <div class="deck-card-list">${deckCards.map(({ card, count }) => `<article class="deck-list-item" data-card-id="${escapeHtml(card.id)}">${cardArtHtml(card, "deck-list-art")}<div><span>${escapeHtml(card.rarity)} · ${escapeHtml(TYPE_NAMES[card.type])}</span><strong>${escapeHtml(card.name)}</strong></div><div class="deck-count-control"><button data-deck-remove="${escapeHtml(card.id)}">−</button><strong>${count}</strong><button data-deck-add="${escapeHtml(card.id)}">＋</button></div></article>`).join("") || "<p class='empty-copy'>卡组是空的。</p>"}</div>
                    <footer class="deck-editor-footer"><div class="deck-breakdown"><span>角色 ${validation.stats?.monsters || 0}</span><span>魔法 ${validation.stats?.spells || 0}</span><span>陷阱 ${validation.stats?.traps || 0}</span></div><button class="primary-action" id="save-deck">保存卡组</button></footer>
                </div>
            </section>`;

        this.screenRoot.querySelectorAll(".deck-source .catalog-card").forEach(card => {
            card.title = "点击加入卡组，右键查看详情";
            card.addEventListener("click", () => this.addCardToDraft(card.dataset.cardId));
            card.addEventListener("contextmenu", e => { e.preventDefault(); this.showCardDetail(getCardById(card.dataset.cardId)); });
        });
        this.screenRoot.querySelectorAll(".deck-list-item").forEach(item => {
            item.addEventListener("contextmenu", e => { e.preventDefault(); this.showCardDetail(getCardById(item.dataset.cardId)); });
        });
        this.screenRoot.querySelectorAll("[data-deck-add]").forEach(button => button.addEventListener("click", () => this.addCardToDraft(button.dataset.deckAdd)));
        this.screenRoot.querySelectorAll("[data-deck-remove]").forEach(button => button.addEventListener("click", () => this.removeCardFromDraft(button.dataset.deckRemove)));
        this.screenRoot.querySelector("#save-deck")?.addEventListener("click", () => this.saveDeckDraft());
        this.screenRoot.querySelector("#new-deck")?.addEventListener("click", () => this.createNewDeck());
        this.screenRoot.querySelector("#delete-deck")?.addEventListener("click", () => this.deleteCurrentDeck());
        this.screenRoot.querySelector("#reset-starter")?.addEventListener("click", () => {
            const source = this.collection.decks.find(item => item.id === "nightcord_starter");
            if (source) this.deckDraft = clone(source);
            this.renderDeckEditor(false);
        });
    }

    addCardToDraft(cardId) {
        if (!this.deckDraft) return;
        const count = this.deckDraft.main.filter(id => id === cardId).length;
        const owned = getCardCount(this.collection, cardId);
        if (this.deckDraft.main.length >= 60) return this.toast("主卡组最多60张", "error");
        if (count >= 3) return this.toast("同名卡最多3张", "error");
        if (count >= owned) return this.toast("拥有数量不足", "error");
        this.deckDraft.main.push(cardId);
        this.renderDeckEditor(false);
    }

    removeCardFromDraft(cardId) {
        if (!this.deckDraft) return;
        const index = this.deckDraft.main.lastIndexOf(cardId);
        if (index >= 0) this.deckDraft.main.splice(index, 1);
        this.renderDeckEditor(false);
    }

    saveDeckDraft() {
        if (!this.deckDraft) return;
        this.deckDraft.name = this.screenRoot.querySelector("#deck-name-input")?.value.trim() || "未命名卡组";
        const validation = validateDeck(this.deckDraft, ALL_CARDS, this.collection);
        if (!validation.valid) return this.toast(validation.errors[0], "error");
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
        const id = "deck_" + Date.now();
        const newDeck = { id, name: "新卡组", coverCardId: null, main: [], extra: [], side: [], createdAt: Date.now(), updatedAt: Date.now() };
        this.collection.decks.push(newDeck);
        this.collection.selectedDeckId = id;
        this.deckDraft = clone(newDeck);
        saveData(this.collection);
        this.toast("已创建新卡组", "success");
        this.renderDeckEditor(false);
    }

    deleteCurrentDeck() {
        if (!this.deckDraft || this.collection.decks.length <= 1) return;
        const index = this.collection.decks.findIndex(d => d.id === this.deckDraft.id);
        if (index < 0) return;
        this.collection.decks.splice(index, 1);
        this.collection.selectedDeckId = this.collection.decks[0]?.id || null;
        this.deckDraft = null;
        saveData(this.collection);
        this.toast("卡组已删除", "success");
        this.renderDeckEditor(true);
    }

    renderRules() {
        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">DUEL MANUAL</span><h1>决斗规则</h1><p>本项目采用游戏王式自动阶段规则：抽卡与准备阶段自动结算，玩家只需出牌、攻击和结束回合。</p></div></section>
            <section class="rules-grid">
                <article class="rule-panel"><span>01</span><h2>胜利条件</h2><p>将对方LP从8000降至0，或让对方在抽卡时无牌可抽。双方同时归零时判定平局。</p></article>
                <article class="rule-panel"><span>02</span><h2>通常召唤</h2><p>一回合仅限一次。1~4星无需祭品，5~6星解放1只怪兽，7~12星解放2只。可选攻击表示召唤或里侧守备盖放。</p></article>
                <article class="rule-panel"><span>03</span><h2>特殊召唤</h2><p>不限次数，出场可自由选择表侧状态。不占用通常召唤次数。</p></article>
                <article class="rule-panel"><span>04</span><h2>翻转召唤</h2><p>主要阶段将里侧守备怪兽翻开为表侧守备，不占通召次数，触发翻转效果，一回合不限次数。</p></article>
                <article class="rule-panel"><span>05</span><h2>攻守转换</h2><p>每只怪兽每回合只能手动变1次形态，仅限主要阶段。刚召唤/特召出场的怪兽本回合无法转换。</p></article>
                <article class="rule-panel"><span>06</span><h2>战斗阶段</h2><p>点击攻击表示怪兽会自动进入战斗阶段；选择合法目标。对方攻击里侧怪兽时自动翻开，先触发翻转效果再结算攻防。</p></article>
                <article class="rule-panel"><span>07</span><h2>共鸣机制</h2><p>己方场上存在至少两名不同Nightcord成员时，满足“共鸣”，部分卡牌获得追加效果。</p></article>
                <article class="rule-panel"><span>08</span><h2>卡组规则</h2><p>主卡组40至60张，同名卡最多3张。额外卡组最多15张，副卡组最多15张。</p></article>
            </section>`;
    }

    renderSettings() {
        const settings = this.collection.settings;
        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">SYSTEM</span><h1>设置</h1><p>视觉与操作选项保存在本地浏览器中。</p></div></section>
            <section class="settings-panel">
                <label class="setting-row"><div><strong>减少动态效果</strong><span>降低卡包和战斗中的动画强度。</span></div><input type="checkbox" id="setting-reduce" ${settings.reduceAnimations ? "checked" : ""}></label>
                <label class="setting-row"><div><strong>动画速度</strong><span>控制AI行动和界面演出的速度。</span></div><select id="setting-speed"><option value="0.7">慢速</option><option value="1">正常</option><option value="1.5">快速</option></select></label>
                <label class="setting-row"><div><strong>决斗日志</strong><span>控制战场右侧日志面板的显示。</span></div><input type="checkbox" id="setting-log" ${settings.logLevel !== 0 ? "checked" : ""}></label>
                <button class="primary-action" id="save-settings">保存设置</button>
            </section>`;
        const speed = this.screenRoot.querySelector("#setting-speed");
        speed.value = String(settings.animationSpeed || 1);
        this.screenRoot.querySelector("#save-settings")?.addEventListener("click", () => {
            settings.reduceAnimations = this.screenRoot.querySelector("#setting-reduce").checked;
            settings.animationSpeed = Number(speed.value);
            settings.logLevel = this.screenRoot.querySelector("#setting-log").checked ? 1 : 0;
            saveData(this.collection);
            document.body.classList.toggle("reduce-motion", settings.reduceAnimations);
            document.body.classList.toggle("hide-duel-log", settings.logLevel === 0);
            this.toast("设置已保存", "success");
        });
    }

    startDuel() {
        const deck = this.getSelectedDeck();
        if (!deck) return this.toast("请先选择卡组", "error");
        const validation = validateDeck(deck, ALL_CARDS, this.collection);
        if (!validation.valid) return this.toast(validation.errors[0], "error");
        this.hideShell();
        this.onStartDuel({ mode: "ai", deck });
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
