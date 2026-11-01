package com.ykd.claw.memory;

import java.time.Instant;

public record ChatMessageRecord(
        Long id,
        String userId,
        String conversationId,
        String role,
        String content,
        Instant createdTime,
        String toolName,
        String metadata) {

    public static ChatMessageRecord user(String userId, String conversationId, String content) {
        return new ChatMessageRecord(null, userId, conversationId, "user", content, Instant.now(), null, null);
    }

    public static ChatMessageRecord assistant(String userId, String conversationId, String content) {
        return new ChatMessageRecord(null, userId, conversationId, "assistant", content, Instant.now(), null, null);
    }

    public static ChatMessageRecord tool(String userId, String conversationId, String toolName,
                                         String content, String metadata) {
        return new ChatMessageRecord(null, userId, conversationId, "tool", content, Instant.now(),
                toolName, metadata);
    }
}
