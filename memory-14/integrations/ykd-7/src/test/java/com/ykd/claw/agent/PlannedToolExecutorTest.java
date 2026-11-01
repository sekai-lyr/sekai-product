package com.ykd.claw.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.agent.entity.ToolExecutionEntity;
import com.ykd.claw.graph.PlannedToolCall;
import com.ykd.claw.memory.ConversationService;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PlannedToolExecutorTest {
    @Test
    void executesGraphToolsThroughTheExistingAuditAndConversationPipeline() {
        AgentAuditService audit = mock(AgentAuditService.class);
        ConversationService conversations = mock(ConversationService.class);
        ToolExecutionEntity execution = mock(ToolExecutionEntity.class);
        when(audit.startTool("execution-1", "query_weather", "{\"city\":\"杭州\"}"))
                .thenReturn(execution);
        PlannedToolExecutor executor = new PlannedToolExecutor(audit, conversations, new ObjectMapper());

        var results = executor.execute(
                List.of(new PlannedToolCall("query_weather", Map.of("city", "杭州"))),
                new Object[]{new SampleWeatherTool()}, "execution-1", "user-1", "conversation-1");

        assertEquals("杭州：晴", results.getFirst().result());
        verify(audit).toolSucceeded("execution-1", "query_weather", execution, "\"杭州：晴\"");
        verify(conversations).saveToolExecution(
                "user-1", "conversation-1", "query_weather", "\"杭州：晴\"", "{\"city\":\"杭州\"}");
    }

    @Test
    void skipsFallbackWhenPrimaryToolSucceeds() {
        PlannedToolExecutor executor = new PlannedToolExecutor(
                mock(AgentAuditService.class), mock(ConversationService.class), new ObjectMapper());

        var results = executor.execute(List.of(
                        new PlannedToolCall("primary_search", Map.of()),
                        new PlannedToolCall("fallback_search", Map.of(), "primary_search")),
                new Object[]{new SuccessfulPrimaryTool(), new FallbackTool()},
                "execution-1", "user-1", "conversation-1");

        assertEquals(1, results.size());
        assertEquals("primary result", results.getFirst().result());
    }

    @Test
    void runsFallbackWhenPrimaryToolFails() {
        PlannedToolExecutor executor = new PlannedToolExecutor(
                mock(AgentAuditService.class), mock(ConversationService.class), new ObjectMapper());

        var results = executor.execute(List.of(
                        new PlannedToolCall("primary_search", Map.of()),
                        new PlannedToolCall("fallback_search", Map.of(), "primary_search")),
                new Object[]{new FailingPrimaryTool(), new FallbackTool()},
                "execution-1", "user-1", "conversation-1");

        assertEquals(2, results.size());
        assertEquals("TOOL_EXECUTION_FAILED: primary failed", results.getFirst().error());
        assertEquals("fallback result", results.getLast().result());
    }

    @Test
    void treatsStructuredToolErrorAsFailureAndContinuesWithFallback() {
        PlannedToolExecutor executor = new PlannedToolExecutor(
                mock(AgentAuditService.class), mock(ConversationService.class), new ObjectMapper());

        var results = executor.execute(List.of(
                        new PlannedToolCall("primary_search", Map.of()),
                        new PlannedToolCall("fallback_search", Map.of(), "primary_search")),
                new Object[]{new StructuredErrorTool(), new FallbackTool()},
                "execution-1", "user-1", "conversation-1");

        assertEquals(2, results.size());
        assertEquals("INVALID_TRAVEL_DATE: choose a future date", results.getFirst().errorMessage());
        assertEquals("fallback result", results.getLast().data());
    }

    static final class SampleWeatherTool implements ToolProvider {
        @Tool(name = "query_weather", description = "test weather")
        public String weather(@ToolParam(description = "city") String city) {
            return city + "：晴";
        }
    }

    static final class SuccessfulPrimaryTool implements ToolProvider {
        @Tool(name = "primary_search", description = "successful primary")
        public String search() {
            return "primary result";
        }
    }

    static final class FailingPrimaryTool implements ToolProvider {
        @Tool(name = "primary_search", description = "failing primary")
        public String search() {
            throw new IllegalStateException("primary failed");
        }
    }

    static final class FallbackTool implements ToolProvider {
        @Tool(name = "fallback_search", description = "fallback")
        public String search() {
            return "fallback result";
        }
    }

    static final class StructuredErrorTool implements ToolProvider {
        @Tool(name = "primary_search", description = "structured error")
        public String search() {
            return "{\"success\":false,\"error\":{\"code\":\"INVALID_TRAVEL_DATE\","
                    + "\"message\":\"choose a future date\"}}";
        }
    }
}
