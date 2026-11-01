package com.ykd.claw.agent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.graph.PlannedToolCall;
import com.ykd.claw.graph.SkillToolResult;
import com.ykd.claw.memory.ConversationService;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PlannedToolExecutor {
    private final AgentAuditService auditService;
    private final ConversationService conversationService;
    private final ObjectMapper objectMapper;

    // Cache tool callback map to avoid repeated reflection-based discovery
    private final Map<Integer, Map<String, ToolCallback>> callbackCache = new ConcurrentHashMap<>();

    public PlannedToolExecutor(AgentAuditService auditService,
                               ConversationService conversationService,
                               ObjectMapper objectMapper) {
        this.auditService = auditService;
        this.conversationService = conversationService;
        this.objectMapper = objectMapper;
    }

    public List<SkillToolResult> execute(List<PlannedToolCall> calls, Object[] providers,
                                         String executionId, String userId, String conversationId) {
        if (calls == null || calls.isEmpty()) return List.of();
        Map<String, ToolCallback> callbacks = callbackCache.computeIfAbsent(
                Arrays.deepHashCode(providers), k ->
                        Arrays.stream(providers)
                                .flatMap(provider -> Arrays.stream(MethodToolCallbackProvider.builder()
                                        .toolObjects(provider).build().getToolCallbacks()))
                                .collect(Collectors.toMap(callback -> callback.getToolDefinition().name(),
                                        Function.identity(), (left, right) -> left, LinkedHashMap::new)));
        ToolContext context = new ToolContext(Map.of(
                "userId", userId, "conversationId", conversationId,
                "plannedExecution", true));
        List<SkillToolResult> results = new ArrayList<>(java.util.Collections.nCopies(calls.size(), null));
        Set<String> successfulTools = new HashSet<>();
        executePhase(calls, results, callbacks, context, executionId, userId, conversationId,
                false, successfulTools);
        executePhase(calls, results, callbacks, context, executionId, userId, conversationId,
                true, successfulTools);
        return results.stream().filter(java.util.Objects::nonNull).toList();
    }

    private void executePhase(List<PlannedToolCall> calls, List<SkillToolResult> results,
                              Map<String, ToolCallback> callbacks, ToolContext context,
                              String executionId, String userId, String conversationId,
                              boolean fallbackPhase, Set<String> successfulTools) {
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Map<Integer, Future<SkillToolResult>> pending = new LinkedHashMap<>();
            for (int index = 0; index < calls.size(); index++) {
                PlannedToolCall call = calls.get(index);
                if ((call.fallbackFor() != null) != fallbackPhase) continue;
                if (fallbackPhase && successfulTools.contains(call.fallbackFor())) continue;
                pending.put(index, executor.submit(() -> executeOne(call, callbacks, context,
                        executionId, userId, conversationId)));
            }
            pending.forEach((index, future) -> {
                SkillToolResult result;
                try {
                    result = future.get();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    result = new SkillToolResult(calls.get(index).toolName(), null, "tool execution interrupted");
                } catch (ExecutionException e) {
                    result = new SkillToolResult(calls.get(index).toolName(), null, rootMessage(e));
                }
                results.set(index, result);
                if (result.succeeded()) successfulTools.add(result.toolName());
            });
        }
    }

    private SkillToolResult executeOne(PlannedToolCall call, Map<String, ToolCallback> callbacks,
                                       ToolContext context, String executionId,
                                       String userId, String conversationId) {
        ToolCallback callback = callbacks.get(call.toolName());
        if (callback == null) return new SkillToolResult(call.toolName(), null, "tool is not registered");
        try {
            String input = objectMapper.writeValueAsString(call.arguments());
            String result = new AuditedToolCallback(callback, auditService, conversationService,
                    executionId, userId, conversationId).call(input, context);
            String normalized = normalize(result);
            String structuredError = structuredError(normalized);
            return structuredError == null
                    ? new SkillToolResult(call.toolName(), normalized, null)
                    : new SkillToolResult(call.toolName(), null, structuredError);
        } catch (JsonProcessingException e) {
            return new SkillToolResult(call.toolName(), null,
                    "invalid tool arguments: " + e.getMessage());
        } catch (RuntimeException e) {
            return new SkillToolResult(call.toolName(), null, rootMessage(e));
        }
    }

    private static String rootMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }

    private String normalize(String result) {
        if (result == null || result.isBlank()) return result;
        try {
            var json = objectMapper.readTree(result);
            return json.isTextual() ? json.asText() : result;
        } catch (JsonProcessingException ignored) {
            return result;
        }
    }

    private String structuredError(String result) {
        if (result == null || result.isBlank()) return null;
        try {
            var root = objectMapper.readTree(result);
            if (!root.path("success").isBoolean() || root.path("success").asBoolean()) return null;
            String code = root.path("error").path("code").asText("TOOL_ERROR");
            String message = root.path("error").path("message").asText("Tool returned an error");
            return code + ": " + message;
        } catch (JsonProcessingException ignored) {
            return null;
        }
    }
}
