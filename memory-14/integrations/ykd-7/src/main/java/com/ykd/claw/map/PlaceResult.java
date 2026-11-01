package com.ykd.claw.map;

public record PlaceResult(
        String id,
        String name,
        String address,
        String location,
        String city,
        String district,
        String type,
        String businessArea,
        String openingHours,
        String telephone,
        String tags,
        Double rating,
        Double averageCost,
        String photoUrl,
        String mapUrl) {
}
