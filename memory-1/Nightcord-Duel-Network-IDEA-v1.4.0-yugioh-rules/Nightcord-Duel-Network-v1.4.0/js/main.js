/**
 * main.js - 产品入口：认证、存档、游戏大厅与决斗流程
 */
import { Player, GameState } from "./model.js";
import { GameEngine } from "./engine.js";
import { GameUI } from "./ui.js";
import { GameController } from "./controller.js";
import { CardGameApp } from "./app.js";
import { ALL_CARDS, getCardById, hydrateCardArt } from "./catalog.js";
import { getAIDeck } from "./decks.js";
import { loadSave, saveData } from "./storage.js";
import { createNewProfile, ensureProfile } from "./profile.js";
import { calculateMatchReward, applyReward } from "./rewards.js";
import * as api from "./api.js";
import { saveAuth, loadAuth, clearAuth, isAuthenticated } from "./auth.js";

let collection = null;
let currentController = null;
let currentUI = null;
let currentMatch = null;
let matchSettled = false;
let app = null;

// ---- Auth Screen Logic ----
const authScreen = document.getElementById("auth-screen");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const authTabs = document.querySelectorAll("[data-auth-mode]");
const nickField = document.querySelector(".auth-nick-field");
let authMode = "login";

authTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        authMode = tab.dataset.authMode;
        authTabs.forEach(t => t.classList.toggle("active", t === tab));
        nickField.classList.toggle("hidden", authMode === "login");
        authError.textContent = "";
    });
});

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password").value;
    const nickname = document.getElementById("auth-nickname").value.trim();
    if (!username || !password) { authError.textContent = "请填写用户名和密码"; return; }

    authError.textContent = "";
    const submitBtn = authForm.querySelector(".auth-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "处理中...";

    let result;
    if (authMode === "register") {
        if (!nickname) { authError.textContent = "请填写昵称"; submitBtn.disabled = false; submitBtn.textContent = "确认"; return; }
        result = await api.register(username, password, nickname);
    } else {
        result = await api.login(username, password);
    }

    if (result.success) {
        saveAuth({ userId: result.userId, username: result.username, nickname: result.nickname });
        startApp();
    } else {
        authError.textContent = result.reason || "操作失败";
    }
    submitBtn.disabled = false;
    submitBtn.textContent = "确认";
});

// ---- Server Sync ----
async function syncFromServer(userId) {
    const [userResult, decksResult, collectionResult] = await Promise.all([
        api.getUser(userId),
        api.getUserDecks(userId),
        api.getUserCollection(userId),
    ]);

    if (userResult.success) {
        collection.profile.name = userResult.nickname || userResult.username || collection.profile.name;
        collection.currency.duelCoins = userResult.duelCoins ?? collection.currency.duelCoins;
        collection.statistics.packsOpened = userResult.packsOpened ?? collection.statistics.packsOpened;
        collection.statistics.duelsPlayed = userResult.duelsPlayed ?? collection.statistics.duelsPlayed;
        collection.statistics.wins = userResult.wins ?? collection.statistics.wins;
        collection.statistics.losses = userResult.losses ?? collection.statistics.losses;
        collection.statistics.draws = userResult.draws ?? collection.statistics.draws;
    }

    if (decksResult.success && Array.isArray(decksResult.decks) && decksResult.decks.length > 0) {
        collection.decks = decksResult.decks.map(d => ({
            id: d.id,
            name: d.name,
            coverCardId: d.coverCardId,
            main: (d.deckCards || []).filter(c => c.slotType === "main").sort((a, b) => a.position - b.position).map(c => c.cardId || c.card?.id),
            extra: (d.deckCards || []).filter(c => c.slotType === "extra").sort((a, b) => a.position - b.position).map(c => c.cardId || c.card?.id),
            side: (d.deckCards || []).filter(c => c.slotType === "side").sort((a, b) => a.position - b.position).map(c => c.cardId || c.card?.id),
            createdAt: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
            updatedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
        }));
        collection.selectedDeckId = collection.decks[0]?.id || null;
    }

    if (collectionResult.success && Array.isArray(collectionResult)) {
        collection.cards = {};
        for (const item of collectionResult) {
            collection.cards[item.cardId] = item.count || 0;
        }
    }
}

async function syncDuelToServer(userId, matchResult, reward) {
    await api.recordDuel(userId, {
        result: matchResult,
        opponentType: "ai",
        opponentName: "Nightcord AI",
        coinsEarned: reward?.duelCoins || 0,
    });
    await api.updateUser(userId, { duelCoins: collection.currency.duelCoins });
}

