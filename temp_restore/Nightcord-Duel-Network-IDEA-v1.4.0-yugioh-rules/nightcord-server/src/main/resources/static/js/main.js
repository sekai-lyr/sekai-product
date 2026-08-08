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
import { SeededRandom } from "./rng.js";
import { loadSave, saveData } from "./storage.js";
import { createNewProfile, ensureProfile } from "./profile.js";
import { enableDemoMode } from "./collection.js";
import { createDeck } from "./deck.js";
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

// 离线用户存储
const OFFLINE_USERS_KEY = "nightcord_offline_users";
function getOfflineUsers() {
    try { return JSON.parse(localStorage.getItem(OFFLINE_USERS_KEY)) || {}; } catch { return {}; }
}
function saveOfflineUser(username, password, nickname) {
    const users = getOfflineUsers();
    users[username] = { password, nickname: nickname || username };
    localStorage.setItem(OFFLINE_USERS_KEY, JSON.stringify(users));
}
function verifyOfflineUser(username, password) {
    const users = getOfflineUsers();
    const user = users[username];
    if (!user) return null;
    if (user.password === password) return { username, nickname: user.nickname };
    return null;
}

// 预置用户：sekai / 123456520baba
(function seedOfflineUsers() {
    const users = getOfflineUsers();
    if (!users["sekai"]) {
        users["sekai"] = { password: "123456520baba", nickname: "sekai" };
        localStorage.setItem(OFFLINE_USERS_KEY, JSON.stringify(users));
    }
})();

authTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        authMode = tab.dataset.authMode;
        authTabs.forEach(t => t.classList.toggle("active", t === tab));
        nickField.classList.toggle("hidden", authMode === "login");
        authError.textContent = "";
    });
});

// 路由：根据 URL 路径决定显示登录、注册、还是游戏
function getPathRoute() {
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path === "/register") return "register";
    if (path === "/login") return "login";
    if (path === "/game" || path === "") return "game";
    return "game";
}

