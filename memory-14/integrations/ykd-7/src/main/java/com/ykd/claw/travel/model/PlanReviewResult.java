package com.ykd.claw.travel.model;

import java.util.List;

public record PlanReviewResult(boolean passed, List<String> issues, List<String> adjustments) {
    public PlanReviewResult {
        issues = List.copyOf(issues);
        adjustments = List.copyOf(adjustments);
    }
}
