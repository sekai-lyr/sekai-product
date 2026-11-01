package com.ykd.claw.user.model;

import java.time.Instant;
import java.util.List;

public record UserRecord(String userId, String name, String channel, List<String> preferences,
                         Instant createdTime, Instant lastActiveTime) {
    public UserRecord {
        preferences = preferences == null ? List.of() : List.copyOf(preferences);
    }
}