function showAuthScreen(mode) {
    authMode = mode;
    authTabs.forEach(t => t.classList.toggle("active", t.dataset.authMode === mode));
    nickField.classList.toggle("hidden", mode === "login");
    authScreen.classList.remove("hidden");
    document.getElementById("app-shell").classList.add("is-hidden");
}

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
        // 先尝试后端注册
        result = await api.register(username, password, nickname);
        // 后端失败则离线注册
        if (!result.success) {
            const users = getOfflineUsers();
            if (users[username]) { authError.textContent = "用户名已存在"; submitBtn.disabled = false; submitBtn.textContent = "确认"; return; }
            saveOfflineUser(username, password, nickname);
            result = { success: true, userId: Date.now(), username, nickname };
        }
    } else {
        // 离线登录优先（后端可能不可用，减少等待时间）
        const offlineUser = verifyOfflineUser(username, password);
        if (offlineUser) {
            result = { success: true, userId: Date.now(), username: offlineUser.username, nickname: offlineUser.nickname };
            // 后台尝试后端登录（用于同步数据，不影响登录）
            api.login(username, password).catch(() => {});
        } else {
            // 离线用户不存在，尝试后端登录
            result = await api.login(username, password);
            if (!result.success) {
                authError.textContent = "用户名或密码错误";
                submitBtn.disabled = false;
                submitBtn.textContent = "确认";
                return;
            }
        }
    }

    if (result.success) {
        saveAuth({ userId: result.userId, username: result.username, nickname: result.nickname });
        // 登录/注册成功后跳转到游戏首页
        if (getPathRoute() !== "game") {
            window.location.href = "/";
            return;
        }
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

    // 合并卡组：服务端有的以服务端为准，本地独有的保留
    if (decksResult.success && Array.isArray(decksResult.decks) && decksResult.decks.length > 0) {
        const serverDecks = decksResult.decks.map(d => ({
            id: d.id,
            name: d.name,
            coverCardId: d.coverCardId,
            main: (d.deckCards || []).filter(c => c.slotType === "main").sort((a, b) => a.position - b.position).map(c => c.cardId || c.card?.id),
            extra: (d.deckCards || []).filter(c => c.slotType === "extra").sort((a, b) => a.position - b.position).map(c => c.cardId || c.card?.id),
            side: (d.deckCards || []).filter(c => c.slotType === "side").sort((a, b) => a.position - b.position).map(c => c.cardId || c.card?.id),
            createdAt: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
            updatedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
        }));
        const serverDeckMap = new Map(serverDecks.map(d => [d.id, d]));
        // 用服务端卡组覆盖同ID的本地卡组，保留本地独有的
        const localOnly = collection.decks.filter(d => !serverDeckMap.has(d.id));
        collection.decks = [...serverDecks, ...localOnly];
        if (!collection.selectedDeckId || !collection.decks.find(d => d.id === collection.selectedDeckId)) {
            collection.selectedDeckId = collection.decks[0]?.id || null;
        }
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

    // 测试模式：全卡x6 + 999999决斗币 + 预组卡组（仅在设置中手动开启时生效）
    if (collection.settings.demoMode) {
        enableDemoMode(collection, ALL_CARDS);
        for (const card of ALL_CARDS) {
            if (card.enabled !== false) collection.cards[card.id] = 6;
        }
        collection.currency.duelCoins = 999999;
    }

    saveData(collection);

    const auth = loadAuth();
    if (auth) {
        try { await syncFromServer(auth.userId); } catch (e) { /* offline */ }
        saveData(collection);
    }

    app = new CardGameApp(collection, {
        onStartDuel: config => createNewGame(config.mode, config.deck, config.pvpClient, config.gameInfo),
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

function createNewGame(mode = "ai", playerDeck = app.getSelectedDeck(), pvpClient = null, gameInfo = null) {
    if (!playerDeck) {
        app.showShell();
        app.toast("没有可用卡组", "error");
        return;
    }
    currentController?.clearAiTimer();
    matchSettled = false;
    currentMatch = { mode, playerDeck, pvpClient };

    // PvP模式：使用共享随机种子，确保双方随机结果一致
    let rng = null;
    if (mode === "pvp" && gameInfo?.seed) {
        rng = new SeededRandom(gameInfo.seed);
    }

    // 构建对手卡组
    let opponentCards;
    if (mode === "pvp" && gameInfo?.opponentDeck) {
        // PvP：从同步的卡牌ID列表构建对手卡组
        opponentCards = gameInfo.opponentDeck
            .map(cardId => getCardById(cardId))
            .filter(Boolean)
            .map(card => hydrateCardArt(card, collection.selectedArtByCard));
    } else {
        // AI：使用预设卡组
        opponentCards = buildDeckCards(getAIDeck("easy"));
    }

    const state = new GameState();
    state.players = [
        new Player(collection.profile?.name || "决斗者", buildDeckCards(playerDeck), rng),
        new Player(gameInfo?.opponentName || (mode === "ai" ? "Nightcord AI" : "对手"), opponentCards, rng),
    ];

    const engine = new GameEngine(state, rng);
    currentUI = currentUI || new GameUI();
    currentController = new GameController(state, engine, currentUI);
    currentController.mode = mode;
    currentController.pvpClient = pvpClient;
    currentUI.mode = mode;
    currentUI.onReturnHome = () => {
        if (pvpClient) pvpClient.disconnect();
        app.navigate("home");
    };
    currentController.onGameOver = result => settleMatch(result);
    currentUI.clearLog();
    currentUI.showBattle();

    if (mode === "pvp" && pvpClient) {
        // PvP模式：根据先手/后手决定是否立即行动
        const isMyTurn = gameInfo.yourIndex === gameInfo.firstPlayer;
        if (!isMyTurn) {
            currentUI.addLog("等待对手行动...", "turn");
        }
        // 监听对手操作
        pvpClient.onAction = (action, playerIndex) => {
            if (playerIndex === 1 - gameInfo.yourIndex) {
                currentController.applyRemoteAction(action);
            }
        };
        pvpClient.onTurnChange = () => { currentController.onPvpTurnStart?.(); };
        pvpClient.onOpponentDisconnect = () => { currentController.onGameOver({ winner: 0, isDraw: false }); };
        pvpClient.onGameOver = (winner, reason) => {
            const myWin = winner === gameInfo.yourIndex;
            currentController.onGameOver({ winner: myWin ? 0 : 1, isDraw: false });
        };
    } else {
        currentController.start();
    }
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
    if (currentMatch) {
        if (currentMatch.mode === "pvp" && currentMatch.pvpClient) {
            currentMatch.pvpClient.disconnect();
            app.navigate("home");
            app.toast("PvP对战已结束，请重新创建房间", "info");
            return;
        }
        createNewGame(currentMatch.mode, currentMatch.playerDeck);
    }
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
// URL 加 ?reset 可强制清档重来
if (new URLSearchParams(location.search).has("reset")) {
    localStorage.removeItem("dimensional_duel_save");
    localStorage.removeItem("nightcord_auth");
    localStorage.setItem("nightcord_offline_users", JSON.stringify({
        "sekai": { password: "123456520baba", nickname: "sekai" }
    }));
    history.replaceState(null, "", location.pathname);
}

// ---- 路由初始化 ----
const route = getPathRoute();
if (route === "login") {
    // /login → 强制显示登录页
    showAuthScreen("login");
} else if (route === "register") {
    // /register → 强制显示注册页
    showAuthScreen("register");
} else {
    // / 或 /game → 已登录进游戏，未登录跳 /login
    if (isAuthenticated()) {
        startApp();
    } else {
        window.location.href = "/login";
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeDomBindings, { once: true });
} else {
    initializeDomBindings();
}
