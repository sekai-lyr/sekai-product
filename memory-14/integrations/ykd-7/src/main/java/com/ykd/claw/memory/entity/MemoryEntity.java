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
@Table(name = "memory", indexes = {
        @Index(name = "idx_memory_user_importance", columnList = "user_id, importance, created_time")
})
public class MemoryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false, length = 64)
    private String type;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private int importance;

    @Column(name = "created_time", nullable = false)
    private Instant createdTime;

    protected MemoryEntity() {
    }

    public MemoryEntity(String userId, String type, String content, int importance, Instant createdTime) {
        this.userId = userId;
        this.type = type;
        this.content = content;
        this.importance = importance;
        this.createdTime = createdTime;
    }

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getType() {
        return type;
    }

    public String getContent() {
        return content;
    }

    public int getImportance() {
        return importance;
    }

    public Instant getCreatedTime() {
        return createdTime;
    }
}
