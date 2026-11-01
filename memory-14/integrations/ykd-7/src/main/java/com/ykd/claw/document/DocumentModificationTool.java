package com.ykd.claw.document;

import com.ykd.claw.agent.GeneratedArtifacts;
import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Document modification tool — reads an existing document, applies modifications
 * based on natural language instructions, and generates a new file.
 *
 * <p>This tool handles the complete modification workflow internally:
 * read source -> parse content -> apply changes -> write new file.
 * No chained tool calls required.
 */
@Component
public final class DocumentModificationTool implements ToolProvider {

    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentModificationTool.class.getName());
    private static final Path OUTPUT_DIR = Path.of("generated");
    private static final String TIMESTAMP_FMT = "yyyyMMdd_HHmmss";

    private final DocumentReaderService readerService = new DocumentReaderService();
    private final GeneratedArtifacts artifacts;

    public DocumentModificationTool(GeneratedArtifacts artifacts) {
        this.artifacts = artifacts;
    }

    @Tool(name = "modify_document",
          description = "Modify an existing document based on natural language instructions "
                  + "and generate a new file. Reads the source file, applies the requested changes, "
                  + "and writes the result to a new file in the generated/ directory. "
                  + "Supports HTML, PDF, DOCX, XLSX, PPTX, MD formats. "
                  + "For HTML files, text content modifications (title, headings, paragraphs) are applied directly.",
          returnDirect = true)
    public String modifyDocument(
            @ToolParam(description = "Path to the source document (absolute or relative to workspace)")
            String sourceFilePath,
            @ToolParam(description = "Natural language instructions describing what to modify. "
                    + "Examples: change title to XXX, replace OLD with NEW")
            String instructions) {

        if (sourceFilePath == null || sourceFilePath.isBlank()) {
            return "Error: sourceFilePath is required";
        }
        if (instructions == null || instructions.isBlank()) {
            return "Error: modification instructions are required";
        }

        try {
            Path source = DocumentReaderTool.resolveWorkspacePath(sourceFilePath);
            LOGGER.info("Modifying document: " + source.toAbsolutePath());

            String fileName = source.getFileName().toString();
            String ext = getFileExtension(fileName);

            Path outputPath = switch (ext) {
                case "html", "htm" -> modifyHtml(source, instructions);
                case "md" -> modifyMarkdown(source, instructions);
                default -> modifyGeneric(source, fileName, ext, instructions);
            };

            LOGGER.info("Modified document saved: " + outputPath.toAbsolutePath());
            artifacts.document(outputPath.toAbsolutePath().toString());

            return "Document modified successfully! New file: " + outputPath.toAbsolutePath()
                    + "\nModification applied: " + instructions;

        } catch (IllegalArgumentException e) {
            return "Error: " + e.getMessage();
        } catch (Exception e) {
            LOGGER.warn( "Document modification failed: " + e.getMessage(), e);
            return "Error: Document modification failed - " + e.getMessage();
        }
    }

    // ==================== HTML Modification ====================

    private Path modifyHtml(Path source, String instructions) throws IOException {
        String html = Files.readString(source, StandardCharsets.UTF_8);
        String modified = applyHtmlModifications(html, instructions);
        return writeNewFile(modified, "html");
    }

    private String applyHtmlModifications(String html, String instructions) {
        String result = html;
        result = applyTitleModification(result, instructions);
        result = applyTextReplacement(result, instructions);
        return result;
    }

    private String applyTitleModification(String html, String instructions) {
        String newTitle = extractQuotedValue(instructions);
        if (newTitle == null) return html;
        if (!instructions.contains("标题")) return html; // 标题

        // Replace <title>...</title>
        Pattern titlePattern = Pattern.compile("<title[^>]*>.*?</title>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
        Matcher titleMatcher = titlePattern.matcher(html);
        if (titleMatcher.find()) {
            html = titleMatcher.replaceAll("<title>" + Matcher.quoteReplacement(newTitle) + "</title>");
        }

        // Replace visible h1 title
        Pattern h1Pattern = Pattern.compile("(<h1[^>]*>)(.*?)(</h1>)", Pattern.DOTALL);
        Matcher h1Matcher = h1Pattern.matcher(html);
        if (h1Matcher.find()) {
            String oldTitle = h1Matcher.group(2).trim();
            if (oldTitle.length() < 100 && !oldTitle.contains("<")) {
                html = h1Matcher.replaceAll("$1" + Matcher.quoteReplacement(newTitle) + "$3");
            }
        }

        return html;
    }

    private String applyTextReplacement(String html, String instructions) {
        // Pattern: replace OLD with NEW
        Pattern replacePattern = Pattern.compile(
                "(?:replace|change|\\u5c06|\\u628a|\\u66ff\\u6362)(.+?)(?:with|to|\\u4e3a|\\u6210|\\u6539\\u6210)(.+?)(?:[\\u3002.!]|$)",
                Pattern.CASE_INSENSITIVE);
        Matcher replaceMatcher = replacePattern.matcher(instructions);

        while (replaceMatcher.find()) {
            String oldValue = replaceMatcher.group(1).trim();
            String newValue = replaceMatcher.group(2).trim();
            oldValue = unquote(oldValue);
            newValue = unquote(newValue);
            if (!oldValue.isEmpty() && !newValue.isEmpty()) {
                html = html.replace(oldValue, newValue);
            }
        }

        return html;
    }

    // ==================== Markdown Modification ====================

    private Path modifyMarkdown(Path source, String instructions) throws IOException {
        String md = Files.readString(source, StandardCharsets.UTF_8);
        String modified = applyMarkdownModifications(md, instructions);
        return writeNewFile(modified, "md");
    }

    private String applyMarkdownModifications(String md, String instructions) {
        String result = md;

        String newTitle = extractQuotedValue(instructions);
        if (newTitle != null && instructions.contains("标题")) {
            Pattern h1Pattern = Pattern.compile("^# .+$", Pattern.MULTILINE);
            Matcher h1Matcher = h1Pattern.matcher(result);
            if (h1Matcher.find()) {
                result = h1Matcher.replaceFirst("# " + Matcher.quoteReplacement(newTitle));
            }
        }

        result = applyTextReplacement(result, instructions);
        return result;
    }

    // ==================== Generic (PDF/DOCX/XLSX/PPTX) ====================

    private Path modifyGeneric(Path source, String fileName, String ext, String instructions) throws IOException {
        DocumentReaderService.DocumentContent content = readerService.read(source);
        String text = content.text();
        String modified = applyTextReplacement(text, instructions);
        DocumentContent docContent = textToDocumentContent(modified, fileName);
        // Detect format conversion instructions (e.g., "转成pdf", "convert to pdf")
        String outputFormat = detectTargetFormat(instructions, ext);
        DocumentGenerationService service = new DocumentGenerationService();
        return service.generate(docContent, outputFormat);
    }

    private static String detectTargetFormat(String instructions, String defaultExt) {
        String lower = instructions.toLowerCase();
        if (lower.contains("pdf") || lower.contains("pdf格式")) return "pdf";
        if (lower.contains("docx") || lower.contains("word") || lower.contains("docx格式")) return "docx";
        if (lower.contains("xlsx") || lower.contains("excel") || lower.contains("xlsx格式")) return "xlsx";
        if (lower.contains("pptx") || lower.contains("ppt") || lower.contains("pptx格式")) return "pptx";
        if (lower.contains("html") || lower.contains("htm") || lower.contains("html格式")) return "html";
        if (lower.contains("md") || lower.contains("markdown") || lower.contains("md格式")) return "md";
        return DocumentGenerationService.resolveExtension(defaultExt);
    }

    private DocumentContent textToDocumentContent(String text, String originalName) {
        DocumentContent doc = new DocumentContent();
        doc.setTitle("Modified: " + originalName);

        String[] blocks = text.split("\\n\\n+");
        List<DocumentContent.Section> sections = new ArrayList<>();

        for (String block : blocks) {
            String trimmed = block.trim();
            if (trimmed.isEmpty()) continue;

            DocumentContent.Section section = new DocumentContent.Section();
            String[] lines = trimmed.split("\\n");

            if (lines.length > 0 && lines[0].trim().length() < 100) {
                section.setHeading(lines[0].trim());
                List<String> paragraphs = new ArrayList<>();
                for (int i = 1; i < lines.length; i++) {
                    String line = lines[i].trim();
                    if (!line.isEmpty()) paragraphs.add(line);
                }
                if (!paragraphs.isEmpty()) section.setParagraphs(paragraphs);
            } else {
                List<String> paragraphs = new ArrayList<>();
                for (String line : lines) {
                    String l = line.trim();
                    if (!l.isEmpty()) paragraphs.add(l);
                }
                section.setParagraphs(paragraphs);
            }

            sections.add(section);
        }

        doc.setSections(sections);
        return doc;
    }

    // ==================== Utilities ====================

    private Path writeNewFile(String content, String ext) throws IOException {
        Files.createDirectories(OUTPUT_DIR);
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern(TIMESTAMP_FMT));
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Path outputPath = OUTPUT_DIR.resolve("doc_" + timestamp + "_" + suffix + "." + ext);
        Files.writeString(outputPath, content, StandardCharsets.UTF_8);
        return outputPath;
    }

    private static String getFileExtension(String fileName) {
        if (fileName == null) return "";
        int dot = fileName.lastIndexOf('.');
        return dot >= 0 ? fileName.substring(dot + 1).toLowerCase() : "";
    }

    private static String extractQuotedValue(String text) {
        if (text == null) return null;
        // ASCII double quotes
        Pattern p = Pattern.compile("\"([^\"]+)\"");
        Matcher m = p.matcher(text);
        if (m.find()) return m.group(1).trim();
        // Chinese/smart quotes
        String smartLeft = "“";
        String smartRight = "”";
        int left = text.indexOf(smartLeft);
        if (left >= 0) {
            int right = text.indexOf(smartRight, left + 1);
            if (right > left) return text.substring(left + 1, right).trim();
        }
        // Japanese quotes
        p = Pattern.compile("「(.+?)」");
        m = p.matcher(text);
        if (m.find()) return m.group(1).trim();
        return null;
    }

    private static String unquote(String s) {
        if (s == null) return null;
        s = s.trim();
        if (s.length() >= 2) {
            char first = s.charAt(0);
            char last = s.charAt(s.length() - 1);
            if ((first == '"' && last == '"')
                    || (first == '“' && last == '”')
                    || (first == '「' && last == '」')) {
                return s.substring(1, s.length() - 1).trim();
            }
        }
        return s;
    }
}
