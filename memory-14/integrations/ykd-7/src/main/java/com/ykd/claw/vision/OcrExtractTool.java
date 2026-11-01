package com.ykd.claw.vision;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * OCR extraction tool — reuses VisionService to extract text/formulas/options
 * from exam question images without answering them.
 */
@Component
public final class OcrExtractTool implements ToolProvider {

    private static final String OCR_PROMPT =
            "你是一个OCR文字提取器。你的唯一任务是从图片中提取文字。\n"
            + "严格规则：\n"
            + "- 只输出图片中出现的原始文字，不要分析、不要解答、不要解释\n"
            + "- 不要判断题目是否有误，不要猜测，不要补充\n"
            + "- 不要添加任何你的看法或评论\n"
            + "- 数学公式用 Unicode 符号表示（如 ∫ ∑ √ ∞ → ≤ ≥），不要用 LaTeX\n"
            + "- 输出格式：按图片中文字出现的顺序，逐行提取\n"
            + "\n"
            + "请提取以下图片中的所有文字：";

    private final VisionService visionService;

    public OcrExtractTool(VisionService visionService) {
        this.visionService = visionService;
    }

    @Tool(name = "ocr_extract", description = "Extract all text, formulas, and options from an exam/homework question image. Returns raw text only, no answers.")
    public String ocrExtract(
            @ToolParam(description = "Local image file path inside the workspace or temp directory") String imagePath) {
        if (imagePath == null || imagePath.isBlank()) {
            throw new IllegalArgumentException("imagePath is required");
        }
        try {
            return visionService.analyze(imagePath, OCR_PROMPT);
        } catch (Exception e) {
            throw new RuntimeException("OCR extraction failed: " + e.getMessage(), e);
        }
    }
}
