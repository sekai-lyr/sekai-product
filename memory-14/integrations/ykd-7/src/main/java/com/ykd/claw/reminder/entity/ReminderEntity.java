package com.ykd.claw.reminder.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

@Entity
@Table(name = "reminder", indexes = {
        @Index(name = "idx_reminder_user_scheduled", columnList = "user_id, status, scheduled_time"),
        @Index(name = "idx_reminder_due", columnList = "status, next_fire_time"),
        @Index(name = "idx_reminder_user_created", columnList = "user_id, created_time")
})
public class ReminderEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "scheduled_time", nullable = false)
    private Instant scheduledTime;

    @Column(nullable = false, length = 100)
    private String timezone;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "created_time", nullable = false)
    private Instant createdTime;

    @Column(name = "recurrence_type", nullable = false, length = 32)
    @ColumnDefault("'once'")
    private String recurrenceType;

    @Column(name = "recurrence_rule")
    private String recurrenceRule;

    @Column(name = "next_fire_time")
    private Instant nextFireTime;

    @Column(name = "last_fired_time")
    private Instant lastFiredTime;

    @Column(name = "cancelled_time")
    private Instant cancelledTime;

    @Column(name = "failure_count", nullable = false)
    @ColumnDefault("0")
    private int failureCount;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    protected ReminderEntity() {
    }

    public ReminderEntity(String userId, String conversationId, String title, Instant scheduledTime,
                          String timezone, String description, String status, Instant createdTime,
                          String recurrenceType, String recurrenceRule) {
        this.userId = userId;
        this.conversationId = conversationId;
        this.title = title;
        this.scheduledTime = scheduledTime;
        this.timezone = timezone;
        this.description = description;
        this.status = status;
        this.createdTime = createdTime;
        this.recurrenceType = recurrenceType;
        this.recurrenceRule = recurrenceRule;
        this.nextFireTime = scheduledTime;
    }

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getConversationId() {
        return conversationId;
    }

    public String getTitle() {
        return title;
    }

    public Instant getScheduledTime() {
        return scheduledTime;
    }

    public String getTimezone() {
        return timezone;
    }

    public String getDescription() {
        return description;
    }

    public String getStatus() {
        return status;
    }

    public Instant getCreatedTime() {
        return createdTime;
    }

    public String getRecurrenceType() {
        return recurrenceType;
    }

    public String getRecurrenceRule() {
        return recurrenceRule;
    }

    public Instant getNextFireTime() {
        return nextFireTime;
    }

    public Instant getLastFiredTime() {
        return lastFiredTime;
    }

    public Instant getCancelledTime() {
        return cancelledTime;
    }

    public int getFailureCount() {
        return failureCount;
    }

    public String getLastError() {
        return lastError;
    }

    public void cancel(Instant now) {
        status = "cancelled";
        cancelledTime = now;
        nextFireTime = null;
    }

    public void pause() {
        status = "paused";
    }

    public void resume(Instant nextFireTime) {
        status = "scheduled";
        this.nextFireTime = nextFireTime;
        lastError = null;
    }

    public void retryFailed(Instant nextFireTime) {
        status = "scheduled";
        this.nextFireTime = nextFireTime;
        failureCount = 0;
        lastError = null;
    }

    public void complete(Instant firedTime) {
        status = "completed";
        lastFiredTime = firedTime;
        nextFireTime = null;
        failureCount = 0;
        lastError = null;
    }

    public void scheduleNext(Instant firedTime, Instant nextFireTime) {
        status = "scheduled";
        lastFiredTime = firedTime;
        this.nextFireTime = nextFireTime;
        failureCount = 0;
        lastError = null;
    }

    public void retry(Instant nextFireTime, String error) {
        status = "scheduled";
        this.nextFireTime = nextFireTime;
        failureCount++;
        lastError = error;
    }

    public void fail(String error) {
        status = "failed";
        failureCount++;
        lastError = error;
    }
}
