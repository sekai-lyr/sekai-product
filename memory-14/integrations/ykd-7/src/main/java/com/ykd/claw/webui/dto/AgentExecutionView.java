package com.ykd.claw.webui.dto;

import com.ykd.claw.agent.entity.AgentExecutionEntity;

import java.time.Instant;

/** Agent 一次执行的只读视图。 */
public record AgentExecutionView(
        String executionId, String userId, String conversationId, String status,
        String userMessage, String selectedTools, String response, String error,
        Instant startedTime, Instant completedTime, Long durationMs) {

    public static AgentExecutionView from(AgentExecutionEntity entity) {
        return new AgentExecutionView(
                entity.getExecutionId(), entity.getUserId(), entity.getConversationId(),
                entity.getStatus(), entity.getUserMessage(), entity.getSelectedTools(),
                entity.getResponse(), entity.getError(), entity.getStartedTime(),
                entity.getCompletedTime(), entity.getDurationMs());
    }
}
