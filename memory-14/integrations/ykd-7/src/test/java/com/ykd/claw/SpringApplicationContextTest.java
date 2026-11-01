package com.ykd.claw;

import com.ykd.claw.agent.DeepSeekRouter;
import com.ykd.claw.agent.ToolProvider;
import com.ykd.claw.graph.SkillGraphResult;
import com.ykd.claw.graph.SkillRequirementEvaluator;
import com.ykd.claw.graph.SkillExecutionPlan;
import com.ykd.claw.skill.repository.SkillTaskJpaRepository;
import com.ykd.claw.skill.SkillRegistry;
import com.ykd.claw.travel.service.AiTravelExecutionPlanner;
import com.ykd.claw.travel.service.TravelTaskAnalyzer;
import com.ykd.claw.graph.TaskAnalysis;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "app.cli.enabled=false",
        "spring.ai.deepseek.api-key=test-key"
})
class SpringApplicationContextTest {
    @Autowired DeepSeekRouter router;
    @Autowired List<ToolProvider> tools;
    @Autowired SkillTaskJpaRepository skillTasks;
    @Autowired SkillRegistry skillRegistry;
    @MockitoBean SkillRequirementEvaluator requirementEvaluator;
    @MockitoBean AiTravelExecutionPlanner travelExecutionPlanner;
    @MockitoBean TravelTaskAnalyzer travelTaskAnalyzer;

    @Test
    void loadsSpringContextAndDiscoversAllTools() {
        assertNotNull(router);
        assertEquals(22, tools.size());
        assertEquals("travel", skillRegistry.match("推荐杭州西湖附近的饭店").orElseThrow().name());
        assertEquals("travel", skillRegistry.match("我周日去杭州西湖").orElseThrow().name());
        assertEquals("travel", skillRegistry.match("帮我查杭州到上海的火车票").orElseThrow().name());
    }

    @Test
    void resumesTravelSkillGraphWhenTheNextMessageOnlySuppliesMissingInformation() {
        when(travelTaskAnalyzer.supports(any())).thenReturn(true);
        when(travelTaskAnalyzer.analyze(any(), anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(invocation -> {
                    String input = invocation.getArgument(3);
                    var entities = new java.util.LinkedHashMap<String, Object>();
                    entities.put("destination", "杭州");
                    entities.put("startDate", "2099-08-01");
                    entities.put("days", 3);
                    entities.put("departure", "上海");
                    entities.put("people", 1);
                    if (input.contains("预算3000")) entities.put("budget", 3000);
                    return new TaskAnalysis("PLAN", 0.95, "COLLECTING", entities,
                            List.of(), "ASK_USER");
                });
        when(travelExecutionPlanner.supports(any())).thenReturn(true);
        when(travelExecutionPlanner.plan(any(), anyString(), any())).thenReturn(new SkillExecutionPlan(
                List.of(), java.util.Map.of(
                "destination", "杭州", "startDate", "2099-08-01",
                "people", 1, "budget", 3000)));
        String conversationId = "travel-" + UUID.randomUUID();

        SkillGraphResult first = ReflectionTestUtils.invokeMethod(
                router, "selectSkill", "user-1", conversationId, "帮我规划杭州三日游");
        SkillGraphResult resumed = ReflectionTestUtils.invokeMethod(
                router, "selectSkill", "user-1", conversationId, "预算3000");
        var persisted = skillTasks.findFirstByUserIdAndConversationIdOrderByUpdatedTimeDesc(
                "user-1", conversationId).orElseThrow();

        assertNotNull(first);
        assertEquals(List.of("预算"), first.missingInformation());
        assertNotNull(resumed);
        assertEquals("travel", resumed.skillName());
        assertEquals("ready", persisted.getStatus());
        assertTrue(persisted.getAccumulatedInput().contains("杭州三日游"));
        assertTrue(persisted.getAccumulatedInput().contains("预算3000"));
    }
}
