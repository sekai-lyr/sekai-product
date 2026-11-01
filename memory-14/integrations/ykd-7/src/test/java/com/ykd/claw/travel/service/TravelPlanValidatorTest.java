package com.ykd.claw.travel.service;

import com.ykd.claw.skill.SkillDefinition;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TravelPlanValidatorTest {
    private final SkillDefinition skill = new SkillDefinition(
            "travel", "travel", List.of(), List.of(), List.of(), List.of(), "", Path.of("SKILL.md"));
    private final TravelPlanValidator validator = new TravelPlanValidator(
            new TravelDateValidationService(new TravelDateResolver(Clock.fixed(
                    Instant.parse("2026-08-01T02:00:00Z"), ZoneId.of("Asia/Shanghai")))));

    @Test
    void requiresOnlyCurrentlyRelevantPlanFieldsBeforeToolPlanning() {
        assertEquals(List.of("目的地", "日期", "游玩天数", "出发地", "人数"),
                validator.validate(skill, Map.of("intent", "PLAN")));
    }

    @Test
    void rejectsPastDateAndAcceptsExplicitUnlimitedBudget() {
        var invalid = validator.validate(skill, Map.of(
                "destination", "杭州", "startDate", "2026-07-31",
                "people", 1, "budgetSpecified", true));
        assertEquals(List.of("日期（不能早于今天）"), invalid);

        assertTrue(validator.validate(skill, Map.of(
                "destination", "杭州", "startDate", "2026-08-02",
                "people", 1, "budgetSpecified", true)).isEmpty());
    }
}
