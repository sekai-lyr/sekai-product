package com.ykd.claw.memory;

public record MemoryCandidate(String type, String content, int importance) {
    public MemoryCandidate {
        type = type == null ? "preference" : type.trim().toLowerCase();
        content = content == null ? "" : content.trim();
        importance = Math.max(1, Math.min(10, importance));
    }
}
