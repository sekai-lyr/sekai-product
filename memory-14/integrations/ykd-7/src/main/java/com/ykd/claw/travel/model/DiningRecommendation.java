package com.ykd.claw.travel.model;

import java.util.List;

public record DiningRecommendation(
        String name,
        String address,
        Double rating,
        Double averageCost,
        String openingHours,
        String tags,
        String photoUrl,
        String mapUrl,
        double score,
        List<String> reasons) {

    public DiningRecommendation {
        reasons = List.copyOf(reasons);
    }
}
