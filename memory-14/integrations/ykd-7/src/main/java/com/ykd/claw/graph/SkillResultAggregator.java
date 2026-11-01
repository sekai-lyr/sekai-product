package com.ykd.claw.graph;

import java.util.List;
import java.util.Map;

public interface SkillResultAggregator {
    boolean supports(String skillName);

    String aggregate(Map<String, Object> planningContext, List<SkillToolResult> toolResults);
}
