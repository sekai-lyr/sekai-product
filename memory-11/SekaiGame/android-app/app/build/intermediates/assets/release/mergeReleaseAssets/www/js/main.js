import { configureDuelMotion, cancelDuelMotion } from "./duel-motion.js";
/**
 * main.js - 产品入口：认证、存档、游戏大厅与决斗流程
 */
import { Player, GameState, createCardInstance } from "./model.js";
import { GameEngine } from "./engine.js?v=1.8.1-strategy";
import { GameUI } from "./ui.js?v=1.9.0-trap-atlas";
import { GameController } from "./controller.js?v=1.8.0-trap-atlas";
import { CardGameApp } from "./app.js?v=3.8.0-trap-atlas";
import { ALL_CARDS, getCardById, hydrateCardArt } from "./catalog.js?v=1.8.6-original";
import { getAIDeck, getStarterDeck } from "./decks.js?v=1.7.1";
import { SeededRandom } from "./rng.js";
import { GAME_CONFIG } from "./constants.js";
import { loadSave, saveData } from "./storage.js?v=1.7.4";
import { createNewProfile, ensureProfile } from "./profile.js?v=1.7.1";
import { enableDemoMode } from "./collection.js?v=1.7.0";
import { createDeck } from "./deck.js?v=1.7.4";
import { calculateMatchReward, applyReward } from "./rewards.js?v=1.7.5-strategy";
import * as api from "./api.js?v=1.7.4";
import { saveAuth, loadAuth, clearAuth, isAuthenticated } from "./auth.js";
import { playAuthIgnition } from "./card-ignition.js?v=1.0.7";
import { setSoundEnabled } from "./audio.js?v=1.0.0";
import { TUTORIAL_CARDS, buildTutorialDecks, orderTutorialDeck, TutorialCoach } from "./tutorial.js?v=1.0.0";

function showFatalGameError(error) {
    const message = error instanceof Error
        ? `${error.message}\n\n${error.stack || ""}`
        : String(error || "Unknown error");
    let panel = document.getElementById("fatal-game-error");
    if (!panel) {
        panel = document.createElement("section");
        panel.id = "fatal-game-error";
        panel.style.cssText = "position:fixed;z-index:10000;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 32px));padding:24px;border:1px solid #ff7b99;background:#15101b;color:#fff;box-shadow:0 20px 70px rgba(0,0,0,.5);font:16px/1.6 system-ui,sans-serif";
        document.body.appendChild(panel);
    }
    panel.innerHTML = `<strong style="display:block;margin-bottom:8px;color:#ff9bb1">PvP 初始化失败</strong><code style="white-space:pre-wrap;word-break:break-word">${message.replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char])}</code><p style="margin:14px 0 0;color:#d9c9d0">请截图此提示发送给开发者。</p>`;
}

window.addEventListener("error", event => showFatalGameError(event.error || event.message));
window.addEventListener("unhandledrejection", event => showFatalGameError(event.reason));

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
let authMode = window.__nightcordAuthMode || "login";

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

authTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        authMode = tab.dataset.authMode;
        window.__nightcordAuthMode = authMode;
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
    window.__nightcordAuthMode = mode;
    authTabs.forEach(t => t.classList.toggle("active", t.dataset.authMode === mode));
    nickField.classList.toggle("hidden", mode === "login");
    authScreen.classList.remove("hidden");
    document.getElementById("app-shell").classList.add("is-hidden");
    playAuthIgnition(authScreen.querySelector("[data-auth-ignition]"));
}

