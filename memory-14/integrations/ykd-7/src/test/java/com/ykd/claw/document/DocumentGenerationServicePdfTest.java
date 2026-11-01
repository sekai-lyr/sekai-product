package com.ykd.claw.document;

import org.apache.pdfbox.Loader;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentGenerationServicePdfTest {

    @Test
    void generatesChinesePdfAndPaginatesLongContent() throws Exception {
        DocumentContent content = new DocumentContent();
        content.setTitle("杭州三日游行程");
        String paragraph = "上午游览西湖，下午参观博物馆，晚上品尝杭帮菜。".repeat(180);
        content.setSections(List.of(new DocumentContent.Section("第一天", List.of(paragraph))));

        Path output = new DocumentGenerationService().generate(content, "pdf");
        try (var document = Loader.loadPDF(output.toFile())) {
            assertTrue(document.getNumberOfPages() > 1);
            assertTrue(Files.size(output) > 0);
        } finally {
            Files.deleteIfExists(output);
        }
    }
}
