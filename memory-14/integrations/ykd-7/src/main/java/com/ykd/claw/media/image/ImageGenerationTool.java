package com.ykd.claw.media.image;

import com.ykd.claw.agent.GeneratedArtifacts;
import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.http.HttpTimeoutException;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public final class ImageGenerationTool implements ToolProvider {
    private static final Logger LOGGER = LoggerFactory.getLogger(ImageGenerationTool.class.getName());
    private final GeneratedArtifacts artifacts;
    private final ImageGenerationService service;

    public ImageGenerationTool(GeneratedArtifacts artifacts) {
        this(artifacts, null);
    }

    @Autowired
    public ImageGenerationTool(GeneratedArtifacts artifacts, ImageGenerationService service) {
        this.artifacts = artifacts;
        this.service = service;
    }

    @Tool(name = "generate_image", description = "Generate one still image with Alibaba Cloud Wan from a text prompt. "
            + "Use only for image requests, then continue handling any other requests in the same user message.")
    public String generateImage(@ToolParam(description = "Detailed image description") String prompt) throws Exception {
        if (prompt == null || prompt.isBlank()) throw new IllegalArgumentException("prompt is required");
        if (service == null) return "Image generation is not configured";
        try {
            Path result = service.generate(prompt);
            artifacts.image(result.toAbsolutePath().toString());
            return "Generated: " + prompt;
        } catch (HttpTimeoutException e) {
            LOGGER.warn("Image generation provider timed out");
            return "Image generation failed: provider timed out. Continue handling the user's other requests.";
        } catch (IOException e) {
            LOGGER.warn("Image generation request failed: " + e.getMessage());
            return "Image generation failed: " + e.getMessage()
                    + ". Continue handling the user's other requests.";
        }
    }
}
