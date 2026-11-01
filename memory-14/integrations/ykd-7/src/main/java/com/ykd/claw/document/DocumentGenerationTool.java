package com.ykd.claw.document;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.ykd.claw.agent.GeneratedArtifacts;
import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Document generation tool — generates document files from structured content.
 * Supports: PDF, DOCX, XLSX, PPTX, Markdown, HTML.
 */
@Component
public final class DocumentGenerationTool implements ToolProvider {

    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentGenerationTool.class.getName());
    private static final Gson GSON = new Gson();

    private final GeneratedArtifacts artifacts;
    private final DocumentGenerationService service;

    public DocumentGenerationTool(GeneratedArtifacts artifacts) {
        this.artifacts = artifacts;
        this.service = new DocumentGenerationService();
    }

    @Tool(name = "generate_document",
          description = "Generate a document file only when the user explicitly asks to create or export "
                  + "a PDF, DOCX, XLSX, PPTX, Markdown or HTML file. Do not call this tool for a normal "
                  + "chat answer, travel plan or guide unless the user explicitly requests a file. "
                  + "Generate the file from structured content. "
                  + "The content parameter must be a JSON string matching the DocumentContent structure: "
                  + "{\"title\":\"...\", \"subtitle\":\"...\", \"author\":\"...\", \"date\":\"...\", "
                  + "\"sections\":[{\"heading\":\"...\", \"paragraphs\":[\"...\"], "
                  + "\"tables\":[[\"cell1\",\"cell2\"]], \"bullets\":[\"...\"]}]}. "
                  + "IMPORTANT: The JSON must be complete and valid. Do not truncate arrays. "
                  + "Keep each paragraph/bullet short (under 200 characters) to avoid truncation. "
                  + "Supported formats: pdf, docx, xlsx, pptx, md, html.",
          returnDirect = true)
    public String generateDocument(
            @ToolParam(description = "JSON string of document content (DocumentContent structure)")
            String content,
            @ToolParam(description = "Target format: pdf, docx, xlsx, pptx, md, html")
            String format) {

        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("content is required");
        }
        if (format == null || format.isBlank()) {
            format = "pdf";
        }

        try {
            DocumentContent docContent = GSON.fromJson(content, DocumentContent.class);
            if (docContent == null) {
                return "Error: Failed to parse content JSON. Please provide valid JSON.";
            }

            String resolvedFormat = DocumentGenerationService.resolveExtension(format);
            Path outputPath = service.generate(docContent, resolvedFormat);

            LOGGER.info("Document generated: " + outputPath.toAbsolutePath());
            artifacts.document(outputPath.toAbsolutePath().toString());

            return "Document generated: " + outputPath.toAbsolutePath()
                    + " (" + resolvedFormat.toUpperCase() + ")";
        } catch (JsonSyntaxException e) {
            LOGGER.warn("JSON parse error in document generation: " + e.getMessage());
            return "Error: Invalid JSON format - " + e.getMessage()
                    + ". Please regenerate with complete, valid JSON. Keep content short to avoid truncation.";
        } catch (Exception e) {
            LOGGER.warn( "Document generation failed: " + e.getMessage(), e);
            return "Error: Document generation failed - " + e.getMessage();
        }
    }
}