// ---- App Start ----
async function startApp() {
    authScreen.classList.add("hidden");
    document.getElementById("app-shell").classList.remove("is-hidden");

    collection = ensureProfile(loadSave() || createNewProfile());
    saveData(collection);

    const auth = loadAuth();
    if (auth) {
        try { await syncFromServer(auth.userId); } catch (e) { /* offline */ }
        saveData(collection);
    }

    app = new CardGameApp(collection, {
        onStartDuel: config => createNewGame(config.mode, config.deck),
    });

    // Logout button in settings
    const originalRenderSettings = app.renderSettings.bind(app);
    app.renderSettings = function() {
        originalRenderSettings();
        const settingsPanel = this.screenRoot.querySelector(".settings-panel");
        if (settingsPanel) {
            const logoutBtn = document.createElement("button");
            logoutBtn.className = "secondary-action";
            logoutBtn.style.marginTop = "12px";
            logoutBtn.style.borderColor = "rgba(255,111,141,.4)";
            logoutBtn.style.color = "#ffc4d0";
            logoutBtn.textContent = "退出登录";
            logoutBtn.addEventListener("click", () => {
                clearAuth();
                location.reload();
            });
            settingsPanel.appendChild(logoutBtn);
        }
    };
}

// ---- Game Logic ----
function buildDeckCards(deckDefinition) {
    return deckDefinition.main
        .map(cardId => getCardById(cardId))
        .filter(Boolean)
        .map(card => hydrateCardArt(card, collection.selectedArtByCard));
}

function createNewGame(mode = "ai", playerDeck = app.getSelectedDeck()) {
    if (!playerDeck) {
        app.showShell();
        app.toast("没有可用卡组", "error");
        return;
    }
    currentController?.clearAiTimer();
    matchSettled = false;
    currentMatch = { mode, playerDeck };

    const aiDeckDefinition = getAIDeck("easy");
    const state = new GameState();
    state.players = [
        new Player(collection.profile?.name || "决斗者", buildDeckCards(playerDeck)),
        new Player(mode === "ai" ? "Nightcord AI" : "玩家 2", buildDeckCards(aiDeckDefinition)),
    ];

    const engine = new GameEngine(state);
    currentUI = currentUI || new GameUI();
    currentController = new GameController(state, engine, currentUI);
    currentController.mode = mode;
    currentUI.mode = mode;
    currentUI.onReturnHome = () => app.navigate("home");
    currentController.onGameOver = result => settleMatch(result);
    currentUI.clearLog();
    currentUI.showBattle();
    currentController.start();
}

function settleMatch({ winner, isDraw }) {
    if (matchSettled || !currentMatch) return;
    matchSettled = true;
    let result = "draw";
    if (!isDraw) result = winner === 0 ? "win" : "loss";
    const reward = calculateMatchReward(result, { statistics: collection.statistics }, collection);
    applyReward(collection, reward);
    saveData(collection);
    currentUI?.setGameOverReward(reward);
    app.renderTopbar();

    // Sync duel to backend
    const auth = loadAuth();
    if (auth) syncDuelToServer(auth.userId, result, reward).catch(() => {});
}

function returnHome() {
    currentController?.clearAiTimer();
    currentUI?.hideGameOver();
    currentUI?.showMenu();
}

function rematch() {
    currentUI?.hideGameOver();
    if (currentMatch) createNewGame(currentMatch.mode, currentMatch.playerDeck);
}

let domBindingsInitialized = false;

function initializeDomBindings() {
    if (domBindingsInitialized) return;
    domBindingsInitialized = true;

    currentUI ||= new GameUI();
    currentUI.onReturnHome = () => app?.navigate("home");

    document.querySelector("#end-turn-button")?.addEventListener("click", () => currentController?.endTurn());
    document.querySelector("#btn-next-phase")?.addEventListener("click", () => currentController?.nextPhase());
    document.querySelector("#btn-cancel-target")?.addEventListener("click", () => {
        if (!currentController) return;
        if (currentController.state.phase === "tribute_select") currentController.cancelTribute();
        else currentController.cancelTargetSelect();
    });
    document.querySelector("#btn-battle-exit")?.addEventListener("click", returnHome);
    document.querySelector("#btn-back-menu")?.addEventListener("click", returnHome);
    document.querySelector("#btn-rematch")?.addEventListener("click", rematch);
    document.querySelector("#log-toggle")?.addEventListener("click", () => document.body.classList.toggle("duel-log-collapsed"));
    document.querySelector("#log-collapse-inline")?.addEventListener("click", () => document.body.classList.add("duel-log-collapsed"));

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        if (currentUI?.closeTopOverlay?.()) return;
        if (currentController?.state.phase === "tribute_select") currentController.cancelTribute();
        else if (currentController?.state.phase === "target_select" || currentController?.state.phase === "graveyard_select") currentController.cancelTargetSelect();
    });

    app?.renderTopbar();
    console.log("Nightcord Duel Network 已加载", { cards: ALL_CARDS.length });
}

// ---- Entry Point ----
if (isAuthenticated()) {
    startApp();
} else {
    authScreen.classList.remove("hidden");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeDomBindings, { once: true });
} else {
    initializeDomBindings();
}
