package com.ykd.claw.travel.service;

import com.ykd.claw.graph.TaskAnalysis;
import com.ykd.claw.skill.SkillDefinition;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InformationRequirementEvaluatorTest {
    private final InformationRequirementEvaluator evaluator = new InformationRequirementEvaluator();
    private final SkillDefinition skill = new SkillDefinition(
            "travel", "travel", List.of(), List.of(), List.of(), List.of(), "", Path.of("SKILL.md"));

    @Test
    void exploreDoesNotAskPlanningQuestions() {
        TaskAnalysis result = evaluator.evaluate(skill, analysis("EXPLORE", Map.of("destination", "杭州")));
        assertEquals(List.of(), result.missingInfo());
        assertEquals("CALL_TOOL", result.nextAction());
    }

    @Test
    void concreteSundayPlanOnlyAsksFieldsThatAffectTheNextDecision() {
        TaskAnalysis result = evaluator.evaluate(skill, analysis("PLAN", Map.of(
                "destination", "杭州西湖", "startDate", "2026-08-02")));
        assertEquals(List.of("游玩天数", "出发地", "人数"), result.missingInfo());
        assertEquals("ASK_USER", result.nextAction());
    }

    @Test
    void multiDayPlanRequestsBudgetOnlyAfterDurationIsKnown() {
        TaskAnalysis result = evaluator.evaluate(skill, analysis("PLAN", Map.of(
                "destination", "杭州", "startDate", "2026-08-02", "days", 3,
                "departure", "上海", "people", 2)));
        assertEquals(List.of("预算"), result.missingInfo());
    }

    @Test
    void routeQueryRequiresAnOriginButHotelBrowsingDoesNotRequireBookingFields() {
        assertEquals(List.of("出发地"), evaluator.evaluate(skill, analysis("QUERY", Map.of(
                "destination", "杭州西湖", "productType", "ROUTE"))).missingInfo());
        assertEquals(List.of(), evaluator.evaluate(skill, analysis("QUERY", Map.of(
                "destination", "杭州", "productType", "HOTEL"))).missingInfo());
    }

    private static TaskAnalysis analysis(String intent, Map<String, Object> entities) {
        return new TaskAnalysis(intent, 0.9, "INIT", entities, List.of(), "ASK_USER");
    }
}
