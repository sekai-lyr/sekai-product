package com.ykd.claw.reminder;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ReminderScheduler {
    private final ReminderService service;

    public ReminderScheduler(ReminderService service) {
        this.service = service;
    }

    @Scheduled(fixedDelayString = "${reminder.scan-interval-ms:30000}",
            initialDelayString = "${reminder.initial-delay-ms:5000}")
    public void dispatchDueReminders() {
        service.findDueIds().forEach(service::dispatchDueAsync);
    }
}
