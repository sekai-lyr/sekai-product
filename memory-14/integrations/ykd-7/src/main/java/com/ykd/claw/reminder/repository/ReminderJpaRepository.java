package com.ykd.claw.reminder.repository;

import com.ykd.claw.reminder.entity.ReminderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReminderJpaRepository extends JpaRepository<ReminderEntity, Long> {
    List<ReminderEntity> findTop100ByStatusAndNextFireTimeLessThanEqualOrderByNextFireTimeAsc(
            String status, Instant now);

    List<ReminderEntity> findByUserIdOrderByCreatedTimeDesc(String userId);

    List<ReminderEntity> findAllByOrderByCreatedTimeDesc();

    long countByStatus(String status);

    Optional<ReminderEntity> findByIdAndUserId(Long id, String userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update ReminderEntity reminder
            set reminder.status = 'processing'
            where reminder.id = :id
              and reminder.status = 'scheduled'
              and reminder.nextFireTime <= :now
            """)
    int claimDue(@Param("id") Long id, @Param("now") Instant now);

    @Modifying
    @Query("""
            update ReminderEntity reminder
            set reminder.recurrenceType = 'once'
            where reminder.recurrenceType is null
            """)
    int backfillRecurrence();

    @Modifying
    @Query("""
            update ReminderEntity reminder
            set reminder.nextFireTime = reminder.scheduledTime
            where reminder.nextFireTime is null and reminder.status = 'scheduled'
            """)
    int backfillNextFireTime();

    @Modifying
    @Query("""
            update ReminderEntity reminder
            set reminder.status = 'scheduled'
            where reminder.status = 'processing'
            """)
    int recoverProcessing();
}
