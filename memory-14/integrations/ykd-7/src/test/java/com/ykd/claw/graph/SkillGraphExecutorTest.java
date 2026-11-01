package com.ykd.claw.graph;

import com.ykd.claw.skill.SkillDefinition;
import com.ykd.claw.agent.PlannedToolExecutor;
import com.ykd.claw.skill.service.SkillTaskState;
import com.ykd.claw.skill.service.SkillTaskStateService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SkillGraphExecutorTest {
    private final SkillDefinition skill = new SkillDefinition("travel", "plan travel", List.of("travel"),
            List.of("query_weather"), List.of("verify inputs"), List.of("destination"),
            "instructions", Path.of("SKILL.md"));

    @Test
    void followsReadyAndHumanWaitBranches() {
        SkillGraphResult ready = new SkillGraphExecutor((ignored, message) -> List.of())
                .execute(skill, "Hangzhou");
        SkillGraphResult waiting = new SkillGraphExecutor((ignored, message) -> List.of("destination"))
                .execute(skill, "plan a trip");

        assertFalse(ready.waitingForUser());
        assertTrue(waiting.waitingForUser());
        assertTrue(waiting.context().contains("destination"));
    }

    @Test
    void plansToolsAndAggregatesTheirResultsAfterRequirementsAreComplete() {
        SkillExecutionPlanner planner = new SkillExecutionPlanner() {
            @Override
            public boolean supports(SkillDefinition ignored) {
                return true;
            }

            @Override
            public SkillExecutionPlan plan(SkillDefinition ignored, String input) {
                return new SkillExecutionPlan(
                        List.of(new PlannedToolCall("query_weather", java.util.Map.of("city", "杭州"))),
                        java.util.Map.of("destination", "杭州", "days", 3));
            }
        };
        SkillResultAggregator aggregator = new SkillResultAggregator() {
            @Override
            public boolean supports(String skillName) {
                return "travel".equals(skillName);
            }

            @Override
            public String aggregate(java.util.Map<String, Object> context,
                                    List<SkillToolResult> results) {
                return "{\"destination\":\"" + context.get("destination") + "\"}";
            }
        };
        SkillGraphExecutor executor = new SkillGraphExecutor(
                (ignored, message) -> List.of(), null, List.of(planner), List.of(aggregator));

        SkillGraphResult planned = executor.execute(skill, "杭州三日游");
        SkillGraphResult aggregated = executor.aggregate(planned,
                List.of(new SkillToolResult("query_weather", "杭州：晴，30℃", null)));

        assertEquals(List.of("query_weather"),
                planned.plannedToolCalls().stream().map(PlannedToolCall::toolName).toList());
        assertTrue(aggregated.context().contains("\"destination\":\"杭州\""));
    }

    @Test
    void executesPlannedToolsInsideGraphBeforeAggregation() {
        SkillExecutionPlanner planner = new SkillExecutionPlanner() {
            @Override
            public boolean supports(SkillDefinition ignored) {
                return true;
            }

            @Override
            public SkillExecutionPlan plan(SkillDefinition ignored, String input) {
                return new SkillExecutionPlan(
                        List.of(new PlannedToolCall("query_weather_forecast",
                                java.util.Map.of("city", "杭州", "date", "2026-08-02"))),
                        java.util.Map.of("destination", "杭州"));
            }
        };
        PlannedToolExecutor toolExecutor = mock(PlannedToolExecutor.class);
        when(toolExecutor.execute(any(), any(), eq("exec-1"), eq("user-1"), eq("conversation-1")))
                .thenReturn(List.of(new SkillToolResult(
                        "query_weather_forecast", "杭州 2026-08-02：多云", null)));
        SkillGraphExecutor executor = new SkillGraphExecutor(
                (ignored, message) -> List.of(), null, List.of(planner), List.of());

        SkillGraphResult planned = executor.execute(skill, "我周日去杭州西湖");
        SkillGraphResult completed = executor.executePlannedTools(
                planned, toolExecutor, new Object[0], "exec-1", "user-1", "conversation-1");

        verify(toolExecutor).execute(any(), any(), eq("exec-1"), eq("user-1"), eq("conversation-1"));
        assertTrue(completed.context().contains("2026-08-02"));
    }

    @Test
    void clearsPlannedToolsWhenDeterministicTravelInformationValidationFails() {
        SkillExecutionPlanner planner = new SkillExecutionPlanner() {
            @Override
            public boolean supports(SkillDefinition ignored) {
                return true;
            }

            @Override
            public SkillExecutionPlan plan(SkillDefinition ignored, String input) {
                return new SkillExecutionPlan(
                        List.of(new PlannedToolCall("flyai_search_train", java.util.Map.of())),
                        java.util.Map.of("destination", "杭州"));
            }
        };
        SkillGraphExecutor executor = new SkillGraphExecutor(
                (ignored, message) -> List.of(), null, List.of(planner), List.of(),
                List.of(new SkillPlanValidator() {
                    @Override
                    public boolean supports(SkillDefinition ignored) {
                        return true;
                    }

                    @Override
                    public List<String> validate(SkillDefinition ignored,
                                                 java.util.Map<String, Object> context) {
                        return List.of("日期", "人数", "预算");
                    }
                }));

        SkillGraphResult result = executor.execute(skill, "去杭州");

        assertTrue(result.waitingForUser());
        assertEquals(List.of(), result.plannedToolCalls());
        assertEquals(List.of("日期", "人数", "预算"), result.missingInformation());
    }

    @Test
    void weatherFailureUsesFallbackNodeAndStillCompletesWithOtherSources() {
        PlannedToolExecutor toolExecutor = mock(PlannedToolExecutor.class);
        when(toolExecutor.execute(any(), any(), eq("exec-2"), eq("user-1"), eq("conversation-2")))
                .thenReturn(List.of(
                        new SkillToolResult("query_weather_forecast", null, "weather unavailable"),
                        new SkillToolResult("search_knowledge", "杭州历史气候：夏季多雨", null)));
        SkillExecutionPlanner planner = new SkillExecutionPlanner() {
            @Override public boolean supports(SkillDefinition ignored) { return true; }
            @Override public SkillExecutionPlan plan(SkillDefinition ignored, String input) {
                return new SkillExecutionPlan(List.of(
                        new PlannedToolCall("query_weather_forecast", java.util.Map.of()),
                        new PlannedToolCall("search_knowledge", java.util.Map.of())), java.util.Map.of());
            }
        };
        SkillGraphExecutor executor = new SkillGraphExecutor(
                (ignored, message) -> List.of(), null, List.of(planner), List.of());

        SkillGraphResult planned = executor.execute(skill, "杭州旅行");
        SkillGraphResult completed = executor.executePlannedTools(
                planned, toolExecutor, new Object[0], "exec-2", "user-1", "conversation-2");

        assertTrue(completed.context().contains("杭州历史气候"));
        assertTrue(completed.context().contains("FallbackNode"));
    }

    @Test
    void analyzesAndPlansTheCurrentFollowUpInsteadOfTheWholeAccumulatedConversation() {
        SkillTaskStateService tasks = mock(SkillTaskStateService.class);
        when(tasks.beginOrResume("user-1", "conversation-1", "travel", "帮我查酒店"))
                .thenReturn(new SkillTaskState(1L, "travel",
                        "之前我想去杭州玩\nFollow-up user message:\n帮我查酒店", true));
        AtomicReference<String> analyzed = new AtomicReference<>();
        AtomicReference<String> planned = new AtomicReference<>();
        SkillTaskAnalyzer analyzer = new SkillTaskAnalyzer() {
            @Override public boolean supports(SkillDefinition ignored) { return true; }
            @Override public TaskAnalysis analyze(SkillDefinition ignored, String userId,
                                                   String conversationId, String input) {
                analyzed.set(input);
                return new TaskAnalysis("QUERY", 1, "PLANNING",
                        Map.of("destination", "杭州", "productType", "HOTEL"),
                        List.of(), "CALL_TOOL");
            }
        };
        SkillExecutionPlanner planner = new SkillExecutionPlanner() {
            @Override public boolean supports(SkillDefinition ignored) { return true; }
            @Override public SkillExecutionPlan plan(SkillDefinition ignored, String input) {
                throw new AssertionError("context-aware plan method must be used");
            }
            @Override public SkillExecutionPlan plan(SkillDefinition ignored, String input,
                                                     Map<String, Object> context) {
                planned.set(input);
                assertEquals("杭州", context.get("destination"));
                return new SkillExecutionPlan(List.of(
                        new PlannedToolCall("search_place", Map.of("city", "杭州"))), context);
            }
        };
        SkillGraphExecutor executor = new SkillGraphExecutor(
                (ignored, message) -> List.of(), tasks, List.of(planner), List.of(), List.of(),
                List.of(analyzer), List.of());

        SkillGraphResult result = executor.execute(
                skill, "user-1", "conversation-1", "帮我查酒店");

        assertEquals("帮我查酒店", analyzed.get());
        assertEquals("帮我查酒店", planned.get());
        assertEquals(List.of("search_place"),
                result.plannedToolCalls().stream().map(PlannedToolCall::toolName).toList());
    }

    @Test
    void writesSerializableGraphCheckpoints(@TempDir Path checkpointDirectory) throws Exception {
        SkillGraphExecutor executor = new SkillGraphExecutor(
                (ignored, message) -> List.of(), null, List.of(), List.of(), List.of(),
                List.of(), List.of(), checkpointDirectory.toString());

        SkillGraphResult result = executor.execute(skill, "杭州旅行");

        assertFalse(result.waitingForUser());
        try (var files = Files.list(checkpointDirectory)) {
            assertTrue(files.anyMatch(Files::isRegularFile));
        }
    }
}
