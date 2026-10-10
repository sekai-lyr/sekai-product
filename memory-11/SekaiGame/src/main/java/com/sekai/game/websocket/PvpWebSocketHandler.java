package com.sekai.game.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PvpWebSocketHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(PvpWebSocketHandler.class);
    // 每条 end_turn/game_action 都会携带双方完整战局快照：实测 60 张卡组约 76 KB，
    // 55 张起就超过旧的 64 KiB 上限，导致服务器直接关闭连接（PvP 第一回合即软锁）。
    private static final int MAX_MESSAGE_LENGTH = 512 * 1024;
    private static final int MIN_DECK_SIZE = 40;
    private static final int MAX_DECK_SIZE = 60;
    private static final int MAX_NAME_LENGTH = 40;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();

    // Room management
    private final Map<String, PvpRoom> rooms = new ConcurrentHashMap<>();

    // Session to room mapping
    private final Map<String, PvpPlayer> sessionPlayers = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String sessionId = session.getId();
        logger.info("PvP connection established: {}", sessionId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        PvpPlayer player = sessionPlayers.remove(sessionId);
        if (player != null && player.roomId != null) {
            PvpRoom room = rooms.get(player.roomId);
            if (room != null) {
                // Notify opponent
                WebSocketSession opponent = room.getOpponent(session);
                if (opponent != null && opponent.isOpen()) {
                    sendJson(opponent, Map.of("type", "opponent_disconnected"));
                }
                // 房间销毁时必须同时清掉双方会话记录：只清关闭方会让对手的连接
                // 永远停留在"你已经在房间中"，必须刷新页面才能再次建房/加入。
                if (opponent != null) sessionPlayers.remove(opponent.getId());
                rooms.remove(player.roomId);
                logger.info("Room {} closed", player.roomId);
            }
        }
        logger.info("PvP connection closed: {}", sessionId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            if (message.getPayloadLength() > MAX_MESSAGE_LENGTH) {
                sendJson(session, Map.of("type", "error", "reason", "消息过大"));
                session.close(new CloseStatus(1009, "Message too big"));
                return;
            }
            JsonNode msg = objectMapper.readTree(message.getPayload());
            String type = msg.has("type") ? msg.get("type").asText() : "";

            switch (type) {
                case "create_room" -> handleCreateRoom(session, msg);
                case "join_room" -> handleJoinRoom(session, msg);
                case "set_deck" -> handleSetDeck(session, msg);
                case "game_action" -> handleGameAction(session, msg);
                case "end_turn" -> handleEndTurn(session, msg);
                case "game_over" -> handleGameOver(session, msg);
                case "chat" -> handleChat(session, msg);
                case "ping" -> sendJson(session, Map.of("type", "pong", "at", msg.path("at").asLong(0)));
                default -> logger.warn("Unknown message type: {}", type);
            }
        } catch (Exception e) {
            logger.error("Error handling message", e);
        }
    }

    private void handleCreateRoom(WebSocketSession session, JsonNode msg) throws IOException {
        if (sessionPlayers.containsKey(session.getId())) {
            sendJson(session, Map.of("type", "error", "reason", "你已经在房间中"));
            return;
        }
        String roomId;
        do {
            roomId = String.valueOf(100000 + secureRandom.nextInt(900000));
        } while (rooms.containsKey(roomId));
        String playerName = normalizeName(msg.path("name").asText(null), "Player 1");

        PvpRoom room = new PvpRoom();
        room.host = session;
        room.hostName = playerName;
        room.seed = generateSeed();
        rooms.put(roomId, room);

        PvpPlayer player = new PvpPlayer();
        player.session = session;
        player.roomId = roomId;
        player.playerIndex = 0;
        player.playerName = playerName;
        sessionPlayers.put(session.getId(), player);

        sendJson(session, Map.of("type", "room_created", "roomId", roomId));
        logger.info("Room {} created by {}", roomId, playerName);
    }

    private void handleJoinRoom(WebSocketSession session, JsonNode msg) throws IOException {
        String roomId = msg.has("roomId") ? msg.get("roomId").asText() : "";
        if (sessionPlayers.containsKey(session.getId()) || !roomId.matches("\\d{6}")) {
            sendJson(session, Map.of("type", "error", "reason", "房间号无效"));
            return;
        }
        PvpRoom room = rooms.get(roomId);

        if (room == null) {
            sendJson(session, Map.of("type", "error", "reason", "房间不存在"));
            return;
        }
        if (room.guest != null) {
            sendJson(session, Map.of("type", "error", "reason", "房间已满"));
            return;
        }

        String playerName = normalizeName(msg.path("name").asText(null), "Player 2");
        room.guest = session;
        room.guestName = playerName;

        PvpPlayer player = new PvpPlayer();
        player.session = session;
        player.roomId = roomId;
        player.playerIndex = 1;
        player.playerName = playerName;
        sessionPlayers.put(session.getId(), player);

        // Notify host
        sendJson(room.host, Map.of("type", "opponent_joined", "name", playerName));
        // Notify guest
        sendJson(session, Map.of("type", "room_joined", "roomId", roomId, "opponent", room.hostName));

        logger.info("{} joined room {}", playerName, roomId);
    }

    private void handleSetDeck(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null) return;

        JsonNode deck = msg.has("deck") ? msg.get("deck") : objectMapper.createArrayNode();
        if (room.gameStarted || !isValidDeck(deck)) {
            sendJson(session, Map.of("type", "error", "reason", "卡组必须为40至60张，且同名卡不超过3张"));
            return;
        }
        if (player.playerIndex == 0) {
            room.hostDeck = deck;
        } else {
            room.guestDeck = deck;
        }

        // 准备与开局必须加锁：两个 set_deck 并发时可能出现重复 game_start
        // 或永远等不到开局（room.ready 是非并发集合）。
        synchronized (room) {
            if (room.gameStarted) return;
            room.ready.add(player.playerIndex);
            if (room.ready.size() < 2 || room.hostDeck == null || room.guestDeck == null) return;

            room.hostDeck = shuffleDeck(room.hostDeck);
            room.guestDeck = shuffleDeck(room.guestDeck);
            room.gameStarted = true;
            int firstPlayer = secureRandom.nextInt(2);
            room.turn = firstPlayer;

            // Send game_start to both players
            ObjectNode hostMsg = objectMapper.createObjectNode();
            hostMsg.put("type", "game_start");
            hostMsg.put("yourIndex", 0);
            hostMsg.put("firstPlayer", firstPlayer);
            hostMsg.put("seed", room.seed);
            hostMsg.set("deck", room.hostDeck);
            hostMsg.put("opponentName", room.guestName);
            hostMsg.set("opponentDeck", room.guestDeck);
            sendJson(room.host, hostMsg);

            ObjectNode guestMsg = objectMapper.createObjectNode();
            guestMsg.put("type", "game_start");
            guestMsg.put("yourIndex", 1);
            guestMsg.put("firstPlayer", firstPlayer);
            guestMsg.put("seed", room.seed);
            guestMsg.set("deck", room.guestDeck);
            guestMsg.put("opponentName", room.hostName);
            guestMsg.set("opponentDeck", room.hostDeck);
            sendJson(room.guest, guestMsg);

            logger.info("Room {}: game started, first={}, seed={}", player.roomId, firstPlayer, room.seed.substring(0, 8));
        }
    }

    private void handleGameAction(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null || !room.gameStarted) return;
        if (room.turn != player.playerIndex) {
            sendJson(session, Map.of("type", "turn_changed", "turn", room.turn));
            return;
        }

        JsonNode action = msg.get("action");
        if (action == null || !action.isObject()) return;
        String actionType = action.path("type").asText("");
        if (Set.of("selectTribute", "confirmTribute", "cancelTribute").contains(actionType)) {
            logger.warn("Ignored intermediate PvP action {} from room {}", actionType, player.roomId);
            return;
        }

        WebSocketSession opponent = room.getOpponent(session);
        if (opponent != null && opponent.isOpen()) {
            ObjectNode forwardMsg = objectMapper.createObjectNode();
            forwardMsg.put("type", "game_action");
            forwardMsg.set("action", action);
            forwardMsg.put("playerIndex", player.playerIndex);
            sendJson(opponent, forwardMsg);
        }
    }

    private void handleEndTurn(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null || !room.gameStarted) return;
        synchronized (room) {
            String requestId = msg.path("requestId").asText("");
            if (room.turn != player.playerIndex) {
                ObjectNode ack = objectMapper.createObjectNode();
                ack.put("type", "turn_changed");
                ack.put("turn", room.turn);
                if (!requestId.isEmpty()) ack.put("requestId", requestId);
                sendJson(session, ack);
                return;
            }
            // 重发的结束回合（客户端重试）必须被忽略：否则回合转回来后，迟到的
            // 重发会被当作新的结束回合，把陈旧快照推给对手并抢走回合。
            if (!requestId.isEmpty() && requestId.equals(room.lastEndTurnRequestId)) {
                ObjectNode ack = objectMapper.createObjectNode();
                ack.put("type", "turn_changed");
                ack.put("turn", room.turn);
                ack.put("requestId", requestId);
                sendJson(session, ack);
                return;
            }
            room.lastEndTurnRequestId = requestId.isEmpty() ? null : requestId;

            JsonNode state = msg.get("state");
            WebSocketSession opponent = room.getOpponent(session);
            if (state != null && state.isObject() && opponent != null && opponent.isOpen()) {
            ObjectNode syncAction = objectMapper.createObjectNode();
            syncAction.put("type", "syncState");
            syncAction.set("state", state);
            ObjectNode forwardMsg = objectMapper.createObjectNode();
            forwardMsg.put("type", "game_action");
            forwardMsg.set("action", syncAction);
            forwardMsg.put("playerIndex", player.playerIndex);
            sendJson(opponent, forwardMsg);
            }

            room.turn = 1 - player.playerIndex;
            ObjectNode turnMessage = objectMapper.createObjectNode();
            turnMessage.put("type", "turn_changed");
            turnMessage.put("turn", room.turn);
            if (!requestId.isEmpty()) turnMessage.put("requestId", requestId);
            sendJson(room.host, turnMessage);
            sendJson(room.guest, turnMessage);
            logger.info("Room {} turn changed to {} ({})", player.roomId, room.turn, requestId);
        }
    }

    private void handleGameOver(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null || !room.gameStarted) return;

        // Broadcast to both players
        ObjectNode gameOverMsg = objectMapper.createObjectNode();
        gameOverMsg.put("type", "game_over");
        // 客户端上报的 winner 是本地视角（0 = 自己获胜）；广播给对手时必须换算成
        // 绝对玩家序号（0 = 房主），否则对手会把胜负判反。
        JsonNode declaredWinner = msg.get("winner");
        if (declaredWinner == null || declaredWinner.isNull()) {
            gameOverMsg.putNull("winner");
        } else {
            int localWinner = declaredWinner.asInt(0);
            gameOverMsg.put("winner", localWinner == 0 ? player.playerIndex : 1 - player.playerIndex);
        }
        gameOverMsg.set("reason", msg.get("reason"));

        sendJson(room.host, gameOverMsg);
        sendJson(room.guest, gameOverMsg);
    }

    private void handleChat(WebSocketSession session, JsonNode msg) throws IOException {
        PvpPlayer player = sessionPlayers.get(session.getId());
        if (player == null) return;

        PvpRoom room = rooms.get(player.roomId);
        if (room == null) return;

        WebSocketSession opponent = room.getOpponent(session);
        if (opponent != null && opponent.isOpen()) {
            String message = normalizeMessage(msg.path("message").asText(null));
            if (message.isBlank()) return;
            ObjectNode chatMsg = objectMapper.createObjectNode();
            chatMsg.put("type", "chat");
            chatMsg.put("name", player.playerName);
            chatMsg.put("message", message);
            sendJson(opponent, chatMsg);
        }
    }

    private boolean isValidDeck(JsonNode deck) {
        if (deck == null || !deck.isArray() || deck.size() < MIN_DECK_SIZE || deck.size() > MAX_DECK_SIZE) {
            return false;
        }
        Map<String, Integer> counts = new HashMap<>();
        for (JsonNode card : deck) {
            if (!card.isTextual() || card.asText().isBlank() || card.asText().length() > 50) return false;
            String cardId = card.asText();
            int count = counts.merge(cardId, 1, Integer::sum);
            if (count > 3) return false;
        }
        return true;
    }

    private String normalizeName(String value, String fallback) {
        if (value == null) return fallback;
        String normalized = value.trim();
        return normalized.isBlank() ? fallback : normalized.substring(0, Math.min(MAX_NAME_LENGTH, normalized.length()));
    }

    private String normalizeMessage(String value) {
        if (value == null) return "";
        String normalized = value.trim();
        return normalized.substring(0, Math.min(500, normalized.length()));
    }

    private void sendJson(WebSocketSession session, Object data) {
        if (session == null || !session.isOpen()) return;
        try {
            String json = objectMapper.writeValueAsString(data);
            synchronized (session) {
                if (session.isOpen()) session.sendMessage(new TextMessage(json));
            }
        } catch (Exception e) {
            logger.error("Error sending message", e);
        }
    }

    private String generateSeed() {
        byte[] bytes = new byte[16];
        secureRandom.nextBytes(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private ArrayNode shuffleDeck(JsonNode deck) {
        List<JsonNode> cards = new ArrayList<>();
        deck.forEach(cards::add);
        Collections.shuffle(cards, secureRandom);
        ArrayNode shuffled = objectMapper.createArrayNode();
        shuffled.addAll(cards);
        return shuffled;
    }

    // Inner classes
    static class PvpRoom {
        WebSocketSession host;
        WebSocketSession guest;
        String hostName;
        String guestName;
        JsonNode hostDeck;
        JsonNode guestDeck;
        String seed;
        int turn;
        boolean gameStarted;
        // 已处理过的结束回合请求 id：用于忽略客户端重发的同一条 end_turn。
        String lastEndTurnRequestId;
        Set<Integer> ready = new HashSet<>();

        WebSocketSession getOpponent(WebSocketSession session) {
            if (session == host) return guest;
            if (session == guest) return host;
            return null;
        }
    }

    static class PvpPlayer {
        WebSocketSession session;
        String roomId;
        int playerIndex;
        String playerName;
    }
}
