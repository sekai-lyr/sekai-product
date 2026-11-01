package com.ykd.claw.graph;

import java.util.List;
import java.util.Map;

public record SkillExecutionPlan(List<PlannedToolCall> toolCalls, Map<String, Object> context) {
    public SkillExecutionPlan {
        toolCalls = List.copyOf(toolCalls);
        context = Map.copyOf(context);
    }

    public static SkillExecutionPlan empty() {
        return new SkillExecutionPlan(List.of(), Map.of());
    }
}
