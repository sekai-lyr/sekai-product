package com.ykd.claw.agent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.agent.entity.ToolExecutionEntity;
import com.ykd.claw.memory.ConversationService;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;

import java.util.Map;

final class AuditedToolCallback implements ToolCallback {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private final ToolCallback delegate;
    private final AgentAuditService auditService;
    private final ConversationService conversationService;
    private final String executionId;
    private final String userId;
    private final String conversationId;

    AuditedToolCallback(ToolCallback delegate, AgentAuditService auditService,
                        ConversationService conversationService, String executionId,
                        String userId, String conversationId) {
        this.delegate = delegate;
        this.auditService = auditService;
        this.conversationService = conversationService;
        this.executionId = executionId;
        this.userId = userId;
        this.conversationId = conversationId;
    }

    @Override
    public ToolDefinition getToolDefinition() {
        return delegate.getToolDefinition();
    }

    @Override
    public ToolMetadata getToolMetadata() {
        return delegate.getToolMetadata();
    }

    @Override
    public String call(String input) {
        return execute(input, false, () -> delegate.call(input));
    }

    @Override
    public String call(String input, ToolContext toolContext) {
        boolean plannedExecution = Boolean.TRUE.equals(
                toolContext.getContext().get("plannedExecution"));
        return execute(input, plannedExecution, () -> delegate.call(input, toolContext));
    }

    private String execute(String input, boolean plannedExecution, ToolCall call) {
        String toolName = getToolDefinition().name();
        ToolExecutionEntity execution = auditService.startTool(executionId, toolName, input);
        try {
            String rawResult = call.invoke();
            String result = plannedExecution ? rawResult : successResult(toolName, rawResult);
            auditService.toolSucceeded(executionId, toolName, execution, result);
            conversationService.saveToolExecution(userId, conversationId, toolName, result, input);
            return result;
        } catch (RuntimeException e) {
            auditService.toolFailed(executionId, toolName, execution, e);
            String result = failureResult(toolName, e);
            conversationService.saveToolExecution(userId, conversationId, toolName, result, input);
            return result;
        }
    }

    private static String successResult(String toolName, String rawResult) {
        var envelope = OBJECT_MAPPER.createObjectNode();
        envelope.put("success", true);
        envelope.put("tool", toolName);
        if (rawResult == null) {
            envelope.putNull("data");
        } else {
            try {
                envelope.set("data", OBJECT_MAPPER.readTree(rawResult));
            } catch (JsonProcessingException ignored) {
                envelope.put("data", rawResult);
            }
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(envelope);
        } catch (JsonProcessingException impossible) {
            return "{\"success\":true}";
        }
    }

    private static String failureResult(String toolName, RuntimeException error) {
        Throwable root = error;
        while (root.getCause() != null) root = root.getCause();
        String message = root.getMessage() == null ? root.getClass().getSimpleName() : root.getMessage();
        try {
            return OBJECT_MAPPER.writeValueAsString(Map.of(
                    "success", false,
                    "data", Map.of(),
                    "error", Map.of(
                            "code", "TOOL_EXECUTION_FAILED",
                            "tool", toolName,
                            "message", message)));
        } catch (JsonProcessingException impossible) {
            return "{\"success\":false,\"error\":{\"code\":\"TOOL_EXECUTION_FAILED\"}}";
        }
    }

    @FunctionalInterface
    private interface ToolCall {
        String invoke();
    }
}
