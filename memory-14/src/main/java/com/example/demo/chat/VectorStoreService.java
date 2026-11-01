package com.example.demo.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.sql.*;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * RAG向量存储服务（SQLite 版）。
 * 向量以 BLOB 形式存于本地 rag_knowledge.sqlite 的 vector_store 表，
 * 检索时在内存缓存中计算余弦相似度，取 topK 注入对话上下文。
 * （此前版本依赖 Redis RediSearch，但本机 Redis 为原版 5.0 无该模块，已迁移至 SQLite。）
 */
@Service
public class VectorStoreService {

    private static final Logger logger = LoggerFactory.getLogger(VectorStoreService.class);

    /** 内存缓存条目上限，超过时按 timestamp 清理最旧条目 */
    private static final int MAX_CACHE_ENTRIES = 5000;

    private final EmbeddingService embeddingService;
    private final String dbUrl;

    @Value("${chat.vectorstore.top-k:3}")
    private int topK;

    @Value("${chat.vectorstore.similarity-threshold:0.5}")
    private double similarityThreshold;

    /** docId -> 缓存条目 */
    private final Map<String, Entry> cache = new ConcurrentHashMap<>();

    private record Entry(String content, String conversationId, float[] vector, long timestamp) {}

    private Connection conn;

    public VectorStoreService(EmbeddingService embeddingService,
                              @Value("${chat.vectorstore.sqlite-path:rag_knowledge.sqlite}") String dbPath) {
        this.embeddingService = embeddingService;
        String jdbcPath = Paths.get(dbPath).toAbsolutePath().toString();
        this.dbUrl = "jdbc:sqlite:" + jdbcPath;
        try {
            this.conn = openAndInit();
            loadFromDb();
            logger.info("VectorStore (SQLite) ready at {}, {} vectors cached", jdbcPath, cache.size());
        } catch (Exception e) {
            logger.error("Failed to initialize SQLite vector store", e);
            this.conn = null;
        }
    }

    private Connection openAndInit() throws SQLException {
        Connection c = DriverManager.getConnection(dbUrl);
        try (Statement st = c.createStatement()) {
            st.executeUpdate("CREATE TABLE IF NOT EXISTS vector_store ("
                    + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    + "content TEXT NOT NULL, "
                    + "conversation_id TEXT, "
                    + "document_id VARCHAR(36) NOT NULL, "
                    + "metadata_json TEXT, "
                    + "source_id TEXT, "
                    + "timestamp TIMESTAMP, "
                    + "vector BLOB NOT NULL)");
            st.executeUpdate("CREATE INDEX IF NOT EXISTS idx_vs_document ON vector_store(document_id)");
            st.executeUpdate("CREATE INDEX IF NOT EXISTS idx_vs_conversation ON vector_store(conversation_id)");
        }
        return c;
    }

    /** 自愈：操作前检查连接，失效或初始化失败时尝试重建一次并重载缓存 */
    private synchronized Connection ensureConnection() throws SQLException {
        try {
            if (conn != null && !conn.isClosed()) return conn;
        } catch (SQLException ignored) {}
        logger.info("VectorStore SQLite connection unavailable, attempting reconnect...");
        try {
            Connection c = openAndInit();
            this.conn = c;
            loadFromDb();
            logger.info("VectorStore SQLite reconnected, {} vectors cached", cache.size());
            return c;
        } catch (SQLException e) {
            this.conn = null;
            throw e;
        }
    }

