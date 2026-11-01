package com.ykd.claw;

import com.ykd.claw.knowledge.repository.KnowledgeChunkJpaRepository;
import com.ykd.claw.knowledge.repository.KnowledgeDocumentJpaRepository;
import com.ykd.claw.knowledge.service.KnowledgeEmbeddingService;
import com.ykd.claw.knowledge.service.KnowledgeIngestionService;
import com.ykd.claw.knowledge.service.KnowledgeRetriever;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ActiveProfiles("sqlite")
@SpringBootTest(properties = {
        "app.cli.enabled=false",
        "spring.ai.deepseek.api-key=test-key",
        "spring.datasource.url=jdbc:sqlite:target/knowledge-persistence-test.db",
        "spring.jpa.hibernate.ddl-auto=update",
        "memory.extraction-enabled=false"
})
class KnowledgeJpaPersistenceTest {
    @TempDir Path directory;
    @Autowired KnowledgeIngestionService ingestionService;
    @Autowired KnowledgeRetriever retriever;
    @Autowired KnowledgeDocumentJpaRepository documents;
    @Autowired KnowledgeChunkJpaRepository chunks;
    @MockitoBean KnowledgeEmbeddingService embeddingService;

    @Test
    void indexesPersistsAndSearchesDocument() throws Exception {
        when(embeddingService.embed(anyList())).thenAnswer(invocation -> {
            List<String> texts = invocation.getArgument(0);
            return texts.stream().map(this::vector).toList();
        });
        when(embeddingService.embed(anyString())).thenAnswer(invocation -> vector(invocation.getArgument(0)));
        Path source = directory.resolve("reminder-guide.txt");
        Files.writeString(source, "创建提醒时提供标题和未来时间。提醒可以取消、暂停和恢复。");

        var document = ingestionService.index(source);
        assertEquals(1, chunks.findByDocumentIdOrderById(document.getId()).size());
        assertFalse(retriever.search("如何创建提醒", 3).isEmpty());
        assertEquals(source.toAbsolutePath().normalize().toString(),
                documents.findById(document.getId()).orElseThrow().getSourcePath());
    }

    private float[] vector(String text) {
        return text.contains("提醒") ? new float[]{1, 0, 0} : new float[]{0, 1, 0};
    }
}
