package com.ykd.claw.vision;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public final class VisionTool implements ToolProvider {
    private final VisionService service;

    public VisionTool(VisionService service) {
        this.service = service;
    }

    @Tool(name = "analyze_image", description = "Analyze an existing local image file and answer a question "
            + "about its visible content. Do not use this tool to generate or edit images.")
    public String analyzeImage(
            @ToolParam(description = "Path to an existing local image file inside the workspace or temp directory") String imagePath,
            @ToolParam(description = "Specific question about the image; omit for a general description", required = false)
            String question) throws Exception {
        if (imagePath == null || imagePath.isBlank()) throw new IllegalArgumentException("imagePath is required");
        if (!java.nio.file.Files.exists(java.nio.file.Path.of(imagePath))) {
            return "ERROR: Image file not found: " + imagePath + ". The file may have been cleaned up. Ask the user to resend.";
        }
        return service.analyze(imagePath, question);
    }

}
