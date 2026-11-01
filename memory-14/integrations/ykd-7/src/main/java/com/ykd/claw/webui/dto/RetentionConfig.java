package com.ykd.claw.webui.dto;

/** 数据保留策略配置。 */
public record RetentionConfig(boolean enabled, int days) {
}
