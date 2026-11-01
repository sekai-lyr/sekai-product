package com.ykd.claw.travel.service;

import com.ykd.claw.graph.SkillInformationRequirementEvaluator;
import com.ykd.claw.graph.TaskAnalysis;
import com.ykd.claw.skill.SkillDefinition;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class InformationRequirementEvaluator implements SkillInformationRequirementEvaluator {
    @Override
    public boolean supports(SkillDefinition skill) {
        return "travel".equalsIgnoreCase(skill.name());
    }

    @Override
    public TaskAnalysis evaluate(SkillDefinition skill, TaskAnalysis analysis) {
        Map<String, Object> entities = analysis.entities();
        List<String> missing = new ArrayList<>();
        String intent = analysis.intent();

        if ("EXPLORE".equals(intent)) {
            if (blank(entities, "destination") && blank(entities, "preference")) {
                missing.add("想去的城市或旅行偏好");
            }
        } else if ("PLAN".equals(intent)) {
            requireText(missing, entities, "destination", "目的地");
            requireText(missing, entities, "startDate", "日期");
            requireNumber(missing, entities, "days", "游玩天数");
            requireText(missing, entities, "departure", "出发地");
            requireNumber(missing, entities, "people", "人数");
            Integer days = integer(entities.get("days"));
            if (days != null && days > 1 && !number(entities.get("budget"))
                    && !Boolean.TRUE.equals(entities.get("budgetSpecified"))) {
                missing.add("预算");
            }
        } else if ("EXECUTE".equals(intent)) {
            requireText(missing, entities, "destination", "目的地");
            requireText(missing, entities, "startDate", "日期");
            String productType = String.valueOf(entities.getOrDefault("productType", ""));
            if (productType.equals("TRAIN") || productType.equals("FLIGHT")) {
                requireText(missing, entities, "departure", "出发地");
            } else if (productType.equals("HOTEL")) {
                requireNumber(missing, entities, "days", "入住天数");
                requireNumber(missing, entities, "people", "入住人数");
            }
        } else {
            String productType = String.valueOf(entities.getOrDefault("productType", ""));
            // 餐饮/美食类查询：用户往往已给出地点（如"西湖附近"），
            // 此时不应再强求 "目的地"，避免不必要的追问。
            if ("DINING".equals(productType)) {
                // 仅当完全没有地点线索时才提示位置
                if (blank(entities, "destination") && blank(entities, "preference")
                        && blank(entities, "foodPreference")) {
                    missing.add("用餐区域或位置");
                }
            } else {
                requireText(missing, entities, "destination", "目的地");
            }
            if ("ROUTE".equals(productType)) {
                requireText(missing, entities, "departure", "出发地");
            }
        }

        String stage = missing.isEmpty()
                ? ("EXECUTE".equals(intent) ? "EXECUTING" : "PLANNING") : "COLLECTING";
        String action = missing.isEmpty() ? "CALL_TOOL" : "ASK_USER";
        return analysis.withDecision(List.copyOf(missing), stage, action);
    }

    private static void requireText(List<String> missing, Map<String, Object> values,
                                    String key, String label) {
        if (blank(values, key)) missing.add(label);
    }
    private static void requireNumber(List<String> missing, Map<String, Object> values,
                                      String key, String label) {
        if (!number(values.get(key))) missing.add(label);
    }
    private static boolean blank(Map<String, Object> values, String key) {
        Object value = values.get(key);
        return value == null || String.valueOf(value).isBlank();
    }
    private static boolean number(Object value) {
        return value instanceof Number number && number.doubleValue() > 0;
    }
    private static Integer integer(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }
}
