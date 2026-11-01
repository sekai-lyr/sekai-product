package com.ykd.claw.knowledge.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.agent.ToolProvider;
import com.ykd.claw.document.DocumentReaderTool;
import com.ykd.claw.knowledge.service.KnowledgeIngestionService;
import com.ykd.claw.knowledge.service.KnowledgeRetriever;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.util.Map;
import java.util.List;
import java.util.LinkedHashMap;

@Component
public class KnowledgeTool implements ToolProvider {
    private final KnowledgeRetriever retriever;
    private final KnowledgeIngestionService ingestionService;
    private final ObjectMapper objectMapper;
    private final int defaultLimit;
    private final Path workspace = Path.of("").toAbsolutePath().normalize();

    public KnowledgeTool(KnowledgeRetriever retriever, KnowledgeIngestionService ingestionService,
                         ObjectMapper objectMapper,
                         @Value("${knowledge.search-limit:5}") int defaultLimit) {
        this.retriever = retriever;
        this.ingestionService = ingestionService;
        this.objectMapper = objectMapper;
        this.defaultLimit = defaultLimit;
    }

    @Tool(name = "search_knowledge", description = "Search indexed local/project documents. "
            + "Use for internal knowledge questions; do not use for live information such as weather.")
    public String searchKnowledge(@ToolParam(description = "Question or concise semantic search query") String query) {
        try {
            List<Map<String, Object>> compact = retriever.search(query, Math.min(defaultLimit, 3)).stream()
                    .map(result -> {
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("content", limit(result.content(), 600));
                        item.put("score", result.score());
                        item.put("fileName", result.fileName());
                        item.put("sourcePath", result.sourcePath());
                        item.put("pageNumber", result.pageNumber());
                        return item;
                    })
                    .toList();
            return objectMapper.writeValueAsString(compact);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to search the knowledge base", e);
        }
    }

    private static String limit(String text, int max) {
        if (text == null || text.length() <= max) return text == null ? "" : text;
        return text.substring(0, max) + "…";
    }

    @Tool(name = "index_knowledge_document", description = "Parse and index one document inside the project workspace.")
    public String indexDocument(@ToolParam(description = "Document path relative to the project workspace") String path)
            throws Exception {
        Path resolved = workspace.resolve(path).normalize();
        if (!resolved.startsWith(workspace)) throw new IllegalArgumentException("Document must be inside workspace");
        DocumentReaderTool.rejectSensitiveFile(resolved);
        var document = ingestionService.index(resolved);
        return objectMapper.writeValueAsString(Map.of(
                "documentId", document.getId(),
                "fileName", document.getFileName(),
                "sourcePath", document.getSourcePath()));
    }
}
