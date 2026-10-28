package com.example.demo.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@ConditionalOnProperty(prefix = "spring.ai", name = "enabled", havingValue = "true", matchIfMissing = false)
public class SpringAiChatService {

    public String chatWithTools(String message, String systemPrompt, Object context, String tools) {
        log.warn("AI is disabled, returning empty response for: {}", message);
        return "";
    }

    public String chatWithTools(String message, String systemPrompt, java.util.Set<String> tools, String context) {
        log.warn("AI is disabled, returning empty response for: {}", message);
        return "";
    }

    public boolean isAvailable() {
        return false;
    }
}
