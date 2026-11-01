package com.ykd.claw.graph;

import java.util.List;
import java.util.Map;

public record SkillGraphResult(String skillName, String context, List<String> missingInformation,
                               List<PlannedToolCall> plannedToolCalls,
                               Map<String, Object> planningContext) {
    public SkillGraphResult(String skillName, String context, List<String> missingInformation) {
        this(skillName, context, missingInformation, List.of(), Map.of());
    }

    public SkillGraphResult(String skillName, String context, List<String> missingInformation,
                            List<PlannedToolCall> plannedToolCalls) {
        this(skillName, context, missingInformation, plannedToolCalls, Map.of());
    }

    public boolean waitingForUser() {
        return !missingInformation.isEmpty();
    }
}
