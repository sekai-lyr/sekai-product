package com.ykd.claw.graph;

public record SkillToolResult(String toolName, String result, String error) {
    public boolean succeeded() {
        return error == null;
    }

    public boolean success() { return succeeded(); }
    public String data() { return result; }
    public String errorMessage() { return error; }
}
