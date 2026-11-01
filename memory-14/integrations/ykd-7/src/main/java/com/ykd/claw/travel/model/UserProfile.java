package com.ykd.claw.travel.model;

import java.util.List;

public record UserProfile(List<String> preferences) {
    public UserProfile {
        preferences = List.copyOf(preferences);
    }
}