function attachAuthHandler() {
    const form = document.getElementById("auth-form");
    if (!form) return;
    window.__nightcordAuthReady = true;
    form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password").value;
    const nickname = document.getElementById("auth-nickname").value.trim();
    if (!username || !password) { authError.textContent = "请填写用户名和密码"; return; }

    authError.textContent = "";
    const submitBtn = form.querySelector(".auth-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "处理中...";

    let result;
    if (authMode === "register") {
        if (!nickname) { authError.textContent = "请填写昵称"; submitBtn.disabled = false; submitBtn.textContent = "确认"; return; }
        result = await api.register(username, password, nickname);
        if (!result.success) {
            const allowOffline = ["localhost", "127.0.0.1", "appassets.androidplatform.net"].includes(location.hostname);
            if (allowOffline) {
                const users = getOfflineUsers();
                if (users[username]) { authError.textContent = "用户名已存在"; submitBtn.disabled = false; submitBtn.textContent = "确认"; return; }
                saveOfflineUser(username, password, nickname);
                result = { success: true, userId: null, username, nickname };
            } else {
                authError.textContent = result.reason || "注册失败";
                submitBtn.disabled = false;
                submitBtn.textContent = "确认";
                return;
            }
        }
    } else {
        result = await api.login(username, password);
        if (!result.success) {
            const allowOffline = ["localhost", "127.0.0.1", "appassets.androidplatform.net"].includes(location.hostname);
            const offlineUser = allowOffline ? verifyOfflineUser(username, password) : null;
            if (offlineUser) {
                result = { success: true, userId: null, username: offlineUser.username, nickname: offlineUser.nickname };
            } else {
                authError.textContent = "用户名或密码错误，或服务器暂时不可用";
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
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachAuthHandler, { once: true });
} else {
    attachAuthHandler();
}

// ---- Server Sync ----
async function syncFromServer(userId) {
    const [userResult, decksResult, collectionResult] = await Promise.all([
        api.getUser(userId),
        api.getUserDecks(userId),
        api.getUserCollection(userId),
    ]);

    if (userResult.success) {
        collection.profile.name = userResult.username || collection.profile.name;
        collection.currency.duelCoins = userResult.duelCoins ?? collection.currency.duelCoins;
        try {
            collection.currency.shards = JSON.parse(userResult.shardsJson || "{}");
            collection.pityCounters = JSON.parse(userResult.pityCountersJson || "{}");
        } catch { /* 保留本地经济数据 */ }
        collection.statistics.packsOpened = userResult.packsOpened ?? collection.statistics.packsOpened;
        collection.statistics.duelsPlayed = userResult.duelsPlayed ?? collection.statistics.duelsPlayed;
        collection.statistics.wins = userResult.wins ?? collection.statistics.wins;
        collection.statistics.losses = userResult.losses ?? collection.statistics.losses;
        collection.statistics.draws = userResult.draws ?? collection.statistics.draws;
    }

    // 登录用户完全以服务端卡组为准，避免旧浏览器存档重新上传未拥有卡。
    if (decksResult.success && Array.isArray(decksResult.decks)) {
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
        collection.decks = serverDecks;
        if (!collection.selectedDeckId || !collection.decks.find(d => d.id === collection.selectedDeckId)) {
            collection.selectedDeckId = collection.decks[0]?.id || null;
        }
    }

    const serverCollection = Array.isArray(collectionResult)
        ? collectionResult
        : Object.values(collectionResult).filter(item => item && typeof item === "object" && item.cardId);
    // 合法但背包为空的账号同样算同步成功；用卡牌数量判断会把空背包误判成
    // session 失效，从而 clearAuth() 把玩家反复踢回登录页。
    collection.inventorySynced = Boolean(collectionResult.success);
    if (collectionResult.success && serverCollection.length > 0) {
        collection.cards = {};
        for (const item of serverCollection) {
            collection.cards[item.cardId] = item.count || 0;
        }
    }

    collection.decks = (collection.decks || []).map(deck => {
        const used = {};
        const main = (deck.main || []).filter(cardId => {
            const owned = Number(collection.cards[cardId] || 0);
            used[cardId] = (used[cardId] || 0) + 1;
            return owned > 0 && used[cardId] <= owned && getCardById(cardId)?.enabled !== false;
        });
        return { ...deck, main };
    });
    return collection.inventorySynced;
}

async function syncDuelToServer(userId, matchResult, reward, mode = "ai", stage = null) {
    if (!userId) return;
    const result = await api.recordDuel(userId, {
        result: matchResult,
        opponentType: mode,
        opponentName: stage?.opponent || (mode === "pvp" ? "PvP玩家" : "Nightcord AI"),
        coinsEarned: reward?.duelCoins || 0,
    });
    if (result.success && Number.isFinite(Number(result.duelCoins))) {
        collection.currency.duelCoins = Number(result.duelCoins);
        saveData(collection);
        app?.renderTopbar();
    }
}

async function waitForAuthenticatedSession(userId) {
    const retryDelays = [0, 100, 250, 500, 800, 1200];
    for (const delay of retryDelays) {
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        try {
            const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
                credentials: "include",
                headers: { Accept: "application/json" },
                signal: controller.signal,
            });
            if (response.ok) return true;
        } catch {
            // Cookie persistence and the first navigation can finish on different ticks.
        } finally {
            clearTimeout(timeout);
        }
    }
    return false;
}

// ---- App Start ----
/**
 * 把已保存的显示设置应用到 <body>。保存设置时必须调用它，
 * 启动流程也必须调用一次，否则刷新后 reduce-motion / hide-duel-log 会丢失。
 */
function applyDisplaySettings(settings = {}) {
    configureDuelMotion(settings);
    document.body.classList.toggle("reduce-motion", Boolean(settings.reduceAnimations));
    document.body.classList.toggle("hide-duel-log", Number(settings.logLevel ?? 1) === 0);
    // 音效开关的唯一来源是存档（默认开启），启动时回放一次
    setSoundEnabled(settings.soundEnabled !== false);
}

/**
 * 离线（localhost 且后端不可用）新档如果既没有卡牌也没有卡组，玩家就永远无法凑出
 * 40 张卡组 → 无法决斗 → 无法赚币，只能清档重来。这里补一份入门卡组及其卡牌。
 */
function grantOfflineStarterIfEmpty(target) {
    const hasCards = Object.values(target.cards || {}).some(count => Number(count) > 0);
    const hasDeck = Array.isArray(target.decks) && target.decks.length > 0;
    if (hasCards || hasDeck) return false;
    const deck = getStarterDeck();
    target.decks = [deck];
    target.selectedDeckId = deck.id;
    const counts = {};
    for (const cardId of deck.main) counts[cardId] = (counts[cardId] || 0) + 1;
    for (const [cardId, count] of Object.entries(counts)) target.cards[cardId] = count;
    return true;
}

async function startApp() {    const appShell = document.getElementById("app-shell");
    const appLoading = document.getElementById("app-loading");
    authScreen.classList.add("hidden");
    appShell.classList.add("is-hidden");
    appLoading?.classList.remove("is-hidden");

    try {
        collection = ensureProfile(loadSave() || createNewProfile());
        const auth = loadAuth();

        // 登录后的 Cookie 可能在页面跳转后的首个事件循环才可用。
        // 先确认会话，再启动本地存档同步，避免把短暂的 403 当成登录失效。
        if (auth?.userId && !(await waitForAuthenticatedSession(auth.userId))) {
            clearAuth();
            authScreen.classList.remove("hidden");
            authError.textContent = "登录状态已失效，请重新登录以同步服务器卡牌";
            return;
        }

        // 无后端的离线模式：补一份入门卡组，否则新档无法进入决斗。
        if (!auth?.userId) grantOfflineStarterIfEmpty(collection);

        // 测试模式：全卡x3 + 999999次元币（仅在设置中手动开启时生效）
        if (collection.settings.demoMode) {
            enableDemoMode(collection, ALL_CARDS);
            collection.currency.duelCoins = 999999;
        }

        if (auth?.userId) {
            try {
                const csrfResult = await api.ensureCsrf();
                if (!csrfResult.success) throw new Error("CSRF 初始化失败");
            } catch (e) {
                clearAuth();
                authScreen.classList.remove("hidden");
                authError.textContent = "登录状态已失效，请重新登录以同步服务器卡牌";
                return;
            }
        }

        saveData(collection);

        if (auth?.userId) {
            let synced = false;
            try {
                synced = await syncFromServer(auth.userId);
            } catch (e) { synced = false; }
            if (!synced) {
                clearAuth();
                authScreen.classList.remove("hidden");
                authError.textContent = "登录状态已失效，请重新登录以同步服务器卡牌";
                return;
            }
            saveData(collection);
        }

        app = new CardGameApp(collection, {
            onStartDuel: config => createNewGame(config.mode, config.deck, config.pvpClient, config.gameInfo, config),
        });

        // 回放已保存的显示设置：这两个 body class 之前只在"保存设置"的瞬间生效，
        // 刷新页面后就失效（复选框仍是勾选状态，界面却恢复默认）。
        applyDisplaySettings(collection.settings || {});

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
                logoutBtn.addEventListener("click", async () => {
                    try { await api.logout(); } catch { /* 本地状态仍需清理 */ }
                    clearAuth();
                    location.reload();
                });
                settingsPanel.appendChild(logoutBtn);
            }
        };
    } catch (error) {
        appShell.classList.add("is-hidden");
        authScreen.classList.remove("hidden");
        authError.textContent = "大厅初始化失败，请刷新后重试";
        showFatalGameError(error);
    } finally {
        appLoading?.classList.add("is-hidden");
    }

    if (app) appShell.classList.remove("is-hidden");
}

