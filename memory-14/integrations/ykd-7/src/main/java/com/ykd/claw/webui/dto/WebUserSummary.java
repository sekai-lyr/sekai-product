package com.ykd.claw.webui.dto;

import java.time.Instant;
import java.util.List;

/** 监测看板中一位用户及其全部会话的摘要。 */
public record WebUserSummary(String userId, String channel, long conversationCount, long messageCount,
                             Instant lastMessageAt, String alias, String lastMessageRole,
                             String lastMessagePreview, List<ConversationSummary> conversations) {
}
