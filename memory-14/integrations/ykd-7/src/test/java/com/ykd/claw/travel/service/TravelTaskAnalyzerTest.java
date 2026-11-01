package com.ykd.claw.travel.service;

import com.ykd.claw.skill.SkillDefinition;
import com.ykd.claw.travel.model.TravelTaskState;
import com.ykd.claw.travel.model.UserProfile;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TravelTaskAnalyzerTest {
    private final SkillDefinition skill = new SkillDefinition(
            "travel", "travel", List.of(), List.of(), List.of(), List.of(), "", Path.of("SKILL.md"));

    @Test
    void classifiesExploreAndConcretePlanScenarios() {
        TravelTaskStateService states = mock(TravelTaskStateService.class);
        when(states.merge(anyString(), anyString(), any())).thenAnswer(invocation -> {
            Map<String, Object> values = invocation.getArgument(2);
            return state(values);
        });
        UserProfileService profiles = mock(UserProfileService.class);
        when(profiles.load(anyString(), anyString())).thenReturn(new UserProfile(List.of()));
        TravelDateResolver dates = new TravelDateResolver(Clock.fixed(
                Instant.parse("2026-08-01T02:00:00Z"), ZoneId.of("Asia/Shanghai")));
        TravelTaskAnalyzer explore = analyzer(model("EXPLORE", "杭州"), dates, states, profiles);
        TravelTaskAnalyzer plan = analyzer(model("PLAN", "杭州西湖"), dates, states, profiles);

        assertEquals("EXPLORE", explore.analyze(skill, "u", "c1", "杭州有什么好玩的？").intent());
        var result = plan.analyze(skill, "u", "c2", "本周日去杭州西湖");
        assertEquals("PLAN", result.intent());
        assertEquals(List.of("游玩天数", "出发地", "人数"), result.missingInfo());
    }

    @Test
    void hotelFollowUpInheritsTheTaskTypeAndIntentFromTheWaitingRequest() {
        TravelTaskStateService states = mock(TravelTaskStateService.class);
        when(states.merge(anyString(), anyString(), any())).thenAnswer(invocation ->
                state(invocation.getArgument(2)));
        UserProfileService profiles = mock(UserProfileService.class);
        when(profiles.load(anyString(), anyString())).thenReturn(new UserProfile(List.of()));
        TravelDateResolver dates = new TravelDateResolver(Clock.fixed(
                Instant.parse("2026-08-01T02:00:00Z"), ZoneId.of("Asia/Shanghai")));
        TravelTaskAnalyzer analyzer = analyzer(model("PLAN", "杭州"), dates, states, profiles);

        var result = analyzer.analyze(skill, "u", "c", "8月3日，住三天，两个人",
                "帮我查杭州酒店\nFollow-up user message:\n8月3日，住三天，两个人");

        assertEquals("EXECUTE", result.intent());
        assertEquals("HOTEL", result.entities().get("productType"));
        assertEquals(List.of(), result.missingInfo());
    }

    private static TravelTaskAnalyzer analyzer(ChatModel model, TravelDateResolver dates,
                                               TravelTaskStateService states, UserProfileService profiles) {
        return new TravelTaskAnalyzer(ChatClient.builder(model), new com.fasterxml.jackson.databind.ObjectMapper(),
                dates, states, new InformationRequirementEvaluator(), profiles);
    }

    private static ChatModel model(String intent, String destination) {
        return prompt -> new ChatResponse(List.of(new Generation(new AssistantMessage("""
                {"intent":"%s","confidence":0.95,"taskStage":"INIT",
                 "entities":{"destination":"%s"},"missingInfo":[],"nextAction":"ASK_USER"}
                """.formatted(intent, destination)))));
    }

    private static TravelTaskState state(Map<String, Object> values) {
        String date = String.valueOf(values.getOrDefault("startDate", ""));
        return new TravelTaskState(1L, "u", "c", String.valueOf(values.getOrDefault("destination", "")),
                date.isBlank() ? null : LocalDate.parse(date),
                values.get("days") instanceof Number n ? n.intValue() : null,
                (String) values.get("departure"),
                values.get("people") instanceof Number n ? n.intValue() : null,
                values.get("budget") instanceof Number n ? n.doubleValue() : null,
                Boolean.TRUE.equals(values.get("budgetSpecified")), null, null, null, null, "INIT");
    }
}
