package com.ykd.claw.travel.model;

public record TravelPlace(
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
