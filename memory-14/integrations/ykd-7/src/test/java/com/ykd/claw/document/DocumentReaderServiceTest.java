package com.ykd.claw.document;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentReaderServiceTest {

    @TempDir
    Path tempDir;

    private final DocumentReaderService reader = new DocumentReaderService();

    @Test
    void extractsPlainTextDocument() throws Exception {
        Path file = tempDir.resolve("notes.txt");
        Files.writeString(file, "第一段\r\n\r\n第二段", StandardCharsets.UTF_8);

        DocumentReaderService.DocumentContent content = reader.read(file);

        assertEquals("text/plain; charset=UTF-8", content.contentType());
        assertEquals("第一段\n\n第二段", content.text());
        assertTrue(reader.formatForAi(content).contains("Document: notes.txt"));
    }

    @Test
    void extractsTextWithoutHtmlMarkup() throws Exception {
        Path file = tempDir.resolve("page.html");
        Files.writeString(file, "<html><head><title>示例</title></head>"
                + "<body><h1>标题</h1><p>正文内容</p></body></html>", StandardCharsets.UTF_8);

        DocumentReaderService.DocumentContent content = reader.read(file);

        assertTrue(content.text().contains("标题"));
        assertTrue(content.text().contains("正文内容"));
        assertTrue(content.metadata().containsKey("title"));
    }

    @Test
    void extractsTextFromWordDocument() throws Exception {
        Path file = tempDir.resolve("report.docx");
        try (XWPFDocument document = new XWPFDocument()) {
            document.createParagraph().createRun().setText("季度报告核心内容");
            try (java.io.OutputStream output = Files.newOutputStream(file)) {
                document.write(output);
            }
        }

        DocumentReaderService.DocumentContent content = reader.read(file);

        assertTrue(content.text().contains("季度报告核心内容"));
        assertTrue(content.contentType().contains("wordprocessingml"));
    }

    @Test
    void marksExtractionAsTruncatedAtConfiguredLimit() throws Exception {
        Path file = tempDir.resolve("long.txt");
        Files.writeString(file, "0123456789".repeat(100), StandardCharsets.UTF_8);

        DocumentReaderService.DocumentContent content = reader.read(file, 50);

        assertTrue(content.truncated());
        assertTrue(content.text().length() <= 50);
    }

    @Test
    void rejectsMissingDocument() {
        assertThrows(Exception.class, () -> reader.read(tempDir.resolve("missing.docx")));
    }

    @Test
    void documentToolCannotEscapeWorkspaceOrReadCredentials() {
        assertThrows(Exception.class,
                () -> DocumentReaderTool.resolveWorkspacePath("..\\outside.txt"));
        assertThrows(Exception.class,
                () -> DocumentReaderTool.resolveWorkspacePath("secrets.properties"));
    }
}
