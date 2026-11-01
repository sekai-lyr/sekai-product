package com.ykd.claw.webui.dto;

import java.util.List;
import java.util.Map;

/** 统计面板数据。 */
public record StatsData(
        List<DateCount> messageVolume,
        List<ToolCount> toolUsage,
        List<DateCount> activeUsers,
        Map<String, Long> totals) {

    /** 某一天的消息数 / 活跃用户数。 */
    public record DateCount(String date, long count) {
    }

    /** 某工具的被调用次数。 */
    public record ToolCount(String tool, long count) {
    }
}
