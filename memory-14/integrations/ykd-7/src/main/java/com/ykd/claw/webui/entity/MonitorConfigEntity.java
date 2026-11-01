package com.ykd.claw.webui.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 监测台运行时配置(KV 键值对,如数据保留策略)。 */
@Entity
@Table(name = "monitor_config")
public class MonitorConfigEntity {

    @Id
    @Column(name = "config_key", nullable = false, length = 64)
    private String key;

    @Column(name = "config_value", columnDefinition = "TEXT")
    private String value;

    protected MonitorConfigEntity() {
    }

    public MonitorConfigEntity(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey() {
        return key;
    }

    public String getValue() {
        return value;
    }

    public void update(String value) {
        this.value = value;
    }
}
