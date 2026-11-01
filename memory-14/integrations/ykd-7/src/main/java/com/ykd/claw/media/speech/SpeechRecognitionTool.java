package com.ykd.claw.media.speech;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

@Component
public final class SpeechRecognitionTool implements ToolProvider {
    private final SpeechService service = new SpeechService();

    @Tool(name = "recognize_speech", description = "Transcribe a voice/audio file to text.")
    public String recognizeSpeech(
            @ToolParam(description = "Local audio file path inside the workspace or temp directory") String audioPath,
            @ToolParam(description = "WeChat encode type (4/6=SILK, 5=AMR)", required = false) Integer encodeType,
            @ToolParam(description = "Sample rate in Hz, e.g. 16000", required = false) Integer sampleRate) throws Exception {
        if (audioPath == null || audioPath.isBlank()) throw new IllegalArgumentException("audioPath is required");
        int et = encodeType != null ? encodeType : 6;
        int sr = sampleRate != null ? sampleRate : 16000;
        String text = service.recognize(Path.of(audioPath), et, sr);
        return text != null && !text.isBlank() ? text : "(no speech detected)";
    }
}
