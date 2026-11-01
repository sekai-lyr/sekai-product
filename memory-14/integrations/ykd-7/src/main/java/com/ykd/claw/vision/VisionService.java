package com.ykd.claw.vision;

import com.ykd.claw.document.DocumentReaderTool;
import com.ykd.claw.media.ImageProcessor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.content.Media;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeTypeUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class VisionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(VisionService.class.getName());
    private static final String DEFAULT_PROMPT = "请详细描述这张图片的内容。";

    private final ChatClient visionChatClient;
    private final boolean configured;

    public VisionService(
            @Qualifier("visionChatClient") ChatClient visionChatClient,
            @Value("${dashscope.api.key:}") String apiKey) {
        this.visionChatClient = visionChatClient;
        this.configured = apiKey != null && !apiKey.isBlank();
    }

    public String analyze(String imagePath, String prompt) throws IOException {
        if (!configured) {
            throw new IOException("Vision API is not configured; set DASHSCOPE_API_KEY");
        }
        Path path = DocumentReaderTool.resolveWorkspacePath(imagePath);
        if (!Files.isRegularFile(path)) {
            throw new IOException("Image file not found: " + imagePath);
        }

        byte[] imageBytes = ImageProcessor.prepareForVision(path);
        String effectivePrompt = prompt == null || prompt.isBlank() ? DEFAULT_PROMPT : prompt;
        Media image = Media.builder()
                .mimeType(MimeTypeUtils.IMAGE_JPEG)
                .data(new ByteArrayResource(imageBytes))
                .build();
        UserMessage message = UserMessage.builder()
                .text(effectivePrompt)
                .media(image)
                .build();

        LOGGER.info("Vision analyzing through Spring AI: " + imagePath
                + " (" + imageBytes.length + " bytes)");
        try {
            String reply = visionChatClient.prompt().messages(message).call().content();
            return reply == null ? "(no response from model)" : reply;
        } catch (RuntimeException e) {
            throw new IOException("Vision analysis failed: " + e.getMessage(), e);
        }
    }
}
