package com.ykd.claw.graph;

import com.ykd.claw.skill.SkillDefinition;

import java.util.Map;

public interface SkillExecutionPlanner {
    boolean supports(SkillDefinition skill);

    SkillExecutionPlan plan(SkillDefinition skill, String accumulatedInput);

    default SkillExecutionPlan plan(SkillDefinition skill, String currentInput,
                                    Map<String, Object> knownContext) {
        return plan(skill, currentInput);
    }
}
