package com.ykd.claw.webui.dto;

import java.time.Instant;
import java.util.List;

/** 响应性能分析。 */
public record PerformanceData(
        Double avgDurationMs,
        Double medianDurationMs,
        List<SlowExecutionView> slowestExecutions,
        List<ToolLatencyView> toolLatency,
        List<DailyLatencyView> dailyAvg) {

    /** 最慢的执行。 */
    public record SlowExecutionView(String executionId, String userId, String userMessage,
                                    long durationMs, Instant startedTime) {
    }

    /** 某工具的平均耗时。 */
    public record ToolLatencyView(String tool, double avgDurationMs, long count) {
    }

    /** 某一天的平均耗时。 */
    public record DailyLatencyView(String date, double avgDurationMs, long count) {
    }
}
