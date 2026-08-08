/**
 * pvp.js - PvP WebSocket 客户端
 * 支持卡组同步、随机种子分发、全动作类型中继
 * Spring Boot 整合版：使用同源 WebSocket 端点
 */
const PVP_URL = `ws://${location.hostname}:8079`;

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
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(PVP_URL);
                this.ws.onopen = () => { this.connected = true; resolve(); };
                this.ws.onclose = () => { this.connected = false; };
                this.ws.onerror = (e) => { this.onError?.("连接失败"); reject(e); };
                this.ws.onmessage = (e) => this._handleMessage(JSON.parse(e.data));
            } catch (e) { reject(e); }
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
            case "your_turn": this.onTurnChange?.(); break;
            case "game_over": this.onGameOver?.(msg.winner, msg.reason); break;
            case "opponent_disconnected": this.onOpponentDisconnect?.(); break;
            case "error": this.onError?.(msg.reason); break;
            case "chat": break;
        }
    }

    send(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }
    createRoom(name) { this.send({ type: "create_room", name }); }
    joinRoom(roomId, name) { this.send({ type: "join_room", roomId, name }); }
    /** 发送卡组数据（卡牌ID数组） */
    setDeck(cardIds) { this.send({ type: "set_deck", deck: cardIds }); }
    /** 中继游戏动作到对手 */
    sendAction(action) { this.send({ type: "game_action", action }); }
    endTurn() { this.send({ type: "end_turn" }); }
    gameOver(winner, reason) { this.send({ type: "game_over", winner, reason }); }
    disconnect() { this.ws?.close(); this.ws = null; this.connected = false; this.roomId = null; }
}
