/**
 * ui.js
 * 界面层 —— 次元决斗：元素召唤
 */

import { ELEMENT_ICONS, ELEMENT_NAMES, RACE_NAMES } from "./cards.js";
import { ALL_CARDS } from "./catalog.js";
import { PHASE, GAME_CONFIG, MONSTER_POSITION } from "./constants.js";
import { addFoilShimmer } from "./effects.js?v=1.10.2-card-atlas-4x4";
import { cardEffectFieldsHtml, cardRuleStatusHtml, cardVisualEffectHtml, cardVisualImageClass, cardVisualMotionStyle, sekaiCardBackHtml } from "./card-view.js?v=1.2.0-bca";
import { emitControllerAction } from "./controller-2d.js?v=2.2.0-runtime-polish";

// 触屏设备没有 Shift 键，提示文案必须跟着输入方式切换，否则玩家会照着按不出来。
const COARSE_POINTER = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(pointer: coarse)").matches;

function cardImageHTML(card, size) {
    const attr = card.attribute || card.element || "none";
    const icon = ELEMENT_ICONS[attr] || "?";
    const letter = card.name ? card.name[0] : "?";
    const colors = { fire: ["#1a0505", "#8b1a1a"], water: ["#050a1a", "#1a3d8b"], wind: ["#051a0a", "#1a8b3d"], earth: ["#1a1005", "#8b5a1a"], light: ["#1a1a05", "#8b8b1a"], dark: ["#0a051a", "#3d1a8b"], none: ["#111", "#333"] };
    const [c1, c2] = colors[attr] || colors.none;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120"><defs><linearGradient id="bg_${card.instanceId || card.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="120" height="120" fill="url(#bg_${card.instanceId || card.id})" rx="8"/><text x="60" y="45" text-anchor="middle" font-size="32">${icon}</text><text x="60" y="85" text-anchor="middle" font-size="18" fill="rgba(255,255,255,0.9)" font-weight="bold">${letter}</text></svg>`;
}

function escapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function getCardImageHTML(card, size = 120) {
    const img = card.image || card.thumbnail;
    const position = escapeAttr(card.objectPosition || "center");
    const effect = cardVisualEffectHtml(card);
    const fallback = escapeAttr(card.originalImage || "");
    if (img) return `<img src="${escapeAttr(img)}" data-fallback-src="${fallback}" alt="${escapeAttr(card.name)}" class="card-img ${cardVisualImageClass(card)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;object-position:${position};${cardVisualMotionStyle(card)}"><div class="card-img-fallback" style="display:none;width:100%;height:100%">${cardImageHTML(card, size)}</div>${effect}`;
    return `<div class="card-img-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${cardImageHTML(card, size)}</div>${effect}`;
}

const PHASE_NAMES = { waiting: "等待", draw: "抽卡阶段", standby: "准备阶段", main_1: "主要阶段1", battle: "战斗阶段", main_2: "主要阶段2", end: "结束阶段", target_select: "选择目标", graveyard_select: "选择墓地", tribute_select: "选择祭品" };
const PHASE_ORDER = ["draw", "standby", "main_1", "battle", "main_2", "end"];

export class GameUI {
    constructor() {
        this.menuScreen = document.querySelector("#app-shell");
        this.battleScreen = document.querySelector("#battle-screen");
        this.handElement = document.querySelector("#hand");
        this.opponentHandElement = document.querySelector("#opponent-hand");
        this.battlefield = document.querySelector("#battlefield");
        this.turnBadge = document.querySelector("#turn-badge");
        this.logBody = document.querySelector("#log-body");
        this.playerDeckCount = document.querySelector("#player-deck-count");
        this.opponentDeckCount = document.querySelector("#opponent-deck-count");
        this.playerGraveyardCount = document.querySelector("#player-graveyard-count");
        this.opponentGraveyardCount = document.querySelector("#opponent-graveyard-count");
        this.visibleHandCount = document.querySelector("#visible-hand-count");
        this.drawBanner = document.querySelector("#draw-banner");
        this.drawBannerLabel = document.querySelector("#draw-banner-label");
        this.drawBannerName = document.querySelector("#draw-banner-name");
        this.drawTimer = null;
        this.aiActionTimer = null;
        // 主控信号基线：showBattle() 每次新决斗会重置，首帧只建立基线不触发动画。
        this._controllerLp = null;
        this._controllerLowHp = false;
        this.aiActionPreview = document.createElement("div");
        this.aiActionPreview.className = "ai-action-preview";
        this.aiActionPreview.setAttribute("aria-live", "polite");
        this.aiActionPreview.setAttribute("aria-atomic", "true");
        document.body.appendChild(this.aiActionPreview);
        this.floatContainer = document.createElement("div");
        this.floatContainer.className = "float-container";
        document.body.appendChild(this.floatContainer);
        this._createHandoffOverlay();
        this._createGraveyardOverlay();
        this._createTributeOverlay();
        this._createCardActionOverlay();
        this._createFirstPlayerOverlay();
        this._createDiscardOverlay();
        this._createMulliganOverlay();
        this._createZoneViewerOverlay();
        this._bindDetailOverlay();
        this._bindZoneViewers();
        this._bindImageFallbacks();
        this._initArenaEffects();
        this._logEntries = [];
        this._createLogFullscreen();
    }

    _createLogFullscreen() {
        this.logFullscreen = document.createElement("div");
        this.logFullscreen.className = "log-fullscreen";
        this.logFullscreen.innerHTML = `
            <div class="log-fullscreen-header">
                <h2>DUEL LOG</h2>
                <button class="log-fullscreen-close" id="log-fullscreen-close" type="button" aria-label="关闭">×</button>
            </div>
            <div class="log-fullscreen-body" id="log-fullscreen-body"></div>`;
        document.body.appendChild(this.logFullscreen);
        this.logFullscreen.querySelector("#log-fullscreen-close").addEventListener("click", () => this.closeLogFullscreen());
        this.logFullscreen.addEventListener("click", e => { if (e.target === this.logFullscreen) this.closeLogFullscreen(); });
        // 点击迷你日志面板 → 打开全屏（收起按钮与全屏日志自身不触发）
        const logPanel = document.querySelector(".log-panel");
        if (logPanel) logPanel.addEventListener("click", event => {
            if (event.target?.closest?.("#log-collapse-inline, #log-toggle")) return;
            if (this.logFullscreen.classList.contains("active")) return;
            this.openLogFullscreen();
        });
    }

    openLogFullscreen() {
        const body = this.logFullscreen.querySelector("#log-fullscreen-body");
        body.innerHTML = "";
        for (const entry of this._logEntries) {
            const el = document.createElement("div");
            el.className = `log-entry-v2${entry.card ? " has-card" : ""}${entry.report ? " has-report" : ""}`;
            let thumbHtml = `<div class="log-thumb-placeholder">◆</div>`;
            const cardMatch = entry.msg.match(/【(.+?)】/) || entry.msg.match(/「(.+?)」/);
            const card = entry.card || (cardMatch ? ALL_CARDS?.find(item => item.name === cardMatch[1]) : null);
            if (card?.image) {
                thumbHtml = `<img src="${this._esc(card.image)}" alt="${this._esc(card.name)}" loading="lazy">`;
            }
            const stats = card?.type === "monster"
                ? `<span>★${Number(card.level || 0)}</span><span>ATK ${Number(card.attack || 0)}</span><span>DEF ${Number(card.defense || 0)}</span>`
                : "";
            const effectTexts = card
                ? [...new Set([card.description, ...(card.effects || []).map(effect => effect?.description)].filter(Boolean))]
                : [];
            const detailsHtml = card ? `
                <div class="log-card-details">
                    <div class="log-card-heading">
                        <strong>${this._esc(card.name)}</strong>
                        <span>${this._esc((card.rarity || "N").toUpperCase())} · ${this._esc(card.type || "card")}</span>
                        ${entry.private ? `<em>仅自己可见</em>` : ""}
                    </div>
                    ${stats ? `<div class="log-card-stats">${stats}</div>` : ""}
                    <div class="log-card-effects">${effectTexts.length
                        ? effectTexts.map(text => `<p>${this._esc(text)}</p>`).join("")
                        : "<p>无额外效果说明</p>"}</div>
                    <div class="log-expand-hint">点击收起卡牌详情</div>
                </div>` : "";
            el.innerHTML = `
                <div class="log-card-thumb">${thumbHtml}</div>
                <div class="log-content">
                    <div class="log-turn">TURN ${entry.turn}</div>
                    <div class="log-msg ${entry.type || ""}">${this._esc(entry.msg)}</div>
                    ${detailsHtml}
                    ${entry.report ? `<details class="log-settlement"><summary>查看结算明细</summary><ol>${entry.report.lines.map(line => `<li>${this._esc(line)}</li>`).join("")}</ol></details>` : ""}
                </div>`;
            if (card) {
                el.classList.add("expanded");
                el.addEventListener("click", event => { if (!event.target.closest(".log-settlement")) el.classList.toggle("expanded"); });
            }
            body.appendChild(el);
        }
        body.scrollTop = body.scrollHeight;
        this.logFullscreen.classList.add("active");
    }

    closeLogFullscreen() {
        this.logFullscreen.classList.remove("active");
    }

    _initArenaEffects() {
        if (typeof document === "undefined") return;
        const bs = this.battleScreen;
        if (!bs) return;

        // 中央能量核心
        const core = document.createElement("div");
        core.className = "battlefield-center-glow";
        bs.appendChild(core);

        // 浮动粒子层
        const particleLayer = document.createElement("div");
        particleLayer.className = "duel-particles";
        bs.appendChild(particleLayer);
        this._spawnAmbientParticles(particleLayer);
    }

    _spawnAmbientParticles(layer) {
        if (!layer || typeof document === "undefined") return;
        const colors = [
            "rgba(85,216,229,.35)", "rgba(123,114,255,.3)",
            "rgba(92,224,178,.25)", "rgba(199,125,255,.2)",
            "rgba(255,211,107,.15)",
        ];
        for (let i = 0; i < 18; i++) {
            const p = document.createElement("div");
            p.className = "duel-particle";
            const size = 2 + Math.random() * 4;
            const dur = 6 + Math.random() * 10;
            const delay = Math.random() * dur;
            const left = Math.random() * 100;
            const drift = (Math.random() - 0.5) * 80;
            const maxOp = 0.15 + Math.random() * 0.3;
            const color = colors[Math.floor(Math.random() * colors.length)];
            p.style.cssText = `
                width:${size}px; height:${size}px;
                left:${left}%; bottom:-10px;
                background:${color};
                --dur:${dur}s; --drift:${drift}px; --max-op:${maxOp};
                animation-delay:${delay}s;
            `;
            layer.appendChild(p);
        }
    }

    /** 观星：展示牌库顶卡牌、调整顺序，并以叠回牌库的动画确认。 */
    showDeckOrdering(cards, onConfirm, { interactive = true, deckId = "player-deck-pile" } = {}) {
        if (typeof document === "undefined" || !Array.isArray(cards) || !cards.length) {
            onConfirm?.(cards || []);
            return;
        }
        this.deckOrderOverlay?.remove();
        const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const ordered = [...cards];
        const overlay = document.createElement("div");
        overlay.className = "overlay deck-order-overlay active";
        overlay.innerHTML = `
            <section class="deck-order-panel" role="dialog" aria-modal="true" aria-labelledby="deck-order-title">
                <header><small>${interactive ? "DECK FORECAST" : "OPPONENT FORECAST"}</small><h2 id="deck-order-title">${interactive ? "调整牌库顶顺序" : "对手正在观星"}</h2><p>${interactive ? "左侧是下一张抽到的卡。拖动卡牌，或使用箭头调整；右键卡牌可查看完整详情。" : "卡面仅对发动者可见。"}</p></header>
                <div class="deck-order-list" role="list"></div>
                <footer><span class="deck-order-status" aria-live="polite">${interactive ? `已展示 ${cards.length} 张卡` : "正在重新排列牌库……"}</span>${interactive ? '<button type="button" class="primary-action deck-order-confirm">确认顺序</button>' : ""}</footer>
            </section>`;
        document.body.appendChild(overlay);
        document.body.classList.add("battle-modal-open");
        this.deckOrderOverlay = overlay;
        const list = overlay.querySelector(".deck-order-list");
        const render = () => {
            list.innerHTML = ordered.map((card, index) => `
                <article class="deck-order-card rarity-${escapeAttr(card.rarity || "N")}" role="listitem" draggable="${interactive}" data-order-index="${index}" data-order-position="${index + 1}" tabindex="0">
                    <div class="deck-order-art">${interactive ? getCardImageHTML(card, 180) : `<div class="deck-order-back">${sekaiCardBackHtml()}</div>`}</div>
                    <strong>${interactive ? escapeAttr(card.name) : "隐藏卡牌"}</strong>
                    <small>${interactive ? `${escapeAttr(card.rarity || "N")} · ${escapeAttr(card.type || "card")}` : `第 ${index + 1} 张`}</small>
                    ${interactive ? `<div class="deck-order-controls"><button type="button" data-move="left" aria-label="向前移动" ${index === 0 ? "disabled" : ""}>←</button><b>${index + 1}</b><button type="button" data-move="right" aria-label="向后移动" ${index === ordered.length - 1 ? "disabled" : ""}>→</button></div>` : ""}
                </article>`).join("");
            if (!reduced) list.querySelectorAll(".deck-order-card").forEach((el, index) => el.animate([
                { opacity: 0, transform: "translateY(28px) rotateY(70deg) scale(.9)" },
                { opacity: 1, transform: "translateY(0) rotateY(0) scale(1)" },
            ], { duration: 420, delay: index * 80, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }));
            bindCards();
        };
        const moveCard = (from, to) => {
            if (to < 0 || to >= ordered.length || from === to) return;
            const [card] = ordered.splice(from, 1);
            ordered.splice(to, 0, card);
            render();
            overlay.querySelector(".deck-order-status").textContent = `下一张将抽到「${ordered[0].name}」`;
        };
        let dragged = -1;
        const bindCards = () => list.querySelectorAll(".deck-order-card").forEach((el, index) => {
            el.querySelectorAll("[data-move]").forEach(button => button.addEventListener("click", () => moveCard(index, index + (button.dataset.move === "left" ? -1 : 1))));
            // 右键查看完整卡牌详情：不知道卡的效果就没法决定怎么排序
            el.addEventListener("contextmenu", event => {
                event.preventDefault();
                if (interactive) this.showDetail(ordered[index]);
            });
            el.addEventListener("dragstart", event => { dragged = index; el.classList.add("is-dragging"); event.dataTransfer?.setData("text/plain", String(index)); });
            el.addEventListener("dragend", () => { dragged = -1; el.classList.remove("is-dragging"); });
            el.addEventListener("dragover", event => { if (interactive) event.preventDefault(); });
            el.addEventListener("drop", event => { event.preventDefault(); if (dragged >= 0) moveCard(dragged, index); });
        });
        const finish = () => {
            const target = document.getElementById(deckId);
            const targetRect = target?.getBoundingClientRect();
            const cardEls = [...list.querySelectorAll(".deck-order-card")];
            const animations = reduced ? [] : cardEls.map((el, index) => {
                const rect = el.getBoundingClientRect();
                const dx = targetRect ? targetRect.left + targetRect.width / 2 - (rect.left + rect.width / 2) : 0;
                const dy = targetRect ? targetRect.top + targetRect.height / 2 - (rect.top + rect.height / 2) : 80;
                return el.animate([
                    { opacity: 1, transform: "translate(0,0) scale(1)" },
                    { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(.18) rotate(8deg)` },
                ], { duration: 520, delay: index * 65, easing: "cubic-bezier(.4,0,.8,.2)", fill: "forwards" }).finished;
            });
            Promise.allSettled(animations).then(() => {
                overlay.remove();
                if (this.deckOrderOverlay === overlay) this.deckOrderOverlay = null;
                document.body.classList.remove("battle-modal-open");
                onConfirm?.([...ordered]);
            });
        };
        overlay.querySelector(".deck-order-confirm")?.addEventListener("click", finish);
        render();
        if (!interactive) setTimeout(finish, reduced ? 250 : 900 + cards.length * 80);
    }

    /** 展示抽取：展示卡组顶 N 张卡，玩家点选 1 张加入手牌（默认选中引擎的默认卡）。 */
    showDeckSearch(cards, chosen, onPick, eligible = cards) {
        if (typeof document === "undefined" || !Array.isArray(cards) || !cards.length) {
            onPick?.(null);
            return;
        }
        this.deckOrderOverlay?.remove();
        const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let picked = chosen && cards.includes(chosen) ? chosen : null;
        const overlay = document.createElement("div");
        overlay.className = "overlay deck-order-overlay active";
        overlay.innerHTML = `
            <section class="deck-order-panel" role="dialog" aria-modal="true" aria-labelledby="deck-search-title">
                <header><small>DECK SEARCH</small><h2 id="deck-search-title">选择 1 张加入手牌</h2><p>展示的是卡组顶的卡。仅可选择符合卡面条件的亮起卡牌，右键可查看完整详情，确认后其余的按原顺序放回卡组底。</p></header>
                <div class="deck-order-list" role="list"></div>
                <footer><span class="deck-order-status" aria-live="polite"></span><button type="button" class="primary-action deck-order-confirm">确认选择</button></footer>
            </section>`;
        document.body.appendChild(overlay);
        document.body.classList.add("battle-modal-open");
        this.deckOrderOverlay = overlay;
        const list = overlay.querySelector(".deck-order-list");
        const status = overlay.querySelector(".deck-order-status");
        const render = () => {
            list.innerHTML = cards.map((card, index) => {
                const active = card === picked;
                const allowed = eligible.includes(card);
                return `
                <article class="deck-order-card rarity-${escapeAttr(card.rarity || "N")}${active ? " is-picked" : ""}" role="listitem" data-search-index="${index}" aria-disabled="${!allowed}" tabindex="${allowed ? 0 : -1}" style="opacity:${allowed ? 1 : .4};cursor:${allowed ? "pointer" : "not-allowed"};${active ? "outline:2px solid #55d8e5;outline-offset:-2px;" : ""}">
                    <div class="deck-order-art">${getCardImageHTML(card, 180)}</div>
                    <strong>${escapeAttr(card.name)}</strong>
                    <small>${escapeAttr(card.rarity || "N")} · ${escapeAttr(card.type || "card")}${card === chosen ? " · 默认" : ""}</small>
                </article>`;
            }).join("");
            status.textContent = picked ? `已选择「${picked.name}」` : "点击一张卡以选择";
            if (!reduced) list.querySelectorAll(".deck-order-card").forEach((el, index) => el.animate([
                { opacity: 0, transform: "translateY(28px) rotateY(70deg) scale(.9)" },
                { opacity: 1, transform: "translateY(0) rotateY(0) scale(1)" },
            ], { duration: 420, delay: index * 80, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }));
        list.querySelectorAll("[data-search-index]").forEach(el => {
            const pick = () => {
                const index = Number(el.dataset.searchIndex), card = cards[index];
                if (!eligible.includes(card)) return;
                picked = card; render();
                const selected = list.querySelector(`[data-search-index="${index}"]`);
                selected.focus({ preventScroll: true });
                selected.scrollIntoView({ block: "nearest", inline: "nearest" });
            };
            el.addEventListener("click", pick);
            el.addEventListener("contextmenu", event => { event.preventDefault(); this.showDetail(cards[Number(el.dataset.searchIndex)]); });
            el.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } });
        });
        };
        const finish = () => {
            overlay.remove();
            if (this.deckOrderOverlay === overlay) this.deckOrderOverlay = null;
            document.body.classList.remove("battle-modal-open");
            onPick?.(picked);
        };
        overlay.querySelector(".deck-order-confirm").addEventListener("click", finish);
        render();
    }

    _createFirstPlayerOverlay() {
        this.firstPlayerOverlay = document.createElement("div");
        this.firstPlayerOverlay.className = "overlay first-player-overlay";
        this.firstPlayerOverlay.innerHTML = `
            <section class="first-player-panel" role="dialog" aria-modal="true">
                <span class="eyebrow">ROCK PAPER SCISSORS</span>
                <h2>猜拳决定先后手</h2>
                <p id="rps-result">请选择石头、剪刀或布</p>
                <div class="rps-actions">
                    <button type="button" data-rps="rock">石头</button>
                    <button type="button" data-rps="scissors">剪刀</button>
                    <button type="button" data-rps="paper">布</button>
                </div>
                <div class="turn-choice-actions" id="turn-choice-actions" hidden>
                    <button type="button" class="primary-action" data-turn-choice="0">选择先攻</button>
                    <button type="button" class="secondary-action" data-turn-choice="1">选择后攻</button>
                </div>
            </section>`;
        document.body.appendChild(this.firstPlayerOverlay);
    }

    showFirstPlayerChoice(callback) {
        const choices = ["rock", "scissors", "paper"];
        const labels = { rock: "石头", scissors: "剪刀", paper: "布" };
        const beats = { rock: "scissors", scissors: "paper", paper: "rock" };
        const result = this.firstPlayerOverlay.querySelector("#rps-result");
        const turnChoices = this.firstPlayerOverlay.querySelector("#turn-choice-actions");
        this.firstPlayerOverlay.classList.add("active");
        turnChoices.hidden = true;
        result.textContent = "请选择石头、剪刀或布";
        this.firstPlayerOverlay.querySelectorAll("[data-rps]").forEach(button => {
            button.disabled = false;
            button.onclick = () => {
                const human = button.dataset.rps;
                const ai = choices[Math.floor(Math.random() * choices.length)];
                if (human === ai) {
                    result.textContent = `双方都是${labels[human]}，平局，请再来一次`;
                    return;
                }
                const humanWins = beats[human] === ai;
                result.textContent = `你出${labels[human]}，AI出${labels[ai]}：${humanWins ? "你获胜" : "AI获胜"}`;
                this.firstPlayerOverlay.querySelectorAll("[data-rps]").forEach(item => item.disabled = true);
                if (humanWins) {
                    turnChoices.hidden = false;
                } else {
                    setTimeout(() => {
                        this.firstPlayerOverlay.classList.remove("active");
                        callback(1);
                    }, 700);
                }
            };
        });
        turnChoices.querySelectorAll("[data-turn-choice]").forEach(button => {
            button.onclick = () => {
                const choice = Number(button.dataset.turnChoice);
                this.firstPlayerOverlay.classList.remove("active");
                callback(choice === 0 ? 0 : 1);
            };
        });
    }

    _createDiscardOverlay() {
        this.discardOverlay = document.createElement("div");
        this.discardOverlay.className = "overlay discard-overlay";
        this.discardOverlay.innerHTML = `
            <section class="discard-panel" role="dialog" aria-modal="true">
                <span class="eyebrow">END PHASE</span>
                <h2 id="discard-title">请选择要丢弃的手牌</h2>
                <p id="discard-hint"></p>
                <div class="discard-grid" id="discard-grid"></div>
                <button type="button" class="primary-action" id="discard-confirm" disabled>确认丢弃</button>
            </section>`;
        document.body.appendChild(this.discardOverlay);
    }

    showDiscardSelection(hand, count, callback) {
        const selected = new Set();
        const title = this.discardOverlay.querySelector("#discard-title");
        const hint = this.discardOverlay.querySelector("#discard-hint");
        const grid = this.discardOverlay.querySelector("#discard-grid");
        const confirm = this.discardOverlay.querySelector("#discard-confirm");
        title.textContent = `结束阶段：请选择${count}张手牌丢弃`;
        const update = () => {
            hint.textContent = `已选择 ${selected.size}/${count} 张；右键卡牌可查看完整详情。结束阶段手牌必须保留至${GAME_CONFIG.END_HAND_LIMIT}张`;
            confirm.disabled = selected.size !== count;
        };
        grid.replaceChildren();
        hand.forEach(card => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "discard-card";
            button.innerHTML = `<div class="card discard-card-view">${this.cardHTML(card)}</div>`;
            button.addEventListener("click", () => {
                if (selected.has(card.instanceId)) {
                    selected.delete(card.instanceId);
                    button.classList.remove("selected");
                } else if (selected.size < count) {
                    selected.add(card.instanceId);
                    button.classList.add("selected");
                }
                update();
            });
            button.addEventListener("contextmenu", event => {
                // 弃哪一张完全取决于完整效果文本，看不到详情等于盲选
                event.preventDefault();
                this.showDetail(card);
            });
            grid.appendChild(button);
        });
        confirm.onclick = () => {
            if (selected.size !== count) return;
            this.discardOverlay.classList.remove("active");
            callback([...selected]);
        };
        update();
        this.discardOverlay.classList.add("active");
    }

    _createMulliganOverlay() {
        this.mulliganOverlay = document.createElement("div");
        this.mulliganOverlay.className = "overlay discard-overlay mulligan-overlay";
        this.mulliganOverlay.innerHTML = `
            <section class="discard-panel" role="dialog" aria-modal="true">
                <span class="eyebrow">OPENING HAND</span>
                <h2 id="mulligan-title">起手手牌</h2>
                <p id="mulligan-hint"></p>
                <div class="discard-grid" id="mulligan-grid"></div>
                <div class="modal-actions">
                    <button type="button" class="primary-action" id="mulligan-keep">保留手牌</button>
                    <button type="button" class="secondary-action" id="mulligan-redraw">重抽一次</button>
                </div>
            </section>`;
        document.body.appendChild(this.mulliganOverlay);
    }

    /**
     * 起手重抽：展示 5 张起手手牌，玩家决定保留还是重抽（每局一次）。
     * @param {object[]} hand 当前起手手牌
     * @param {(redraw:boolean)=>void} callback 选择结果
     */
    showMulliganChoice(hand, callback) {
        const hint = this.mulliganOverlay.querySelector("#mulligan-hint");
        const grid = this.mulliganOverlay.querySelector("#mulligan-grid");
        const hasPlayable = hand.some(card => card.type === "monster" && (Number(card.level) || 0) <= 4)
            || hand.some(card => card.type === "spell");
        const baseHint = hasPlayable
            ? "本局可以重抽一次：把手牌洗回卡组后重新抽 5 张。"
            : "这张起手没有能立刻打出的牌（没有 4 星以下怪兽，也没有魔法）——建议重抽。";
        hint.textContent = `${baseHint} 右键任意卡牌可查看完整详情。`;
        grid.replaceChildren();
        hand.forEach(card => {
            const button = document.createElement("div");
            button.className = "discard-card";
            button.innerHTML = `<div class="card discard-card-view">${this.cardHTML(card)}</div>`;
            // 右键查看完整卡牌详情：与场上手牌 / 选靶浮层的交互保持一致。
            button.querySelector(".card")?.addEventListener("contextmenu", event => {
                event.preventDefault();
                this.showDetail(card);
            });
            grid.appendChild(button);
        });
        const finish = redraw => {
            this.mulliganOverlay.classList.remove("active");
            callback(redraw);
        };
        this.mulliganOverlay.querySelector("#mulligan-keep").onclick = () => finish(false);
        this.mulliganOverlay.querySelector("#mulligan-redraw").onclick = () => finish(true);
        this.mulliganOverlay.classList.add("active");
    }

    _bindDetailOverlay() {
        this.detailOverlay = document.getElementById("detail-overlay");
        this.detailOverlay?.querySelectorAll("#detail-close, [data-detail-close]").forEach(close => {
            close.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                this.hideDetail();
            });
        });
        this.detailOverlay?.addEventListener("click", event => {
            if (event.target === this.detailOverlay || event.target.closest("[data-detail-close]")) this.hideDetail();
        });
        this.detailOverlay?.querySelector(".detail-panel")?.addEventListener("click", event => event.stopPropagation());
    }

    /** 陷阱响应确认：列出可发动的盖放陷阱，勾选后由控制器继续结算。 */
    showTrapConfirm(traps, onConfirm) {
        if (typeof document === "undefined" || !Array.isArray(traps) || !traps.length) {
            onConfirm?.([]);
            return;
        }
        this.trapConfirmOverlay?.remove();
        const overlay = document.createElement("div");
        overlay.className = "overlay trap-confirm-overlay active";
        overlay.innerHTML = `
            <section class="deck-order-panel trap-confirm-panel" role="dialog" aria-modal="true" aria-labelledby="trap-confirm-title">
                <header><small>TRAP RESPONSE</small><h2 id="trap-confirm-title">陷阱响应</h2><p>你后场的盖放陷阱满足发动条件。勾选要发动的陷阱，未勾选的会保留在后场。</p></header>
                <div class="trap-confirm-list" role="list"></div>
                <footer><span class="deck-order-status">右键卡牌可查看完整详情</span><button type="button" class="primary-action trap-confirm-apply">确认</button></footer>
            </section>`;
        document.body.appendChild(overlay);
        document.body.classList.add("battle-modal-open");
        this.trapConfirmOverlay = overlay;
        const list = overlay.querySelector(".trap-confirm-list");
        list.innerHTML = traps.map(trap => `
            <label class="trap-confirm-item" role="listitem">
                <input type="checkbox" checked data-trap-id="${escapeAttr(trap.instanceId || trap.id)}">
                <div class="trap-confirm-art">${getCardImageHTML(trap, 96)}</div>
                <div class="trap-confirm-text">
                    <strong>${escapeAttr(trap.name || "陷阱")}</strong>
                    <small>${escapeAttr(trap.description || "")}</small>
                </div>
            </label>`).join("");
        list.querySelectorAll(".trap-confirm-art").forEach((el, index) => {
            el.addEventListener("contextmenu", event => {
                event.preventDefault();
                this.showDetail(traps[index]);
            });
        });
        overlay.querySelector(".trap-confirm-apply").addEventListener("click", () => {
            const selected = [...overlay.querySelectorAll("input[data-trap-id]:checked")].map(el => el.dataset.trapId);
            overlay.remove();
            if (this.trapConfirmOverlay === overlay) this.trapConfirmOverlay = null;
            document.body.classList.remove("battle-modal-open");
            onConfirm?.(selected);
        });
    }

    _createCardActionOverlay() {
        this.cardActionOverlay = document.createElement("div");
        this.cardActionOverlay.className = "overlay card-action-overlay";
        this.cardActionOverlay.id = "card-action-overlay";
        this.cardActionOverlay.innerHTML = `
            <section class="card-action-panel" role="dialog" aria-modal="true" aria-labelledby="card-action-name">
                <button type="button" class="modal-close" data-card-action-close aria-label="关闭">×</button>
                <div class="card-action-preview" id="card-action-preview"></div>
                <div class="card-action-copy">
                    <span class="eyebrow">SELECT ACTION</span>
                    <h2 id="card-action-name"></h2>
                    <div class="card-action-buttons" id="card-action-buttons"></div>
                    <details class="card-action-rules" open><summary>技能说明与代价</summary><div class="card-action-effects" id="card-action-description"></div></details>
                    <button type="button" class="secondary-action card-action-cancel" data-card-action-close>取消</button>
                </div>
            </section>`;
        document.body.appendChild(this.cardActionOverlay);
        this.cardActionOverlay.addEventListener("click", event => {
            if (event.target === this.cardActionOverlay || event.target.closest("[data-card-action-close]")) this.hideCardActions();
        });
    }

    closeTopOverlay() {
        if (this.cardActionOverlay?.classList.contains("active")) { this.hideCardActions(); return true; }
        if (this.detailOverlay?.classList.contains("active")) { this.hideDetail(); return true; }
        if (this.tributeOverlay?.classList.contains("active")) { return false; }
        if (this.graveyardOverlay?.classList.contains("active")) { return false; }
        return false;
    }

    hideCardActions() {
        this.cardActionOverlay?.classList.remove("active");
        document.body.classList.remove("battle-modal-open");
    }

    _showCardActions(card, index, handlers, canPlay, gs) {
        if (!this.cardActionOverlay) return;
        const preview = this.cardActionOverlay.querySelector("#card-action-preview");
        const name = this.cardActionOverlay.querySelector("#card-action-name");
        const description = this.cardActionOverlay.querySelector("#card-action-description");
        const buttons = this.cardActionOverlay.querySelector("#card-action-buttons");
        preview.innerHTML = `<div class="card action-card">${this.cardHTML(card)}</div>`;
        name.textContent = card.name || "未知卡牌";
        description.innerHTML = cardEffectFieldsHtml(card);
        this.cardActionOverlay.querySelector(".card-action-rules").open = !window.matchMedia?.("(pointer: coarse)")?.matches;
        buttons.replaceChildren();

        const addAction = (label, className, callback, availability = null) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = className;
            button.textContent = label;
            if (availability && !availability.canActivate) { button.disabled = true; button.title = availability.reason; }
            button.addEventListener("click", () => {
                this.hideCardActions();
                callback();
            });
            buttons.appendChild(button);
            if (availability) {
                const hint = document.createElement("small");
                hint.className = "skill-availability"; hint.id = `skill-availability-${buttons.children.length}`;
                hint.textContent = availability.reason; button.setAttribute("aria-describedby", hint.id); buttons.appendChild(hint);
            }
        };

        if (canPlay && card.type === "monster") {
            addAction("攻击表示召唤", "primary-action", () => handlers.onSummon(index, MONSTER_POSITION.ATTACK, false));
            addAction("里侧守备盖放", "secondary-action", () => handlers.onSetCard(index));
        } else if (canPlay && card.type === "spell") {
            addAction("发动魔法", "primary-action", () => handlers.onPlayCard(index));
            addAction("盖放魔法", "secondary-action", () => handlers.onSetCard(index));
        } else if (canPlay && card.type === "trap") {
            addAction("盖放陷阱", "primary-action", () => handlers.onSetCard(index));
        }

        // 场上判定必须以当前游戏状态为准：card._onField 是历史标记，怪兽被弹回手牌后
        // 它不会被清除，手牌面板就会错误地提供「翻转召唤 / 变更表示」等只对场上怪兽
        // 有效的操作（其中一部分会先在引擎里支付代价，导致手牌被静默丢弃）。
        const onField = !!(gs?.players?.some(player =>
            player.monsterZone?.includes(card) || player.spellTrapZone?.includes(card)));

        if (onField && card.type === "monster" && card.faceUp && card.canAttack && !card.cannotAttack && card.position === MONSTER_POSITION.ATTACK
            && !gs.firstTurn && !gs.gameOver && [PHASE.MAIN_1, PHASE.BATTLE].includes(gs.phase)) {
            addAction("选择攻击", "primary-action", () => handlers.onSelectAttacker(card));
        }
        // 场上怪兽操作（翻转召唤 / 手动变更形态 / 发动效果）
        if (onField && card.type === "monster") {
            if (!card.faceUp && card.position === MONSTER_POSITION.DEFENSE) {
                addAction("翻转召唤", "primary-action", () => handlers.onFlipSummon(card));
            }
            const summonTurnBlocked = card.setTurn === gs?.turn && !GAME_CONFIG.ALLOW_SUMMON_TURN_POSITION_CHANGE;
            if (card.faceUp && !card.hasAttackedThisTurn && !card.positionChangedThisTurn && !summonTurnBlocked) {
                const newPos = card.position === MONSTER_POSITION.ATTACK ? "守备表示" : "攻击表示";
                addAction(`变为${newPos}`, "secondary-action", () => handlers.onChangePosition(card));
            } else if (card.faceUp && !card.hasAttackedThisTurn && !card.positionChangedThisTurn && summonTurnBlocked) {
                // 规则限制可见化：当回合召唤/盖放的怪兽不能变更表示形式（游戏王大师规则），
                // 否则玩家会以为「转为防守」功能消失了。
                const hint = document.createElement("p");
                hint.className = "set-spell-hint";
                hint.textContent = "本回合召唤的怪兽不能变更表示形式，下个回合起可以转为守备/攻击。";
                buttons.appendChild(hint);
            }
            // 可发动的手动效果（一回合一次）
            if (card.faceUp && card.rulesVersion) {
                card.effects.forEach((effect, effectIndex) => {
                    if (effect.trigger === "manual") addAction(effect.skillName, "primary-action", () => handlers.onActivateMonsterEffect(card, effectIndex), handlers.getMonsterEffectAvailability?.(card, effectIndex));
                });
            } else if (card.faceUp && card.effects?.some(e => e.trigger === "manual") && !card.oncePerTurnUsed) {
                addAction("发动效果", "primary-action", () => handlers.onActivateMonsterEffect(card));
            }
        }
        if (onField && card.type === "spell" && card.faceDown) {
            const activation = handlers.canActivateSetSpell?.(card);
            if (activation?.canActivate) {
                addAction("翻开发动", "primary-action", () => handlers.onActivateSetSpell(card));
            } else if (activation?.reason) {
                const hint = document.createElement("p");
                hint.className = "set-spell-hint";
                hint.textContent = activation.reason;
                buttons.appendChild(hint);
            }
        }
        if (onField && card.type === "trap" && card.faceDown) {
            const activation = handlers.canActivateTrapManually?.(card);
            if (activation?.canActivate) {
                addAction("主动翻开", "primary-action", () => handlers.onActivateSetTrap(card));
            } else if (activation?.reason) {
                const hint = document.createElement("p");
                hint.className = "set-spell-hint";
                hint.textContent = activation.reason;
                buttons.appendChild(hint);
            }
        }
        addAction("查看完整详情", "secondary-action", () => this.showDetail(card));
        this.cardActionOverlay.classList.add("active");
        document.body.classList.add("battle-modal-open");
    }

    showAiAction(card, message = "AI ACTION") {
        if (!card || card.faceDown) return;
        clearTimeout(this.aiActionTimer);
        const label = message === "AI ATTACK" ? "对手发动攻击" : message === "AI SUMMON"
            ? "对手召唤" : message === "AI SPELL" ? "对手发动魔法" : message === "AI SKILL"
                ? "对手发动技能" : "对手出牌";
        this.aiActionPreview.innerHTML = `
            <div class="ai-action-preview-copy"><small>OPPONENT ACTION</small><strong>${escapeAttr(label)}</strong></div>
            <div class="ai-action-preview-card">${this.cardHTML(card)}</div>
            <span class="ai-action-preview-name">${escapeAttr(card.name)}</span>`;
        this.aiActionPreview.classList.remove("active");
        // Restart the entrance even when two actions resolve close together.
        void this.aiActionPreview.offsetWidth;
        this.aiActionPreview.classList.add("active");
        const compact = window.matchMedia?.("(max-width: 720px)").matches;
        this.aiActionTimer = setTimeout(() => this.aiActionPreview.classList.remove("active"), compact ? 850 : 1450);
    }

    _bindImageFallbacks() {
        document.addEventListener("error", (e) => {
            if (e.target.tagName === "IMG" && e.target.classList.contains("card-img")) {
                if (e.target.dataset.retryAttempted !== "true") {
                    e.target.dataset.retryAttempted = "true";
                    // 卡图默认走 WebP 缩略图；若该文件缺失，先回退到原始图片
                    // （data-fallback-src，来自 card.originalImage），保证画面不空。
                    const fallbackSrc = e.target.dataset.fallbackSrc;
                    if (fallbackSrc && fallbackSrc !== e.target.getAttribute("src")) {
                        e.target.src = fallbackSrc;
                        return;
                    }
                    const original = e.target.currentSrc || e.target.src;
                    const separator = original.includes("?") ? "&" : "?";
                    setTimeout(() => { e.target.src = `${original}${separator}retry=${Date.now()}`; }, 500);
                    return;
                }
                e.target.style.display = "none";
                const fb = e.target.nextElementSibling;
                if (fb && fb.classList.contains("card-img-fallback")) fb.style.display = "flex";
            }
        }, true);
    }

    /**
     * 结束回合二次确认：列出还没用掉的动作，避免误点导致整个主要阶段白费。
     * @param {{id:string,label:string}[]} reasons
     * @param {() => void} callback 确认结束回合
     */
    showTurnEndConfirm(reasons, callback) {
        if (!this.endTurnOverlay) {
            this.endTurnOverlay = document.createElement("div");
            this.endTurnOverlay.className = "overlay discard-overlay turn-end-overlay";
            this.endTurnOverlay.innerHTML = `
                <section class="discard-panel" role="dialog" aria-modal="true">
                    <span class="eyebrow">END TURN</span>
                    <h2>确定结束回合？</h2>
                    <p id="turn-end-reasons"></p>
                    <div class="modal-actions">
                        <button type="button" class="primary-action" id="turn-end-continue">继续操作</button>
                        <button type="button" class="secondary-action" id="turn-end-confirm">结束回合</button>
                    </div>
                </section>`;
            document.body.appendChild(this.endTurnOverlay);
        }
        this.endTurnOverlay.querySelector("#turn-end-reasons").textContent =
            `本回合还可以：${reasons.map(item => item.label).join("、")}。`;
        const close = () => this.endTurnOverlay.classList.remove("active");
        this.endTurnOverlay.querySelector("#turn-end-continue").onclick = close;
        this.endTurnOverlay.querySelector("#turn-end-confirm").onclick = () => {
            close();
            callback();
        };
        this.endTurnOverlay.classList.add("active");
    }

    /**
     * 教学教练面板：固定在战场上方，显示当前步骤、说明、提示。
     * @param {{index:number,total:number,title:string,text:string,hint?:string,waiting:boolean,finish:boolean,onNext:Function,onSkip:Function}} payload
     */
    showCoach({ index, total, title, text, hint, waiting, finish, onNext, onSkip }) {
        if (!this.coachPanel) {
            this.coachPanel = document.createElement("section");
            this.coachPanel.className = "coach-panel";
            this.coachPanel.setAttribute("role", "dialog");
            this.coachPanel.setAttribute("aria-live", "polite");
            this.coachPanel.innerHTML = `
                <div class="coach-head">
                    <span class="coach-progress" id="coach-progress"></span>
                    <span class="coach-title" id="coach-title"></span>
                    <button type="button" class="coach-skip" id="coach-skip">跳过教学</button>
                </div>
                <p class="coach-text" id="coach-text"></p>
                <p class="coach-hint" id="coach-hint"></p>
                <div class="coach-actions"><span class="coach-wait" id="coach-wait"></span><button type="button" class="primary-action" id="coach-next">下一步</button></div>`;
            document.body.appendChild(this.coachPanel);
        }
        this.coachPanel.querySelector("#coach-progress").textContent = `${index}/${total}`;
        this.coachPanel.querySelector("#coach-title").textContent = title;
        this.coachPanel.querySelector("#coach-text").textContent = text;
        const hintEl = this.coachPanel.querySelector("#coach-hint");
        hintEl.textContent = hint || "";
        hintEl.hidden = !hint;
        const waitEl = this.coachPanel.querySelector("#coach-wait");
        const nextBtn = this.coachPanel.querySelector("#coach-next");
        if (finish) {
            waitEl.textContent = "";
            nextBtn.textContent = "完成教学";
            nextBtn.hidden = false;
        } else if (waiting) {
            // 等待玩家完成具体动作时，不给「下一步」按钮，避免绕过教学内容
            waitEl.textContent = "按上面的说明操作后会自动继续…";
            nextBtn.hidden = true;
        } else {
            waitEl.textContent = "";
            nextBtn.textContent = "下一步";
            nextBtn.hidden = false;
        }
        nextBtn.onclick = () => onNext?.();
        this.coachPanel.querySelector("#coach-skip").onclick = () => onSkip?.();
        this.coachPanel.classList.add("active");
    }

    hideCoach() {
        this.coachPanel?.classList.remove("active");
    }

    _createHandoffOverlay() {
        this.handoffOverlay = document.createElement("div");
        this.handoffOverlay.className = "overlay handoff-overlay";
        this.handoffOverlay.innerHTML = `<div class="handoff-panel"><div class="handoff-text" id="handoff-text"></div><button class="menu-btn" id="handoff-confirm" style="width:200px;margin-top:20px">确认开始</button></div>`;
        document.body.appendChild(this.handoffOverlay);
    }

    _createGraveyardOverlay() {
        this.graveyardOverlay = document.createElement("div");
        this.graveyardOverlay.className = "overlay";
        this.graveyardOverlay.id = "graveyard-overlay";
        this.graveyardOverlay.innerHTML = `<div class="detail-panel" style="width:500px;max-height:80vh;overflow-y:auto"><h2 style="text-align:center;margin-bottom:12px;color:#fbbf24">选择怪兽</h2><div class="graveyard-grid" id="graveyard-grid"></div><button class="btn-close" id="graveyard-close">✕</button></div>`;
        document.body.appendChild(this.graveyardOverlay);
    }

    _createTributeOverlay() {
        this.tributeOverlay = document.createElement("div");
        this.tributeOverlay.className = "overlay";
        this.tributeOverlay.id = "tribute-overlay";
        this.tributeOverlay.innerHTML = `<div class="detail-panel" style="width:500px;max-height:80vh;overflow-y:auto"><h2 style="text-align:center;margin-bottom:12px;color:#fbbf24" id="tribute-title">选择祭品</h2><div class="tribute-grid" id="tribute-grid"></div><div style="text-align:center;margin-top:12px"><button class="menu-btn" id="tribute-confirm" style="width:150px;margin:5px">确认</button><button class="menu-btn" id="tribute-cancel" style="width:150px;margin:5px;background:rgba(255,80,80,0.1);border-color:rgba(255,80,80,0.3)">取消</button></div></div>`;
        document.body.appendChild(this.tributeOverlay);
    }

    showBattle() {
        this.menuScreen?.classList.add("is-hidden");
        const scenes = [
            "moon-shrine", "neon-rooftop", "celestial-ruins", "sakura-academy",
            "abyssal-temple", "volcanic-forge", "aurora-palace", "desert-relic",
            "spirit-forest", "gothic-castle",
        ];
        const previousScene = this.battleScreen.dataset.duelScene;
        const choices = scenes.filter(scene => scene !== previousScene);
        const selectedScene = choices[Math.floor(Math.random() * choices.length)] || scenes[0];
        this.battleScreen.dataset.duelScene = selectedScene;
        this.battleScreen.classList.add("active");
        document.body.classList.add("battle-active");
        const pl = this.battleScreen.querySelector(".duel-particles");
        if (pl) { pl.innerHTML = ""; this._spawnAmbientParticles(pl); }
        this.resetRenderCache();
        // 新决斗：重置主控的 LP 基线并解锁 win/lose 最终姿态。
        this._controllerLp = null;
        this._controllerLowHp = false;
        emitControllerAction("duelStart", {});
    }

    /** 开新对局时清空增量渲染缓存，保证 DOM 与状态重新对齐。 */
    resetRenderCache() {
        this._fieldRefs = null;
        this._slotCache = new Map();
        this._handSig = null;
        this._topHudSig = null;
        this._bottomHudSig = null;
        this._phaseSig = null;
        this._opponentHandCount = -1;
        this._prevFieldIds = new Set();
        this._prevHandIds = [];
    }
    showMenu() {
        // 离开决斗：清掉主控的计时器、特效节点与动画类名，避免残留与泄漏。
        emitControllerAction("duelEnd", {});
        for (const overlay of [this.cardActionOverlay, this.detailOverlay, this.firstPlayerOverlay, this.mulliganOverlay, this.discardOverlay, this.endTurnOverlay, this.graveyardOverlay, this.tributeOverlay, this.trapConfirmOverlay]) overlay?.classList.remove("active");
        this.deckOrderOverlay?.remove(); this.deckSearchOverlay?.remove();
        document.body.classList.remove("battle-modal-open");
        this.battleScreen.classList.remove("active");
        document.body.classList.remove("battle-active");
        this.menuScreen?.classList.remove("is-hidden");
        this.onReturnHome?.();
    }

    render(gs, h) {
        if (!gs || !Array.isArray(gs.players) || gs.players.length < 2) {
            console.error("[GameUI] 无效游戏状态", gs);
            return;
        }
        this.battleScreen.dataset.activeOwner = String(gs.currentPlayerIndex);

        // 控制和阶段必须最先更新。即便某张卡的数据异常，也不能让整场决斗停在“等待开始”。
        this._safeRender("phase", () => this._renderPhaseBar(gs));
        this._safeRender("controls", () => this._renderControls(gs, h));
        this._safeRender("topHud", () => this._renderTop(gs));
        this._safeRender("opponentHand", () => this._renderOpponentHand(gs));
        this._safeRender("bottomHud", () => this._renderBottom(gs));
        this._safeRender("deckPiles", () => this._renderDeckPiles(gs));
        this._safeRender("field", () => this._renderField(gs, h));
        this._safeRender("hand", () => this._renderHand(gs, h), () => this._renderHandFailure());

        // 主控动态只跟随真实状态变化：LP 实际下降 → hit；跨过 25% 阈值 → lowHp / lowHpEnd。
        this._syncControllerSignals(gs);

        // 场地魔法场景变换
        this._updateFieldScene(gs);

        if (gs.phase === PHASE.GRAVEYARD_SELECT) this._safeRender("graveyard", () => this._showGraveyardSelect(gs, h));
        else this.graveyardOverlay.classList.remove("active");
        if (gs.phase === PHASE.TRIBUTE_SELECT) this._safeRender("tribute", () => this._showTributeSelect(gs, h));
        else this.tributeOverlay.classList.remove("active");
    }

    /**
     * 主控信号：只读真实的玩家 LP（gs.players[0]），不猜测点击。
     *   · LP 实际下降 → hit（带伤害值），LP 回升（治疗）不触发。
     *   · 跨过 25% 阈值 → lowHp（进入）/ lowHpEnd（退出），只在状态跃迁时派发。
     * 基线在 showBattle() 里重置，避免新决斗的首帧被误判为掉血。
     */
    _syncControllerSignals(gs) {
        const player = gs.players?.[0];
        if (!player) return;
        const lp = Number(player.lp) || 0;
        const maxLp = Number(player.maxLp) || 0;
        const previousLp = this._controllerLp;
        const previousLow = this._controllerLowHp;
        const low = maxLp > 0 && lp > 0 && lp <= maxLp * 0.25;
        this._controllerLp = lp;
        this._controllerLowHp = low;
        // 首帧只建立基线：新决斗的第一帧不能被误判为掉血或阈值跃迁。
        if (previousLp === null || previousLp === undefined) return;
        if (lp < previousLp) {
            emitControllerAction("hit", { playerIndex: 0, damage: previousLp - lp, lp, maxLp });
        }
        if (previousLow === undefined) return;
        if (low !== previousLow) {
            emitControllerAction(low ? "lowHp" : "lowHpEnd", { playerIndex: 0, lp, maxLp });
        }
    }

    _safeRender(section, callback, fallback = null) {
        try {
            callback();
        } catch (error) {
            console.error(`[GameUI] ${section} 渲染失败`, error);
            fallback?.(error);
        }
    }

    _updateFieldScene(gs) {
        const bs = this.battleScreen;
        if (!bs) return;
        // 检查是否有场地魔法
        const p0Field = gs.players[0]?.fieldZone;
        const p1Field = gs.players[1]?.fieldZone;
        const activeField = p0Field || p1Field;
        const fieldSpellType = activeField?.fieldSpellType || null;

        bs.classList.remove("scene-ocean", "scene-shallow-tide");
        if (fieldSpellType === "ocean_scene") {
            bs.classList.add("scene-ocean");
        } else if (fieldSpellType === "shallow_tide") {
            bs.classList.add("scene-shallow-tide");
        }
    }

    _renderDeckPiles(gs) {
        if (this.playerDeckCount) this.playerDeckCount.textContent = String(gs.players[0]?.deck?.length ?? 0);
        if (this.opponentDeckCount) this.opponentDeckCount.textContent = String(gs.players[1]?.deck?.length ?? 0);
        if (this.playerGraveyardCount) this.playerGraveyardCount.textContent = String(gs.players[0]?.graveyard?.length ?? 0);
        if (this.opponentGraveyardCount) this.opponentGraveyardCount.textContent = String(gs.players[1]?.graveyard?.length ?? 0);
        if (this.visibleHandCount) {
            const visiblePlayer = this.mode === "local" ? gs.currentPlayer : gs.players[0];
            this.visibleHandCount.textContent = String(visiblePlayer?.hand?.length ?? 0);
        }
    }

    _renderHandFailure() {
        if (!this.handElement) return;
        this.handElement.innerHTML = `<div class="hand-render-error">手牌显示发生异常。请按 Ctrl+F5 刷新；错误已输出到浏览器控制台。</div>`;
    }

    showDrawAnimation(card, playerIndex = 0, message = "DRAW") {
        // 抽卡运镜已由 animateDrawCard 接管，这里只播放辅助氛围特效

        // 玩家抽卡播放氛围特效
        if (playerIndex !== 0 || !card) return;
        emitControllerAction("draw", { playerIndex, cardId: card.id, cardType: card.type });

        const battleScreen = document.querySelector(".battle-screen");
        if (!battleScreen) return;

        // 屏幕震动
        setTimeout(() => {
            battleScreen.classList.remove("draw-shake");
            void battleScreen.offsetWidth;
            battleScreen.classList.add("draw-shake");
            setTimeout(() => battleScreen.classList.remove("draw-shake"), 400);
        }, 600);

        // 径向冲击波
        const burst = document.createElement("div");
        burst.className = "draw-radial-burst";
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 900);

        // 光粒子从中心四散
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight * 0.42;
        for (let i = 0; i < 12; i++) {
            const p = document.createElement("div");
            p.className = "draw-particle";
            const angle = (i / 12) * Math.PI * 2;
            const dist = 80 + Math.random() * 120;
            p.style.cssText = `left:${cx}px; top:${cy}px; --px:${Math.cos(angle) * dist}px; --py:${Math.sin(angle) * dist}px; animation-delay:${0.6 + i * 0.02}s;`;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 1300);
        }
    }

    _renderTop(gs) {
        const opp = gs.players[1];
        const el = document.getElementById("opponent-area");
        const pct = Math.max(0, Math.min(100, (opp.lp / opp.maxLp) * 100));
        const html = `<div class="player-hud opponent-hud ${gs.currentPlayerIndex === 1 ? "active-player" : ""}">
            <div class="player-avatar opp-avatar">NC</div>
            <div class="player-stats"><div class="player-name">${this._esc(opp.name)}</div><div class="hp-bar-wrap"><div class="hp-bar"><div class="hp-fill enemy" style="width:${pct}%"></div></div><span class="hp-text">${opp.lp.toLocaleString()} LP</span></div></div>
            <div class="hud-counters"><div><span>DECK</span><strong>${opp.deck.length}</strong></div><div><span>HAND</span><strong>${opp.hand.length}</strong></div><div><span>GY</span><strong>${opp.graveyard.length}</strong></div></div>
        </div>`;
        // HUD 内容没变就不要重建 DOM：攻击者掉血之外的绝大多数刷新都会命中这里
        if (this._topHudSig === html) return;
        this._topHudSig = html;
        el.innerHTML = html;
    }

    _renderOpponentHand(gs) {
        if (!this.opponentHandElement) return;
        const opponent = gs.players[1];
        const count = Array.isArray(opponent?.hand) ? opponent.hand.length : 0;
        if (this._opponentHandCount === count) return;
        this._opponentHandCount = count;
        this.opponentHandElement.replaceChildren();
        for (let index = 0; index < count; index++) {
            const back = document.createElement("div");
            back.className = "opponent-hand-card";
            back.style.transform = `translateX(${(index - (count - 1) / 2) * 24}px) rotate(${(index - (count - 1) / 2) * 2}deg)`;
            back.innerHTML = sekaiCardBackHtml();
            this.opponentHandElement.appendChild(back);
        }
    }

    _renderBottom(gs) {
        const p = gs.players[0];
        const el = document.getElementById("player-area");
        const pct = Math.max(0, Math.min(100, (p.lp / p.maxLp) * 100));
        const html = `<div class="player-hud player-hud-bottom ${gs.currentPlayerIndex === 0 ? "active-player" : ""}">
            <div class="player-avatar my-avatar">${this._esc((p.name || "P").slice(0, 1))}</div>
            <div class="player-stats"><div class="player-name">${this._esc(p.name)}</div><div class="hp-bar-wrap"><div class="hp-bar"><div class="hp-fill ally" style="width:${pct}%"></div></div><span class="hp-text">${p.lp.toLocaleString()} LP</span></div></div>
            <div class="hud-counters"><div><span>DECK</span><strong>${p.deck.length}</strong></div><div><span>HAND</span><strong>${p.hand.length}</strong></div><div><span>GY</span><strong>${p.graveyard.length}</strong></div></div>
        </div>`;
        if (this._bottomHudSig === html) return;
        this._bottomHudSig = html;
        el.innerHTML = html;
    }

    _renderPhaseBar(gs) {
        const bar = document.getElementById("phase-bar");
        if (this.turnBadge) this.turnBadge.textContent = `TURN ${gs.turn} · ${PHASE_NAMES[gs.phase] || gs.phase}`;
        if (!bar) return;
        // index.html 的 #phase-bar 带 inline display:none，且没有任何代码移除它，
        // 阶段条因此永远不可见；首次渲染阶段条时恢复为可见。
        if (bar.style.display === "none") bar.style.display = "flex";
        const sig = `${gs.turn}|${gs.phase}`;
        if (this._phaseSig === sig) return;
        this._phaseSig = sig;
        const currentIdx = PHASE_ORDER.indexOf(gs.phase);
        bar.innerHTML = PHASE_ORDER.map((p, i) => `<span class="phase-step ${i === currentIdx ? "phase-active" : ""} ${i < currentIdx ? "phase-done" : ""}">${PHASE_NAMES[p]}</span>`).join('<span class="phase-arrow">→</span>');
    }

    _renderField(gs, h) {
        const p0 = gs.players[0], p1 = gs.players[1];
        const isBattle = gs.phase === PHASE.BATTLE || (gs.phase === PHASE.MAIN_1 && !gs.firstTurn);
        const hasAttacker = !!gs.selectedAttacker;
        const isTargetSelect = gs.phase === PHASE.TARGET_SELECT;
        const isTributeSelect = gs.phase === PHASE.TRIBUTE_SELECT;
        this._currentTurn = gs.turn;

        // 记录上一帧的场上卡牌 instanceId，用于检测新放置
        const prevFieldIds = this._prevFieldIds || new Set();
        const curFieldIds = new Set();
        [...p0.monsterZone, ...p0.spellTrapZone, ...p1.monsterZone, ...p1.spellTrapZone]
            .forEach(c => { if (c?.instanceId) curFieldIds.add(c.instanceId); });
        this._prevFieldIds = curFieldIds;

        // 已选攻击者时，为每个可攻击目标算一次"这一击会发生什么"（纯函数，无副作用）
        const attacker = gs.selectedAttacker;
        const canPreview = isBattle && !!attacker && typeof h.onPreviewBattle === "function";
        const previewFor = card => (canPreview ? h.onPreviewBattle(attacker, card) : null);
        const directPreview = canPreview && p1.monsterZone.length === 0 ? h.onPreviewBattle(attacker, "player") : null;
        const directPreviewHtml = directPreview
            ? `<div class="battle-preview-bar">${this._esc(attacker.name)} → 对方玩家：${this._esc(directPreview.text)}</div>`
            : "";

        // 事件委托需要在触发时读取最新的 state / handlers
        this._gs = gs;
        this._h = h;

        // 骨架（区域容器）只建一次。之后每次渲染都走"逐槽 diff"，
        // 只替换内容真正变化的卡槽。以前每一次 checkAndRefresh 都会把 22 个卡槽
        // （含卡图 <img>）整体丢弃重建，攻击动画期间连续刷新会直接掉帧。
        if (!this._fieldRefs || !this.battlefield.contains(this._fieldRefs.m0)) {
            this._buildFieldSkeleton();
        }
        const refs = this._fieldRefs;

        this._diffSlotRow(refs.st1, this._buildSpellTrapSlots(p1.spellTrapZone, 1, isTargetSelect, gs.validTargets), "st1");
        this._diffSlotRow(refs.m1, this._buildMonsterSlots(p1.monsterZone, 1, gs.currentPlayerIndex, isBattle, isTargetSelect, gs.validTargets, hasAttacker, isTributeSelect, gs, previewFor), "m1");
        this._diffSlotRow(refs.m0, this._buildMonsterSlots(p0.monsterZone, 0, gs.currentPlayerIndex, isBattle, isTargetSelect, gs.validTargets, hasAttacker, isTributeSelect, gs), "m0");
        this._diffSlotRow(refs.st0, this._buildSpellTrapSlots(p0.spellTrapZone, 0, isTargetSelect, gs.validTargets), "st0");
        this._diffFieldZoneSlot(refs.f0, p0.fieldZone, "f0");
        this._diffFieldZoneSlot(refs.f1, p1.fieldZone, "f1");
        this._diffInner(refs.preview, directPreviewHtml, "preview");

        // 新放置的卡牌添加涟漪效果
        if (prevFieldIds.size > 0) {
            this.battlefield.querySelectorAll(".field-slot.has-card").forEach(slot => {
                const id = slot.dataset.instanceId;
                if (id && !prevFieldIds.has(id)) {
                    slot.classList.add("ripple");
                    setTimeout(() => slot.classList.remove("ripple"), 550);
                }
            });
        }

        // HUD 目标绑定每次渲染都要刷新（用 on* 赋值，重复渲染不会累积监听器）
        this._bindHudTargets(gs, h);
    }

    /** 构建战场骨架；骨架稳定后所有刷新都走增量 diff。 */
    _buildFieldSkeleton() {
        this.battlefield.innerHTML = `
            <div class="field-half opp-half">
                <div class="spell-trap-row" data-drop-zone="spell-trap" data-owner="1"></div>
                <div class="monster-row" data-drop-zone="monster" data-owner="1"></div>
                <div class="battle-preview-host"></div>
            </div>
            <div class="field-zone-center">
                <div class="field-zone-slot" data-owner="0" data-zone="field"></div>
                <div class="field-zone-slot" data-owner="1" data-zone="field"></div>
            </div>
            <div class="field-half my-half">
                <div class="monster-row" data-drop-zone="monster" data-owner="0"></div>
                <div class="spell-trap-row" data-drop-zone="spell-trap" data-owner="0"></div>
            </div>`;
        this._fieldRefs = {
            st1: this.battlefield.querySelector('.spell-trap-row[data-owner="1"]'),
            m1: this.battlefield.querySelector('.monster-row[data-owner="1"]'),
            m0: this.battlefield.querySelector('.monster-row[data-owner="0"]'),
            st0: this.battlefield.querySelector('.spell-trap-row[data-owner="0"]'),
            f0: this.battlefield.querySelector('.field-zone-slot[data-owner="0"]'),
            f1: this.battlefield.querySelector('.field-zone-slot[data-owner="1"]'),
            preview: this.battlefield.querySelector(".battle-preview-host"),
        };
        this._slotCache = new Map();
        this._bindFieldDelegates();
    }

    /** 逐槽 diff：只替换 HTML 发生变化的卡槽，未变化的 DOM 节点（含卡图）保持不动。 */
    _diffSlotRow(rowEl, slots, key) {
        if (!rowEl || !Array.isArray(slots)) return;
        const cache = this._slotCache || (this._slotCache = new Map());
        const prev = cache.get(key);
        if (!prev || prev.length !== slots.length) {
            rowEl.innerHTML = slots.join("");
            cache.set(key, slots.slice());
            return;
        }
        for (let i = 0; i < slots.length; i++) {
            if (prev[i] === slots[i]) continue;
            const holder = document.createElement("div");
            holder.innerHTML = slots[i];
            const next = holder.firstElementChild;
            if (!next) continue;
            const old = rowEl.children[i];
            if (old) rowEl.replaceChild(next, old);
            else rowEl.appendChild(next);
        }
        cache.set(key, slots.slice());
    }

    /** 内容未变化时跳过 innerHTML 写入。 */
    _diffInner(el, html, key) {
        if (!el) return;
        const cache = this._slotCache || (this._slotCache = new Map());
        if (cache.get(key) === html) return;
        el.innerHTML = html;
        cache.set(key, html);
    }

    _diffFieldZoneSlot(el, fieldZone, key) {
        if (!el) return;
        const inner = fieldZone
            ? `<div class="card mini-card type-spell rarity-${fieldZone.rarity || "N"} field-spell-card"><div class="card-frame elem-${fieldZone.attribute || "none"}"><div class="card-header"><span class="card-name">${this._esc(fieldZone.name)}</span></div><div class="card-art"><div class="card-art-inner">${getCardImageHTML(fieldZone, 60)}</div></div><div class="card-footer"><span class="stat-type">场地</span></div></div></div>`
            : `<div class="field-zone-empty"><span>场地</span></div>`;
        const sig = `${fieldZone ? "1" : "0"}|${inner}`;
        if (this._slotCache?.get(key) === sig) return;
        el.innerHTML = inner;
        el.classList.toggle("has-card", !!fieldZone);
        (this._slotCache || (this._slotCache = new Map())).set(key, sig);
    }

    /** 返回每个卡槽的 HTML 数组，供 _diffSlotRow 逐格 diff。 */
    _buildMonsterSlots(zone, ownerIdx, currentPlayerIndex, isBattle, isTargetSelect, validTargets, hasAttacker, isTributeSelect, gs, previewFor = null) {
        const slots = [];
        for (let i = 0; i < GAME_CONFIG.MAX_MONSTER_ZONE; i++) {
            if (i < zone.length) {
                const c = zone[i];
                const attr = c.attribute || c.element || "none";
                const isDef = c.position === MONSTER_POSITION.DEFENSE;
                const isFaceDown = !c.faceUp;
                const isLocalOwner = ownerIdx === 0;
                const canControl = isLocalOwner && currentPlayerIndex === 0;
                const canAtk = canControl && isBattle && c.canAttack && !c.cannotAttack && !(c.themedState?.frozenUntil >= gs.turn) && !(c.themedState?.paralyzedUntil >= gs.turn) && !isDef && c.faceUp;
                const isEnemy = ownerIdx === 1;
                const isTargetable = isEnemy && currentPlayerIndex === 0 && isBattle && hasAttacker && !c.cannotBeAttacked;
                const isEffectTarget = isTargetSelect && validTargets.some(t => t.instanceId === c.instanceId);
                const isTributeTarget = isTributeSelect && canControl;
                const slotAttr = c.attribute || c.element || "";
                const cls = ["field-slot", "has-card", slotAttr, canAtk ? "can-attack" : "", isTargetable ? "targetable" : "", isEffectTarget ? "effect-target" : "", isTributeTarget ? "tribute-target" : "", isDef && !isFaceDown ? "defense-pos" : "", isFaceDown ? "face-down-set" : ""].filter(Boolean).join(" ");
                // 特效锚点：主题动作按"数据攻击力最高的敌方槽位"落点；里侧记 0，避免泄底
                const atkValue = isFaceDown ? 0 : (Number(c.currentAttack) || 0);
                const attrs = [
                    `data-owner="${ownerIdx}"`,
                    `data-zone="monster"`,
                    `data-instance-id="${escapeAttr(c.instanceId)}"`,
                    `data-atk="${atkValue}"`,
                    canAtk ? `data-attacker="${i}" data-drag-attacker="${escapeAttr(c.instanceId)}" draggable="true"` : "",
                    isTargetable ? `data-target="${i}"` : "",
                    isEnemy && isBattle ? `data-attack-drop-target="${escapeAttr(c.instanceId)}"` : "",
                    isEffectTarget ? `data-effect-target="${escapeAttr(c.instanceId)}"` : "",
                    isTributeTarget ? `data-tribute="${i}"` : "",
                ].filter(Boolean).join(" ");

                // 里侧守备显示卡背
                if (isFaceDown) {
                    slots.push(`<div class="${cls}" ${attrs}>
                        <div class="card in-field rarity-${c.rarity || "N"}">
                            <div class="card-frame face-down-frame">
                                <div class="card-back-icon">?</div>
                                ${sekaiCardBackHtml({ label: "SET" })}
                            </div>
                        </div>
                    </div>`);
                } else {
                    // 主要阶段：己方表侧怪兽显示「守备/攻击」切换按钮
                    const showPosBtn = canControl && !gs.gameOver
                        && (gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2)
                        && c.faceUp
                        // 大师规则：召唤当回合不能变更表示形式；开关打开时放行（自制规则）
                        && (c.setTurn !== gs.turn || GAME_CONFIG.ALLOW_SUMMON_TURN_POSITION_CHANGE)
                        && !(c.themedState?.frozenUntil >= gs.turn) && !(c.themedState?.paralyzedUntil >= gs.turn) && !c.hasAttackedThisTurn && !c.positionChangedThisTurn;
                    const posLabel = isDef ? "攻击" : "守备";
                    const posBtnHtml = showPosBtn
                        // 事件已委托到 #battlefield，这里不能再写 inline onclick，
                        // 否则 stopPropagation 会阻止冒泡，委托处理器收不到点击。
                        ? `<button class="pos-switch-btn" data-pos-switch="${escapeAttr(c.instanceId)}" type="button">${posLabel}</button>`
                        : "";
                    // 战斗预览：只对"己方已选攻击者 + 敌方目标"计算，告诉玩家会破坏还是吃亏
                    const preview = (previewFor && isEnemy && isTargetable) ? previewFor(c) : null;
                    const previewHtml = preview
                        ? `<div class="battle-preview ${preview.outcome}">${this._esc(preview.text)}</div>`
                        : "";
                    slots.push(`<div class="${cls}" ${attrs}>
                        <div class="card in-field rarity-${c.rarity || "N"}">
                            <div class="card-frame elem-${attr} type-monster member-${c.member || "none"}">
                                <div class="card-header"><span class="card-name">${this._esc(c.name)}</span><span class="card-level">Lv.${c.level || "?"}</span></div>
                                <div class="card-art"><div class="card-art-inner">${getCardImageHTML(c, 80)}</div></div>
                                <div class="card-footer"><span class="stat-atk"><span>ATK</span>${c.currentAttack}</span><span class="stat-def"><span>DEF</span>${c.currentDefense}</span></div>
                            </div>
                            ${cardRuleStatusHtml(c, gs.turn)}${previewHtml}
                        </div>
                        ${canControl && !gs.gameOver && ([PHASE.MAIN_1, PHASE.MAIN_2].includes(gs.phase) || (hasAttacker && this._h?.canCancelAttackToMain?.())) ? `<div class="field-card-actions">${posBtnHtml}<button type="button" class="card-actions-button" data-card-actions="${escapeAttr(c.instanceId)}" aria-label="${escapeAttr(c.name)}的操作">技能</button></div>` : ""}
                    </div>`);
                }
            } else {
                slots.push(`<div class="field-slot empty" data-owner="${ownerIdx}" data-zone="monster"></div>`);
            }
        }
        return slots;
    }

    /** 返回每个卡槽的 HTML 数组，供 _diffSlotRow 逐格 diff。 */
    _buildSpellTrapSlots(zone, ownerIdx, isTargetSelect = false, validTargets = []) {
        const slots = [];
        for (let i = 0; i < GAME_CONFIG.MAX_SPELL_TRAP_ZONE; i++) {
            if (i < zone.length) {
                const c = zone[i];
                const isFaceDown = c.faceDown;
                const typeIcon = c.type === "trap" ? "TRAP" : "SPELL";
                const isEffectTarget = isTargetSelect && validTargets.some(target => target.instanceId === c.instanceId);
                const targetAttr = isEffectTarget ? ` data-effect-target="${this._esc(c.instanceId)}"` : "";
                slots.push(`<div class="field-slot spell-trap-slot ${isFaceDown ? "face-down" : "has-card"} ${isEffectTarget ? "effect-target" : ""}" data-owner="${ownerIdx}" data-zone="spell-trap" data-stidx="${i}" data-instance-id="${escapeAttr(c.instanceId)}"${targetAttr}>
                    ${isFaceDown ? `<div class="card-back-icon">${typeIcon}</div>${sekaiCardBackHtml({ label: typeIcon })}` : `<div class="card mini-card type-${c.type} rarity-${c.rarity || "N"}"><div class="card-frame elem-${c.attribute || "none"}"><div class="card-header"><span class="card-name">${this._esc(c.name)}</span></div><div class="card-footer"><span class="stat-type">${c.type === "trap" ? "陷阱" : "魔法"}</span></div>${cardVisualEffectHtml(c)}</div></div>`}
                </div>`);
            } else {
                slots.push(`<div class="field-slot empty spell-trap-slot" data-owner="${ownerIdx}" data-zone="spell-trap"></div>`);
            }
        }
        return slots;
    }

    /**
     * 战场事件一次性委托到 #battlefield。
     * 增量 diff 让卡槽 DOM 长期存活，若仍按每次渲染重新 addEventListener，
     * 监听器会不断累积（内存泄漏 + 一次点击触发多次）。委托只绑一次，
     * 事件触发时从 this._gs / this._h 读取最新状态。
     */
    _bindFieldDelegates() {
        const bf = this.battlefield;
        if (bf.dataset.delegatesBound === "1") return;
        bf.dataset.delegatesBound = "1";
        const closest = (event, selector) => {
            const node = event.target instanceof Element ? event.target : null;
            return node ? node.closest(selector) : null;
        };
        bf.addEventListener("click", event => this._onFieldClick(event, closest));
        bf.addEventListener("contextmenu", event => this._onFieldContextMenu(event, closest));
        bf.addEventListener("dragstart", event => {
            const gs = this._gs, h = this._h;
            const el = closest(event, "[data-drag-attacker]");
            if (!el || !gs || !h) return;
            const attacker = this._findTarget(gs, el.dataset.dragAttacker);
            if (!attacker) return event.preventDefault();
            this.dragContext = { kind: "attacker", instanceId: attacker.instanceId };
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", JSON.stringify(this.dragContext));
            el.classList.add("dragging-card");
            this.battleScreen.classList.add("dragging-attacker");
        });
        bf.addEventListener("dragend", () => this._finishDrag());
        bf.addEventListener("dragover", event => this._onFieldDragOver(event, closest));
        bf.addEventListener("dragleave", event => {
            const el = closest(event, "[data-attack-drop-target],[data-drop-zone]");
            if (el && !el.contains(event.relatedTarget)) el.classList.remove("drop-hover");
        });
        bf.addEventListener("drop", event => this._onFieldDrop(event, closest));
    }

    _onFieldClick(event, closest) {
        const gs = this._gs, h = this._h;
        if (!gs || !h) return;

        const actionButton = closest(event, "[data-card-actions]");
        if (actionButton) {
            event.stopPropagation();
            const card = this._findTarget(gs, actionButton.dataset.cardActions);
            if (card && gs.currentPlayer.monsterZone.includes(card)) {
                if (h.canCancelAttackToMain?.()) h.onCancelAttackSelection?.();
                this._showCardActions(card, -1, h, false, gs);
            }
            return;
        }
        // 守备/攻击切换按钮最内层，优先消费
        const posBtn = closest(event, "[data-pos-switch]");
        if (posBtn) {
            event.stopPropagation();
            const card = this._findTarget(gs, posBtn.dataset.posSwitch);
            if (card) h.onChangePosition(card);
            return;
        }

        const eff = closest(event, "[data-effect-target]");
        if (eff) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const target = this._findTarget(gs, eff.dataset.effectTarget);
            if (target) h.onConfirmTarget(target);
            return;
        }

        const tgt = closest(event, "[data-target]");
        if (tgt) {
            const i = Number.parseInt(tgt.dataset.target, 10);
            const card = gs.opponentPlayer.monsterZone[i];
            if (card) h.onAttack(card);
            return;
        }

        const trib = closest(event, "[data-tribute]");
        if (trib) {
            const i = Number.parseInt(trib.dataset.tribute, 10);
            const card = gs.currentPlayer.monsterZone[i];
            if (card) h.onSelectTribute(card);
            return;
        }

        const el = closest(event, "[data-instance-id]");
        if (!el) return;
        const card = this._findTarget(gs, el.dataset.instanceId);
        if (!card || card.isPlayer) return;
        const isOwn = Number(el.dataset.owner) === gs.currentPlayerIndex;
        const isMainPhase = gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2;

        // Touch users choose attack/skills explicitly; a tap must not force an attack.
        if (isOwn && card.faceUp && !gs.gameOver && window.matchMedia?.("(pointer: coarse)")?.matches
            && (isMainPhase || h.canCancelAttackToMain?.())) {
            if (h.canCancelAttackToMain?.()) h.onCancelAttackSelection?.();
            this._showCardActions(card, -1, h, false, gs);
            return;
        }

        // 战斗阶段优先：己方可攻击怪兽 → 选为攻击手
        if (isOwn && gs.phase === PHASE.BATTLE && el.dataset.attacker !== undefined) {
            const i = Number.parseInt(el.dataset.attacker, 10);
            const attackerCard = gs.currentPlayer.monsterZone[i];
            if (attackerCard) h.onSelectAttacker(attackerCard);
            return;
        }

        // 主要阶段点击可攻击怪兽：自动进入战斗阶段并把它选为攻击手
        // （界面说明与 .can-attack 的指针样式都承诺了这个交互）。只在可能的
        // 攻击窗口内生效：渲染器给出 data-attacker 的时机即战斗阶段 / 主要阶段1，
        // 避免主要阶段2、准备阶段点击怪兽发出无意义的报错。
        const inAttackWindow = el.dataset.attacker !== undefined
            || gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.BATTLE;
        if (isOwn && !gs.gameOver && inAttackWindow
            && card.type === "monster" && card.faceUp
            && card.position === MONSTER_POSITION.ATTACK
            && card.canAttack && !card.cannotAttack && !card.hasAttackedThisTurn
            && !(card.themedState?.frozenUntil >= gs.turn)
            && !(card.themedState?.paralyzedUntil >= gs.turn)) {
            h.onSelectAttacker(card);
            return;
        }

        // 主要阶段：己方怪兽 → 打开操作面板（含守备表示切换）
        if (isOwn && isMainPhase && !gs.gameOver) {
            this._showCardActions(card, -1, h, false, gs);
        }
    }

    _onFieldContextMenu(event, closest) {
        const gs = this._gs, h = this._h;
        if (!gs || !h) return;
        const el = closest(event, "[data-instance-id]");
        if (!el) return;
        event.preventDefault();
        event.stopPropagation();
        // 右键：己方怪兽显示操作面板（含形态切换），对方怪兽只看详情
        const card = this._findTarget(gs, el.dataset.instanceId);
        if (!card || card.isPlayer) return;
        const isOwn = Number(el.dataset.owner) === gs.currentPlayerIndex;
        const isFaceDown = card.type === "monster" ? !card.faceUp : !!card.faceDown;
        if (isFaceDown) {
            if (isOwn) this.showDetail(card);
            return;
        }
        if (isOwn && h.canCancelAttackToMain?.()) h.onCancelAttackSelection?.();
        const isMainPhase = gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2;
        if (isOwn && (gs.currentPlayerIndex === 0 || this.mode === "local") && card.type === "monster" && isMainPhase && !gs.gameOver) {
            this._showCardActions(card, -1, h, false, gs);
        } else {
            this.showDetail(card);
        }
    }

    _onFieldDragOver(event, closest) {
        const gs = this._gs;
        if (!gs) return;
        // 拖动场上怪兽攻击敌方怪兽
        const adt = closest(event, "[data-attack-drop-target]");
        if (adt) {
            if (this.dragContext?.kind !== "attacker") return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            adt.classList.add("drop-hover");
            return;
        }
        // 拖动手牌到己方对应区域：角色召唤，魔法发动，陷阱盖放
        const zone = closest(event, "[data-drop-zone]");
        if (!zone) return;
        const drag = this.dragContext;
        if (!drag || drag.kind !== "hand" || Number(zone.dataset.owner) !== gs.currentPlayerIndex) return;
        const valid = drag.cardType === "monster" ? zone.dataset.dropZone === "monster" : zone.dataset.dropZone === "spell-trap";
        if (!valid) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        zone.classList.add("drop-hover");
    }

    _onFieldDrop(event, closest) {
        const gs = this._gs, h = this._h;
        if (!gs || !h) return;
        const adt = closest(event, "[data-attack-drop-target]");
        if (adt) {
            if (this.dragContext?.kind !== "attacker") return;
            event.preventDefault();
            const attacker = this._findTarget(gs, this.dragContext.instanceId);
            const target = this._findTarget(gs, adt.dataset.attackDropTarget);
            this._finishDrag();
            if (!attacker || !target) return;
            h.onSelectAttacker(attacker);
            h.onAttack(target);
            return;
        }
        const zone = closest(event, "[data-drop-zone]");
        if (!zone) return;
        const drag = this.dragContext;
        if (!drag || drag.kind !== "hand" || Number(zone.dataset.owner) !== gs.currentPlayerIndex) return;
        const valid = drag.cardType === "monster" ? zone.dataset.dropZone === "monster" : zone.dataset.dropZone === "spell-trap";
        if (!valid) return;
        event.preventDefault();
        const currentIndex = gs.currentPlayer.hand.findIndex(card => card.instanceId === drag.instanceId);
        const cardType = drag.cardType;
        const defense = !!event.shiftKey;
        this._finishDrag();
        if (currentIndex < 0) return;
        if (cardType === "monster") h.onSummon(currentIndex, defense ? MONSTER_POSITION.DEFENSE : MONSTER_POSITION.ATTACK, defense);
        else if (cardType === "spell") h.onPlayCard(currentIndex);
        else if (cardType === "trap") h.onSetCard(currentIndex);
    }

    /**
     * 玩家 HUD 的目标/直接攻击绑定。每次渲染都会调用，因此全部用 on* 属性赋值，
     * 重复渲染不会累积监听器（HUD 也可能因为 LP 未变而在增量渲染中保留）。
     */
    _bindHudTargets(gs, h) {
        const isBattle = gs.phase === PHASE.BATTLE || (gs.phase === PHASE.MAIN_1 && !gs.firstTurn);
        const hasAttacker = !!gs.selectedAttacker;
        const oppHud = document.querySelector("#opponent-area .player-hud");
        const playerHud = document.querySelector("#player-area .player-hud");
        // 目标选择：enemy_monster_or_player 会返回 isPlayer 的伪目标，但之前没有任何元素
        // 承载它；对方场上没有怪兽时决斗会卡在目标选择阶段（手牌被隐藏、结束回合被禁用），
        // 这个效果也永远打不到玩家。这里让伪目标对应的玩家 HUD 变成可点选的目标，
        // 点击仍然走 _findTarget，取消按钮 / ESC 的取消路径不受影响。
        const playerTarget = gs.phase === PHASE.TARGET_SELECT
            ? (gs.validTargets || []).find(target => target?.isPlayer === true)
            : null;
        const targetHud = playerTarget?.instanceId
            ? (playerTarget.instanceId === `player_${gs.players[0].name}` ? playerHud : oppHud)
            : null;
        for (const hud of [oppHud, playerHud]) {
            if (!hud || hud === targetHud) continue;
            hud.classList.remove("effect-target", "direct-attack-target");
            hud.removeAttribute("data-effect-target");
            hud.removeAttribute("title");
        }
        if (targetHud) {
            targetHud.dataset.effectTarget = escapeAttr(playerTarget.instanceId);
            targetHud.classList.add("effect-target", "direct-attack-target");
            targetHud.title = `选择目标：${playerTarget.name || "对方玩家"}`;
            targetHud.onclick = event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                const target = this._findTarget(gs, playerTarget.instanceId);
                if (target) h.onConfirmTarget(target);
            };
        }
        if (oppHud) {
            oppHud.onclick = null;
            oppHud.classList.remove("drop-hover");
            oppHud.classList.remove("direct-attack-target");
            if (isBattle && gs.opponentPlayer.monsterZone.length === 0) {
                if (hasAttacker) {
                    oppHud.classList.add("direct-attack-target");
                    oppHud.onclick = () => h.onAttackPlayer();
                }
                oppHud.ondragover = event => {
                    if (this.dragContext?.kind !== "attacker") return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    oppHud.classList.add("drop-hover");
                };
                oppHud.ondragleave = () => oppHud.classList.remove("drop-hover");
                oppHud.ondrop = event => {
                    if (this.dragContext?.kind !== "attacker") return;
                    event.preventDefault();
                    const attacker = this._findTarget(gs, this.dragContext.instanceId);
                    this._finishDrag();
                    if (!attacker) return;
                    h.onSelectAttacker(attacker);
                    h.onAttackPlayer();
                };
            } else {
                oppHud.ondragover = null;
                oppHud.ondragleave = null;
                oppHud.ondrop = null;
            }
        }
    }

    _finishDrag() {
        this.dragContext = null;
        this.battleScreen.classList.remove("dragging-hand-monster", "dragging-hand-spell", "dragging-hand-trap", "dragging-attacker");
        this.battleScreen.removeAttribute("data-active-owner");
        document.querySelectorAll(".dragging-card, .drop-hover").forEach(element => element.classList.remove("dragging-card", "drop-hover"));
    }

    _findTarget(gs, instanceId) {
        if (!instanceId) return null;
        if (instanceId.startsWith("player_")) { const idx = instanceId === "player_" + gs.players[0].name ? 0 : 1; return { isPlayer: true, name: gs.players[idx].name, currentDefense: gs.players[idx].lp }; }
        for (const p of gs.players) for (const c of [...p.monsterZone, ...p.spellTrapZone, ...p.hand, ...p.graveyard]) if (c.instanceId === instanceId) return c;
        return null;
    }

    _renderHand(gs, h) {
        if (!this.handElement) throw new Error("缺少 #hand 元素");
        if (gs.phase === PHASE.TARGET_SELECT || gs.phase === PHASE.GRAVEYARD_SELECT || gs.phase === PHASE.TRIBUTE_SELECT) {
            this.handElement.innerHTML = `<div class="target-select-hint">${gs.phase === PHASE.TRIBUTE_SELECT ? "选择祭品" : "选择目标"} · ESC 取消</div>`;
            return;
        }

        const player = this.mode === "local" ? gs.currentPlayer : gs.players[0];
        const hand = Array.isArray(player?.hand) ? player.hand : [];
        const prevIds = new Set(this._prevHandIds || []);
        const newIds = new Set(hand.map(c => c?.instanceId).filter(Boolean));

        // 手牌没变化就完全跳过重建：一次 attack 流程里手牌通常一动不动，
        // 以前却要整体丢弃再重建（含全部卡图 <img> 解码 + 监听器重新绑定）。
        const canPlayNow = (gs.currentPlayerIndex === 0 || this.mode === "local") &&
            (gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2 || gs.phase === PHASE.BATTLE) && !gs.gameOver;
        const handSig = `${gs.phase}|${canPlayNow}|${hand.length}|` +
            hand.map(c => `${c?.instanceId}:${c?.currentAttack ?? ""}:${c?.currentDefense ?? ""}:${c?.rarity || ""}:${c?.name || ""}`).join(",");
        if (this._handSig === handSig) return;
        this._handSig = handSig;
        this._prevHandIds = [...newIds];

        this.handElement.replaceChildren();
        if (this.visibleHandCount) this.visibleHandCount.textContent = String(hand.length);

        if (hand.length === 0) {
            const empty = document.createElement("div");
            empty.className = "target-select-hint";
            empty.textContent = "当前没有手牌";
            this.handElement.appendChild(empty);
            return;
        }

        const count = hand.length;
        const angle = Math.min(4, 22 / Math.max(count, 1));
        const canPlay = canPlayNow;

        hand.forEach((card, index) => {
            if (!card || typeof card !== "object") return;
            let element;
            try {
                element = document.createElement("article");
                element.className = `card in-hand rarity-${card.rarity || "N"}`;
                element.innerHTML = this.cardHTML(card);
            } catch (error) {
                console.error("[GameUI] 单张手牌渲染失败", card, error);
                element = document.createElement("article");
                element.className = "card in-hand render-fallback";
                const frame = document.createElement("div");
                frame.className = "card-frame";
                const name = document.createElement("strong");
                name.textContent = String(card.name || "异常卡牌");
                const info = document.createElement("small");
                info.textContent = "卡面数据异常，但不会中断决斗";
                frame.append(name, info);
                element.appendChild(frame);
            }

            element.dataset.handIndex = String(index);
            element.dataset.instanceId = String(card.instanceId || card.id || index);
            const rotation = (index - (count - 1) / 2) * angle;
            const offsetY = Math.abs(index - (count - 1) / 2) * 2;
            const transform = `rotate(${rotation}deg) translateY(${offsetY}px)`;
            element.style.transform = transform;
            element.style.setProperty("--hand-transform", transform);
            element.style.setProperty("--target-rot", `${rotation}deg`);
            element.style.setProperty("--target-y", `${offsetY}px`);

            // 扇形展开动画：首次渲染或有新卡时
            const isNew = card.instanceId && !prevIds.has(card.instanceId);
            if (prevIds.size === 0 || isNew) {
                element.classList.add("fan-enter");
                element.style.animationDelay = `${60 + index * 70}ms`;
                setTimeout(() => element.classList.remove("fan-enter"), 650 + index * 70);
            }

            if (canPlay) {
                element.draggable = true;
                element.setAttribute("aria-grabbed", "false");
                if (card.type === "monster") {
                    element.classList.add("playable");
                    element.title = COARSE_POINTER
                        ? "拖到己方怪兽区通常召唤；点击卡片可改为里侧守备盖放"
                        : "拖到己方怪兽区通常召唤；按住 Shift 拖放为里侧守备盖放";
                } else if (card.type === "spell") {
                    element.classList.add("playable");
                    element.title = "拖到己方魔法陷阱区发动";
                } else if (card.type === "trap") {
                    element.classList.add("playable-set");
                    element.title = "拖到己方魔法陷阱区盖放";
                }

                element.addEventListener("dragstart", event => {
                    this.dragContext = {
                        kind: "hand",
                        instanceId: String(card.instanceId || card.id || index),
                        cardType: card.type,
                    };
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", JSON.stringify(this.dragContext));
                    element.classList.add("dragging-card");
                    element.setAttribute("aria-grabbed", "true");
                    this.battleScreen.classList.add(`dragging-hand-${card.type}`);
                    this.battleScreen.setAttribute("data-active-owner", "0");
                });
                element.addEventListener("dragend", () => {
                    element.setAttribute("aria-grabbed", "false");
                    this._finishDrag();
                });
            } else {
                element.draggable = false;
            }

            // 单击提供稳定的操作面板；右键只查看详情。不要再依赖双击，因为第一次点击打开详情后第二次点击会丢失。
            element.addEventListener("click", event => {
                event.preventDefault();
                this._showCardActions(card, index, h, canPlay, gs);
            });
            element.addEventListener("contextmenu", event => {
                event.preventDefault();
                event.stopPropagation();
                this.showDetail(card);
            });
            this.handElement.appendChild(element);

            // SR/UR卡牌添加碎闪效果
            if (card.rarity === "SR" || card.rarity === "UR" || card.rarity === "SSR") {
                addFoilShimmer(element);
            }
        });
    }

    _renderControls(gs, h) {
        const canAct = gs.currentPlayerIndex === 0 || this.mode === "local";
        const selecting = gs.phase === PHASE.TARGET_SELECT || gs.phase === PHASE.GRAVEYARD_SELECT || gs.phase === PHASE.TRIBUTE_SELECT;
        const attackPending = gs.phase === PHASE.BATTLE && !!gs.selectedAttacker;
        const btnNext = document.getElementById("btn-next-phase");
        const btnEnd = document.getElementById("end-turn-button");
        const btnCancel = document.getElementById("btn-cancel-target");
        if (btnNext) {
            btnNext.hidden = true;
            btnNext.disabled = true;
        }
        if (btnEnd) {
            btnEnd.disabled = !canAct || gs.gameOver || selecting;
            btnEnd.textContent = "结束回合";
            // 提示"本回合还有没用掉的动作"：玩家不必自己逐张检查能不能出牌/攻击
            const pending = (canAct && !gs.gameOver && !selecting && typeof h.onPendingActions === "function")
                ? h.onPendingActions()
                : [];
            btnEnd.classList.toggle("has-pending", pending.length > 0);
            if (pending.length > 0) btnEnd.title = pending.map(item => item.label).join("／");
            else btnEnd.removeAttribute("title");
            let hint = document.getElementById("end-turn-hint");
            if (pending.length > 0) {
                if (!hint) {
                    hint = document.createElement("div");
                    hint.id = "end-turn-hint";
                    hint.className = "end-turn-hint";
                    btnEnd.insertAdjacentElement("afterend", hint);
                }
                hint.textContent = pending.map(item => item.label).join("／");
            } else if (hint) {
                hint.remove();
            }
        }
        if (btnCancel) {
            btnCancel.style.display = selecting || attackPending ? "inline-block" : "none";
            btnCancel.textContent = attackPending ? "取消攻击" : "取消选择";
            btnCancel.onclick = () => {
                if (gs.phase === PHASE.TRIBUTE_SELECT) h.onCancelTribute();
                else if (gs.phase === PHASE.BATTLE) h.onCancelAttackSelection?.();
                else h.onCancelTarget();
            };
        }
    }

    _showGraveyardSelect(gs, h) {
        const grid = document.getElementById("graveyard-grid");
        if (!grid) return;
        const chars = gs.currentPlayer.graveyard.filter(c => c.type === "monster");
        grid.innerHTML = chars.length === 0 ? '<p style="text-align:center;color:#888">墓地没有怪兽</p>' : "";
        chars.forEach(c => { const el = document.createElement("div"); el.className = `card in-hand rarity-${c.rarity || "N"}`; el.innerHTML = this.cardHTML(c); el.style.cursor = "pointer"; el.addEventListener("click", () => h.onConfirmTarget(c)); el.addEventListener("contextmenu", (e) => { e.preventDefault(); this.showDetail(c); }); grid.appendChild(el); });
        this.graveyardOverlay.classList.add("active");
        document.getElementById("graveyard-close").onclick = () => h.onCancelTarget();
        this.graveyardOverlay.onclick = (e) => { if (e.target === this.graveyardOverlay) h.onCancelTarget(); };
    }

    _showTributeSelect(gs, h) {
        const pt = gs.pendingTribute;
        if (!pt) return;
        document.getElementById("tribute-title").textContent = `选择${pt.needed}只祭品 (已选${pt.selected.length})`;
        const grid = document.getElementById("tribute-grid");
        grid.innerHTML = "";
        pt.player.monsterZone.forEach(c => {
            const el = document.createElement("div");
            el.className = `card in-hand rarity-${c.rarity || "N"} ${pt.selected.includes(c) ? "tribute-selected" : ""}`;
            el.innerHTML = this.cardHTML(c);
            el.style.cursor = "pointer";
            el.addEventListener("click", () => h.onSelectTribute(c));
            el.addEventListener("contextmenu", (e) => { e.preventDefault(); this.showDetail(c); });
            grid.appendChild(el);
        });
        this.tributeOverlay.classList.add("active");
        document.getElementById("tribute-confirm").onclick = () => h.onConfirmTribute();
        document.getElementById("tribute-cancel").onclick = () => h.onCancelTribute();
        this.tributeOverlay.onclick = (e) => { if (e.target === this.tributeOverlay) h.onCancelTribute(); };
    }

    showHandoff(name, cb) { document.getElementById("handoff-text").textContent = `请将设备交给 ${name}`; this.handoffOverlay.classList.add("active"); const btn = document.getElementById("handoff-confirm"); const nb = btn.cloneNode(true); btn.parentNode.replaceChild(nb, btn); nb.addEventListener("click", () => { this.handoffOverlay.classList.remove("active"); cb(); }); }

    cardHTML(card) {
        const attr = card.attribute || card.element || "none";
        const isMonster = card.type === "monster";
        const starterClass = card.series === "starter_ygo" ? " starter-ygo-frame" : "";
        const description = card.series === "starter_ygo"
            ? ""
            : `<div class="card-body"><div class="card-desc">${this._esc(card.description)}</div></div>`;
        const typeLabel = isMonster ? `<span class="type-label">怪兽</span>` : "";
        let stats = "";
        if (isMonster) { stats = `<div class="stat-atk"><span>ATK</span>${card.currentAttack ?? card.attack}</div><div class="stat-def"><span>DEF</span>${card.currentDefense ?? card.defense}</div>`; }
        else { stats = `<div class="stat-type">${card.type === "trap" ? "TRAP" : "SPELL"}</div>`; }
        return `<div class="card-frame elem-${attr} type-${card.type} member-${card.member || "none"} rarity-${card.rarity || "N"}${starterClass}"><div class="card-header"><span class="card-name">${this._esc(card.name)}</span><span class="card-element-badge">${ELEMENT_ICONS[attr] || ""}</span><span class="card-cost">${card.level || ""}</span></div><div class="card-art"><div class="card-art-inner">${getCardImageHTML(card)}</div></div>${description}<div class="card-footer">${stats}${typeLabel}</div></div>`;
    }

    /**
     * 区域一览浮层：
     * 墓地是公开信息——能不能看清墓地，直接决定"要不要复活、对方还剩什么资源、
     * 这一击值不值得换"这类判断。以前 UI 上完全没有墓地查看入口，只有计数。
     */
    _createZoneViewerOverlay() {
        this.zoneViewerOverlay = document.createElement("div");
        this.zoneViewerOverlay.className = "overlay zone-viewer-overlay";
        this.zoneViewerOverlay.id = "zone-viewer-overlay";
        this.zoneViewerOverlay.innerHTML = `
            <div class="detail-panel zone-viewer-panel">
                <h2 id="zone-viewer-title">区域一览</h2>
                <p class="zone-viewer-hint" id="zone-viewer-hint">右键任意卡牌可查看完整详情。</p>
                <div class="tribute-grid zone-viewer-grid" id="zone-viewer-grid"></div>
                <div class="zone-viewer-actions"><button class="menu-btn" id="zone-viewer-close" type="button">关闭</button></div>
            </div>`;
        document.body.appendChild(this.zoneViewerOverlay);
        this.zoneViewerOverlay.querySelector("#zone-viewer-close").addEventListener("click", () => this.hideZoneViewer());
        this.zoneViewerOverlay.addEventListener("click", event => { if (event.target === this.zoneViewerOverlay) this.hideZoneViewer(); });
    }

    showZoneViewer(title, cards, hint = "右键任意卡牌可查看完整详情。") {
        if (!this.zoneViewerOverlay) return;
        this.zoneViewerOverlay.querySelector("#zone-viewer-title").textContent = title;
        this.zoneViewerOverlay.querySelector("#zone-viewer-hint").textContent = hint;
        const grid = this.zoneViewerOverlay.querySelector("#zone-viewer-grid");
        grid.replaceChildren();
        const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
        if (list.length === 0) {
            const empty = document.createElement("p");
            empty.className = "zone-viewer-empty";
            empty.textContent = "这里还没有卡。";
            grid.appendChild(empty);
        }
        for (const card of list) {
            const el = document.createElement("div");
            el.className = `card in-hand zone-viewer-card rarity-${card.rarity || "N"}`;
            el.innerHTML = this.cardHTML(card);
            el.addEventListener("contextmenu", event => {
                event.preventDefault();
                this.showDetail(card);
            });
            grid.appendChild(el);
        }
        this.zoneViewerOverlay.classList.add("active");
        document.body.classList.add("battle-modal-open");
    }

    hideZoneViewer() {
        this.zoneViewerOverlay?.classList.remove("active");
        document.body.classList.remove("battle-modal-open");
    }

    /** 双方墓地都是公开区，点墓地堆即可查看（与 select 阶段的墓地选择浮层互不干扰）。 */
    _bindZoneViewers() {
        const piles = [["#player-graveyard-pile", 0, "我方墓地"], ["#opponent-graveyard-pile", 1, "对方墓地"]];
        for (const [selector, ownerIndex, label] of piles) {
            const pile = document.querySelector(selector);
            if (!pile) continue;
            pile.style.cursor = "pointer";
            pile.title = `点击查看${label}（墓地属于公开信息）`;
            pile.addEventListener("click", () => {
                const gs = this._gs;
                const player = gs?.players?.[ownerIndex];
                if (!player) return;
                if (gs.phase === PHASE.GRAVEYARD_SELECT) return; // 选择阶段交给专用浮层
                this.showZoneViewer(`${label} · ${player.graveyard.length} 张`, [...player.graveyard].reverse());
            });
        }
    }

    showDetail(card) {
        const attr = card.attribute || card.element || "none";
        const typeName = card.type === "monster" ? "怪兽卡" : card.type === "spell" ? "魔法卡" : "陷阱卡";
        const raceName = RACE_NAMES[card.race] || "";
        const rarityName = { N: "普通", R: "稀有", SR: "超稀有", SSR: "传说" }[card.rarity] || "";
        document.getElementById("detail-name").textContent = card.name;
        document.getElementById("detail-type").textContent = `${typeName} · ${ELEMENT_NAMES[attr] || ""}属性 · ${raceName} · Lv.${card.level || "?"} · ${rarityName}`;
        document.getElementById("detail-desc").innerHTML = cardEffectFieldsHtml(card);
        document.getElementById("detail-card-display").innerHTML = `<div class="card detail-card">${this.cardHTML(card)}</div>`;
        this.hideCardActions();
        this.detailOverlay?.classList.add("active");
        document.body.classList.add("battle-modal-open");
    }

    hideDetail() {
        this.detailOverlay?.classList.remove("active");
        document.body.classList.remove("battle-modal-open");
    }

    showGameOver(winner, names, isDraw, reason = "") {
        const icon = document.getElementById("gameover-icon"), title = document.getElementById("gameover-title"), text = document.getElementById("gameover-text");
        const reward = document.getElementById("gameover-reward");
        if (reward) reward.textContent = ["tutorial", "practice"].includes(this.mode) ? "本模式不发奖励、不计战绩" : "正在结算奖励…";
        if (isDraw) {
            icon.textContent = "DRAW";
            title.textContent = "平局";
            title.dataset.result = "draw";
            text.textContent = "双方LP同时归零";
        } else {
            icon.textContent = winner === 0 ? "VICTORY" : "DEFEAT";
            title.textContent = winner === 0 ? "决斗胜利" : "决斗败北";
            title.dataset.result = winner === 0 ? "win" : "loss";
            text.textContent = reason ? `${names[winner]} 获胜 · ${reason}` : `${names[winner]} 获胜`;
        }
        document.getElementById("gameover-overlay").classList.add("active");
        emitControllerAction(isDraw ? "drawGame" : winner === 0 ? "win" : "lose", {
            playerIndex: Number.isInteger(winner) ? winner : null,
            isDraw: !!isDraw,
            reason: reason || "",
        });
    }

    setGameOverReward(reward) {
        const el = document.getElementById("gameover-reward");
        if (!el || !reward) return;
        el.innerHTML = `<span>获得次元币</span><strong>+${Number(reward.duelCoins || 0).toLocaleString()}</strong>${(reward.bonuses || []).map(item => `<small>${this._esc(item.label)} +${item.amount}</small>`).join("")}`;
    }

    hideGameOver() { document.getElementById("gameover-overlay").classList.remove("active"); }

    addLog(msg, type, details = null) {
        const d = document.createElement("div");
        d.className = `log-entry ${type || ""}`;
        d.textContent = msg;
        this.logBody.appendChild(d);
        this.logBody.scrollTop = this.logBody.scrollHeight;
        const sourceCard = details?.card || null;
        const card = sourceCard ? {
            id: sourceCard.id,
            name: sourceCard.name,
            type: sourceCard.type,
            rarity: sourceCard.rarity,
            level: sourceCard.level,
            attack: sourceCard.attack,
            defense: sourceCard.defense,
            image: sourceCard.image || sourceCard.thumbnail,
            description: sourceCard.description,
            effects: (sourceCard.effects || []).map(effect => ({ description: effect?.description })),
        } : null;
        this._logEntries.push({
            msg,
            type,
            turn: this._currentTurn || 0,
            card,
            private: details?.private === true,
            report: details?.report ? { turn: details.report.turn, phase: details.report.phase, lines: [...details.report.lines] } : null,
        });
    }
    clearLog() { this.logBody.innerHTML = ""; this._logEntries = []; }
    _esc(s) { if (!s) return ""; const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
}
