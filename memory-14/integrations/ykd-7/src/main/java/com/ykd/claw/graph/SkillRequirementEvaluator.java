package com.ykd.claw.graph;

import com.ykd.claw.skill.SkillDefinition;

import java.util.List;

public interface SkillRequirementEvaluator {
    List<String> findMissing(SkillDefinition skill, String userMessage);
}