    private synchronized void loadFromDb() throws SQLException {
        cache.clear();
        if (conn == null) return;
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT document_id, content, conversation_id, timestamp, vector FROM vector_store")) {
            while (rs.next()) {
                byte[] bytes = rs.getBytes("vector");
                float[] vector = deserializeVector(bytes);
                if (vector.length == 0) continue;
                cache.put(rs.getString("document_id"),
                        new Entry(rs.getString("content"), rs.getString("conversation_id"),
                                vector, rs.getTimestamp("timestamp") != null ? rs.getTimestamp("timestamp").getTime() : 0L));
            }
        }
    }

    public void saveMessage(String conversationId, String userMessage, String assistantReply) {
        saveDocument(UUID.randomUUID().toString(), "用户: " + userMessage + "\n助手: " + assistantReply, conversationId);
    }

    public void saveDocument(String documentId, String content, String conversationId) {
        try {
            float[] embedding = embeddingService.embed(content);
            if (embedding.length == 0) {
                logger.warn("Embedding is empty, skipping save");
                return;
            }
            Connection c = ensureConnection();
            synchronized (this) {
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO vector_store (content, conversation_id, document_id, timestamp, vector) VALUES (?,?,?,?,?)")) {
                    ps.setString(1, content);
                    ps.setString(2, conversationId);
                    ps.setString(3, documentId);
                    ps.setTimestamp(4, new Timestamp(System.currentTimeMillis()));
                    ps.setBytes(5, serializeVector(embedding));
                    ps.executeUpdate();
                }
            }
            cache.put(documentId, new Entry(content, conversationId, embedding, System.currentTimeMillis()));
            evictOldest();
            logger.info("Saved vector to SQLite, docId: {}, dim: {}, conversation: {}", documentId, embedding.length, conversationId);
        } catch (Exception e) {
            logger.error("Failed to save vector to SQLite", e);
        }
    }

    /** 内存缓存超限时清理最旧条目，防止长期运行内存无限增长 */
    private synchronized void evictOldest() {
        int overflow = cache.size() - MAX_CACHE_ENTRIES;
        if (overflow <= 0) return;
        cache.entrySet().stream()
                .sorted(Comparator.comparingLong((Map.Entry<String, Entry> e) -> e.getValue().timestamp()))
                .limit(overflow)
                .map(Map.Entry::getKey)
                .forEach(cache::remove);
        logger.info("Vector cache overflow, evicted {} oldest entries, size now {}", overflow, cache.size());
    }

    public List<String> searchSimilar(String query, String conversationId) {
        List<String> results = new ArrayList<>();
        try {
            float[] queryEmbedding = embeddingService.embed(query);
            if (queryEmbedding.length == 0) {
                logger.warn("Query embedding is empty");
                return results;
            }
            record Hit(String content, double score) {}
            List<Hit> hits = new ArrayList<>();
            for (Entry entry : cache.values()) {
                if (conversationId != null && !conversationId.isBlank()
                        && !conversationId.equals(entry.conversationId())) continue;
                if (entry.vector().length != queryEmbedding.length) continue; // 维度不一致跳过
                double sim = cosine(queryEmbedding, entry.vector());
                if (sim >= similarityThreshold) hits.add(new Hit(entry.content(), sim));
            }
            hits.sort((a, b) -> Double.compare(b.score(), a.score()));
            for (int i = 0; i < Math.min(topK, hits.size()); i++) results.add(hits.get(i).content());
            logger.info("Vector search: {} cached, {} above threshold ({}), returning {}", 
                    cache.size(), hits.size(), similarityThreshold, results.size());
        } catch (Exception e) {
            logger.error("Vector search failed", e);
        }
        return results;
    }

    public void clearConversationVectors(String conversationId) {
        try {
            Connection c = ensureConnection();
            synchronized (this) {
                try (PreparedStatement ps = c.prepareStatement("DELETE FROM vector_store WHERE conversation_id = ?")) {
                    ps.setString(1, conversationId);
                    ps.executeUpdate();
                }
            }
            cache.values().removeIf(e -> conversationId.equals(e.conversationId()));
            logger.info("Cleared vectors for conversation: {}", conversationId);
        } catch (Exception e) {
            logger.error("Failed to clear conversation vectors", e);
        }
    }

    static double cosine(float[] a, float[] b) {
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
        return (na == 0 || nb == 0) ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    static byte[] serializeVector(float[] vector) {
        ByteBuffer buf = ByteBuffer.allocate(vector.length * 4);
        for (float v : vector) buf.putFloat(v);
        return buf.array();
    }

    static float[] deserializeVector(byte[] bytes) {
        if (bytes == null || bytes.length == 0 || bytes.length % 4 != 0) return new float[0];
        ByteBuffer buf = ByteBuffer.wrap(bytes);
        float[] v = new float[bytes.length / 4];
        for (int i = 0; i < v.length; i++) v[i] = buf.getFloat();
        return v;
    }

    @PreDestroy
    public void shutdown() {
        try { if (conn != null) conn.close(); } catch (SQLException ignored) {}
    }
}
