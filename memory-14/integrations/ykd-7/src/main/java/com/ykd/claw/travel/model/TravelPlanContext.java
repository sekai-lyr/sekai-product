package com.ykd.claw.travel.model;

import java.util.List;
import java.util.Map;

public record TravelPlanContext(
        Map<String, Object> request,
        TravelContext travelContext,
        Map<Integer, List<TravelPlace>> dailyPlaceCandidates,
        Map<Integer, List<TravelItineraryItem>> dailyItinerary,
        List<DiningRecommendation> diningRecommendations,
        TravelBudget budget,
        Map<String, List<String>> evidence,
        List<String> unavailableSources,
        List<String> planningWarnings,
        PlanReviewResult review) {
}
