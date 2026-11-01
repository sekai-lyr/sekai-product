package com.ykd.claw.knowledge.repository;

import com.ykd.claw.knowledge.entity.KnowledgeDocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KnowledgeDocumentJpaRepository extends JpaRepository<KnowledgeDocumentEntity, Long> {
    Optional<KnowledgeDocumentEntity> findBySourcePath(String sourcePath);
}
