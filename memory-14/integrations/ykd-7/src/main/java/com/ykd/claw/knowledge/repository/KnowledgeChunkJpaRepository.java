package com.ykd.claw.knowledge.repository;

import com.ykd.claw.knowledge.entity.KnowledgeChunkEmbedding;
import com.ykd.claw.knowledge.entity.KnowledgeChunkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface KnowledgeChunkJpaRepository extends JpaRepository<KnowledgeChunkEntity, Long> {
    List<KnowledgeChunkEntity> findByDocumentIdOrderById(Long documentId);

    void deleteByDocumentId(Long documentId);

    long countByDocumentId(Long documentId);

    /** Load only the fields needed for similarity search (no content TEXT). */
    @Query("SELECT new com.ykd.claw.knowledge.entity.KnowledgeChunkEmbedding(c.id, c.documentId, c.embedding, c.pageNumber) FROM KnowledgeChunkEntity c")
    List<KnowledgeChunkEmbedding> findAllEmbeddings();
}
