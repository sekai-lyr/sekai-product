package com.ykd.claw.travel.model;

import java.time.LocalTime;
import java.util.List;

public record TravelItineraryItem(
        int day,
        LocalTime startTime,
        LocalTime endTime,
        TravelPlace place,
        Double estimatedDistanceKmFromPrevious,
        Integer estimatedTravelMinutesFromPrevious,
        List<String> notes) {
}
