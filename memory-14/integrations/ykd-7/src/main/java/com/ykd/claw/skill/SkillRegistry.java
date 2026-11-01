package com.ykd.claw.skill;

import java.util.Collection;
import java.util.Optional;

public interface SkillRegistry {
    Collection<SkillDefinition> findAll();

    Optional<SkillDefinition> findByName(String name);

    Optional<SkillDefinition> match(String userMessage);

    void reload();
}
