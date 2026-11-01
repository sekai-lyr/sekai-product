package com.ykd.claw.graph;

import java.util.Map;

public record PlannedToolCall(String toolName, Map<String, Object> arguments, String fallbackFor) {
    public PlannedToolCall(String toolName, Map<String, Object> arguments) {
        this(toolName, arguments, null);
    }

    public PlannedToolCall {
        arguments = Map.copyOf(arguments);
        fallbackFor = fallbackFor == null || fallbackFor.isBlank() ? null : fallbackFor;
    }
}
