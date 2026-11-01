package com.ykd.claw.travel.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.graph.SkillResultAggregator;
import com.ykd.claw.graph.SkillToolResult;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class TravelDataAggregator implements SkillResultAggregator {
    private final TripPlanningService tripPlanningService;
    private final ObjectMapper objectMapper;

    public TravelDataAggregator(TripPlanningService tripPlanningService, ObjectMapper objectMapper) {
        this.tripPlanningService = tripPlanningService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean supports(String skillName) {
        return "travel".equalsIgnoreCase(skillName);
    }

    @Override
    public String aggregate(Map<String, Object> planningContext, List<SkillToolResult> toolResults) {
        try {
            return objectMapper.writeValueAsString(tripPlanningService.plan(planningContext, toolResults));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unable to serialize travel planning context", e);
        }
    }
}
