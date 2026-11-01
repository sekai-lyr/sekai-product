package com.ykd.claw.webui.dto;

import java.time.Instant;

/** 实时动态流中的一条事件。 */
public record ActivityEvent(String type, String userId, String summary, Instant timestamp) {
}
