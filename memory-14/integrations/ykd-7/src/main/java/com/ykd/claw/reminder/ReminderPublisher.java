package com.ykd.claw.reminder;


/** Extension point for publishing locally saved reminders to third-party calendar providers. */
public interface ReminderPublisher {
    void publish(ReminderRecord reminder) throws Exception;
}
