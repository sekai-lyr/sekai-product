package com.ykd.claw.travel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.graph.SkillToolResult;
import com.ykd.claw.travel.model.DiningRecommendation;
import com.ykd.claw.travel.model.TravelBudget;
import com.ykd.claw.travel.model.TravelItineraryItem;
import com.ykd.claw.travel.model.TravelPlace;
import com.ykd.claw.travel.model.TravelPlanContext;
import com.ykd.claw.travel.model.TravelContext;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TripPlanningService {
    private static final Logger LOGGER = LoggerFactory.getLogger(TripPlanningService.class);
    private static final LocalTime DAY_START = LocalTime.of(9, 0);
    private static final LocalTime DAY_END = LocalTime.of(20, 0);
    private static final Pattern OPENING_INTERVAL =
            Pattern.compile("(\\d{1,2}:\\d{2})\\s*[-~至]\\s*(\\d{1,2}:\\d{2})");
    private final ObjectMapper objectMapper;
    private final PlanReviewService planReviewService;

    public TripPlanningService(ObjectMapper objectMapper, PlanReviewService planReviewService) {
        this.objectMapper = objectMapper;
        this.planReviewService = planReviewService;
    }

    public TravelPlanContext plan(Map<String, Object> request, List<SkillToolResult> toolResults) {
        List<TravelPlace> places = new ArrayList<>();
        List<TravelPlace> diningCandidates = new ArrayList<>();
        Map<String, List<String>> evidence = new LinkedHashMap<>();
        List<String> unavailable = new ArrayList<>();
        List<String> weather = new ArrayList<>();
        List<String> routes = new ArrayList<>();
        List<String> hotels = new ArrayList<>();
        List<String> knowledge = new ArrayList<>();
        List<String> pois = new ArrayList<>();
        List<String> flights = new ArrayList<>();
        List<String> trains = new ArrayList<>();
        for (SkillToolResult result : toolResults) {
            if (!result.succeeded()) {
                unavailable.add(result.toolName() + ": " + result.error());
                continue;
            }
            evidence.computeIfAbsent(result.toolName(), ignored -> new ArrayList<>()).add(result.result());
            if (result.toolName().startsWith("query_weather")) weather.add(result.result());
            if ("get_route".equals(result.toolName())) routes.add(result.result());
            if ("flyai_search_hotel".equals(result.toolName())) hotels.add(result.result());
            if ("search_knowledge".equals(result.toolName())) knowledge.add(result.result());
            if ("flyai_search_poi".equals(result.toolName())) pois.add(result.result());
            if ("flyai_search_flight".equals(result.toolName())) flights.add(result.result());
            if ("flyai_search_train".equals(result.toolName())) trains.add(result.result());
            if ("search_place".equals(result.toolName())) {
                PlaceSearchResult search = readPlaces(result.result());
                if (search.error() != null) {
                    unavailable.add("search_place: " + search.error());
                    continue;
                }
                if (isDiningSearch(request, search.keyword())) {
                    diningCandidates.addAll(search.places());
                } else {
                    places.addAll(search.places());
                }
            }
        }
        int days = positiveInt(request.get("days"), 1);
        int people = positiveInt(request.get("people"), 1);
        Map<Integer, List<TravelPlace>> dailyPlaces = distribute(
                sortByProximity(prioritizePreferences(places, request)), days);
        ScheduleResult schedule = schedule(dailyPlaces);
        List<DiningRecommendation> foods = recommendDining(diningCandidates, request);
        TravelBudget travelBudget = budget(request.get("budget"), days, people);
        TravelContext travelContext = new TravelContext(weather, places, routes, foods, hotels, knowledge, pois, flights, trains);
        var review = planReviewService.review(request, schedule.items(), travelBudget,
                weather, schedule.warnings());
        return new TravelPlanContext(Map.copyOf(request), travelContext, dailyPlaces, schedule.items(),
                foods, travelBudget, immutableEvidence(evidence),
                List.copyOf(unavailable), schedule.warnings(), review);
    }

    private PlaceSearchResult readPlaces(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode places = root.path("places");
            if (!places.isArray()) {
                return new PlaceSearchResult("", List.of(), "返回格式缺少 places 数组");
            }
            List<TravelPlace> result = new ArrayList<>();
            for (JsonNode place : places) {
                String name = text(place, "name");
                if (!name.isBlank()) {
                    result.add(new TravelPlace(name, text(place, "address"), text(place, "location"),
                            text(place, "city"), text(place, "district"), text(place, "type"),
                            text(place, "businessArea"), text(place, "openingHours"),
                            text(place, "telephone"), text(place, "tags"),
                            decimal(place, "rating"), decimal(place, "averageCost"),
                            text(place, "photoUrl"), text(place, "mapUrl")));
                }
            }
            return new PlaceSearchResult(text(root, "keyword"), List.copyOf(result), null);
        } catch (Exception exception) {
            LOGGER.warn("景点搜索结果解析失败", exception);
            return new PlaceSearchResult("", List.of(), "返回数据无法解析");
        }
    }

    private static boolean isDiningSearch(Map<String, Object> request, String keyword) {
        if ("dining".equalsIgnoreCase(String.valueOf(request.getOrDefault("taskType", "")))) return true;
        String value = keyword == null ? "" : keyword.toLowerCase();
        return containsAny(value, "餐厅", "饭店", "美食", "小吃", "火锅", "烧烤", "菜馆", "料理");
    }

    private static List<DiningRecommendation> recommendDining(
            List<TravelPlace> candidates, Map<String, Object> request) {
        if (candidates.isEmpty()) return List.of();
        Double mealBudget = positiveDouble(request.get("mealBudget"));
        List<String> preferences = preferences(request);
        String requestedKeyword = String.valueOf(request.getOrDefault("placeKeyword", "")).trim();
        if (!requestedKeyword.isBlank()) preferences.add(requestedKeyword);

        List<DiningRecommendation> recommendations = new ArrayList<>();
        for (int index = 0; index < candidates.size(); index++) {
            TravelPlace place = candidates.get(index);
            double score = Math.max(10, 30 - index * 4);
            String searchable = (place.name() + " " + place.type() + " " + place.tags()).toLowerCase();
            boolean preferenceMatched = preferences.stream()
                    .map(String::toLowerCase)
                    .anyMatch(term -> !term.isBlank() && searchable.contains(term));
            score += preferences.isEmpty() ? 15 : preferenceMatched ? 25 : 10;
            if (place.rating() != null) score += Math.min(20, Math.max(0, place.rating() / 5 * 20));
            score += priceScore(place.averageCost(), mealBudget);
            score += completeness(place);
            recommendations.add(new DiningRecommendation(
                    place.name(), place.address(), place.rating(), place.averageCost(),
                    place.openingHours(), place.tags(), place.photoUrl(), place.mapUrl(),
                    round(score), reasons(place, mealBudget, preferenceMatched)));
        }
        return recommendations.stream()
                .sorted(Comparator.comparingDouble(DiningRecommendation::score).reversed())
                .limit(5)
                .toList();
    }

    private static double priceScore(Double cost, Double budget) {
        if (budget == null) return cost == null ? 5 : 8;
        if (cost == null) return 5;
        if (cost <= budget) return 15;
        return Math.max(0, 15 * budget / cost);
    }

    private static double completeness(TravelPlace place) {
        double score = 0;
        if (place.rating() != null) score += 2;
        if (place.averageCost() != null) score += 2;
        if (!place.openingHours().isBlank()) score += 2;
        if (!place.tags().isBlank()) score += 2;
        if (!place.mapUrl().isBlank()) score += 2;
        return score;
    }

    private static List<String> reasons(TravelPlace place, Double budget, boolean preferenceMatched) {
        List<String> result = new ArrayList<>();
        if (preferenceMatched) result.add("符合口味偏好");
        if (place.rating() != null) result.add("高德评分 " + place.rating());
        if (place.averageCost() != null) {
            String cost = "高德参考人均 ¥" + Math.round(place.averageCost());
            if (budget != null) cost += place.averageCost() <= budget ? "，符合预算" : "，高于预算";
            result.add(cost);
        }
        if (!place.tags().isBlank()) result.add(place.tags());
        if (!place.openingHours().isBlank()) result.add("营业时间：" + place.openingHours());
        if (place.rating() == null || place.averageCost() == null) {
            result.add("部分评价或价格缺失，以店铺页面为准");
        }
        return List.copyOf(result);
    }

    private static List<String> preferences(Map<String, Object> request) {
        List<String> result = new ArrayList<>();
        Object value = request.get("preferences");
        if (value instanceof Collection<?> collection) {
            collection.stream().map(String::valueOf).map(String::trim)
                    .filter(item -> !item.isBlank()).forEach(result::add);
        }
        return result;
    }

    static List<TravelPlace> sortByProximity(List<TravelPlace> places) {
        if (places.size() < 2) return List.copyOf(places);
        List<TravelPlace> remaining = new ArrayList<>(places);
        List<TravelPlace> ordered = new ArrayList<>(places.size());
        TravelPlace current = remaining.removeFirst();
        ordered.add(current);
        while (!remaining.isEmpty()) {
            TravelPlace from = current;
            current = remaining.stream()
                    .min((left, right) -> Double.compare(distance(from, left), distance(from, right)))
                    .orElse(remaining.getFirst());
            remaining.remove(current);
            ordered.add(current);
        }
        return List.copyOf(ordered);
    }

    private static List<TravelPlace> prioritizePreferences(
            List<TravelPlace> places, Map<String, Object> request) {
        List<String> preferences = preferences(request);
        if (preferences.isEmpty()) return List.copyOf(places);
        return places.stream().sorted(Comparator.comparingInt(place -> {
            String searchable = (place.name() + " " + place.type() + " " + place.tags()).toLowerCase();
            return preferences.stream().map(String::toLowerCase)
                    .anyMatch(searchable::contains) ? 0 : 1;
        })).toList();
    }

    private static Map<Integer, List<TravelPlace>> distribute(List<TravelPlace> places, int days) {
        if (places.isEmpty()) return Map.of();
        int usedDays = Math.min(days, places.size());
        Map<Integer, List<TravelPlace>> result = new LinkedHashMap<>();
        for (int index = 0; index < places.size(); index++) {
            int day = Math.min(usedDays, index * usedDays / places.size() + 1);
            result.computeIfAbsent(day, ignored -> new ArrayList<>()).add(places.get(index));
        }
        result.replaceAll((ignored, value) -> List.copyOf(value));
        return Map.copyOf(result);
    }

    private static ScheduleResult schedule(Map<Integer, List<TravelPlace>> dailyPlaces) {
        if (dailyPlaces.isEmpty()) return new ScheduleResult(Map.of(), List.of());
        Map<Integer, List<TravelItineraryItem>> result = new LinkedHashMap<>();
        List<String> warnings = new ArrayList<>();
        dailyPlaces.forEach((day, places) -> {
            List<TravelItineraryItem> items = new ArrayList<>();
            LocalTime cursor = DAY_START;
            TravelPlace previous = null;
            for (TravelPlace place : places) {
                double distanceKm = previous == null ? 0 : distanceKm(previous, place);
                int travelMinutes = previous == null ? 0 : estimatedTravelMinutes(distanceKm);
                cursor = cursor.plusMinutes(travelMinutes);
                if (!cursor.isBefore(LocalTime.of(11, 30)) && cursor.isBefore(LocalTime.of(13, 0))) {
                    cursor = LocalTime.of(13, 0);
                }
                TimeWindow hours = openingWindow(place.openingHours());
                if (hours != null && cursor.isBefore(hours.open())) cursor = hours.open();
                int visitMinutes = visitMinutes(place);
                LocalTime end = cursor.plusMinutes(visitMinutes);
                List<String> notes = new ArrayList<>();
                if (previous != null) notes.add("交通时间按经纬度距离估算，最终以地图路线为准");
                if (hours == null) {
                    notes.add("开放时间未确认，出发前请查看地点页面");
                } else if (end.isAfter(hours.close())) {
                    notes.add("预计结束时间超过公开营业时段，请调整顺序或缩短停留");
                }
                if (cursor.isAfter(DAY_END) || end.isAfter(DAY_END.plusHours(1))) {
                    warnings.add("第" + day + "天的" + place.name() + "可能无法在合理时间内完成");
                }
                items.add(new TravelItineraryItem(day, cursor, end, place,
                        previous == null ? null : round(distanceKm), travelMinutes, List.copyOf(notes)));
                cursor = end;
                previous = place;
            }
            result.put(day, List.copyOf(items));
        });
        return new ScheduleResult(Map.copyOf(result), List.copyOf(warnings));
    }

    private static int visitMinutes(TravelPlace place) {
        String value = (place.type() + " " + place.tags()).toLowerCase();
        if (containsAny(value, "博物馆", "主题乐园", "动物园", "museum", "theme park")) return 180;
        if (containsAny(value, "公园", "景区", "风景", "古镇", "park")) return 120;
        return 90;
    }

    private static int estimatedTravelMinutes(double distanceKm) {
        if (!Double.isFinite(distanceKm)) return 30;
        return Math.max(10, (int) Math.ceil(distanceKm / 18.0 * 60));
    }

    private static TimeWindow openingWindow(String openingHours) {
        if (openingHours == null || openingHours.isBlank()) return null;
        Matcher matcher = OPENING_INTERVAL.matcher(openingHours);
        if (!matcher.find()) return null;
        try {
            return new TimeWindow(LocalTime.parse(matcher.group(1), DateTimeFormatter.ofPattern("H:mm")),
                    LocalTime.parse(matcher.group(2), DateTimeFormatter.ofPattern("H:mm")));
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private static TravelBudget budget(Object value, int days, int people) {
        Double total = positiveDouble(value);
        if (total == null) return new TravelBudget(null, days, people, null, null);
        return new TravelBudget(total, days, people, round(total / days),
                round(total / days / people));
    }

    private static Map<String, List<String>> immutableEvidence(Map<String, List<String>> evidence) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        evidence.forEach((key, value) -> result.put(key, List.copyOf(value)));
        return Map.copyOf(result);
    }

    private static double distance(TravelPlace left, TravelPlace right) {
        double[] a = coordinates(left.location());
        double[] b = coordinates(right.location());
        if (a == null || b == null) return Double.MAX_VALUE;
        double longitude = a[0] - b[0];
        double latitude = a[1] - b[1];
        return longitude * longitude + latitude * latitude;
    }

    private static double distanceKm(TravelPlace left, TravelPlace right) {
        double[] a = coordinates(left.location());
        double[] b = coordinates(right.location());
        if (a == null || b == null) return Double.POSITIVE_INFINITY;
        double latitude1 = Math.toRadians(a[1]);
        double latitude2 = Math.toRadians(b[1]);
        double deltaLatitude = latitude2 - latitude1;
        double deltaLongitude = Math.toRadians(b[0] - a[0]);
        double value = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2)
                + Math.cos(latitude1) * Math.cos(latitude2)
                * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
        return 6371.0 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    }

    private static double[] coordinates(String location) {
        if (location == null) return null;
        String[] values = location.split(",", -1);
        if (values.length != 2) return null;
        try {
            return new double[]{Double.parseDouble(values[0]), Double.parseDouble(values[1])};
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static int positiveInt(Object value, int fallback) {
        if (value instanceof Number number && number.intValue() > 0) return number.intValue();
        return fallback;
    }

    private static Double positiveDouble(Object value) {
        if (value instanceof Number number && number.doubleValue() > 0) return number.doubleValue();
        return null;
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static String text(JsonNode node, String field) {
        return node.path(field).asText("").trim();
    }

    private static Double decimal(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.doubleValue() : null;
    }

    private static boolean containsAny(String value, String... terms) {
        for (String term : terms) {
            if (value.contains(term)) return true;
        }
        return false;
    }

    private record PlaceSearchResult(String keyword, List<TravelPlace> places, String error) {
    }

    private record TimeWindow(LocalTime open, LocalTime close) {
    }

    private record ScheduleResult(
            Map<Integer, List<TravelItineraryItem>> items, List<String> warnings) {
    }
}
