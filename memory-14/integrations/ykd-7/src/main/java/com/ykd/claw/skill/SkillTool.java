package com.ykd.claw.skill;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public class SkillTool implements ToolProvider {
    private final SkillRegistry registry;

    public SkillTool(SkillRegistry registry) {
        this.registry = registry;
    }

    @Tool(name = "read_skill", description = "Read the full instructions for a dynamically registered business skill.")
    public String readSkill(@ToolParam(description = "Exact skill name from the selected skill catalog") String name) {
        return registry.findByName(name).map(SkillDefinition::instructions)
                .orElse("Skill not found: " + name);
    }
}
