package com.ykd.claw.knowledge.entity;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "knowledge_chunk", indexes = {
        @Index(name = "idx_knowledge_chunk_document", columnList = "document_id")
})
public class KnowledgeChunkEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(nullable = false, columnDefinition = "TEXT")
    private String embedding;

    @Column(name = "page_number")
    private Integer pageNumber;

    @Column(name = "created_time", nullable = false)
    private Instant createdTime;

    protected KnowledgeChunkEntity() {
    }

    public KnowledgeChunkEntity(Long documentId, String content, String embedding,
                                Integer pageNumber, Instant createdTime) {
        this.documentId = documentId;
        this.content = content;
        this.embedding = embedding;
        this.pageNumber = pageNumber;
        this.createdTime = createdTime;
    }

    public Long getId() { return id; }
    public Long getDocumentId() { return documentId; }
    public String getContent() { return content; }
    public String getEmbedding() { return embedding; }
    public Integer getPageNumber() { return pageNumber; }
    public Instant getCreatedTime() { return createdTime; }
}
