package com.ykd.claw.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.graph.SkillToolResult;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TripPlanningServiceTest {
    private final TripPlanningService service =
            new TripPlanningService(new ObjectMapper(), new PlanReviewService());

    @Test
    void sortsNearbyPlacesDistributesDaysAndCalculatesBudget() {
        String placeResult = """
                {
                  "places": [
                    {"name":"A","address":"a","location":"120.0,30.0","city":"杭州","district":"西湖","type":"景点"},
                    {"name":"C","address":"c","location":"121.0,30.0","city":"杭州","district":"临安","type":"景点"},
                    {"name":"B","address":"b","location":"120.1,30.0","city":"杭州","district":"西湖","type":"景点"}
                  ]
                }
                """;

        var plan = service.plan(Map.of("destination", "杭州", "days", 2, "people", 2, "budget", 3000),
                List.of(
                        new SkillToolResult("search_place", placeResult, null),
                        new SkillToolResult("query_weather", "杭州：晴", null)));

        assertEquals(List.of("A", "B"),
                plan.dailyPlaceCandidates().get(1).stream().map(place -> place.name()).toList());
        assertEquals(List.of("C"),
                plan.dailyPlaceCandidates().get(2).stream().map(place -> place.name()).toList());
        assertEquals(1500.0, plan.budget().perDay());
        assertEquals(750.0, plan.budget().perPersonPerDay());
        assertEquals("杭州：晴", plan.evidence().get("query_weather").getFirst());
    }

    @Test
    void ranksDiningCandidatesAndPreservesPricesAndMapLinks() {
        String placeResult = """
                {
                  "keyword": "西湖 杭帮菜 餐厅",
                  "places": [
                    {
                      "name":"湖畔杭帮菜","address":"西湖边","location":"120.1,30.2",
                      "city":"杭州","district":"西湖","type":"餐饮服务",
                      "openingHours":"10:00-22:00","tags":"杭帮菜",
                      "rating":4.8,"averageCost":88,
                      "mapUrl":"https://uri.amap.com/marker?position=120.1%2C30.2"
                    },
                    {
                      "name":"高价餐厅","address":"湖滨","location":"120.2,30.2",
                      "city":"杭州","district":"上城","type":"餐饮服务",
                      "rating":4.5,"averageCost":300,
                      "mapUrl":"https://uri.amap.com/marker?position=120.2%2C30.2"
                    }
                  ]
                }
                """;

        var plan = service.plan(Map.of(
                        "taskType", "dining", "destination", "杭州",
                        "placeKeyword", "杭帮菜", "mealBudget", 100),
                List.of(new SkillToolResult("search_place", placeResult, null)));

        assertEquals(2, plan.diningRecommendations().size());
        assertEquals("湖畔杭帮菜", plan.diningRecommendations().getFirst().name());
        assertEquals(88.0, plan.diningRecommendations().getFirst().averageCost());
        assertEquals("https://uri.amap.com/marker?position=120.1%2C30.2",
                plan.diningRecommendations().getFirst().mapUrl());
        assertTrue(plan.diningRecommendations().getFirst().score()
                > plan.diningRecommendations().getLast().score());
    }

    @Test
    void createsTimedItineraryUsingOpeningHoursAndEstimatedTravelTime() {
        String placeResult = """
                {
                  "places": [
                    {"name":"博物馆","address":"a","location":"120.0,30.0","city":"杭州",
                     "district":"西湖","type":"博物馆","openingHours":"10:00-17:00"},
                    {"name":"湖滨公园","address":"b","location":"120.03,30.0","city":"杭州",
                     "district":"西湖","type":"公园","openingHours":"08:00-20:00"}
                  ]
                }
                """;

        var plan = service.plan(Map.of("destination", "杭州", "days", 1),
                List.of(new SkillToolResult("search_place", placeResult, null)));

        var items = plan.dailyItinerary().get(1);
        assertEquals(java.time.LocalTime.of(10, 0), items.getFirst().startTime());
        assertEquals(java.time.LocalTime.of(13, 0), items.getFirst().endTime());
        assertTrue(items.get(1).estimatedDistanceKmFromPrevious() > 2);
        assertTrue(items.get(1).estimatedTravelMinutesFromPrevious() >= 10);
    }

    @Test
    void aggregatesTypedTravelContextAndReviewsWeatherImpact() {
        var plan = service.plan(Map.of("destination", "杭州", "days", 1, "people", 1), List.of(
                new SkillToolResult("query_weather_forecast", "杭州：有雨", null),
                new SkillToolResult("get_route", "上海到杭州约180公里", null),
                new SkillToolResult("flyai_search_hotel", "酒店结果", null),
                new SkillToolResult("search_knowledge", "西湖雨天攻略", null)));

        assertEquals(List.of("杭州：有雨"), plan.travelContext().weather());
        assertEquals(List.of("上海到杭州约180公里"), plan.travelContext().routes());
        assertEquals(List.of("酒店结果"), plan.travelContext().hotels());
        assertEquals(List.of("西湖雨天攻略"), plan.travelContext().knowledge());
        assertTrue(plan.review().adjustments().stream().anyMatch(value -> value.contains("室内景点")));
    }

    @Test
    void reportsMalformedPlaceResultsAsUnavailableInsteadOfSilentlyIgnoringThem() {
        var plan = service.plan(Map.of("destination", "杭州"),
                List.of(new SkillToolResult("search_place", "not-json", null)));

        assertEquals(List.of("search_place: 返回数据无法解析"), plan.unavailableSources());
    }
}
