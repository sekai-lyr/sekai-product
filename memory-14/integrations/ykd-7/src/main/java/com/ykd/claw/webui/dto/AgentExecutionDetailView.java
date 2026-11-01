package com.ykd.claw.webui.dto;

import com.ykd.claw.agent.entity.AgentExecutionEntity;

import java.time.Instant;
import java.util.List;

/** Agent 一次执行的完整详情(含上下文与工具明细)。 */
public record AgentExecutionDetailView(
        String executionId, String userId, String conversationId, int attempt, String status,
        String userMessage, String systemPrompt, String history, String memories, String selectedTools,
        String response, String error, Instant startedTime, Instant completedTime, Long durationMs,
        List<ToolExecutionView> tools) {

    public static AgentExecutionDetailView from(AgentExecutionEntity entity, List<ToolExecutionView> tools) {
        return new AgentExecutionDetailView(
                entity.getExecutionId(), entity.getUserId(), entity.getConversationId(),
                entity.getAttempt(), entity.getStatus(),
                entity.getUserMessage(), entity.getSystemPrompt(), entity.getHistory(),
                entity.getMemories(), entity.getSelectedTools(),
                entity.getResponse(), entity.getError(),
                entity.getStartedTime(), entity.getCompletedTime(), entity.getDurationMs(),
                tools);
    }
}
