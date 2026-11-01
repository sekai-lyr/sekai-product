package com.ykd.claw.agent;

import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;

/**
 * Keeps an already executed Graph tool visible to the model without repeating
 * its external side effect. The actual result is already present in Graph context.
 */
final class AlreadyExecutedToolCallback implements ToolCallback {
    private final ToolCallback delegate;

    AlreadyExecutedToolCallback(ToolCallback delegate) {
        this.delegate = delegate;
    }

    @Override
    public ToolDefinition getToolDefinition() {
        return delegate.getToolDefinition();
    }

    @Override
    public ToolMetadata getToolMetadata() {
        return delegate.getToolMetadata();
    }

    @Override
    public String call(String input) {
        return cachedResult();
    }

    @Override
    public String call(String input, ToolContext toolContext) {
        return cachedResult();
    }

    private String cachedResult() {
        return "{\"success\":true,\"cached\":true,\"tool\":\""
                + getToolDefinition().name()
                + "\",\"message\":\"该工具已由Graph执行，请直接使用系统上下文中的汇总结果\"}";
    }
}