// ---- Game Logic ----
function buildDeckCards(deckDefinition) {
    return deckDefinition.main
        .map(cardId => getCardById(cardId))
        .filter(Boolean)
        .map(card => hydrateCardArt(card, collection.selectedArtByCard));
}

function createNewGame(mode = "ai", playerDeck = app.getSelectedDeck(), pvpClient = null, gameInfo = null, matchConfig = {}) {
    // 教学模式自带卡组，不要求玩家先有一副合法卡组（否则新号永远进不了教学）
    if (!playerDeck && mode !== "tutorial") {
        app.showShell();
        app.toast("没有可用卡组", "error");
        return;
    }
    currentController?.dispose();
    cancelDuelMotion("new-duel");
    matchSettled = false;
    currentMatch = { mode, playerDeck, pvpClient, stage: matchConfig.stage || null, opponentDeck: matchConfig.opponentDeck || null };

    // 教学模式：卡组与起手都由 tutorial.js 指定，开局状态可复现
    const isTutorial = mode === "tutorial";
    const tutorialDecks = isTutorial ? buildTutorialDecks() : null;
    const effectivePlayerDeck = tutorialDecks
        ? { id: "tutorial_player", name: "教学卡组", main: orderTutorialDeck(tutorialDecks.player, [TUTORIAL_CARDS.learner, TUTORIAL_CARDS.learner, TUTORIAL_CARDS.learner, TUTORIAL_CARDS.trap]) }
        : playerDeck;
    const effectiveOpponentDeck = tutorialDecks
        ? { id: "tutorial_opponent", name: "教学对手", main: orderTutorialDeck(tutorialDecks.opponent, [TUTORIAL_CARDS.dummy, TUTORIAL_CARDS.dummy, TUTORIAL_CARDS.dummy]) }
        : (matchConfig.opponentDeck || playerDeck);
    if (isTutorial) currentMatch.playerDeck = effectivePlayerDeck;

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
        // AI：使用和玩家一样的卡组
        opponentCards = buildDeckCards(effectiveOpponentDeck);
    }

    const playerCards = mode === "pvp" && Array.isArray(gameInfo?.deck)
        ? gameInfo.deck.map(cardId => getCardById(cardId)).filter(Boolean).map(card => hydrateCardArt(card, collection.selectedArtByCard))
        : buildDeckCards(effectivePlayerDeck);
    // 教学与 PvP 都按原顺序构建：教学需要固定的起手，PvP 由服务端洗牌
    const preserveDeckOrder = mode === "pvp" || isTutorial;
    const state = new GameState();
    state.players = [
        new Player(isTutorial ? "你" : (collection.profile?.name || "决斗者"), playerCards, rng, preserveDeckOrder),
        new Player(gameInfo?.opponentName || matchConfig.stage?.opponent || (isTutorial ? "教学对手" : ["training", "practice"].includes(mode) ? "练习 AI" : "Nightcord AI"), opponentCards, rng, preserveDeckOrder),
    ];

    const engine = new GameEngine(state, rng);
    currentUI = currentUI || new GameUI();
    currentController = new GameController(state, engine, currentUI);
    currentController.mode = ["training", "practice"].includes(mode) || isTutorial ? "ai" : mode;
    if (isTutorial) {
        // 教学：放慢 AI、限制它的行动次数，并预置一只怪用来演示陷阱响应
        currentController.aiActionDelay = 900;
        currentController.aiMaxMainActions = 2;
        if (TUTORIAL_CARDS.dummy && state.players[1].monsterZone.length === 0) {
            const dummy = state.players[1].deck.find(card => card.id === TUTORIAL_CARDS.dummy.id)
                || createCardInstance(TUTORIAL_CARDS.dummy);
            const index = state.players[1].deck.indexOf(dummy);
            if (index >= 0) state.players[1].deck.splice(index, 1);
            state.players[1].monsterZone.push(dummy);
            dummy.setTurn = 0;
            dummy.faceUp = true;
            dummy.position = "attack";
        }
    }
    if (matchConfig.stage) {
        currentController.aiDifficulty = matchConfig.stage.difficulty;
        currentController.aiProfile = { ...(matchConfig.stage.ai || {}) };
        currentController.aiMaxMainActions = matchConfig.stage.ai?.maxMainActions
            || ({ easy: 3, normal: 5, hard: 7, expert: 9, nightmare: 11 })[matchConfig.stage.difficulty]
            || 5;
        currentController.aiActionDelay = ({ easy: 800, normal: 600, hard: 420, expert: 300, nightmare: 220 })[matchConfig.stage.difficulty] || 600;
    }
    currentController.pvpClient = pvpClient;
    currentUI.mode = mode;
    currentUI.onReturnHome = () => {
        currentController?.dispose();
        cancelDuelMotion("return-home");
        if (pvpClient) pvpClient.disconnect();
        app.navigate("home");
    };
    currentController.onGameOver = result => settleMatch(result);
    if (isTutorial) {
        // 教学：注入教练。跳过/完成都回到大厅，且不结算奖励、不计数战绩。
        currentController.tutorial = new TutorialCoach({
            ui: currentUI,
            onFinish: ({ completed, skipped }) => {
                currentUI.hideCoach();
                currentController.clearAiTimer();
                currentUI.showMenu();       // 关掉决斗界面（内部会回到大厅）
                app.toast(skipped ? "已跳过教学" : "教学完成，去实战试试吧", "success", 2600);
                void completed;
            },
        });
    }
    currentUI.clearLog();
    currentUI.showBattle();
    if (window.matchMedia?.("(max-width: 720px)").matches) {
        document.body.classList.add("duel-log-collapsed");
    } else {
        document.body.classList.remove("duel-log-collapsed");
    }

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
        pvpClient.onTurnChange = currentPlayer => {
            currentController.clearTurnAckTimer?.();
            currentController.turnEnding = false;
            if (currentPlayer === gameInfo.yourIndex) {
                currentController.onPvpTurnStart?.();
            } else {
                currentController.state.currentPlayerIndex = 1;
                currentController.checkAndRefresh();
            }
        };
        // 对手掉线不等于自己获胜：断线单独按平局结算（0 奖励）。若判负对手并发放
        // PvP 胜利奖励（+1000），两个客户端可以互相掉线无限刷币。
        pvpClient.onOpponentDisconnect = () => {
            currentUI?.addLog("对手已断开连接，本局按平局结算（不发放奖励）", "gameover");
            currentController.onGameOver({ winner: null, isDraw: true });
        };
        pvpClient.onGameOver = (winner, reason) => {
            const myWin = winner === gameInfo.yourIndex;
            currentController.onGameOver({ winner: myWin ? 0 : 1, isDraw: false });
        };
        for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) {
            engine.drawCard(state.players[0]);
            engine.drawCard(state.players[1]);
        }
        state.turn = 0;
        state.firstTurn = true;
        state.currentPlayerIndex = isMyTurn ? 0 : 1;
        currentController.checkAndRefresh();
        if (isMyTurn) {
            currentController._pvpSend({ type: "turnStart" });
            currentController._beginTurn({ openingTurn: true });
        }
    } else {
        currentController.start();
        if (isTutorial) {
            // 教练要等首回合进入主要阶段（手牌已渲染）后再显示，否则提示会悬在空画面上
            currentController.tutorial?.start();
        }
    }
}

