package com.ykd.claw.graph;

import com.ykd.claw.skill.SkillDefinition;

import java.util.List;

/** Serializable skill data kept in Graph state; filesystem paths stay outside checkpoints. */
record SkillStateDefinition(
        String name,
        String description,
        List<String> keywords,
        List<String> availableTools,
        List<String> executionRules,
        List<String> requiredUserInformation,
        String instructions) {

    static SkillStateDefinition from(SkillDefinition skill) {
        return new SkillStateDefinition(skill.name(), skill.description(), skill.keywords(),
                skill.availableTools(), skill.executionRules(), skill.requiredUserInformation(),
                skill.instructions());
    }

    SkillDefinition toSkillDefinition() {
        return new SkillDefinition(name, description, keywords, availableTools, executionRules,
                requiredUserInformation, instructions, null);
    }

    String prompt() {
        return toSkillDefinition().prompt();
    }
}
