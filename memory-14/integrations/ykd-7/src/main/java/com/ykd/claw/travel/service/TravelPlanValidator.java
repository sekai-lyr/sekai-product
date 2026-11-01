package com.ykd.claw.travel.service;

import com.ykd.claw.graph.SkillPlanValidator;
import com.ykd.claw.skill.SkillDefinition;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class TravelPlanValidator implements SkillPlanValidator {
    private final TravelDateValidationService dateValidation;

    public TravelPlanValidator(TravelDateValidationService dateValidation) {
        this.dateValidation = dateValidation;
    }

    @Override
    public boolean supports(SkillDefinition skill) {
        return "travel".equalsIgnoreCase(skill.name());
    }

    @Override
    public List<String> validate(SkillDefinition skill, Map<String, Object> context) {
        List<String> problems = new ArrayList<>();
        if (text(context, "destination").isBlank()) problems.add("目的地");
        String intent = text(context, "intent");
        String startDate = text(context, "startDate");
        boolean dateRequired = "PLAN".equals(intent) || "EXECUTE".equals(intent);
        if (dateRequired && startDate.isBlank()) {
            problems.add("日期");
        } else if (!startDate.isBlank()) {
            try {
                dateValidation.requireCurrentOrFuture(startDate, "startDate");
            } catch (TravelDateValidationException e) {
                problems.add("日期（不能早于今天）");
            }
        }
        if ("PLAN".equals(intent)) {
            if (!positiveNumber(context.get("days"))) problems.add("游玩天数");
            if (text(context, "departure").isBlank()) problems.add("出发地");
            if (!positiveNumber(context.get("people"))) problems.add("人数");
            if (number(context.get("days")) > 1 && !positiveNumber(context.get("budget"))
                    && !Boolean.TRUE.equals(context.get("budgetSpecified"))) problems.add("预算");
        } else if ("EXECUTE".equals(intent)) {
            String productType = text(context, "productType");
            if (("TRAIN".equals(productType) || "FLIGHT".equals(productType))
                    && text(context, "departure").isBlank()) problems.add("出发地");
            if ("HOTEL".equals(productType)) {
                if (!positiveNumber(context.get("days"))) problems.add("入住天数");
                if (!positiveNumber(context.get("people"))) problems.add("入住人数");
            }
        } else if ("QUERY".equals(intent) && "ROUTE".equals(text(context, "productType"))
                && text(context, "departure").isBlank()) {
            problems.add("出发地");
        }
        return List.copyOf(problems);
    }

    private static String text(Map<String, Object> context, String field) {
        Object value = context.get(field);
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static boolean positiveNumber(Object value) {
        return value instanceof Number number && number.doubleValue() > 0;
    }

    private static int number(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }
}
