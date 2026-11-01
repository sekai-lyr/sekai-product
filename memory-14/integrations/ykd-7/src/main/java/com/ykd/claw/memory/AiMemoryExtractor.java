package com.ykd.claw.memory;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class AiMemoryExtractor implements MemoryExtractor {
    private static final Logger LOGGER = LoggerFactory.getLogger(AiMemoryExtractor.class.getName());
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "technology_stack", "profession", "interest", "preference", "long_term_need");
    private static final String PROMPT = """
            Extract only durable user facts that will be useful in future conversations.
            Allowed types: technology_stack, profession, interest, preference, long_term_need.
            Do not store temporary requests, secrets, credentials, sensitive identifiers, guesses,
            assistant statements, or facts that are not explicitly stated by the user.
            Return a JSON array only. Each item must contain type, content and importance (1-10).
            Return [] when there is nothing worth remembering.

            User message:
            %s

            Assistant response:
            %s
            """;

    private final ChatClient extractionClient;
    private final ObjectMapper objectMapper;

    public AiMemoryExtractor(ChatModel chatModel, ObjectMapper objectMapper) {
        this.extractionClient = ChatClient.builder(chatModel).build();
        this.objectMapper = objectMapper;
    }

    @Override
    public List<MemoryCandidate> extract(String userMessage, String assistantMessage) {
        try {
            String response = extractionClient.prompt().user(PROMPT.formatted(userMessage, assistantMessage))
                    .call().content();
            if (response == null || response.isBlank()) return List.of();
            String json = stripCodeFence(response);
            return objectMapper.readValue(json, new TypeReference<List<MemoryCandidate>>() { }).stream()
                    .filter(candidate -> ALLOWED_TYPES.contains(candidate.type()))
                    .filter(candidate -> !candidate.content().isBlank())
                    .limit(5)
                    .toList();
        } catch (Exception e) {
            LOGGER.warn( "Long-term memory extraction skipped: " + e.getMessage(), e);
            return List.of();
        }
    }

    private static String stripCodeFence(String value) {
        String trimmed = value.trim();
        if (!trimmed.startsWith("```")) return trimmed;
        int firstNewline = trimmed.indexOf('\n');
        int lastFence = trimmed.lastIndexOf("```");
        return firstNewline >= 0 && lastFence > firstNewline
                ? trimmed.substring(firstNewline + 1, lastFence).trim() : trimmed;
    }
}
