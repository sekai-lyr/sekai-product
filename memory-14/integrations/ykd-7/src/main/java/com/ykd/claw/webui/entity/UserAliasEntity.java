package com.ykd.claw.webui.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** 监测看板给微信用户设置的备注/别名(以 userId 为键)。 */
@Entity
@Table(name = "user_alias")
public class UserAliasEntity {

    @Id
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false, length = 64)
    private String alias;

    @Column(name = "updated_time", nullable = false)
    private Instant updatedTime;

    protected UserAliasEntity() {
    }

    public UserAliasEntity(String userId, String alias, Instant updatedTime) {
        this.userId = userId;
        this.alias = alias;
        this.updatedTime = updatedTime;
    }

    public String getUserId() {
        return userId;
    }

    public String getAlias() {
        return alias;
    }

    public Instant getUpdatedTime() {
        return updatedTime;
    }

    public void updateAlias(String alias, Instant updatedTime) {
        this.alias = alias;
        this.updatedTime = updatedTime;
    }
}
