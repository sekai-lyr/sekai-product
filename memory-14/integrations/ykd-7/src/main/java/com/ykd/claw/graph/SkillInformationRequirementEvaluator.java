package com.ykd.claw.graph;

import com.ykd.claw.skill.SkillDefinition;

public interface SkillInformationRequirementEvaluator {
    boolean supports(SkillDefinition skill);

    TaskAnalysis evaluate(SkillDefinition skill, TaskAnalysis analysis);
}
