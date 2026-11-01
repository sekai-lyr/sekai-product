package com.ykd.claw.reminder;

import com.ykd.claw.reminder.repository.ReminderJpaRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class ReminderStartupRecovery {
    private static final Logger LOGGER = LoggerFactory.getLogger(ReminderStartupRecovery.class.getName());
    private final ReminderJpaRepository repository;

    public ReminderStartupRecovery(ReminderJpaRepository repository) {
        this.repository = repository;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void recover() {
        int recurrence = repository.backfillRecurrence();
        int nextFire = repository.backfillNextFireTime();
        int processing = repository.recoverProcessing();
        if (recurrence + nextFire + processing > 0) {
            LOGGER.info("Recovered reminder rows: recurrence=" + recurrence
                    + ", nextFire=" + nextFire + ", processing=" + processing);
        }
    }
}
