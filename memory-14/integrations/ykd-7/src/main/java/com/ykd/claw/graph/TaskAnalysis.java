package com.ykd.claw.graph;

import java.util.List;
import java.util.Map;

public record TaskAnalysis(
        String intent,
        double confidence,
        String taskStage,
        Map<String, Object> entities,
        List<String> missingInfo,
        String nextAction) {

    public TaskAnalysis {
        entities = Map.copyOf(entities);
        missingInfo = List.copyOf(missingInfo);
    }

    public TaskAnalysis withDecision(List<String> missing, String stage, String action) {
        return new TaskAnalysis(intent, confidence, stage, entities, missing, action);
    }
}
