package com.ykd.claw.memory;

import java.time.Instant;

public record UserMemory(
        Long id,
        String userId,
        String type,
        String content,
        int importance,
        Instant createdTime) {
}
