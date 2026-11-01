package com.ykd.claw.knowledge.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.knowledge.entity.KnowledgeChunkEmbedding;
import com.ykd.claw.knowledge.entity.KnowledgeDocumentEntity;
import com.ykd.claw.knowledge.repository.KnowledgeChunkJpaRepository;
import com.ykd.claw.knowledge.repository.KnowledgeDocumentJpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class JpaKnowledgeRetriever implements KnowledgeRetriever {
    private final KnowledgeEmbeddingService embeddingService;
    private final KnowledgeChunkJpaRepository chunkRepository;
    private final KnowledgeDocumentJpaRepository documentRepository;
    private final ObjectMapper objectMapper;
    private final double minimumSimilarity;

    // Embedding cache: avoids re-loading and re-parsing all embeddings from DB on every search
    private record CachedEmbedding(long id, long documentId, Integer pageNumber, float[] vector) {}
    private volatile List<CachedEmbedding> embeddingCache;
    private volatile Map<Long, KnowledgeDocumentEntity> documentCache;
    private final AtomicLong cacheVersion = new AtomicLong(0);
    private static final long CACHE_TTL_MS = 60_000; // 60 seconds

    // Query vector cache: avoids repeated DashScope API calls for the same query
    private record CachedQueryVector(float[] vector, long timestamp) {}
    private static final long QUERY_CACHE_TTL_MS = 300_000; // 5 minutes
    private static final int QUERY_CACHE_MAX_SIZE = 100;
    private final ConcurrentHashMap<String, CachedQueryVector> queryVectorCache = new ConcurrentHashMap<>();

    // Search result cache: avoids recomputing cosine similarity for identical queries
    private record CachedSearchResult(List<KnowledgeSearchResult> results, long timestamp) {}
    private static final long RESULT_CACHE_TTL_MS = 120_000; // 2 minutes
    private static final int RESULT_CACHE_MAX_SIZE = 50;
    private final ConcurrentHashMap<String, CachedSearchResult> searchResultCache = new ConcurrentHashMap<>();

    public JpaKnowledgeRetriever(KnowledgeEmbeddingService embeddingService,
                                 KnowledgeChunkJpaRepository chunkRepository,
                                 KnowledgeDocumentJpaRepository documentRepository,
                                 ObjectMapper objectMapper) {
        this(embeddingService, chunkRepository, documentRepository, objectMapper, 0.55);
    }

    @Autowired
    public JpaKnowledgeRetriever(KnowledgeEmbeddingService embeddingService,
                                 KnowledgeChunkJpaRepository chunkRepository,
                                 KnowledgeDocumentJpaRepository documentRepository,
                                 ObjectMapper objectMapper,
                                 @Value("${knowledge.minimum-similarity:0.55}") double minimumSimilarity) {
        this.embeddingService = embeddingService;
        this.chunkRepository = chunkRepository;
        this.documentRepository = documentRepository;
        this.objectMapper = objectMapper;
        this.minimumSimilarity = Math.max(-1, Math.min(1, minimumSimilarity));
    }

    /** Call this after indexing new documents to invalidate the cache. */
    public void invalidateCache() {
        cacheVersion.incrementAndGet();
        embeddingCache = null;
        documentCache = null;
        searchResultCache.clear();
        queryVectorCache.clear();
    }

    @Override
    @Transactional(readOnly = true)
    public List<KnowledgeSearchResult> search(String query, int limit) {
        if (query == null || query.isBlank()) return List.of();
        int safeLimit = Math.max(1, Math.min(limit, 20));

        // Check result cache first
        String cacheKey = query + "|" + safeLimit;
        CachedSearchResult cachedResult = searchResultCache.get(cacheKey);
        if (cachedResult != null && System.currentTimeMillis() - cachedResult.timestamp() < RESULT_CACHE_TTL_MS) {
            return cachedResult.results();
        }

        // Use cached embeddings instead of loading from DB every time
        List<CachedEmbedding> embeddings = getOrLoadEmbeddings();
        if (embeddings.isEmpty()) return List.of();

        float[] queryVector = getOrComputeQueryVector(query);
        Map<Long, KnowledgeDocumentEntity> documents = getOrLoadDocuments();

        // Score and filter, keeping only the top candidates
        List<ScoredChunk> scored = embeddings.stream()
                .map(e -> scoreChunk(e, documents.get(e.documentId()), queryVector))
                .filter(s -> s != null && s.score >= minimumSimilarity)
                .sorted(Comparator.comparingDouble((ScoredChunk s) -> s.score).reversed())
                .limit(safeLimit)
                .toList();

        if (scored.isEmpty()) return List.of();

        // Phase 2: load full content only for matching chunks
        List<Long> matchIds = scored.stream().map(s -> s.chunkId).toList();
        Map<Long, String> contentMap = chunkRepository.findAllById(matchIds).stream()
                .collect(Collectors.toMap(c -> c.getId(), c -> c.getContent()));

        List<KnowledgeSearchResult> results = scored.stream()
                .map(s -> {
                    String content = contentMap.getOrDefault(s.chunkId, "");
                    return new KnowledgeSearchResult(content, s.score,
                            s.document.getFileName(), s.document.getSourcePath(), s.pageNumber);
                })
                .toList();

        // Cache the results
        evictSearchResultCache();
        searchResultCache.put(cacheKey, new CachedSearchResult(results, System.currentTimeMillis()));
        return results;
    }

    private List<CachedEmbedding> getOrLoadEmbeddings() {
        List<CachedEmbedding> cached = embeddingCache;
        if (cached != null) return cached;
        synchronized (this) {
            cached = embeddingCache;
            if (cached != null) return cached;
            List<KnowledgeChunkEmbedding> raw = chunkRepository.findAllEmbeddings();
            List<CachedEmbedding> parsed = raw.stream().map(e -> {
                try {
                    float[] vector = objectMapper.readValue(e.embedding(), float[].class);
                    return new CachedEmbedding(e.id(), e.documentId(), e.pageNumber(), vector);
                } catch (Exception ex) {
                    throw new IllegalStateException("Invalid stored embedding for chunk " + e.id(), ex);
                }
            }).toList();
            embeddingCache = parsed;
            return parsed;
        }
    }

    private Map<Long, KnowledgeDocumentEntity> getOrLoadDocuments() {
        Map<Long, KnowledgeDocumentEntity> cached = documentCache;
        if (cached != null) return cached;
        synchronized (this) {
            cached = documentCache;
            if (cached != null) return cached;
            Map<Long, KnowledgeDocumentEntity> loaded = documentRepository.findAll().stream()
                    .collect(Collectors.toMap(KnowledgeDocumentEntity::getId, Function.identity()));
            documentCache = loaded;
            return loaded;
        }
    }

    private float[] getOrComputeQueryVector(String query) {
        CachedQueryVector cached = queryVectorCache.get(query);
        if (cached != null && System.currentTimeMillis() - cached.timestamp() < QUERY_CACHE_TTL_MS) {
            return cached.vector();
        }
        // Evict expired entries if cache is full
        if (queryVectorCache.size() >= QUERY_CACHE_MAX_SIZE) {
            long now = System.currentTimeMillis();
            queryVectorCache.entrySet().removeIf(e -> now - e.getValue().timestamp() > QUERY_CACHE_TTL_MS);
        }
        float[] vector = embeddingService.embed(query);
        queryVectorCache.put(query, new CachedQueryVector(vector, System.currentTimeMillis()));
        return vector;
    }

    private void evictSearchResultCache() {
        if (searchResultCache.size() >= RESULT_CACHE_MAX_SIZE) {
            long now = System.currentTimeMillis();
            searchResultCache.entrySet().removeIf(e -> now - e.getValue().timestamp() > RESULT_CACHE_TTL_MS);
        }
    }

    private ScoredChunk scoreChunk(CachedEmbedding chunk, KnowledgeDocumentEntity document,
                                   float[] queryVector) {
        if (document == null) return null;
        double score = cosine(queryVector, chunk.vector());
        return new ScoredChunk(chunk.id(), score, document, chunk.pageNumber());
    }

    private record ScoredChunk(Long chunkId, double score, KnowledgeDocumentEntity document, Integer pageNumber) {
    }

    static double cosine(float[] left, float[] right) {
        if (left.length != right.length || left.length == 0) return 0;
        double dot = 0, leftNorm = 0, rightNorm = 0;
        for (int i = 0; i < left.length; i++) {
            dot += left[i] * right[i];
            leftNorm += left[i] * left[i];
            rightNorm += right[i] * right[i];
        }
        if (leftNorm == 0 || rightNorm == 0) return 0;
        return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
    }
}