function settleMatch({ winner, isDraw }) {
    if (matchSettled || !currentMatch) return;
    matchSettled = true;
    // 教学与借用卡组试炼不发奖励、不计入统计
    if (["tutorial", "practice"].includes(currentMatch.mode)) return;
    let result = "draw";
    if (!isDraw) result = winner === 0 ? "win" : "loss";
    const reward = calculateMatchReward(result, {
        statistics: collection.statistics,
        mode: currentMatch.mode,
        stage: currentMatch.stage,
    }, collection);
    applyReward(collection, reward);
    if (result === "win" && currentMatch.stage) {
        collection.stageProgress ||= {};
        collection.stageProgress[currentMatch.stage.id] = { cleared: true, clearedAt: Date.now() };
    }
    saveData(collection);
    currentUI?.setGameOverReward(reward);
    app.renderTopbar();

    // Sync duel to backend
    const auth = loadAuth();
    if (auth?.userId) syncDuelToServer(auth.userId, result, reward, currentMatch.mode, currentMatch.stage).catch(() => {});
}

function returnHome() {
    currentController?.dispose();
    cancelDuelMotion("return-home");
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
        createNewGame(currentMatch.mode, currentMatch.playerDeck, null, null, currentMatch);
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
        else if (currentController?.state.phase === "battle" && currentController?.state.selectedAttacker) currentController.cancelAttackSelection();
    });

    app?.renderTopbar();
    console.log("Nightcord Duel Network 已加载", { cards: ALL_CARDS.length });
}

// ---- Entry Point ----
// URL 加 ?reset 可强制清档重来
if (new URLSearchParams(location.search).has("reset")) {
    localStorage.removeItem("dimensional_duel_save");
    localStorage.removeItem("nightcord_auth");
    localStorage.removeItem(OFFLINE_USERS_KEY);
    history.replaceState(null, "", location.pathname);
}

// ---- 路由初始化 ----
const route = getPathRoute();
const isOfflineAndroid = location.hostname === "appassets.androidplatform.net";
if (isOfflineAndroid) {
    const previousAuth = loadAuth();
    saveAuth({
        userId: null,
        username: previousAuth?.username || "local_player",
        nickname: previousAuth?.nickname || "本地决斗者",
    });
    startApp();
} else if (route === "login") {
    // /login → 强制显示登录页
    showAuthScreen(window.__nightcordAuthModeTouched ? window.__nightcordAuthMode : "login");
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

if (route === "game") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeDomBindings, { once: true });
    } else {
        initializeDomBindings();
    }
}
