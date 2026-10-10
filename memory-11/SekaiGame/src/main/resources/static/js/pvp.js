/**
 * pvp.js - PvP WebSocket 客户端
 * 支持卡组同步、随机种子分发、全动作类型中继
 * Spring Boot 整合版：使用同源 WebSocket 端点
 */
const pvpHost = location.hostname || "127.0.0.1";
const pvpPort = location.port === "8080" ? "8079" : location.port;
const PVP_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${pvpHost}${pvpPort ? `:${pvpPort}` : ""}/ws/pvp`;

// 当前活跃客户端：新连接建立时释放上一个，避免被覆盖的客户端继续跑心跳、占着房间
let activeClient = null;

export class PvPClient {
    constructor() {
        this.ws = null;
        this.roomId = null;
        this.playerIndex = -1;
        this.connected = false;
        this.onGameStart = null;
        this.onAction = null;
        this.onTurnChange = null;
        this.onGameOver = null;
        this.onOpponentDisconnect = null;
        this.onError = null;
        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.heartbeatTimer = null;
    }

    connect() {
        // 重连前先释放上一个连接，避免遗留的心跳定时器与 socket
        if (activeClient && activeClient !== this) activeClient.destroy();
        this.destroy();
        activeClient = this;
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(PVP_URL);
                this.ws.onopen = () => { this.connected = true; this._startHeartbeat(); resolve(); };
                this.ws.onclose = () => {
                    const wasConnected = this.connected;
                    this.connected = false;
                    this._stopHeartbeat();
                    this.ws = null;
                    if (wasConnected) this.onError?.("联机连接已断开，请重新进入房间");
                    else reject(new Error("PvP 连接已关闭"));
                };
                this.ws.onerror = (e) => {
                    const notify = this.onError;
                    notify?.(this.connected ? "联机连接已断开，请重新进入房间" : "连接失败");
                    this.destroy();
                    reject(e);
                };
                this.ws.onmessage = (e) => {
                    try { this._handleMessage(JSON.parse(e.data)); }
                    catch { this.onError?.("收到无效的联机消息"); }
                };
            } catch (e) { this.destroy(); reject(e); }
        });
    }

    _handleMessage(msg) {
        switch (msg.type) {
            case "room_created": this.roomId = msg.roomId; this.onRoomCreated?.(msg.roomId); break;
            case "room_joined": this.roomId = msg.roomId; this.onRoomJoined?.(msg.roomId, msg.opponent); break;
            case "opponent_joined": this.onRoomJoined?.(this.roomId, msg.name); break;
            // game_start 包含 seed、opponentDeck、firstPlayer
            case "game_start": this.playerIndex = msg.yourIndex; this.onGameStart?.(msg); break;
            case "game_action": this.onAction?.(msg.action, msg.playerIndex); break;
            case "turn_changed": this.onTurnChange?.(msg.turn, msg.requestId || null); break;
            case "game_over": this.onGameOver?.(msg.winner, msg.reason); break;
            case "opponent_disconnected": this.onOpponentDisconnect?.(); break;
            case "error": this.onError?.(msg.reason); break;
            case "chat": break;
            case "pong": break;
        }
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this.heartbeatTimer = setInterval(() => this.send({ type: "ping", at: Date.now() }), 20000);
    }
    _stopHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }
    send(msg) {
        const ws = this.ws;
        if (ws?.readyState !== 1) {
            if (msg?.type !== "ping") this.onError?.("联机消息发送失败：连接已断开");
            // 连接已关闭/正在关闭时释放资源；仍在建连（readyState 0）时保留它等待 onopen
            if (!ws || ws.readyState >= 2) this.destroy();
            return false;
        }
        ws.send(JSON.stringify(msg));
        return true;
    }
    createRoom(name) { this.send({ type: "create_room", name }); }
    joinRoom(roomId, name) { this.send({ type: "join_room", roomId, name }); }
    /** 发送卡组数据（卡牌ID数组） */
    setDeck(cardIds) { this.send({ type: "set_deck", deck: cardIds }); }
    /** 中继游戏动作到对手 */
    sendAction(action) { this.send({ type: "game_action", action }); }
    endTurn(state = null, requestId = null) { return this.send({ type: "end_turn", state, requestId }); }
    gameOver(winner, reason) { this.send({ type: "game_over", winner, reason }); }
    /**
     * 释放客户端：停止心跳、关闭 socket 并复位连接状态（幂等，可重复调用）。
     * 回调保留，调用方在销毁后仍能收到最后一次提示。
     */
    destroy() {
        this._stopHeartbeat();
        const ws = this.ws;
        this.ws = null;
        this.connected = false;
        this.roomId = null;
        this.playerIndex = -1;
        if (activeClient === this) activeClient = null;
        if (!ws) return;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (typeof ws.close === "function") {
            try { ws.close(); } catch { /* 连接可能已经关闭 */ }
        }
    }
    disconnect() { this.destroy(); }
}
