package com.ykd.claw.graph;

import com.ykd.claw.skill.SkillDefinition;

import java.util.List;
import java.util.Map;

public interface SkillPlanValidator {
    boolean supports(SkillDefinition skill);

    List<String> validate(SkillDefinition skill, Map<String, Object> planningContext);
}
