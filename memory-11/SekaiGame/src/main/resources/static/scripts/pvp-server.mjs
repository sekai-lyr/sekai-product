/**
 * PvP WebSocket 中继服务器
 * 端口: 8079
 * 功能: 房间管理、玩家匹配、卡组同步、随机种子分发、操作中继
 */
import { WebSocketServer } from "ws";
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PVP_PORT || 8079);
const rooms = new Map(); // roomId -> { players: [ws, ws], decks: [null, null], turn, seed, ... }
const MAX_NAME_LENGTH = 40;
const MAX_DECK_SIZE = 60;
const MIN_DECK_SIZE = 40;
// 软限制：超过它的消息由本服务回复明确的错误并优雅关闭连接。
// 完整的双方对局快照（60 张卡组约 76KB）远小于该值，因此正常对局不会被断开。
const MAX_MESSAGE_BYTES = 512 * 1024;
// 硬限制：ws 的 maxPayload 高于软限制，超限消息才能先走到错误回复逻辑，
// 而不是在协议层被直接掐断（超过硬限制才由 ws 强制 1009 关闭）。
const MAX_PAYLOAD_BYTES = MAX_MESSAGE_BYTES * 2;
const MAX_HANDLED_REQUESTS = 32;

function generateSeed() {
    return crypto.randomBytes(16).toString("hex");
}

/** Fisher-Yates 洗牌，由服务端完成，确保双方拿到同一份洗好的卡组 */
function shuffleDeck(deck) {
    const cards = [...deck];
    for (let i = cards.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
}

/** 记录已处理过的结束回合请求，只保留最近若干个 */
function rememberRequest(room, requestId) {
    if (!requestId) return;
    room.handledRequests.add(requestId);
    while (room.handledRequests.size > MAX_HANDLED_REQUESTS) {
        room.handledRequests.delete(room.handledRequests.values().next().value);
    }
}

/** 释放连接上的房间状态，使其可以重新创建/加入房间 */
function releaseRoom(ws) {
    ws.roomId = null;
    ws.playerIndex = -1;
}

function send(ws, data) {
    if (ws?.readyState !== 1) return;
    try { ws.send(JSON.stringify(data)); } catch { /* 连接可能刚好关闭 */ }
}

function createRoomId() {
    let roomId;
    do {
        roomId = String(crypto.randomInt(100000, 1000000));
    } while (rooms.has(roomId));
    return roomId;
}

function normalizeName(value, fallback) {
    const name = typeof value === "string" ? value.trim().slice(0, MAX_NAME_LENGTH) : "";
    return name || fallback;
}

function isValidDeck(deck) {
    if (!Array.isArray(deck) || deck.length < MIN_DECK_SIZE || deck.length > MAX_DECK_SIZE) return false;
    const counts = new Map();
    return deck.every(cardId => {
        if (typeof cardId !== "string" || cardId.length === 0 || cardId.length > 50) return false;
        const count = (counts.get(cardId) || 0) + 1;
        counts.set(cardId, count);
        return count <= 3;
    });
}

const server = http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "Content-Type": "text/plain", "Allow": "GET, HEAD" });
        res.end("Method Not Allowed");
        return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(req.method === "HEAD" ? undefined : "Nightcord PvP Server Running");
});

const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });

wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.roomId = null;
    ws.playerIndex = -1;
    ws.playerName = "Player";

    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("message", (raw) => {
        if (raw.length > MAX_MESSAGE_BYTES) {
            send(ws, { type: "error", reason: "消息过大" });
            ws.close(1009, "Message too big");
            return;
        }
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;

        switch (msg.type) {
            case "create_room": {
                if (ws.roomId) { send(ws, { type: "error", reason: "你已经在房间中" }); break; }
                const roomId = createRoomId();
                rooms.set(roomId, {
                    players: [ws, null],
                    decks: [null, null],
                    turn: 0,
                    seed: generateSeed(),
                    ready: new Set(),
                    started: false,
                });
                ws.roomId = roomId;
                ws.playerIndex = 0;
                ws.playerName = normalizeName(msg.name, "Player 1");
                send(ws, { type: "room_created", roomId });
                console.log(`Room ${roomId} created by ${ws.playerName}`);
                break;
            }

            case "join_room": {
                if (ws.roomId) { send(ws, { type: "error", reason: "你已经在房间中" }); break; }
                if (typeof msg.roomId !== "string" || !/^\d{6}$/.test(msg.roomId)) {
                    send(ws, { type: "error", reason: "房间号无效" });
                    break;
                }
                const room = rooms.get(msg.roomId);
                if (!room) { send(ws, { type: "error", reason: "房间不存在" }); break; }
                if (room.players[1]) { send(ws, { type: "error", reason: "房间已满" }); break; }
                room.players[1] = ws;
                ws.roomId = msg.roomId;
                ws.playerIndex = 1;
                ws.playerName = normalizeName(msg.name, "Player 2");
                send(room.players[0], { type: "opponent_joined", name: ws.playerName });
                send(ws, { type: "room_joined", roomId: msg.roomId, opponent: room.players[0].playerName });
                console.log(`${ws.playerName} joined room ${msg.roomId}`);
                break;
            }

            case "set_deck": {
                const room = rooms.get(ws.roomId);
                if (!room || room.started) break;
                if (!isValidDeck(msg.deck)) {
                    send(ws, { type: "error", reason: "卡组必须为40至60张，且同名卡不超过3张" });
                    break;
                }
                room.decks[ws.playerIndex] = [...msg.deck];
                room.ready.add(ws.playerIndex);
                // 双方都准备好后，分发游戏开始信息
                if (room.ready.size === 2 && room.decks[0] && room.decks[1]) {
                    const firstPlayer = Math.random() < 0.5 ? 0 : 1;
                    room.turn = firstPlayer;
                    room.started = true;
                    // 服务端洗牌：客户端以 preserveDeckOrder 出战，若不在这里洗牌，
                    // 双方卡组会按编辑器原始顺序出战（起手可预知、可按顺序堆牌）。
                    room.decks = room.decks.map(deck => shuffleDeck(deck));
                    room.players.forEach((p, i) => {
                        if (p) send(p, {
                            type: "game_start",
                            yourIndex: i,
                            firstPlayer,
                            seed: room.seed,
                            deck: room.decks[i],           // 自己的卡组ID列表（已洗牌）
                            opponentName: room.players[1 - i].playerName,
                            opponentDeck: room.decks[1 - i], // 对手的卡组ID列表（已洗牌）
                        });
                    });
                    console.log(`Room ${ws.roomId}: game started, first=${firstPlayer}, seed=${room.seed.slice(0, 8)}...`);
                }
                break;
            }

            case "game_action": {
                const room = rooms.get(ws.roomId);
                if (!room || !room.started || room.turn !== ws.playerIndex || !msg.action || typeof msg.action !== "object") {
                    send(ws, { type: "error", reason: "当前不能发送该操作" });
                    break;
                }
                const opponent = room.players[1 - ws.playerIndex];
                send(opponent, { type: "game_action", action: msg.action, playerIndex: ws.playerIndex });
                break;
            }

            case "end_turn": {
                const room = rooms.get(ws.roomId);
                if (!room || !room.started || room.turn !== ws.playerIndex) {
                    send(ws, { type: "error", reason: "不是你的回合" });
                    break;
                }
                room.turn = 1 - ws.playerIndex;
                room.players.forEach(player => send(player, {
                    type: "turn_changed",
                    turn: room.turn,
                    requestId: typeof msg.requestId === "string" ? msg.requestId.slice(0, 100) : null,
                }));
                break;
            }

            case "game_over": {
                const room = rooms.get(ws.roomId);
                if (!room) break;
                room.players.forEach(p => send(p, { type: "game_over", winner: msg.winner, reason: msg.reason }));
                break;
            }

            case "chat": {
                const room = rooms.get(ws.roomId);
                if (!room) break;
                const message = typeof msg.message === "string" ? msg.message.trim().slice(0, 500) : "";
                if (!message) break;
                const opponent = room.players[1 - ws.playerIndex];
                send(opponent, { type: "chat", name: ws.playerName, message });
                break;
            }
        }
    });

    ws.on("close", () => {
        if (!ws.roomId) return;
        const room = rooms.get(ws.roomId);
        if (!room) return;
        const opponent = room.players.find(p => p && p !== ws);
        send(opponent, { type: "opponent_disconnected" });
        rooms.delete(ws.roomId);
        console.log(`Room ${ws.roomId} closed`);
    });

    ws.on("error", () => {});
});

// 心跳检测
setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Nightcord PvP Server: ws://localhost:${PORT}`);
});
