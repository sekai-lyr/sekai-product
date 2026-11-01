package com.ykd.claw.graph;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.skill.SkillDefinition;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AiSkillRequirementEvaluator implements SkillRequirementEvaluator {
    private static final Logger LOGGER = LoggerFactory.getLogger("AGENT_FULL_TRACE");
    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    public AiSkillRequirementEvaluator(ChatClient.Builder builder, ObjectMapper objectMapper) {
        this.chatClient = builder.build();
        this.objectMapper = objectMapper;
    }

    @Override
    public List<String> findMissing(SkillDefinition skill, String userMessage) {
        if (skill.requiredUserInformation().isEmpty()) return List.of();
        String response = chatClient.prompt()
                .system("""
                        You validate whether required information is present in a user request.
                        Return only a JSON array containing the exact missing field names.
                        Treat information expressed naturally as present. Do not answer the user.
                        """)
                .user("Required fields: " + skill.requiredUserInformation() + "\nUser request: " + userMessage)
                .call().content();
        LOGGER.info("SKILL_REQUIREMENT_CHECK skill=" + skill.name()
                + " required=" + skill.requiredUserInformation()
                + "\nUSER_MESSAGE:\n" + userMessage + "\nMODEL_RESULT:\n" + response);
        try {
            String json = response == null ? "[]" : response.replace("```json", "")
                    .replace("```", "").trim();
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            LOGGER.warn("AI requirement check response parse failed, returning all required: " + e.getMessage());
            return skill.requiredUserInformation();
        }
    }
}
