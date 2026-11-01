package com.example.demo.ai;

import com.alibaba.fastjson2.JSON;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/** 将旅行聊天交给独立的 ykd-7 后端，用户身份只取自当前登录会话。 */
@RestController
@RequestMapping("/api/travel")
public class TravelGatewayController {
    private static final MediaType UTF8_TEXT = new MediaType("text", "plain", StandardCharsets.UTF_8);
    private final String baseUrl;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public TravelGatewayController(@Value("${assistant.travel.base-url:http://127.0.0.1:8096}") String baseUrl) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    @PostMapping("/chat")
    public Map<String, Object> chat(@RequestBody Map<String, String> request, HttpSession session) {
        return forward("/chat", payload(request, session, true));
    }

    @PostMapping("/analyze-image")
    public Map<String, Object> image(@RequestBody Map<String, String> request, HttpSession session) {
        return forward("/analyze-image", payload(request, session, false));
    }

    @GetMapping("/reminders/pending")
    public Map<String, Object> pending(@RequestParam String conversationId, HttpSession session) {
        return forward("/reminders/pending", payload(Map.of("conversationId", conversationId), session, false));
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE + ";charset=UTF-8")
    public SseEmitter stream(@RequestBody Map<String, String> request, HttpSession session, HttpServletResponse response) {
        Map<String, String> body = payload(request, session, true);
        response.setContentType("text/event-stream;charset=UTF-8");
        SseEmitter emitter = new SseEmitter(300000L);
        AtomicReference<HttpURLConnection> upstream = new AtomicReference<>();
        Runnable disconnect = () -> {
            HttpURLConnection connection = upstream.get();
            if (connection != null) connection.disconnect();
        };
        emitter.onTimeout(() -> { disconnect.run(); emitter.complete(); });
        emitter.onError(error -> disconnect.run());
        executor.submit(() -> {
            try {
                HttpURLConnection connection = connect("/chat/stream", body);
                upstream.set(connection);
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                        connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    String event = "message";
                    StringBuilder data = new StringBuilder();
                    boolean done = false;
                    while ((line = reader.readLine()) != null) {
                        if (line.isEmpty()) {
                            if (!data.isEmpty()) {
                                emitter.send(SseEmitter.event().name(event).data(data.substring(0, data.length() - 1), UTF8_TEXT));
                                if (event.equals("done") || event.equals("error")) done = true;
                            }
                            event = "message";
                            data.setLength(0);
                        } else if (line.startsWith("event:")) {
                            event = line.substring(6).trim();
                        } else if (line.startsWith("data:")) {
                            String value = line.substring(5);
                            data.append(value.startsWith(" ") ? value.substring(1) : value).append('\n');
                        }
                    }
                    if (!done) throw new IOException("Travel stream ended before completion");
                } finally {
                    connection.disconnect();
                }
                emitter.complete();
            } catch (Exception error) {
                disconnect.run();
                try {
                    emitter.send(SseEmitter.event().name("error").data("旅行服务暂时不可用，请稍后重试。", UTF8_TEXT));
                    emitter.complete();
                } catch (IOException sendError) {
                    emitter.completeWithError(sendError);
                }
            }
        });
        return emitter;
    }

    private Map<String, String> payload(Map<String, String> request, HttpSession session, boolean requireMessage) {
        Object user = session.getAttribute("user");
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录");
        String conversationId = request.get("conversationId");
        if (conversationId == null || conversationId.isBlank() || conversationId.length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少有效的会话 ID");
        }
        String message = request.getOrDefault("message", request.getOrDefault("question", ""));
        if (message == null) message = "";
        if (requireMessage && message.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "消息不能为空");
        }
        Map<String, String> body = new HashMap<>();
        body.put("userId", "sekai:" + user);
        body.put("conversationId", "web_travel:" + conversationId);
        body.put("message", message);
        if (request.get("image") != null) body.put("image", request.get("image"));
        return body;
    }

    private Map<String, Object> forward(String endpoint, Map<String, String> body) {
        HttpURLConnection connection = null;
        try {
            connection = connect(endpoint, body);
            try (var input = connection.getInputStream()) {
                Map<String, Object> response = JSON.parseObject(new String(input.readAllBytes(), StandardCharsets.UTF_8));
                if (response == null) throw new IOException("Empty travel response");
                return response;
            }
        } catch (IOException | com.alibaba.fastjson2.JSONException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "旅行服务暂时不可用，请稍后重试。", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private HttpURLConnection connect(String endpoint, Map<String, String> body) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) URI.create(baseUrl + "/api/sekai" + endpoint).toURL().openConnection();
        connection.setConnectTimeout(3000);
        connection.setReadTimeout(300000);
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        connection.setDoOutput(true);
        byte[] bytes = JSON.toJSONBytes(body);
        connection.setFixedLengthStreamingMode(bytes.length);
        try {
            try (var output = connection.getOutputStream()) { output.write(bytes); }
            if (connection.getResponseCode() >= 400) throw new IOException("Travel backend rejected the request");
            return connection;
        } catch (IOException error) {
            connection.disconnect();
            throw error;
        }
    }

    @PreDestroy
    void close() {
        executor.shutdownNow();
    }
}
