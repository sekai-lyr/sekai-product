package com.ykd.claw.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiTravelExecutionPlannerTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void buildsAnItineraryPlanFromStructuredTravelInformation() throws Exception {
        var request = objectMapper.readTree("""
                {
                  "taskType": "itinerary",
                  "destination": "杭州",
                  "departure": "上海",
                  "placeKeyword": "自然景点"
                }
                """);

        var calls = AiTravelExecutionPlanner.buildPlan(request);

        assertEquals(
                java.util.List.of("query_weather", "flyai_search_poi", "search_place",
                        "search_knowledge", "search_place"),
                calls.stream().map(call -> call.toolName()).toList());
        assertEquals("杭州", calls.getFirst().arguments().get("city"));
        assertEquals("flyai_search_poi", calls.get(2).fallbackFor());
    }

    @Test
    void plansDiningWithAmapCandidatesAndWebAndKnowledgeEvidence() throws Exception {
        var request = objectMapper.readTree("""
                {
                  "taskType": "dining",
                  "destination": "杭州市",
                  "area": "西湖",
                  "placeKeyword": "杭帮菜",
                  "mealBudget": 100
                }
                """);

        var calls = AiTravelExecutionPlanner.buildPlan(request);

        assertEquals(java.util.List.of("search_place", "search_web", "search_knowledge"),
                calls.stream().map(call -> call.toolName()).toList());
        assertEquals("西湖 杭帮菜 餐厅", calls.getFirst().arguments().get("keyword"));
        // 用户给了具体用餐区域时，应作为 location 传给 search_place 按距离排序
        assertEquals("西湖", calls.getFirst().arguments().get("location"));
    }

    @Test
    void usesFlyAiForHotelsAndKeepsWebSearchOnlyAsFailureFallback() throws Exception {
        var request = objectMapper.readTree("""
                {
                  "taskType": "lodging",
                  "destination": "杭州市",
                  "placeKeyword": "西湖",
                  "startDate": "2099-07-01",
                  "endDate": "2099-07-03",
                  "maxPrice": 800
                }
                """);

        var calls = AiTravelExecutionPlanner.buildPlan(request);

        assertEquals(java.util.List.of("flyai_search_hotel", "search_place", "search_web"),
                calls.stream().map(call -> call.toolName()).toList());
        assertEquals("flyai_search_hotel", calls.getLast().fallbackFor());
        assertEquals("2099-07-01", calls.getFirst().arguments().get("checkInDate"));
        assertEquals(800, calls.getFirst().arguments().get("maxPrice"));
    }

    @Test
    void usesForecastInsteadOfCurrentWeatherWhenTravelDateIsKnown() throws Exception {
        var request = objectMapper.readTree("""
                {
                  "taskType": "itinerary",
                  "destination": "杭州",
                  "startDate": "2026-08-02",
                  "placeKeyword": "景点"
                }
                """);

        var calls = AiTravelExecutionPlanner.buildPlan(request);

        assertEquals("query_weather_forecast", calls.getFirst().toolName());
        assertEquals("2026-08-02", calls.getFirst().arguments().get("date"));
    }

    @Test
    void usesPersistedTravelContextWhenHotelFollowUpOmitsTheDestinationAndDate() {
        var model = (org.springframework.ai.chat.model.ChatModel) prompt -> new ChatResponse(List.of(
                new Generation(new AssistantMessage("{\"taskType\":\"lodging\",\"destination\":\"\"}"))));
        var dates = new TravelDateResolver(Clock.fixed(
                Instant.parse("2026-08-01T02:00:00Z"), ZoneId.of("Asia/Shanghai")));
        var planner = new AiTravelExecutionPlanner(
                ChatClient.builder(model), objectMapper, dates);

        var plan = planner.plan(null, "帮我查酒店", Map.of(
                "destination", "杭州", "startDate", "2026-08-02", "days", 3,
                "people", 2, "productType", "HOTEL", "intent", "EXECUTE"));

        assertEquals(List.of("flyai_search_hotel", "search_place", "search_web"),
                plan.toolCalls().stream().map(call -> call.toolName()).toList());
        assertEquals("杭州", plan.toolCalls().getFirst().arguments().get("destination"));
        assertEquals("2026-08-05", plan.toolCalls().getFirst().arguments().get("checkOutDate"));
    }

    @Test
    void skipsThePlannerModelWhenGraphAlreadyProvidedStructuredContext() {
        var modelCalled = new java.util.concurrent.atomic.AtomicBoolean();
        var model = (org.springframework.ai.chat.model.ChatModel) prompt -> {
            modelCalled.set(true);
            throw new AssertionError("planner model should not be called");
        };
        var dates = new TravelDateResolver(Clock.fixed(
                Instant.parse("2026-08-01T02:00:00Z"), ZoneId.of("Asia/Shanghai")));
        var planner = new AiTravelExecutionPlanner(ChatClient.builder(model), objectMapper, dates);

        var plan = planner.plan(null, "帮我查酒店", Map.of(
                "destination", "杭州", "startDate", "2026-08-02", "days", 3,
                "productType", "HOTEL", "intent", "EXECUTE"));

        assertTrue(!modelCalled.get());
        assertEquals("flyai_search_hotel", plan.toolCalls().getFirst().toolName());
    }

    @Test
    void placeQueryUsesOnlyPoiMapAndKnowledgeTools() throws Exception {
        var request = objectMapper.readTree("""
                {"taskType":"place","destination":"杭州","placeKeyword":"西湖景点"}
                """);

        var calls = AiTravelExecutionPlanner.buildPlan(request);

        assertEquals(List.of("flyai_search_poi", "search_place", "search_knowledge"),
                calls.stream().map(call -> call.toolName()).toList());
    }

    @Test
    void doesNotSearchHotelsForAOneDayItinerary() throws Exception {
        var request = objectMapper.readTree("""
                {"taskType":"itinerary","destination":"杭州","startDate":"2099-07-01","days":1}
                """);

        var calls = AiTravelExecutionPlanner.buildPlan(request);

        assertEquals(false, calls.stream().anyMatch(call -> call.toolName().equals("flyai_search_hotel")));
    }
}
