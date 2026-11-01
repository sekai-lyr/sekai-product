package com.ykd.claw.webui.dto;

import com.ykd.claw.agent.entity.ToolExecutionEntity;

import java.time.Instant;

/** 一次工具调用的只读视图。 */
public record ToolExecutionView(
        Long id, String executionId, String toolName, String arguments, String result,
        String status, String error, Instant startedTime, Instant completedTime, Long durationMs) {

    public static ToolExecutionView from(ToolExecutionEntity entity) {
        return new ToolExecutionView(
                entity.getId(), entity.getExecutionId(), entity.getToolName(),
                entity.getArguments(), entity.getResult(), entity.getStatus(), entity.getError(),
                entity.getStartedTime(), entity.getCompletedTime(), entity.getDurationMs());
    }
}
