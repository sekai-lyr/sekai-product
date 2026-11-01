package com.ykd.claw.reminder;

import com.ykd.claw.channel.wechat.ILinkBotService;
import org.springframework.stereotype.Component;

@Component
public class LocalReminderPublisher implements ReminderPublisher {
    private final ILinkBotService ilinkBotService;

    @org.springframework.beans.factory.annotation.Autowired
    private com.ykd.claw.webui.WebReminderInbox webInbox;

    public LocalReminderPublisher(ILinkBotService ilinkBotService) {
        this.ilinkBotService = ilinkBotService;
    }

    @Override
    public void publish(ReminderRecord reminder) {
        String text = "⏰ 提醒：" + reminder.title()
                + (reminder.description().isBlank() ? "" : "\n" + reminder.description());
        if (reminder.conversationId().startsWith("wx_")) {
            ilinkBotService.sendText(reminder.userId(), text)
                    .ifPresent(error -> {
                        throw new IllegalStateException(error);
                    });
        } else if (reminder.conversationId().startsWith("web_travel:")) {
            webInbox.publish(reminder.userId(), reminder.conversationId(), text);
        } else {
            System.out.println("\n" + text);
        }
    }
}
