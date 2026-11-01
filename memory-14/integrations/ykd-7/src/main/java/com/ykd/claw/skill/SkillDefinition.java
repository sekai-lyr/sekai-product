package com.ykd.claw.skill;

import java.nio.file.Path;
import java.util.List;

public record SkillDefinition(
        String name,
        String description,
        List<String> keywords,
        List<String> availableTools,
        List<String> executionRules,
        List<String> requiredUserInformation,
        String instructions,
        Path source) {

    public String prompt() {
        return """
                Selected skill: %s
                Goal: %s
                Available tools: %s
                Execution rules:
                %s
                Required user information: %s
                """.formatted(name, description, availableTools,
                executionRules.stream().map(rule -> "- " + rule).reduce("", (a, b) -> a + b + "\n"),
                requiredUserInformation);
    }
}
