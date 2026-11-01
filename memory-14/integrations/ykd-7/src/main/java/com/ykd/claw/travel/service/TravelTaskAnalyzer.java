package com.ykd.claw.travel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.graph.SkillTaskAnalyzer;
import com.ykd.claw.graph.TaskAnalysis;
import com.ykd.claw.skill.SkillDefinition;
import com.ykd.claw.travel.model.TravelTaskState;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TravelTaskAnalyzer implements SkillTaskAnalyzer {
    private static final Logger LOGGER = LoggerFactory.getLogger(TravelTaskAnalyzer.class);
    private static final Pattern DURATION =
            Pattern.compile("(?:玩|游玩|旅行|旅游)?([0-9一二两三四五六七八九十]+)天(?!后)");
    private static final Pattern PEOPLE =
            Pattern.compile("([0-9一二两三四五六七八九十]+)(?:个)?人");
    private static final Pattern BUDGET = Pattern.compile("(?:预算)?[约大概]*([0-9]+(?:\\.[0-9]+)?)元?");
    private static final String PROMPT = """
            Analyze the travel request. Return ONE compact JSON object only, no explanation:
            {"intent":"EXPLORE|PLAN|QUERY|EXECUTE","confidence":0.0,
             "entities":{"destination":"","departure":"","preference":"","transport":"",
                         "hotelLevel":"","foodPreference":""}}
            EXPLORE=inspiration, PLAN=itinerary, QUERY=factual question, EXECUTE=search train/flight/hotel.
            Fill destination/departure/preference/transport/hotelLevel/foodPreference only when clearly
            implied; otherwise leave empty. Never invent values. Current date is %s.
            Request:
            %s
            """;

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final TravelDateResolver dateResolver;
    private final TravelTaskStateService stateService;
    private final InformationRequirementEvaluator requirementEvaluator;
    private final UserProfileService profileService;

    public TravelTaskAnalyzer(ChatClient.Builder builder, ObjectMapper objectMapper,
                              TravelDateResolver dateResolver, TravelTaskStateService stateService,
                              InformationRequirementEvaluator requirementEvaluator,
                              UserProfileService profileService) {
        this.chatClient = builder.build();
        this.objectMapper = objectMapper;
        this.dateResolver = dateResolver;
        this.stateService = stateService;
        this.requirementEvaluator = requirementEvaluator;
        this.profileService = profileService;
    }

    @Override
    public boolean supports(SkillDefinition skill) {
        return "travel".equalsIgnoreCase(skill.name());
    }

    @Override
    public TaskAnalysis analyze(SkillDefinition skill, String userId,
                                String conversationId, String input) {
        return analyze(skill, userId, conversationId, input, input);
    }

    @Override
    public TaskAnalysis analyze(SkillDefinition skill, String userId, String conversationId,
                                String input, String accumulatedInput) {
        Map<String, Object> entities = new LinkedHashMap<>();
        String modelIntent = "PLAN";
        double confidence = 0.7;
        try {
            String response = chatClient.prompt().user(PROMPT.formatted(dateResolver.today(), input))
                    .call().content();
            JsonNode root = objectMapper.readTree(stripFence(response));
            modelIntent = root.path("intent").asText("PLAN");
            confidence = root.path("confidence").asDouble(0.7);
            JsonNode modelEntities = root.path("entities");
            if (modelEntities.isObject()) {
                entities.putAll(objectMapper.convertValue(modelEntities,
                        new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { }));
                entities.values().removeIf(value -> value == null || String.valueOf(value).isBlank());
                if (!Boolean.TRUE.equals(entities.get("budgetSpecified"))) {
                    entities.remove("budgetSpecified");
                }
            }
        } catch (RuntimeException | java.io.IOException e) {
            LOGGER.warn("AI task analysis failed, falling back to deterministic extraction", e);
        }

        dateResolver.resolveFirst(input).ifPresentOrElse(
                date -> entities.put("startDate", date.toString()),
                () -> entities.remove("startDate"));
        extractNumber(DURATION, input).ifPresent(value -> entities.put("days", value));
        extractNumber(PEOPLE, input).ifPresent(value -> entities.put("people", value));
        Matcher budget = BUDGET.matcher(input == null ? "" : input);
        if (budget.find() && (input.contains("预算") || input.contains("元"))) {
            entities.put("budget", Double.parseDouble(budget.group(1)));
            entities.put("budgetSpecified", true);
        }
        if (input != null && (input.contains("预算不限") || input.contains("不限制预算"))) {
            entities.put("budgetSpecified", true);
        }
        String currentProductType = productType(input);
        String inheritedProductType = currentProductType == null ? productType(accumulatedInput) : null;
        if (currentProductType != null) entities.put("productType", currentProductType);
        else if (inheritedProductType != null) entities.put("productType", inheritedProductType);
        if (entities.get("preferences") instanceof java.util.Collection<?> preferences) {
            entities.put("preference", preferences.stream().map(String::valueOf)
                    .collect(java.util.stream.Collectors.joining("；")));
        }
        boolean currentDefinesTask = currentProductType != null || contains(input == null ? "" : input,
                "有什么好玩", "哪里好玩", "去哪玩", "旅游灵感", "推荐个地方",
                "预订", "下单", "买票", "多少钱", "开放时间", "去", "行程", "安排", "规划", "游");
        String intent = currentDefinesTask || accumulatedInput == null || accumulatedInput.equals(input)
                ? intent(input, modelIntent, currentProductType)
                : intent(accumulatedInput, modelIntent,
                        currentProductType == null ? productType(accumulatedInput) : currentProductType);
        String normalizedUserId = normalize(userId, "anonymous");
        String normalizedConversationId = normalize(conversationId, "default");
        boolean resetTask = shouldResetTask(input,
                stateService.find(normalizedUserId, normalizedConversationId), entities);
        TravelTaskState state = resetTask
                ? stateService.merge(normalizedUserId, normalizedConversationId, entities, true)
                : stateService.merge(normalizedUserId, normalizedConversationId, entities);
        Map<String, Object> merged = new LinkedHashMap<>(state.entities());
        merged.putAll(entities);
        var profile = profileService.load(userId, input);
        if (!profile.preferences().isEmpty()) {
            merged.put("profilePreferences", profile.preferences());
            merged.put("preferences", mergePreferences(merged, profile.preferences()));
        }
        merged.put("intent", intent);
        TaskAnalysis preliminary = new TaskAnalysis(intent, confidence, "INIT", merged, List.of(), "ASK_USER");
        TaskAnalysis evaluated = requirementEvaluator.evaluate(skill, preliminary);
        stateService.updateStage(state.id(), evaluated.taskStage());
        return evaluated;
    }

    private static String productType(String input) {
        if (input == null) return null;
        if (input.contains("酒店") || input.contains("住宿")) return "HOTEL";
        if (input.contains("火车") || input.contains("高铁")) return "TRAIN";
        if (input.contains("飞机") || input.contains("机票") || input.contains("航班")) return "FLIGHT";
        if (input.contains("天气")) return "WEATHER";
        if (input.contains("路线") || input.contains("怎么走")) return "ROUTE";
        if (input.contains("餐厅") || input.contains("饭店") || input.contains("美食")) return "DINING";
        if (input.contains("景点") || input.contains("开放时间")) return "PLACE";
        return null;
    }

    private static String intent(String input, String modelIntent, String productType) {
        // 明确的单点查询类型（美食/餐厅、景点、天气、路线）优先判定为简单查询 QUERY，
        // 避免被当作完整行程 PLAN 而要求目的地、日期、游玩天数、出发地、人数等不必要信息。
        if (productType != null
                && List.of("DINING", "PLACE", "WEATHER", "ROUTE").contains(productType)) {
            return "QUERY";
        }
        String text = input == null ? "" : input.toLowerCase(Locale.ROOT);
        if (contains(text, "有什么好吃", "推荐什么吃的", "有什么美食", "哪家餐厅", "有什么吃的")) return "QUERY";
        if (contains(text, "有什么好玩", "哪里好玩", "去哪玩", "旅游灵感", "推荐个地方")) return "EXPLORE";
        if (text.contains("酒店") && contains(text, "查", "找", "订", "预订")) return "EXECUTE";
        if (contains(text, "预订", "下单", "买票", "火车票", "机票", "航班",
                "查酒店", "找酒店", "订酒店", "预订酒店")) return "EXECUTE";
        if (contains(text, "天气", "多少钱", "怎么走", "路线", "开放时间")) return "QUERY";
        if (contains(text, "酒店", "住宿")) return "QUERY";
        if (contains(text, "去", "行程", "安排", "规划", "游")) return "PLAN";
        return List.of("EXPLORE", "PLAN", "QUERY", "EXECUTE").contains(modelIntent)
                ? modelIntent : "PLAN";
    }

    private static java.util.Optional<Integer> extractNumber(Pattern pattern, String input) {
        Matcher matcher = pattern.matcher(input == null ? "" : input);
        if (!matcher.find()) return java.util.Optional.empty();
        return java.util.Optional.ofNullable(chineseNumber(matcher.group(1)));
    }

    private static boolean shouldResetTask(String input, java.util.Optional<TravelTaskState> existing,
                                           Map<String, Object> entities) {
        String text = input == null ? "" : input;
        if (contains(text, "重新规划", "重新计划", "新的行程", "另一个行程", "换个地方", "改去")) {
            return true;
        }
        String destination = String.valueOf(entities.getOrDefault("destination", "")).trim();
        return existing.filter(state -> state.destination() != null && !state.destination().isBlank())
                .filter(state -> !destination.isBlank())
                .map(state -> !state.destination().equalsIgnoreCase(destination))
                .orElse(false);
    }

    private static List<String> mergePreferences(Map<String, Object> entities,
                                                 List<String> profilePreferences) {
        java.util.LinkedHashSet<String> values = new java.util.LinkedHashSet<>();
        Object explicit = entities.get("preferences");
        if (explicit instanceof java.util.Collection<?> collection) {
            collection.stream().map(String::valueOf).map(String::trim)
                    .filter(item -> !item.isBlank()).forEach(values::add);
        }
        String persisted = String.valueOf(entities.getOrDefault("preference", ""));
        java.util.Arrays.stream(persisted.split("；")).map(String::trim)
                .filter(item -> !item.isBlank()).forEach(values::add);
        profilePreferences.stream().map(String::trim).filter(item -> !item.isBlank()).forEach(values::add);
        return List.copyOf(values);
    }

    private static Integer chineseNumber(String value) {
        try { return Integer.parseInt(value); } catch (NumberFormatException ignored) { }
        if (value.equals("十")) return 10;
        String digits = "一二三四五六七八九";
        if (value.equals("两")) return 2;
        int ten = value.indexOf('十');
        if (ten >= 0) {
            int left = ten == 0 ? 1 : digits.indexOf(value.charAt(0)) + 1;
            int right = ten == value.length() - 1 ? 0 : digits.indexOf(value.charAt(ten + 1)) + 1;
            return left * 10 + right;
        }
        int index = value.length() == 1 ? digits.indexOf(value.charAt(0)) : -1;
        return index < 0 ? null : index + 1;
    }

    private static boolean contains(String text, String... terms) {
        for (String term : terms) if (text.contains(term)) return true;
        return false;
    }
    private static String normalize(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
    private static String stripFence(String value) {
        if (value == null) return "{}";
        return value.replace("```json", "").replace("```", "").trim();
    }
}
