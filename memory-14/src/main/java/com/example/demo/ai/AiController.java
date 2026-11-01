package com.example.demo.ai;

import com.example.demo.anime.AnimeImageRecognitionService;
import com.example.demo.anime.AnimeService;
import com.example.demo.chat.ChatMemoryService;
import com.example.demo.chat.VectorStoreService;
import com.example.demo.vision.VisionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "spring.ai.enabled", havingValue = "true", matchIfMissing = false)
public class AiController {

    private final SpringAiChatService springAiChatService;
    private final ToolCallingService toolCallingService;
    private final AnimeImageRecognitionService animeImageRecognitionService;
    private final AnimeService animeService;
    private final AnimeEventService animeEventService;
    private final ChatMemoryService chatMemoryService;
    private final VectorStoreService vectorStoreService;
    private final VisionService visionService;
    private final Map<String, String> conversationCities = new ConcurrentHashMap<>();

    /** SSE 流式对话执行器：虚拟线程，任务结束即释放 */
    private final ExecutorService streamExecutor = Executors.newVirtualThreadPerTaskExecutor();

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@RequestBody Map<String, String> request) {
        AssistantProfile profile = AssistantProfile.resolve(request.get("assistant"));
        String conversationId = profile.conversationId(request.get("conversationId"));
        String message = requireMessage(request.get("message"));
        String systemPrompt = profile.systemPrompt();
        log.info("{} chat: {}", profile, message.length() > 50 ? message.substring(0, 50) + "..." : message);
        Map<String, Object> response = new HashMap<>();
        try {
            if (profile == AssistantProfile.ANIME && isRecentAnimeMovieQuestion(message)) {
                String movies = animeService.getRecentAnimeMoviesAniList(15);
                if (movies != null && !movies.isBlank()) {
                    saveShortcutResult(conversationId, message, movies);
                    response.put("success", true);
                    response.put("content", movies);
                    return ResponseEntity.ok(response);
                }
            }
            String result = springAiChatService.chatWithTools(
                    message,
                    systemPrompt,
                    profile.tools(toolCallingService.getRegisteredToolNames()),
                    conversationId);
            
            result = sanitizeUnannouncedEventAnswer(result, null);
            response.put("success", true);
            response.put("content", result);
        } catch (Exception e) {
            log.error("AI chat failed", e);
            response.put("success", false);
            response.put("error", e.getMessage());
        }
        return ResponseEntity.ok(response);
    }

    /**
     * SSE 流式对话（独立助手身份 + 工具 + 记忆 + RAG）。POST 返回 text/event-stream，
     * 事件：增量 data 帧、event:done、event:error。
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@RequestBody Map<String, String> request) {
        AssistantProfile profile = AssistantProfile.resolve(request.get("assistant"));
        String message = requireMessage(request.get("message"));
        String conversationId = profile.conversationId(request.get("conversationId"));
        String systemPrompt = profile.systemPrompt();
        SseEmitter emitter = new SseEmitter(120_000L);
        AtomicBoolean cancelled = new AtomicBoolean(false);
        emitter.onTimeout(() -> { cancelled.set(true); emitter.complete(); });
        emitter.onError(e -> cancelled.set(true));

        streamExecutor.submit(() -> {
            try {
                toolCallingService.chatWithToolsStream(systemPrompt, message,
                        profile.tools(toolCallingService.getRegisteredToolNames()), conversationId, delta -> {
                    if (cancelled.get()) throw new IllegalStateException("client disconnected");
                    try {
                        emitter.send(SseEmitter.event().data(delta));
                    } catch (IOException io) {
                        cancelled.set(true);
                        throw new IllegalStateException("send failed", io);
                    }
                });
                emitter.send(SseEmitter.event().name("done").data("[DONE]"));
                emitter.complete();
            } catch (Exception e) {
                log.error("Stream chat failed: {}", e.getMessage());
                try {
                    if (!cancelled.get()) {
                        emitter.send(SseEmitter.event().name("error")
                                .data("流式回复中断：" + e.getMessage()));
                    }
                    emitter.complete();
                } catch (Exception sendError) {
                    emitter.completeWithError(sendError);
                }
            }
        });
        return emitter;
    }

    private boolean isRecentAnimeMovieQuestion(String message) {
        if (message == null) return false;
        String normalized = message.toLowerCase(Locale.ROOT);
        boolean movie = normalized.contains("动漫电影") || normalized.contains("动画电影")
                || normalized.contains("anime movie") || normalized.contains("剧场版");
        boolean recent = normalized.contains("最近") || normalized.contains("近期")
                || normalized.contains("最新") || normalized.contains("今年")
                || normalized.contains("上映") || normalized.contains("档期");
        return movie && recent;
    }

    private boolean isAnimeEventQuestion(String message) {
        if (message == null) return false;
        String normalized = message.toLowerCase(Locale.ROOT);
        boolean event = normalized.contains("漫展") || normalized.contains("同人展")
                || normalized.contains("动漫节") || normalized.contains("comicup");
        boolean schedule = normalized.contains("最近") || normalized.contains("后面")
                || normalized.contains("接下来") || normalized.contains("日期")
                || normalized.contains("什么时候") || normalized.contains("举行");
        boolean preference = normalized.contains("纯漫展") || normalized.contains("二次元浓度")
                || normalized.contains("不想看") || normalized.contains("排除二游") || normalized.contains("同人向");
        return event && (schedule || preference);
    }

    private Optional<String> extractCity(String message) {
        if (message == null) return Optional.empty();
        Matcher matcher = Pattern.compile("(?:我在|位于|城市是|地点在)([\\p{IsHan}]{2,8}?)(?:市|，|,|。|\\s|最近|后面|接下来)").matcher(message);
        return matcher.find() ? Optional.of(matcher.group(1)) : Optional.empty();
    }

    private String searchAnimeEvents(String message, String conversationId) {
        Optional<String> explicitCity = extractCity(message);
        if (explicitCity.isPresent() && conversationId != null && !conversationId.isBlank()) {
            conversationCities.put(conversationId, explicitCity.get());
        }
        String city = explicitCity.orElseGet(() -> conversationId == null ? "杭州"
                : conversationCities.getOrDefault(conversationId, "杭州"));
        boolean pureAnime = message != null && (message.contains("纯漫展") || message.contains("二次元浓度")
                || message.contains("不想看") || message.contains("排除二游") || message.contains("同人向"));
        return animeEventService.searchIntelligence(city, pureAnime ? message + " 排除二游" : message, 8);
    }

    @PostMapping("/chat-with-tools")
    public ResponseEntity<Map<String, Object>> chatWithTools(@RequestBody Map<String, Object> request) {
        AssistantProfile profile = AssistantProfile.resolve((String) request.get("assistant"));
        String message = requireMessage((String) request.get("message"));
        String systemPrompt = profile.systemPrompt();
        String conversationId = profile.conversationId((String) request.get("conversationId"));
        @SuppressWarnings("unchecked")
        List<String> allowedTools = (List<String>) request.get("allowedTools");
        log.info("AnimeAI tool chat: tools={}", allowedTools);
        Map<String, Object> response = new HashMap<>();
        try {
            if (profile == AssistantProfile.ANIME && isRecentAnimeMovieQuestion(message)) {
                String movies = animeService.getRecentAnimeMoviesAniList(15);
                if (movies != null && !movies.isBlank()) {
                    saveShortcutResult(conversationId, message, movies);
                    response.put("success", true);
                    response.put("content", movies);
                    response.put("toolsUsed", 1);
                    response.put("toolsSucceeded", 1);
                    return ResponseEntity.ok(response);
                }
            }
            List<String> validatedTools = toolCallingService.validateToolNames(allowedTools);
            Set<String> allowedToolSet = profile.tools(toolCallingService.getRegisteredToolNames());
            allowedToolSet.retainAll(validatedTools);
            if (profile == AssistantProfile.ANIME && isAnimeEventQuestion(message)) {
                allowedToolSet.retainAll(Set.of("searchAnimeEventsChina"));
            }
            String result = springAiChatService.chatWithTools(message, systemPrompt, allowedToolSet, conversationId);
            response.put("success", true);
            response.put("content", sanitizeUnannouncedEventAnswer(result, null));
            // response.put("traceId", toolResponse.getTraceId());
            // response.put("totalIterations", toolResponse.getTotalIterations());
            // response.put("totalTokens", toolResponse.getTotalTokens());
            if (false) {
                response.put("toolCallHistory", List.of());
                        
            }
            if (false)
                // response.put("generatedFiles", toolResponse.getGeneratedFiles());
            if (false) {
                // long successCount = toolResponse.getToolCallHistory().stream()
                        
                // response.put("toolsUsed", toolResponse.getToolCallHistory().size());
                // response.put("toolsSucceeded", 0);
            }
        } catch (Exception e) {
            log.error("AI tool chat failed", e);
            response.put("success", false);
            response.put("error", e.getMessage());
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/analyze-image")
    public ResponseEntity<Map<String, Object>> analyzeImage(@RequestBody Map<String, String> request) {
        AssistantProfile profile = AssistantProfile.resolve(request.get("assistant"));
        String conversationId = profile.conversationId(request.get("conversationId"));
        Map<String, Object> response = new HashMap<>();
        try {
            String image = request.get("image");
            if (image == null || image.isBlank()) {
                throw new IllegalArgumentException("请选择图片");
            }
            String imageUrl = image.startsWith("data:") ? image : "data:image/jpeg;base64," + image;
            String question = request.get("question");
            log.info("{} image analysis: dataLength={}", profile, image.length());
            String result = profile == AssistantProfile.PLANT
                    ? visionService.analyzeImageWithCustomPrompt(imageUrl, question == null || question.isBlank()
                            ? "识别图片中的植物或宠物，描述可见的健康状况，并提供初步护理建议。" : question,
                            profile.systemPrompt())
                    : animeImageRecognitionService.recognize(imageUrl, question);
            response.put("success", true);
            response.put("content", result);
            saveShortcutResult(conversationId,
                    "用户上传图片并提问：" + (question == null || question.isBlank() ? "请识别这张图片" : question), result);
        } catch (Exception e) {
            log.error("{} image analysis failed", profile, e);
            response.put("success", false);
            response.put("error", e.getMessage());
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/tools/registered")
    public ResponseEntity<Map<String, Object>> getRegisteredTools(@RequestParam(required = false) String assistant) {
        Map<String, Object> response = new HashMap<>();
        Set<String> tools = AssistantProfile.resolve(assistant).tools(toolCallingService.getRegisteredToolNames());
        response.put("success", true);
        response.put("data", tools);
        response.put("total", tools.size());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/tools/schema")
    public ResponseEntity<Map<String, Object>> getToolsSchema(@RequestParam(required = false) String assistant) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", toolCallingService.buildToolsSchema(
                AssistantProfile.resolve(assistant).tools(toolCallingService.getRegisteredToolNames())));
        return ResponseEntity.ok(response);
    }

    private String requireMessage(String message) {
        if (message == null || message.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "消息不能为空");
        }
        return message;
    }

    private Map<String, Object> convertToolCallResult(ToolCallResult result) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("toolName", result.getToolName());
        map.put("success", result.isSuccess());
        map.put("duration", result.getDurationMs() + "ms");
        if (result.isSuccess()) {
            String out = result.getResult();
            map.put("output", out != null && out.length() > 500 ? out.substring(0, 500) + "..." : out);
        } else {
            map.put("error", result.getErrorMessage());
        }
        return map;
    }

    private void saveShortcutResult(String conversationId, String userMessage, String assistantReply) {
        if (conversationId == null || conversationId.isBlank()) return;
        try {
            chatMemoryService.saveMessagePair(conversationId, userMessage, assistantReply);
            vectorStoreService.saveMessage(conversationId, userMessage, assistantReply);
        } catch (Exception e) {
            log.warn("Failed to save shortcut response for conversation {}: {}", conversationId, e.getMessage());
        }
    }

    private String sanitizeUnannouncedEventAnswer(String answer, ToolCallResponse toolResponse) {
        if (answer == null || toolResponse == null || toolResponse.getToolCallHistory() == null) return answer;
        boolean unannounced = toolResponse.getToolCallHistory().stream()
                .filter(result -> "searchAnimeEventsChina".equals(result.getToolName()))
                .map(ToolCallResult::getResult).filter(Objects::nonNull)
                .anyMatch(result -> result.contains("尚未官宣"));
        if (!unannounced) return answer;
        return answer.lines()
                .filter(line -> !line.contains("大概率") && !line.contains("按照往届")
                        && !line.contains("一年一届") && !line.contains("半年一届")
                        && !line.contains("预计在") && !line.contains("可能在")
                        && !line.contains("如果延续") && !line.contains("推测")
                        && !line.contains("一旦官方发布") && !line.contains("官宣后通知")
                        && !(line.contains("设置") && line.contains("活动提醒") && line.contains("官方"))
                        && !line.matches(".*(?:明年|后年|下一年).*(?:春|夏|秋|冬|月|届).*")
                        && !line.matches(".*(?:第八届|下一届).*(?:202[0-9]年|春|夏|秋|冬).*")
                        && !(line.contains("2025年") && line.contains("梦乡")))
                .collect(Collectors.joining("\n"));
    }
}
