package com.ykd.claw.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "app_user", indexes = {
        @Index(name = "idx_app_user_user_id", columnList = "user_id", unique = true)
})
public class UserEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false, unique = true, length = 128)
    private String userId;
    @Column(length = 128)
    private String name;
    @Column(length = 32)
    private String channel;
    @Column(columnDefinition = "TEXT")
    private String preferences;
    @Column(name = "created_time", nullable = false)
    private Instant createdTime;
    @Column(name = "last_active_time", nullable = false)
    private Instant lastActiveTime;

    protected UserEntity() {
    }

    public UserEntity(String userId, String channel, Instant now) {
        this.userId = userId;
        this.channel = channel;
        this.createdTime = now;
        this.lastActiveTime = now;
    }

    public void touch(Instant now) {
        this.lastActiveTime = now;
    }

    public Long getId() { return id; }
    public String getUserId() { return userId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getChannel() { return channel; }
    public String getPreferences() { return preferences; }
    public void setPreferences(String preferences) { this.preferences = preferences; }
    public Instant getCreatedTime() { return createdTime; }
    public Instant getLastActiveTime() { return lastActiveTime; }
}
