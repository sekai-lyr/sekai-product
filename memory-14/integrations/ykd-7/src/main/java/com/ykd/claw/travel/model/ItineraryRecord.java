package com.ykd.claw.travel.model;

import java.time.Instant;
import java.time.LocalDate;

public record ItineraryRecord(Long id, String destination, LocalDate startDate, LocalDate endDate,
                              Integer days, String title, String content,
                              Instant createdTime, Instant updatedTime) {
    public ItineraryRecord {
        content = content == null ? "" : content;
    }
}
