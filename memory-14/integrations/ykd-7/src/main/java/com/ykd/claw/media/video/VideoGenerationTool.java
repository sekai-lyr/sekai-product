package com.ykd.claw.media.video;

import com.ykd.claw.agent.GeneratedArtifacts;
import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

@Component
public final class VideoGenerationTool implements ToolProvider {
    private final GeneratedArtifacts artifacts;
    private final VideoGenerationService service;

    public VideoGenerationTool(GeneratedArtifacts artifacts, VideoGenerationService service) {
        this.artifacts = artifacts;
        this.service = service;
    }

    @Tool(name = "generate_video", description = "Generate an MP4 video with the configured video API. "
            + "Use for video, animation, motion or MP4 requests, then continue handling any other requests "
            + "in the same user message.")
    public String generateVideo(
            @ToolParam(description = "Video description (supports multi-shot: 第1个镜头[0-3秒] ...)")
            String prompt,
            @ToolParam(description = "Video duration in seconds (2-15); default 5", required = false)
            Integer duration,
            @ToolParam(description = "Video resolution: 720P or 1080P; default 720P", required = false)
            String resolution,
            @ToolParam(description = "Aspect ratio: 16:9, 9:16, 1:1, 4:3, 3:4; default 16:9", required = false)
            String ratio,
            @ToolParam(description = "Enable prompt rewriting for better results", required = false)
            Boolean promptExtend,
            @ToolParam(description = "Add watermark to the video", required = false)
            Boolean watermark,
            @ToolParam(description = "Audio URL for lip-sync (wan2.5+)", required = false)
            String audioUrl,
            @ToolParam(description = "Negative prompt to avoid certain content", required = false)
            String negativePrompt,
            @ToolParam(description = "Random seed for reproducibility", required = false)
            Integer seed,
            @ToolParam(description = "Public source image URL for image-to-video", required = false)
            String imageUrl) throws Exception {
        if (prompt == null || prompt.isBlank()) throw new IllegalArgumentException("prompt is required");

        int effectiveDuration = duration != null ? Math.max(2, Math.min(15, duration)) : 5;
        String effectiveResolution = resolution != null ? resolution : "720P";
        String effectiveRatio = ratio != null ? ratio : "16:9";
        boolean effectivePromptExtend = promptExtend != null ? promptExtend : true;
        boolean effectiveWatermark = watermark != null ? watermark : true;

        Path output = service.generate(prompt, imageUrl, effectiveDuration, effectiveResolution,
                effectiveRatio, effectivePromptExtend, effectiveWatermark,
                audioUrl, negativePrompt, seed);
        artifacts.video(output.toString());
        return "Video generated: " + prompt;
    }
}
