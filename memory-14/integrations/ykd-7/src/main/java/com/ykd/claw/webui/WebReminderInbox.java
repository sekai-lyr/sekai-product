package com.ykd.claw.webui;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 把 Web 渠道的到期提醒交给对应用户的聊天页。 */
@Component
public class WebReminderInbox {
    private record Conversation(String userId, String conversationId) { }
    private final Map<Conversation, List<String>> pending = new HashMap<>();

    public synchronized void publish(String userId, String conversationId, String message) {
        pending.computeIfAbsent(new Conversation(userId, conversationId), key -> new ArrayList<>()).add(message);
    }

    public synchronized List<String> drain(String userId, String conversationId) {
        List<String> messages = pending.remove(new Conversation(userId, conversationId));
        return messages == null ? List.of() : List.copyOf(messages);
    }
}
