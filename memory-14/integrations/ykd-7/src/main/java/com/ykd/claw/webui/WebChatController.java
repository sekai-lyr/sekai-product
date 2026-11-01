package com.ykd.claw.webui;

import com.ykd.claw.agent.DeepSeekRouter;
import com.ykd.claw.memory.ConversationService;
import com.ykd.claw.vision.VisionService;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** 仅在本机监听的 SekaiAI 聊天入口；沿用原来的 Router、技能图与独立记忆。 */
@RestController
@RequestMapping("/api/sekai")
public class WebChatController {
    private static final MediaType UTF8_TEXT = new MediaType("text", "plain", StandardCharsets.UTF_8);
    private final DeepSeekRouter router;
    private final VisionService vision;
    private final ConversationService conversations;
    private final WebReminderInbox reminders;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public WebChatController(DeepSeekRouter router, VisionService vision,
                             ConversationService conversations, WebReminderInbox reminders) {
        this.router = router;
        this.vision = vision;
        this.conversations = conversations;
        this.reminders = reminders;
    }

    public record ChatRequest(String userId, String conversationId, String message, String image) { }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "ok", "assistant", "travel", "backend", "ykd-7");
    }

    @PostMapping("/chat")
    public Map<String, Object> chat(@RequestBody ChatRequest request) throws IOException {
        validate(request, true);
        return Map.of("success", true, "content", router.route(
                request.userId(), request.conversationId(), request.message()));
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE + ";charset=UTF-8")
    public SseEmitter stream(@RequestBody ChatRequest request, HttpServletResponse response) {
        validate(request, true);
        response.setContentType("text/event-stream;charset=UTF-8");
        SseEmitter emitter = new SseEmitter(300000L);
        AtomicBoolean cancelled = new AtomicBoolean();
        emitter.onTimeout(() -> { cancelled.set(true); emitter.complete(); });
        emitter.onError(error -> cancelled.set(true));
        executor.submit(() -> {
            try {
                router.routeStreaming(request.userId(), request.conversationId(), request.message(), chunk -> {
                    if (cancelled.get()) throw new IllegalStateException("Client disconnected");
                    try {
                        emitter.send(SseEmitter.event().data(chunk, UTF8_TEXT));
                    } catch (IOException error) {
                        throw new IllegalStateException("Client disconnected", error);
                    }
                });
                emitter.send(SseEmitter.event().name("done").data("[DONE]"));
                emitter.complete();
            } catch (Exception error) {
                try {
                    if (!cancelled.get()) emitter.send(SseEmitter.event().name("error")
                            .data("旅行助手暂时无法完成这次请求，请稍后重试。", UTF8_TEXT));
                    emitter.complete();
                } catch (IOException sendError) {
                    emitter.completeWithError(sendError);
                }
            }
        });
        return emitter;
    }

    @PostMapping("/analyze-image")
    public Map<String, Object> image(@RequestBody ChatRequest request) throws IOException {
        validate(request, false);
        String image = request.image();
        if (image == null || !image.matches("(?s)^data:image/(png|jpeg|webp|gif);base64,.+$")) {
            throw new IllegalArgumentException("请上传 PNG、JPEG、WebP 或 GIF 图片");
        }
        if (image.length() > 14 * 1024 * 1024) throw new IllegalArgumentException("图片请小于 10MB");
        byte[] bytes = Base64.getDecoder().decode(image.substring(image.indexOf(',') + 1));
        if (bytes.length > 10 * 1024 * 1024) throw new IllegalArgumentException("图片请小于 10MB");
        Path directory = Path.of("data/web-uploads").toAbsolutePath();
        Files.createDirectories(directory);
        Path upload = Files.createTempFile(directory, "travel-", ".image");
        String question = request.message() == null || request.message().isBlank()
                ? "请识别这张图片中的地点、景物或旅行信息，不确定时请说明。" : request.message();
        try {
            Files.write(upload, bytes);
            String reply = vision.analyze(upload.toString(), "你是旅行助手远行向导，请结合照片回答：" + question);
            conversations.saveTurn(request.userId(), request.conversationId(), "用户上传图片并提问：" + question, reply);
            return Map.of("success", true, "content", reply);
        } finally {
            Files.deleteIfExists(upload);
        }
    }

    @PostMapping("/reminders/pending")
    public Map<String, Object> pending(@RequestBody ChatRequest request) {
        validate(request, false);
        return Map.of("success", true, "messages", reminders.drain(request.userId(), request.conversationId()));
    }

    private void validate(ChatRequest request, boolean requireMessage) {
        if (request.userId() == null || request.userId().isBlank()
                || request.conversationId() == null || !request.conversationId().startsWith("web_travel:")) {
            throw new IllegalArgumentException("缺少有效的用户或会话信息");
        }
        if (requireMessage && (request.message() == null || request.message().isBlank())) {
            throw new IllegalArgumentException("消息不能为空");
        }
    }

    @PreDestroy
    void close() {
        executor.shutdownNow();
    }
}
