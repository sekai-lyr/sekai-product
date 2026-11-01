package com.ykd.claw.memory.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "chat_message", indexes = {
        @Index(name = "idx_chat_message_conversation",
                columnList = "user_id, conversation_id, created_time")
})
public class ChatMessageEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(nullable = false, length = 32)
    private String role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_time", nullable = false)
    private Instant createdTime;

    @Column(name = "tool_name")
    private String toolName;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    protected ChatMessageEntity() {
    }

    public ChatMessageEntity(String userId, String conversationId, String role, String content,
                             Instant createdTime, String toolName, String metadata) {
        this.userId = userId;
        this.conversationId = conversationId;
        this.role = role;
        this.content = content;
        this.createdTime = createdTime;
        this.toolName = toolName;
        this.metadata = metadata;
    }

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getConversationId() {
        return conversationId;
    }

    public String getRole() {
        return role;
    }

    public String getContent() {
        return content;
    }

    public Instant getCreatedTime() {
        return createdTime;
    }

    public String getToolName() {
        return toolName;
    }

    public String getMetadata() {
        return metadata;
    }
}
