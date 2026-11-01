package com.ykd.claw.reminder;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Component
public final class ReminderTool implements ToolProvider {
    private final ReminderService service;

    public ReminderTool(ReminderService service) {
        this.service = service;
    }

    @Tool(name = "create_reminder", description = "Create and persist a reminder for the current user. "
            + "Before converting relative dates such as tomorrow, call get_current_time. "
            + "Only call after the title and exact future time are known.")
    public String createReminder(
            @ToolParam(description = "Short reminder title, maximum 200 characters") String title,
            @ToolParam(description = "Future ISO 8601 time with offset or timezone, for example "
                    + "2026-07-24T15:00:00+08:00[Asia/Shanghai]") String time,
            @ToolParam(description = "Optional reminder details", required = false) String description,
            @ToolParam(description = "Optional recurrence: once, daily, weekly, monthly, or "
                    + "cron:<Spring cron expression>", required = false) String recurrence,
            ToolContext toolContext) {
        Map<String, Object> context = toolContext == null ? Map.of() : toolContext.getContext();
        String userId = contextValue(context, "userId", "local");
        String conversationId = contextValue(context, "conversationId", "default");
        ReminderRecord reminder = service.create(userId, conversationId, title, time, description, recurrence);
        String scheduled = DateTimeFormatter.ISO_ZONED_DATE_TIME.format(
                reminder.scheduledTime().atZone(ZoneId.of(reminder.timezone())));
        return "Reminder created successfully.\nID: " + reminder.id()
                + "\nTitle: " + reminder.title()
                + "\nScheduled time: " + scheduled
                + "\nStatus: " + reminder.status()
                + "\nRecurrence: " + reminder.recurrenceType()
                + (reminder.description().isBlank() ? "" : "\nDescription: " + reminder.description());
    }

    @Tool(name = "list_reminders", description = "List reminders belonging to the current user.")
    public String listReminders(ToolContext toolContext) {
        String userId = contextValue(context(toolContext), "userId", "local");
        var reminders = service.list(userId);
        if (reminders.isEmpty()) return "No reminders found.";
        StringBuilder result = new StringBuilder();
        reminders.forEach(reminder -> result.append("ID: ").append(reminder.id())
                .append(" | ").append(reminder.title())
                .append(" | ").append(reminder.status())
                .append(" | next: ").append(reminder.nextFireTime())
                .append(" | recurrence: ").append(reminder.recurrenceType()).append('\n'));
        return result.toString().trim();
    }

    @Tool(name = "cancel_reminder", description = "Cancel one reminder belonging to the current user.")
    public String cancelReminder(@ToolParam(description = "Reminder ID") long reminderId,
                                 ToolContext toolContext) {
        ReminderRecord reminder = service.cancel(
                contextValue(context(toolContext), "userId", "local"), reminderId);
        return "Reminder " + reminder.id() + " cancelled.";
    }

    @Tool(name = "pause_reminder", description = "Pause a scheduled recurring or one-time reminder.")
    public String pauseReminder(@ToolParam(description = "Reminder ID") long reminderId,
                                ToolContext toolContext) {
        ReminderRecord reminder = service.pause(
                contextValue(context(toolContext), "userId", "local"), reminderId);
        return "Reminder " + reminder.id() + " paused.";
    }

    @Tool(name = "resume_reminder", description = "Resume a paused reminder.")
    public String resumeReminder(@ToolParam(description = "Reminder ID") long reminderId,
                                 ToolContext toolContext) {
        ReminderRecord reminder = service.resume(
                contextValue(context(toolContext), "userId", "local"), reminderId);
        return "Reminder " + reminder.id() + " resumed.";
    }

    @Tool(name = "retry_reminder", description = "Reactivate a reminder that entered failed status "
            + "after delivery errors. Use after the delivery channel is available again.")
    public String retryReminder(@ToolParam(description = "Failed reminder ID") long reminderId,
                                ToolContext toolContext) {
        ReminderRecord reminder = service.retryFailed(
                contextValue(context(toolContext), "userId", "local"), reminderId);
        return "Reminder " + reminder.id() + " reactivated.";
    }

    private static Map<String, Object> context(ToolContext toolContext) {
        return toolContext == null ? Map.of() : toolContext.getContext();
    }

    private static String contextValue(Map<String, Object> context, String key, String fallback) {
        Object value = context.get(key);
        return value instanceof String text && !text.isBlank() ? text : fallback;
    }
}
