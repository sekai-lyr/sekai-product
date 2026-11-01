package com.ykd.claw.webui.dto;

/** 系统健康指标。 */
public record SystemMetrics(
        long uptimeMs,
        int threadCount,
        Long heapUsed,      // bytes
        Long heapMax,       // bytes
        Long nonHeapUsed,   // bytes
        Double cpu,         // 0.0 ~ 1.0,不可用时为 null
        long dbSizeBytes,
        String dbPath,
        boolean wechatOnline,
        String wechatState) {
}
