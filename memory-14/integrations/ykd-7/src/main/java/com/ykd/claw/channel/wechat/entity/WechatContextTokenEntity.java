package com.ykd.claw.channel.wechat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "wechat_context_token", indexes = {
        @Index(name = "idx_wechat_context_token_updated", columnList = "updated_time")
})
public class WechatContextTokenEntity {
    @Id
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "context_token", nullable = false, columnDefinition = "TEXT")
    private String contextToken;

    @Column(name = "updated_time", nullable = false)
    private Instant updatedTime;

    protected WechatContextTokenEntity() {
    }

    public WechatContextTokenEntity(String userId, String contextToken, Instant updatedTime) {
        this.userId = userId;
        this.contextToken = contextToken;
        this.updatedTime = updatedTime;
    }

    public String getUserId() { return userId; }
    public String getContextToken() { return contextToken; }
    public Instant getUpdatedTime() { return updatedTime; }

    public void update(String contextToken, Instant updatedTime) {
        this.contextToken = contextToken;
        this.updatedTime = updatedTime;
    }
}
