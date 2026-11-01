package com.example.demo.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Set;

/**
 * AI 聊天服务：委托给 {@link ToolCallingService} 的完整链路
 * （LLM 调用 + 28 个工具 + 对话记忆 + RAG 上下文）。
 * <p>
 * 历史教训：此前的桩实现无论配置如何都返回空字符串，
 * 导致开启 spring.ai.enabled 后页面仍显示空回复。
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "spring.ai", name = "enabled", havingValue = "true", matchIfMissing = false)
public class SpringAiChatService {

    private final ToolCallingService toolCallingService;

    public String chatWithTools(String message, String systemPrompt, Object context, String tools) {
        return doChat(message, systemPrompt, null, tools);
    }

    public String chatWithTools(String message, String systemPrompt, Set<String> tools, String context) {
        return doChat(message, systemPrompt, tools, context);
    }

    private String doChat(String message, String systemPrompt, Set<String> tools, String conversationId) {
        try {
            ToolCallResponse response =
                    toolCallingService.chatWithTools(systemPrompt, message, tools, conversationId);
            String text = response.getText();
            if (text == null || text.isBlank()) {
                log.warn("AI chat returned empty text, hasToolCalls={}", response.hasToolCalls());
                return "抱歉，我这次没有生成回复内容，请换个说法再试一次。";
            }
            return text;
        } catch (Exception e) {
            log.error("AI chat failed: {}", e.getMessage(), e);
            return "AI 服务暂时不可用：" + e.getMessage();
        }
    }

    public boolean isAvailable() {
        return true;
    }
}
