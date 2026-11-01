package com.ykd.claw.vision;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VisionServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void sendsImageAndQuestionThroughSpringAi() throws Exception {
        Path imagePath = tempDir.resolve("sample.jpg");
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "jpg", imagePath.toFile());
        RecordingModel model = new RecordingModel();
        VisionService service = new VisionService(ChatClient.builder(model).build(), "test-key");

        String result = service.analyze(imagePath.toString(), "What is visible?");

        assertEquals("vision reply", result);
        UserMessage message = (UserMessage) model.prompt.getInstructions().getFirst();
        assertEquals("What is visible?", message.getText());
        assertEquals(1, message.getMedia().size());
        assertEquals("image/jpeg", message.getMedia().getFirst().getMimeType().toString());
    }

    @Test
    void rejectsPathOutsideWorkspaceOrTemp() throws Exception {
        VisionService service = new VisionService(ChatClient.builder(new RecordingModel()).build(), "test-key");

        IOException ex = assertThrows(IOException.class,
                () -> service.analyze(Path.of("..").resolve("outside.txt").toString(), "q"));
        assertTrue(ex.getMessage().contains("restricted"));
    }

    @Test
    void rejectsCredentialFile() throws Exception {
        VisionService service = new VisionService(ChatClient.builder(new RecordingModel()).build(), "test-key");

        IOException ex = assertThrows(IOException.class, () -> service.analyze("secrets.properties", "q"));
        assertTrue(ex.getMessage().contains("credential"));
    }

    @Test
    void rejectsNonImageFile() throws Exception {
        Path text = tempDir.resolve("notes.txt");
        Files.write(text, "just text".getBytes(StandardCharsets.UTF_8));
        VisionService service = new VisionService(ChatClient.builder(new RecordingModel()).build(), "test-key");

        IOException ex = assertThrows(IOException.class, () -> service.analyze(text.toString(), "q"));
        assertTrue(ex.getMessage().contains("non-image"));
    }

    private static final class RecordingModel implements ChatModel {
        private Prompt prompt;

        @Override
        public ChatResponse call(Prompt prompt) {
            this.prompt = prompt;
            return new ChatResponse(List.of(new Generation(new AssistantMessage("vision reply"))));
        }
    }
}
