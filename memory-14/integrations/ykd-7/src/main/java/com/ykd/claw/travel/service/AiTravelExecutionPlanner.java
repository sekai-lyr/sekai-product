package com.ykd.claw.travel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ykd.claw.graph.PlannedToolCall;
import com.ykd.claw.graph.SkillExecutionPlan;
import com.ykd.claw.graph.SkillExecutionPlanner;
import com.ykd.claw.skill.SkillDefinition;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AiTravelExecutionPlanner implements SkillExecutionPlanner {
    private static final Logger LOGGER = LoggerFactory.getLogger("AGENT_FULL_TRACE");
    private static final String PROMPT = """
            Analyze the accumulated travel request and return one JSON object only.
            Fields:
            - taskType: itinerary, weather, place, route, lodging, dining, flight, train, or general
            - destination: destination city, or empty string
            - departure: departure city/place, or empty string
            - placeKeyword: requested place category, cuisine or restaurant type; use 景点 for an itinerary
            - area: requested dining landmark, hotel, district or neighborhood, or empty string
            - startDate: trip/departure date as yyyy-MM-dd, or empty string
            - endDate: return/check-out date as yyyy-MM-dd, or empty string
            - days: positive integer, or null
            - budget: total numeric budget, or null
            - budgetSpecified: true only when the user gave a budget or explicitly said the budget is unlimited
            - maxPrice: explicit maximum price for one hotel night or one ticket, or null
            - mealBudget: explicit per-person meal budget, or null
            - people: positive integer, or null
            - preferences: array of short preference strings
            Do not invent missing locations.
            Resolve relative dates against this current date: %s.

            Accumulated request:
            %s
            """;

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final TravelDateResolver dateResolver;

    public AiTravelExecutionPlanner(ChatClient.Builder builder, ObjectMapper objectMapper,
                                    TravelDateResolver dateResolver) {
        this.chatClient = builder.build();
        this.objectMapper = objectMapper;
        this.dateResolver = dateResolver;
    }

    @Override
    public boolean supports(SkillDefinition skill) {
        return "travel".equalsIgnoreCase(skill.name());
    }

    @Override
    public SkillExecutionPlan plan(SkillDefinition skill, String accumulatedInput) {
        return plan(skill, accumulatedInput, Map.of());
    }

    @Override
    public SkillExecutionPlan plan(SkillDefinition skill, String currentInput,
                                   Map<String, Object> knownContext) {
        try {
            if (hasStructuredTaskContext(knownContext)) {
                ObjectNode request = objectMapper.createObjectNode();
                applyKnownContext(request, knownContext, currentInput);
                dateResolver.resolveFirst(currentInput)
                        .ifPresent(date -> request.put("startDate", date.toString()));
                return loggedPlan(currentInput, request);
            }
            String response = chatClient.prompt().user(
                    PROMPT.formatted(dateResolver.today(), currentInput)).call().content();
            JsonNode request = objectMapper.readTree(stripCodeFence(response));
            if (request instanceof ObjectNode objectRequest) {
                applyKnownContext(objectRequest, knownContext, currentInput);
                var resolvedDate = dateResolver.resolveFirst(currentInput);
                if (resolvedDate.isPresent()) {
                    objectRequest.put("startDate", resolvedDate.orElseThrow().toString());
                } else if (!knownContext.containsKey("startDate")) {
                    objectRequest.remove(List.of("startDate", "endDate"));
                }
            }
            return loggedPlan(currentInput, request);
        } catch (Exception e) {
            LOGGER.warn( "Travel execution planning skipped: " + e.getMessage(), e);
            ObjectNode request = objectMapper.createObjectNode();
            applyKnownContext(request, knownContext, currentInput);
            return new SkillExecutionPlan(buildPlan(request), context(request));
        }
    }

    private SkillExecutionPlan loggedPlan(String currentInput, JsonNode request) {
        SkillExecutionPlan result = new SkillExecutionPlan(buildPlan(request), context(request));
        LOGGER.info("TRAVEL_EXECUTION_PLAN input=\n" + currentInput
                + "\nPLAN:\n" + result);
        return result;
    }

    private static boolean hasStructuredTaskContext(Map<String, Object> knownContext) {
        Object destination = knownContext.get("destination");
        if (destination == null || String.valueOf(destination).isBlank()) return false;
        return knownContext.containsKey("intent") || knownContext.containsKey("productType")
                || knownContext.containsKey("taskType");
    }

    private static void applyKnownContext(ObjectNode request, Map<String, Object> knownContext,
                                          String currentInput) {
        knownContext.forEach((key, value) -> {
            if (value instanceof Integer number) request.put(key, number);
            else if (value instanceof Long number) request.put(key, number);
            else if (value instanceof Number number) request.put(key, number.doubleValue());
            else if (value instanceof Boolean bool) request.put(key, bool);
            else if (value instanceof java.util.Collection<?> collection) {
                var array = request.putArray(key);
                collection.stream().map(String::valueOf).map(String::trim)
                        .filter(item -> !item.isBlank()).forEach(array::add);
            }
            else if (value != null && !String.valueOf(value).isBlank()) {
                request.put(key, String.valueOf(value));
            }
        });
        String productType = text(request, "productType");
        if ("HOTEL".equalsIgnoreCase(productType)) request.put("taskType", "lodging");
        else if ("TRAIN".equalsIgnoreCase(productType)) request.put("taskType", "train");
        else if ("FLIGHT".equalsIgnoreCase(productType)) request.put("taskType", "flight");
        else if ("WEATHER".equalsIgnoreCase(productType)) request.put("taskType", "weather");
        else if ("ROUTE".equalsIgnoreCase(productType)) request.put("taskType", "route");
        else if ("DINING".equalsIgnoreCase(productType)) request.put("taskType", "dining");
        else if ("PLACE".equalsIgnoreCase(productType)) request.put("taskType", "place");
        else if (text(request, "taskType").isBlank()) request.put("taskType", inferTaskType(currentInput));
    }

    private static String inferTaskType(String input) {
        String text = input == null ? "" : input;
        if (text.contains("酒店") || text.contains("住宿")) return "lodging";
        if (text.contains("餐厅") || text.contains("饭店") || text.contains("美食")) return "dining";
        if (text.contains("天气")) return "weather";
        if (text.contains("路线") || text.contains("怎么走")) return "route";
        if (text.contains("火车") || text.contains("高铁")) return "train";
        if (text.contains("飞机") || text.contains("机票") || text.contains("航班")) return "flight";
        return "itinerary";
    }

    static List<PlannedToolCall> buildPlan(JsonNode request) {
        String taskType = text(request, "taskType").toLowerCase(Locale.ROOT);
        String destination = text(request, "destination");
        String departure = text(request, "departure");
        String placeKeyword = text(request, "placeKeyword");
        String area = text(request, "area");
        String startDate = text(request, "startDate");
        String endDate = endDate(request, startDate);
        if (destination.isBlank()) return List.of();

        List<PlannedToolCall> calls = new ArrayList<>();
        if (taskType.equals("weather")) {
            calls.add(weatherCall(destination, startDate));
            return List.copyOf(calls);
        }
        if (taskType.equals("route")) {
            if (!departure.isBlank()) {
                calls.add(call("get_route", Map.of("origin", departure, "destination", destination)));
            }
            return List.copyOf(calls);
        }

        if (taskType.equals("place")) {
            String keyword = placeKeyword.isBlank() ? "景点" : placeKeyword;
            calls.add(call("flyai_search_poi", Map.of(
                    "city", destination, "keyword", keyword, "category", "")));
            calls.add(fallback("search_place", Map.of(
                    "keyword", keyword, "city", destination), "flyai_search_poi"));
            calls.add(call("search_knowledge", "query", destination + " " + keyword + " 攻略 避坑"));
            return List.copyOf(calls);
        }

        if (taskType.equals("flight")) {
            if (!departure.isBlank() && !startDate.isBlank()) {
                Map<String, Object> arguments = new LinkedHashMap<>();
                arguments.put("origin", departure);
                arguments.put("destination", destination);
                arguments.put("departureDate", startDate);
                arguments.put("returnDate", endDate);
                putPositiveInteger(arguments, request, "maxPrice");
                calls.add(call("flyai_search_flight", arguments));
            }
            return List.copyOf(calls);
        }

        if (taskType.equals("train")) {
            if (!departure.isBlank() && !startDate.isBlank()) {
                calls.add(call("flyai_search_train", Map.of(
                        "origin", departure,
                        "destination", destination,
                        "departureDate", startDate)));
            }
            return List.copyOf(calls);
        }

        if (taskType.equals("lodging")) {
            if (!startDate.isBlank() && !endDate.isBlank()) {
                Map<String, Object> arguments = new LinkedHashMap<>();
                arguments.put("destination", destination);
                arguments.put("checkInDate", startDate);
                arguments.put("checkOutDate", endDate);
                arguments.put("poiName", placeKeyword);
                putPositiveInteger(arguments, request, "maxPrice");
                calls.add(call("flyai_search_hotel", arguments));
            }
            calls.add(fallback("search_place", Map.of(
                    "keyword", "酒店", "city", destination), "flyai_search_hotel"));
            calls.add(fallback("search_web", Map.of(
                    "keyword", destination + " 酒店 评分 参考价格 预订链接"), "flyai_search_hotel"));
            return List.copyOf(calls);
        }

        if (taskType.equals("dining")) {
            String diningKeyword = diningKeyword(area, placeKeyword);
            // 用户给出了具体用餐区域（如"西湖"）时，把它作为 location 传入，
            // 让 search_place 按到该区域的距离由近到远排序，优先推荐离得近的餐厅。
            Map<String, Object> searchPlaceArgs = new LinkedHashMap<>();
            searchPlaceArgs.put("keyword", diningKeyword);
            searchPlaceArgs.put("city", destination);
            if (!area.isBlank() && !area.equals(destination)) {
                searchPlaceArgs.put("location", area);
            }
            calls.add(call("search_place", searchPlaceArgs));
            calls.add(call("search_web", "keyword",
                    destination + " " + diningKeyword + " 近期评价 人均 特色菜"));
            calls.add(call("search_knowledge", "query",
                    destination + " " + diningKeyword + " 美食 推荐 避坑"));
            return List.copyOf(calls);
        }

        calls.add(weatherCall(destination, startDate));
        calls.add(call("flyai_search_poi", Map.of(
                "city", destination,
                "keyword", placeKeyword.isBlank() ? "景点" : placeKeyword,
                "category", "")));
        calls.add(fallback("search_place", Map.of(
                "keyword", placeKeyword.isBlank() ? "景点" : placeKeyword,
                "city", destination), "flyai_search_poi"));
        calls.add(call("search_knowledge", "query",
                destination + " 旅游 景点 美食 交通 攻略 避坑"));
        calls.add(call("search_place", Map.of("keyword", "特色餐厅", "city", destination)));
        if (!departure.isBlank() && !startDate.isBlank()) {
            calls.add(call("flyai_search_flight", Map.of(
                    "origin", departure, "destination", destination, "departureDate", startDate)));
            calls.add(call("flyai_search_train", Map.of(
                    "origin", departure, "destination", destination, "departureDate", startDate)));
        }
        if (requiresLodging(request, startDate, endDate)) {
            Map<String, Object> arguments = new LinkedHashMap<>();
            arguments.put("destination", destination);
            arguments.put("checkInDate", startDate);
            arguments.put("checkOutDate", endDate);
            arguments.put("poiName", "");
            putPositiveInteger(arguments, request, "maxPrice");
            calls.add(call("flyai_search_hotel", arguments));
        }
        return List.copyOf(calls);
    }

    private static PlannedToolCall call(String toolName, String name, String value) {
        return call(toolName, Map.of(name, value));
    }

    private static PlannedToolCall weatherCall(String destination, String startDate) {
        return startDate.isBlank()
                ? call("query_weather", "city", destination)
                : call("query_weather_forecast", Map.of("city", destination, "date", startDate));
    }

    private static PlannedToolCall call(String toolName, Map<String, Object> arguments) {
        return new PlannedToolCall(toolName, new LinkedHashMap<>(arguments));
    }

    private static PlannedToolCall fallback(String toolName, Map<String, Object> arguments, String fallbackFor) {
        return new PlannedToolCall(toolName, new LinkedHashMap<>(arguments), fallbackFor);
    }

    private static String text(JsonNode node, String field) {
        if (node == null) return "";
        return node.path(field).asText("").trim();
    }

    private static Map<String, Object> context(JsonNode request) {
        Map<String, Object> result = new LinkedHashMap<>();
        putText(result, request, "taskType");
        putText(result, request, "destination");
        putText(result, request, "departure");
        putText(result, request, "placeKeyword");
        putText(result, request, "area");
        putText(result, request, "startDate");
        putText(result, request, "endDate");
        putNumber(result, request, "days");
        putNumber(result, request, "budget");
        putNumber(result, request, "people");
        putNumber(result, request, "mealBudget");
        if (request.path("budgetSpecified").asBoolean(false)) result.put("budgetSpecified", true);
        JsonNode preferences = request.path("preferences");
        if (preferences.isArray()) {
            List<String> values = new ArrayList<>();
            preferences.forEach(item -> {
                if (!item.asText("").isBlank()) values.add(item.asText().trim());
            });
            result.put("preferences", List.copyOf(values));
        }
        return Map.copyOf(result);
    }

    private static void putText(Map<String, Object> target, JsonNode source, String field) {
        String value = text(source, field);
        if (!value.isBlank()) target.put(field, value);
    }

    private static void putNumber(Map<String, Object> target, JsonNode source, String field) {
        JsonNode value = source.path(field);
        if (value.isNumber() && value.doubleValue() > 0) target.put(field, value.numberValue());
    }

    private static void putPositiveInteger(Map<String, Object> target, JsonNode source, String field) {
        JsonNode value = source.path(field);
        if (value.canConvertToInt() && value.intValue() > 0) target.put(field, value.intValue());
    }

    private static String endDate(JsonNode request, String startDate) {
        String explicit = text(request, "endDate");
        if (!explicit.isBlank()) return explicit;
        JsonNode days = request.path("days");
        if (startDate.isBlank() || !days.canConvertToInt() || days.intValue() <= 0) return "";
        try {
            return LocalDate.parse(startDate).plusDays(days.intValue()).toString();
        } catch (DateTimeParseException ignored) {
            return "";
        }
    }

    private static String diningKeyword(String area, String preference) {
        StringBuilder result = new StringBuilder();
        if (!area.isBlank()) result.append(area).append(' ');
        if (!preference.isBlank()) result.append(preference).append(' ');
        return result.append("餐厅").toString().trim();
    }

    private static boolean requiresLodging(JsonNode request, String startDate, String endDate) {
        JsonNode days = request.path("days");
        if (days.canConvertToInt()) return days.intValue() > 1;
        if (startDate.isBlank() || endDate.isBlank()) return false;
        try {
            return LocalDate.parse(endDate).isAfter(LocalDate.parse(startDate));
        } catch (DateTimeParseException ignored) {
            return false;
        }
    }

    private static String stripCodeFence(String value) {
        if (value == null) return "{}";
        String trimmed = value.trim();
        if (!trimmed.startsWith("```")) return trimmed;
        int firstNewline = trimmed.indexOf('\n');
        int lastFence = trimmed.lastIndexOf("```");
        return firstNewline >= 0 && lastFence > firstNewline
                ? trimmed.substring(firstNewline + 1, lastFence).trim() : "{}";
    }
}
