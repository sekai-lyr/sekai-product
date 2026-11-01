package com.ykd.claw.webui.dto;

import com.ykd.claw.memory.ChatMessageRecord;
import com.ykd.claw.memory.entity.ChatMessageEntity;

import java.time.Instant;

/** 全文搜索命中的一条消息。 */
public record SearchResult(String userId, String conversationId, String role,
                           String content, Instant createdTime) {

    public static SearchResult from(ChatMessageEntity entity) {
        return new SearchResult(entity.getUserId(), entity.getConversationId(), entity.getRole(),
                entity.getContent(), entity.getCreatedTime());
    }

    public static SearchResult from(ChatMessageRecord record) {
        return new SearchResult(record.userId(), record.conversationId(), record.role(),
                record.content(), record.createdTime());
    }
}
