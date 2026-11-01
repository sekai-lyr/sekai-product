package com.ykd.claw.reminder;

import java.time.Instant;

public record ReminderRecord(Long id, String userId, String conversationId, String title,
                             Instant scheduledTime, String timezone, String description,
                             String status, Instant createdTime, String recurrenceType,
                             String recurrenceRule, Instant nextFireTime, Instant lastFiredTime,
                             Instant cancelledTime, int failureCount, String lastError) { }
