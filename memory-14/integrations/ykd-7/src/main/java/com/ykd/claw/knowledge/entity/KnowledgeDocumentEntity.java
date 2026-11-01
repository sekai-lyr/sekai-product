package com.ykd.claw.knowledge.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "knowledge_document", indexes = {
        @Index(name = "idx_knowledge_document_source", columnList = "source_path")
})
public class KnowledgeDocumentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    // An indexed utf8mb4 value must fit MySQL's 3072-byte key limit.
    @Column(name = "source_path", nullable = false, length = 768)
    private String sourcePath;

    @Column(name = "created_time", nullable = false)
    private Instant createdTime;

    protected KnowledgeDocumentEntity() {
    }

    public KnowledgeDocumentEntity(String fileName, String sourcePath, Instant createdTime) {
        this.fileName = fileName;
        this.sourcePath = sourcePath;
        this.createdTime = createdTime;
    }

    public Long getId() { return id; }
    public String getFileName() { return fileName; }
    public String getSourcePath() { return sourcePath; }
    public Instant getCreatedTime() { return createdTime; }
}
