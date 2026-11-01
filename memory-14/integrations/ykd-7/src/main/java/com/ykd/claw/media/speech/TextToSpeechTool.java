package com.ykd.claw.media.speech;

import com.ykd.claw.agent.GeneratedArtifacts;
import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public final class TextToSpeechTool implements ToolProvider {
    private final GeneratedArtifacts artifacts;

    public TextToSpeechTool(GeneratedArtifacts artifacts) {
        this.artifacts = artifacts;
    }

    @Tool(name = "speak_text", description = "Convert final user-facing text into a speech audio file. "
            + "Use when the user explicitly asks to listen to content or requests spoken audio.")
    public String speakText(
            @ToolParam(description = "Complete text that should be spoken aloud") String text,
            @ToolParam(description = "Voice gender: male or female", required = false) String gender,
            @ToolParam(description = "Specific voice id; overrides gender", required = false) String voice,
            @ToolParam(description = "Speed multiplier from 0.5 to 2.0", required = false) Double speed,
            @ToolParam(description = "Pitch multiplier from 0.5 to 2.0", required = false) Double pitch,
            @ToolParam(description = "Volume multiplier from 0.5 to 2.0", required = false) Double volume) throws Exception {
        if (text == null || text.isBlank()) throw new IllegalArgumentException("text is required");
        TtsService.TtsOptions options = new TtsService.TtsOptions(voice, gender, speed, pitch, volume);
        String result = TtsService.getInstance().synthesize(text, options);
        if (result != null && result.startsWith("TTS audio: ")) {
            artifacts.audio(result.substring("TTS audio: ".length()).trim());
            return "Voice generated: " + text;
        }
        return result;
    }
}
