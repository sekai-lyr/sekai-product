package com.ykd.claw.map;

import java.util.List;

public record RouteResult(
        String origin,
        String destination,
        String originLocation,
        String destinationLocation,
        long distanceMeters,
        long durationSeconds,
        String tolls,
        String strategy,
        List<String> instructions) {
}
