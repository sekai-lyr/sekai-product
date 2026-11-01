package com.ykd.claw.travel.service;

import com.ykd.claw.travel.model.PlanReviewResult;
import com.ykd.claw.travel.model.TravelBudget;
import com.ykd.claw.travel.model.TravelItineraryItem;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

@Service
public class PlanReviewService {
    public PlanReviewResult review(Map<String, Object> request,
                                   Map<Integer, List<TravelItineraryItem>> itinerary,
                                   TravelBudget budget, List<String> weather,
                                   List<String> existingWarnings) {
        List<String> issues = new ArrayList<>(existingWarnings);
        List<String> adjustments = new ArrayList<>();
        itinerary.values().stream().flatMap(Collection::stream).forEach(item -> {
            if (item.endTime().isAfter(LocalTime.of(21, 0))) {
                issues.add(item.place().name() + "结束时间过晚");
                adjustments.add("缩短停留或将" + item.place().name() + "移到其他日期");
            }
            if (item.estimatedDistanceKmFromPrevious() != null
                    && item.estimatedDistanceKmFromPrevious() > 40) {
                issues.add(item.place().name() + "与上一景点距离过远");
                adjustments.add("改选同一区域景点或增加交通时间");
            }
        });
        boolean rainy = weather.stream().map(String::toLowerCase)
                .anyMatch(value -> value.contains("雨") || value.contains("rain"));
        if (rainy) adjustments.add("天气可能有雨，优先室内景点并预留机动时间");
        if (budget != null && budget.perPersonPerDay() != null
                && budget.perPersonPerDay() < 100) {
            issues.add("人均每日预算较低");
            adjustments.add("优先免费景点、公共交通和高性价比餐饮");
        }
        if (request.containsKey("preference") || request.containsKey("preferences")) {
            adjustments.add("最终方案必须明确说明如何满足用户偏好");
        }
        return new PlanReviewResult(issues.isEmpty(), List.copyOf(issues),
                adjustments.stream().distinct().toList());
    }
}
