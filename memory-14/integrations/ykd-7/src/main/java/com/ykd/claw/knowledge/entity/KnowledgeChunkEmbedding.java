package com.ykd.claw.knowledge.entity;

/** Lightweight projection for cosine similarity search — avoids loading the full content TEXT column. */
public record KnowledgeChunkEmbedding(Long id, Long documentId, String embedding, Integer pageNumber) {
}
