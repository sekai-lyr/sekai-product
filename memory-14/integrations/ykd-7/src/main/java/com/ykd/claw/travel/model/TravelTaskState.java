package com.ykd.claw.travel.model;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

public record TravelTaskState(
        Long id, String userId, String conversationId, String destination, LocalDate date,
        Integer duration, String departure, Integer people, Double budget,
        boolean budgetSpecified, String preference, String transport,
        String hotelLevel, String foodPreference, String currentStage) {

    public Map<String, Object> entities() {
        Map<String, Object> values = new LinkedHashMap<>();
        put(values, "destination", destination);
        if (date != null) values.put("startDate", date.toString());
        if (duration != null) values.put("days", duration);
        put(values, "departure", departure);
        if (people != null) values.put("people", people);
        if (budget != null) values.put("budget", budget);
        if (budgetSpecified) values.put("budgetSpecified", true);
        put(values, "preference", preference);
        put(values, "transport", transport);
        put(values, "hotelLevel", hotelLevel);
        put(values, "foodPreference", foodPreference);
        return Map.copyOf(values);
    }

    private static void put(Map<String, Object> values, String key, String value) {
        if (value != null && !value.isBlank()) values.put(key, value);
    }
}
