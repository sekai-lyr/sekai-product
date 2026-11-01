package com.ykd.claw.reminder;

import com.ykd.claw.reminder.entity.ReminderEntity;
import com.ykd.claw.reminder.repository.ReminderJpaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class ReminderService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ReminderService.class.getName());
    private static final int MAX_FAILURES = 3;

    private final ReminderJpaRepository repository;
    private final List<ReminderPublisher> publishers;
    private final Clock clock;

    @Autowired
    public ReminderService(ReminderJpaRepository repository, List<ReminderPublisher> publishers) {
        this(repository, publishers, Clock.systemUTC());
    }

    ReminderService(ReminderJpaRepository repository, List<ReminderPublisher> publishers, Clock clock) {
        this.repository = repository;
        this.publishers = List.copyOf(publishers);
        this.clock = clock;
    }

    public ReminderRecord create(String userId, String conversationId, String title,
                                 String time, String description) {
        return create(userId, conversationId, title, time, description, "once");
    }

    @Transactional
    public ReminderRecord create(String userId, String conversationId, String title,
                                 String time, String description, String recurrence) {
        String cleanTitle = required(title, "title");
        if (cleanTitle.length() > 200) throw new IllegalArgumentException("title must not exceed 200 characters");
        ParsedTime parsed = parseTime(required(time, "time"));
        if (!parsed.instant().isAfter(clock.instant())) {
            throw new IllegalArgumentException("Reminder time must be in the future");
        }
        Recurrence parsedRecurrence = parseRecurrence(recurrence);
        ReminderEntity saved = repository.save(new ReminderEntity(
                required(userId, "userId"), required(conversationId, "conversationId"), cleanTitle,
                parsed.instant(), parsed.timezone(), description == null ? "" : description.trim(),
                "scheduled", clock.instant(), parsedRecurrence.type(), parsedRecurrence.rule()));
        return toRecord(saved);
    }

    @Transactional(readOnly = true)
    public List<ReminderRecord> list(String userId) {
        return repository.findByUserIdOrderByCreatedTimeDesc(required(userId, "userId")).stream()
                .map(ReminderService::toRecord)
                .toList();
    }

    /** 看板:全量提醒列表(按创建时间倒序)。 */
    @Transactional(readOnly = true)
    public List<ReminderRecord> listAll() {
        return repository.findAllByOrderByCreatedTimeDesc().stream()
                .map(ReminderService::toRecord)
                .toList();
    }

    @Transactional
    public ReminderRecord cancel(String userId, long reminderId) {
        ReminderEntity entity = owned(userId, reminderId);
        if ("completed".equals(entity.getStatus()) || "cancelled".equals(entity.getStatus())) {
            throw new IllegalStateException("Reminder is already " + entity.getStatus());
        }
        entity.cancel(clock.instant());
        return toRecord(repository.save(entity));
    }

    @Transactional
    public ReminderRecord pause(String userId, long reminderId) {
        ReminderEntity entity = owned(userId, reminderId);
        if (!"scheduled".equals(entity.getStatus())) {
            throw new IllegalStateException("Only scheduled reminders can be paused");
        }
        entity.pause();
        return toRecord(repository.save(entity));
    }

    @Transactional
    public ReminderRecord resume(String userId, long reminderId) {
        ReminderEntity entity = owned(userId, reminderId);
        if (!"paused".equals(entity.getStatus())) {
            throw new IllegalStateException("Only paused reminders can be resumed");
        }
        Instant next = entity.getNextFireTime().isAfter(clock.instant())
                ? entity.getNextFireTime() : clock.instant();
        entity.resume(next);
        return toRecord(repository.save(entity));
    }

    @Transactional
    public ReminderRecord retryFailed(String userId, long reminderId) {
        ReminderEntity entity = owned(userId, reminderId);
        if (!"failed".equals(entity.getStatus())) {
            throw new IllegalStateException("Only failed reminders can be retried");
        }
        Instant next = "once".equals(entity.getRecurrenceType())
                ? clock.instant() : nextOccurrence(entity, clock.instant());
        if (next == null) next = clock.instant();
        entity.retryFailed(next);
        return toRecord(repository.save(entity));
    }

    @Async("asyncExecutor")
    public void dispatchDueAsync(long reminderId) {
        try {
            dispatchDue(reminderId);
        } catch (Exception e) {
            LOGGER.warn("Async reminder dispatch failed: id=" + reminderId, e);
        }
    }

    @Transactional(readOnly = true)
    public List<Long> findDueIds() {
        return repository.findTop100ByStatusAndNextFireTimeLessThanEqualOrderByNextFireTimeAsc(
                        "scheduled", clock.instant()).stream()
                .map(ReminderEntity::getId)
                .toList();
    }

    @Transactional
    public void dispatchDue(long reminderId) {
        Instant now = clock.instant();
        if (repository.claimDue(reminderId, now) == 0) return;
        ReminderEntity entity = repository.findById(reminderId).orElseThrow();
        ReminderRecord reminder = toRecord(entity);
        try {
            for (ReminderPublisher publisher : publishers) publisher.publish(reminder);
            Instant next = nextOccurrence(entity, now);
            if (next == null) entity.complete(now);
            else entity.scheduleNext(now, next);
            repository.save(entity);
            LOGGER.info("Reminder delivered: id=" + reminderId + ", next=" + next);
        } catch (Exception e) {
            String error = e.getClass().getSimpleName() + ": " + e.getMessage();
            if (entity.getFailureCount() + 1 >= MAX_FAILURES) entity.fail(error);
            else entity.retry(now.plusSeconds(60), error);
            repository.save(entity);
            LOGGER.warn( "Reminder delivery failed: id=" + reminderId, e);
        }
    }

    private ReminderEntity owned(String userId, long reminderId) {
        return repository.findByIdAndUserId(reminderId, required(userId, "userId"))
                .orElseThrow(() -> new NoSuchElementException("Reminder not found: " + reminderId));
    }

    private static Instant nextOccurrence(ReminderEntity entity, Instant now) {
        if ("once".equals(entity.getRecurrenceType())) return null;
        ZoneId zone = ZoneId.of(entity.getTimezone());
        ZonedDateTime candidate = entity.getNextFireTime().atZone(zone);
        do {
            candidate = switch (entity.getRecurrenceType()) {
                case "daily" -> candidate.plusDays(1);
                case "weekly" -> candidate.plusWeeks(1);
                case "monthly" -> candidate.plusMonths(1);
                case "cron" -> CronExpression.parse(entity.getRecurrenceRule()).next(candidate);
                default -> throw new IllegalStateException("Unsupported recurrence: " + entity.getRecurrenceType());
            };
            if (candidate == null) return null;
        } while (!candidate.toInstant().isAfter(now));
        return candidate.toInstant();
    }

    private static Recurrence parseRecurrence(String value) {
        String normalized = value == null || value.isBlank() ? "once" : value.trim().toLowerCase(Locale.ROOT);
        if (List.of("once", "daily", "weekly", "monthly").contains(normalized)) {
            return new Recurrence(normalized, null);
        }
        if (normalized.startsWith("cron:")) {
            String rule = value.trim().substring("cron:".length()).trim();
            CronExpression.parse(rule);
            return new Recurrence("cron", rule);
        }
        throw new IllegalArgumentException("recurrence must be once, daily, weekly, monthly, or cron:<expression>");
    }

    private static ParsedTime parseTime(String value) {
        try {
            ZonedDateTime zoned = ZonedDateTime.parse(value);
            return new ParsedTime(zoned.toInstant(), zoned.getZone().getId());
        } catch (DateTimeException ignored) {
            try {
                OffsetDateTime offset = OffsetDateTime.parse(value);
                return new ParsedTime(offset.toInstant(), offset.getOffset().getId());
            } catch (DateTimeException e) {
                throw new IllegalArgumentException("time must be ISO 8601 with a timezone or UTC offset", e);
            }
        }
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value.trim();
    }

    private static ReminderRecord toRecord(ReminderEntity entity) {
        return new ReminderRecord(entity.getId(), entity.getUserId(), entity.getConversationId(),
                entity.getTitle(), entity.getScheduledTime(), entity.getTimezone(), entity.getDescription(),
                entity.getStatus(), entity.getCreatedTime(), entity.getRecurrenceType(),
                entity.getRecurrenceRule(), entity.getNextFireTime(), entity.getLastFiredTime(),
                entity.getCancelledTime(), entity.getFailureCount(), entity.getLastError());
    }

    private record ParsedTime(Instant instant, String timezone) { }
    private record Recurrence(String type, String rule) { }
}
