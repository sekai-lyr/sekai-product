package com.ykd.claw.graph;

import com.ykd.claw.skill.SkillDefinition;

public interface SkillTaskAnalyzer {
    boolean supports(SkillDefinition skill);

    TaskAnalysis analyze(SkillDefinition skill, String userId, String conversationId, String input);

    default TaskAnalysis analyze(SkillDefinition skill, String userId, String conversationId,
                                 String currentInput, String accumulatedInput) {
        return analyze(skill, userId, conversationId, currentInput);
    }
}
