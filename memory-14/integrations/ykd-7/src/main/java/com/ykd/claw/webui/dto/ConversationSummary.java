package com.ykd.claw.webui.dto;

import java.time.Instant;

/** 单个会话的摘要信息。 */
public record ConversationSummary(String conversationId, long messageCount,
                                  Instant lastMessageAt, String lastMessageRole,
                                  String lastMessagePreview) {
}
