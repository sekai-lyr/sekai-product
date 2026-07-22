/**
 * api.js - Backend API client for Nightcord Duel Network
 * Spring Boot 整合版：使用同源 API 端点
 */

const BASE_URL = ""; // 同源，使用相对路径
const FETCH_TIMEOUT = 3000; // 3秒超时

async function request(path, options = {}) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: { "Content-Type": "application/json", ...options.headers },
            signal: controller.signal,
            ...options,
        });
        clearTimeout(timer);
        let data;
        try { data = await response.json(); } catch { return { success: false, reason: `HTTP ${response.status}` }; }
        if (!response.ok) return { success: false, reason: data.reason || `HTTP ${response.status}` };
        return { success: true, ...data };
    } catch (error) {
        return { success: false, reason: "网络连接失败" };
    }
}

// Auth
export function register(username, password, nickname) {
    return request("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password, nickname }) });
}

export function login(username, password) {
    return request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

// User
export function getUser(userId) {
    return request(`/api/users/${userId}`);
}

export function updateUser(userId, data) {
    return request(`/api/users/${userId}`, { method: "PUT", body: JSON.stringify(data) });
}

export function getUserCards(userId) {
    return request(`/api/users/${userId}/cards`);
}

// Cards
export function getAllCards() {
    return request("/api/cards");
}

// Decks
export function getUserDecks(userId) {
    return request(`/api/decks/user/${userId}`);
}

export function createDeck(userId, name, coverCardId, main) {
    return request(`/api/decks/user/${userId}`, {
        method: "POST",
        body: JSON.stringify({ name, coverCardId, main }),
    });
}

export function updateDeck(deckId, data) {
    return request(`/api/decks/${deckId}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteDeck(deckId) {
    return request(`/api/decks/${deckId}`, { method: "DELETE" });
}

// Collection
export function getUserCollection(userId) {
    return request(`/api/collection/${userId}`);
}

export function openPackServer(userId, packType = "nightcord", count = 8) {
    return request(`/api/collection/${userId}/pack`, {
        method: "POST",
        body: JSON.stringify({ packType, count }),
    });
}

// Duels
export function recordDuel(userId, data) {
    return request(`/api/duels/user/${userId}`, { method: "POST", body: JSON.stringify(data) });
}

export function getUserDuelStats(userId) {
    return request(`/api/duels/user/${userId}/stats`);
}

// Health check
export function healthCheck() {
    return request("/api/health");
}
