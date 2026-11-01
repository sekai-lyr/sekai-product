package com.ykd.claw.agent;

import com.ykd.claw.agent.entity.ToolExecutionEntity;
import com.ykd.claw.memory.ConversationService;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuditedToolCallbackTest {
    @Test
    void recordsArgumentsResultAndChatMetadata() {
        AgentAuditService audit = mock(AgentAuditService.class);
        ConversationService conversations = mock(ConversationService.class);
        ToolExecutionEntity execution = new ToolExecutionEntity(
                "execution-1", "sample_tool", "{\"value\":1}", java.time.Instant.now());
        when(audit.startTool("execution-1", "sample_tool", "{\"value\":1}")).thenReturn(execution);
        ToolCallback callback = new AuditedToolCallback(new SampleToolCallback(), audit, conversations,
                "execution-1", "user-1", "conversation-1");

        String result = callback.call("{\"value\":1}",
                new ToolContext(Map.of("userId", "user-1", "conversationId", "conversation-1")));

        assertEquals("{\"success\":true,\"tool\":\"sample_tool\",\"data\":{\"ok\":true}}", result);
        verify(audit).toolSucceeded("execution-1", "sample_tool", execution, result);
        verify(conversations).saveToolExecution(
                "user-1", "conversation-1", "sample_tool", result, "{\"value\":1}");
    }

    @Test
    void keepsRawSuccessForInternalPlannedExecution() {
        AgentAuditService audit = mock(AgentAuditService.class);
        ConversationService conversations = mock(ConversationService.class);
        ToolExecutionEntity execution = new ToolExecutionEntity(
                "execution-1", "sample_tool", "{}", java.time.Instant.now());
        when(audit.startTool("execution-1", "sample_tool", "{}")).thenReturn(execution);
        ToolCallback callback = new AuditedToolCallback(new SampleToolCallback(), audit, conversations,
                "execution-1", "user-1", "conversation-1");

        String result = callback.call("{}", new ToolContext(Map.of("plannedExecution", true)));

        assertEquals("{\"ok\":true}", result);
    }

    @Test
    void convertsToolFailureToStructuredResultSoTheAgentCanContinue() {
        AgentAuditService audit = mock(AgentAuditService.class);
        ConversationService conversations = mock(ConversationService.class);
        ToolExecutionEntity execution = new ToolExecutionEntity(
                "execution-1", "sample_tool", "{}", java.time.Instant.now());
        when(audit.startTool("execution-1", "sample_tool", "{}")).thenReturn(execution);
        ToolCallback callback = new AuditedToolCallback(new FailingToolCallback(), audit, conversations,
                "execution-1", "user-1", "conversation-1");

        String result = callback.call("{}");

        assertTrue(result.contains("\"success\":false"));
        assertTrue(result.contains("TOOL_EXECUTION_FAILED"));
        verify(audit).toolFailed(org.mockito.ArgumentMatchers.eq("execution-1"),
                org.mockito.ArgumentMatchers.eq("sample_tool"),
                org.mockito.ArgumentMatchers.eq(execution),
                org.mockito.ArgumentMatchers.any(IllegalStateException.class));
        verify(conversations).saveToolExecution(
                "user-1", "conversation-1", "sample_tool", result, "{}");
    }

    private static class SampleToolCallback implements ToolCallback {
        @Override
        public ToolDefinition getToolDefinition() {
            return ToolDefinition.builder()
                    .name("sample_tool")
                    .description("test")
                    .inputSchema("{}")
                    .build();
        }

        @Override
        public String call(String input) {
            return "{\"ok\":true}";
        }

        @Override
        public String call(String input, ToolContext toolContext) {
            return call(input);
        }
    }

    private static final class FailingToolCallback extends SampleToolCallback {
        @Override
        public String call(String input) {
            throw new IllegalStateException("remote service unavailable");
        }
    }
}
