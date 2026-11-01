package com.ykd.claw.reminder;

import com.ykd.claw.reminder.entity.ReminderEntity;
import com.ykd.claw.reminder.repository.ReminderJpaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReminderServiceTest {

    @Test
    void savesReminderWithUserContextWithoutPublishingBeforeDueTime() {
        List<ReminderRecord> published = new ArrayList<>();
        Clock clock = Clock.fixed(Instant.parse("2026-07-23T01:00:00Z"), ZoneOffset.UTC);
        ReminderService service = new ReminderService(repository(),
                List.of(published::add), clock);

        ReminderRecord reminder = service.create("user-1", "conversation-1", "提交日报",
                "2026-07-23T18:00:00+08:00[Asia/Shanghai]", "发送到项目群");

        assertEquals(1L, reminder.id());
        assertEquals("user-1", reminder.userId());
        assertEquals(Instant.parse("2026-07-23T10:00:00Z"), reminder.scheduledTime());
        assertEquals("Asia/Shanghai", reminder.timezone());
        assertEquals("once", reminder.recurrenceType());
        assertEquals(List.of(), published);
    }

    @Test
    void rejectsPastOrTimezoneLessReminderTime() {
        Clock clock = Clock.fixed(Instant.parse("2026-07-23T01:00:00Z"), ZoneOffset.UTC);
        ReminderService service = new ReminderService(repository(), List.of(), clock);

        assertThrows(IllegalArgumentException.class, () -> service.create("user", "conversation", "过去",
                "2026-07-22T18:00:00+08:00", null));
        assertThrows(IllegalArgumentException.class, () -> service.create("user", "conversation", "无时区",
                "2026-07-24T18:00:00", null));
    }

    @Test
    void deliversDueRecurringReminderAndSchedulesNextOccurrence() {
        List<ReminderRecord> published = new ArrayList<>();
        Clock clock = Clock.fixed(Instant.parse("2026-07-23T10:00:00Z"), ZoneOffset.UTC);
        ReminderJpaRepository repository = repository();
        ReminderEntity entity = new ReminderEntity("user-1", "conversation-1", "Daily standup",
                Instant.parse("2026-07-23T09:00:00Z"), "UTC", "", "scheduled",
                Instant.parse("2026-07-22T01:00:00Z"), "daily", null);
        ReflectionTestUtils.setField(entity, "id", 1L);
        when(repository.claimDue(1L, clock.instant())).thenReturn(1);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(entity));
        ReminderService service = new ReminderService(repository, List.of(published::add), clock);

        service.dispatchDue(1L);

        assertEquals(1, published.size());
        assertEquals("scheduled", entity.getStatus());
        assertEquals(Instant.parse("2026-07-24T09:00:00Z"), entity.getNextFireTime());
    }

    @Test
    void retriesDeliveryThreeTimesThenMarksReminderFailed() {
        Clock clock = Clock.fixed(Instant.parse("2026-07-23T10:00:00Z"), ZoneOffset.UTC);
        ReminderJpaRepository repository = repository();
        ReminderEntity entity = new ReminderEntity("user-1", "conversation-1", "Retry",
                Instant.parse("2026-07-23T09:00:00Z"), "UTC", "", "scheduled",
                Instant.parse("2026-07-22T01:00:00Z"), "once", null);
        ReflectionTestUtils.setField(entity, "id", 1L);
        when(repository.claimDue(1L, clock.instant())).thenReturn(1);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(entity));
        ReminderService service = new ReminderService(repository,
                List.of(reminder -> { throw new IllegalStateException("offline"); }), clock);

        service.dispatchDue(1L);
        service.dispatchDue(1L);
        service.dispatchDue(1L);

        assertEquals("failed", entity.getStatus());
        assertEquals(3, entity.getFailureCount());
        assertEquals("IllegalStateException: offline", entity.getLastError());
    }

    @Test
    void reactivatesFailedRecurringReminderAfterChannelRecovers() {
        Clock clock = Clock.fixed(Instant.parse("2026-07-23T10:00:00Z"), ZoneOffset.UTC);
        ReminderJpaRepository repository = repository();
        ReminderEntity entity = new ReminderEntity("user-1", "conversation-1", "Every minute",
                Instant.parse("2026-07-23T09:00:00Z"), "UTC", "", "scheduled",
                Instant.parse("2026-07-22T01:00:00Z"), "cron", "0 * * * * *");
        ReflectionTestUtils.setField(entity, "id", 1L);
        ReflectionTestUtils.setField(entity, "status", "failed");
        ReflectionTestUtils.setField(entity, "failureCount", 3);
        ReflectionTestUtils.setField(entity, "lastError", "missing context token");
        when(repository.findByIdAndUserId(1L, "user-1")).thenReturn(java.util.Optional.of(entity));
        ReminderService service = new ReminderService(repository, List.of(), clock);

        ReminderRecord retried = service.retryFailed("user-1", 1L);

        assertEquals("scheduled", retried.status());
        assertEquals(0, retried.failureCount());
        assertEquals(Instant.parse("2026-07-23T10:01:00Z"), retried.nextFireTime());
    }

    private static ReminderJpaRepository repository() {
        ReminderJpaRepository repository = mock(ReminderJpaRepository.class);
        when(repository.save(any(ReminderEntity.class))).thenAnswer(invocation -> {
            ReminderEntity entity = invocation.getArgument(0);
            ReflectionTestUtils.setField(entity, "id", 1L);
            return entity;
        });
        return repository;
    }
}
