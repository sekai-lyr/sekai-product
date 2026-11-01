package com.ykd.claw.knowledge.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.document.DocumentReaderService;
import com.ykd.claw.knowledge.entity.KnowledgeChunkEntity;
import com.ykd.claw.knowledge.entity.KnowledgeDocumentEntity;
import com.ykd.claw.knowledge.repository.KnowledgeChunkJpaRepository;
import com.ykd.claw.knowledge.repository.KnowledgeDocumentJpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class KnowledgeIngestionService {
    private final DocumentReaderService documentReader;
    private final TextChunker chunker;
    private final KnowledgeEmbeddingService embeddingService;
    private final KnowledgeDocumentJpaRepository documentRepository;
    private final KnowledgeChunkJpaRepository chunkRepository;
    private final ObjectMapper objectMapper;
    private final KnowledgeRetriever knowledgeRetriever;

    public KnowledgeIngestionService(DocumentReaderService documentReader,
                                     TextChunker chunker, KnowledgeEmbeddingService embeddingService,
                                     KnowledgeDocumentJpaRepository documentRepository,
                                     KnowledgeChunkJpaRepository chunkRepository,
                                     ObjectMapper objectMapper,
                                     KnowledgeRetriever knowledgeRetriever) {
        this.documentReader = documentReader;
        this.chunker = chunker;
        this.embeddingService = embeddingService;
        this.documentRepository = documentRepository;
        this.chunkRepository = chunkRepository;
        this.objectMapper = objectMapper;
        this.knowledgeRetriever = knowledgeRetriever;
    }

    @Transactional
    public KnowledgeDocumentEntity index(Path source) throws IOException {
        Path normalized = source.toAbsolutePath().normalize();
        var extracted = documentReader.read(normalized, DocumentReaderService.MAX_CHARACTERS);
        List<PageChunk> pageChunks = isPdf(extracted.contentType())
                ? pdfChunks(normalized) : chunker.split(extracted.text()).stream()
                .map(content -> new PageChunk(content, null)).toList();
        List<String> contents = pageChunks.stream().map(PageChunk::content).toList();
        if (pageChunks.isEmpty()) throw new IllegalArgumentException("Document has no extractable text");
        List<float[]> embeddings = embeddingService.embed(contents);

        documentRepository.findBySourcePath(normalized.toString()).ifPresent(existing -> {
            chunkRepository.deleteByDocumentId(existing.getId());
            documentRepository.delete(existing);
            documentRepository.flush();
        });
        KnowledgeDocumentEntity document = documentRepository.save(
                new KnowledgeDocumentEntity(normalized.getFileName().toString(), normalized.toString(), Instant.now()));
        List<KnowledgeChunkEntity> chunks = new ArrayList<>(contents.size());
        for (int i = 0; i < contents.size(); i++) {
            chunks.add(new KnowledgeChunkEntity(document.getId(), contents.get(i),
                    json(embeddings.get(i)), pageChunks.get(i).pageNumber(), Instant.now()));
        }
        chunkRepository.saveAll(chunks);
        knowledgeRetriever.invalidateCache();
        return document;
    }

    /** 看板:删除一个已索引文档(级联删分块 + 失效检索缓存)。 */
    @Transactional
    public void deleteDocument(Long documentId) {
        if (documentId == null) throw new IllegalArgumentException("documentId is required");
        documentRepository.findById(documentId).ifPresent(document -> {
            chunkRepository.deleteByDocumentId(document.getId());
            documentRepository.delete(document);
            knowledgeRetriever.invalidateCache();
        });
    }

    private List<PageChunk> pdfChunks(Path source) throws IOException {
        List<PageChunk> result = new ArrayList<>();
        try (PDDocument document = Loader.loadPDF(source.toFile())) {
            PDFTextStripper stripper = new PDFTextStripper();
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                for (String content : chunker.split(stripper.getText(document))) {
                    result.add(new PageChunk(content, page));
                }
            }
        }
        return List.copyOf(result);
    }

    private static boolean isPdf(String contentType) {
        return contentType != null && contentType.equalsIgnoreCase("application/pdf");
    }

    private String json(float[] embedding) {
        try {
            return objectMapper.writeValueAsString(embedding);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unable to serialize embedding", e);
        }
    }

    private record PageChunk(String content, Integer pageNumber) {
    }
}
