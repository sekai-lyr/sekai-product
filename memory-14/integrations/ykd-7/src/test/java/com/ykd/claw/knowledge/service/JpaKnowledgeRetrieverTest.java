package com.ykd.claw.knowledge.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.knowledge.entity.KnowledgeChunkEmbedding;
import com.ykd.claw.knowledge.entity.KnowledgeChunkEntity;
import com.ykd.claw.knowledge.entity.KnowledgeDocumentEntity;
import com.ykd.claw.knowledge.repository.KnowledgeChunkJpaRepository;
import com.ykd.claw.knowledge.repository.KnowledgeDocumentJpaRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

class JpaKnowledgeRetrieverTest {

    @Test
    void emptyKnowledgeBaseDoesNotCallEmbeddingApi() {
        KnowledgeEmbeddingService embeddings = mock(KnowledgeEmbeddingService.class);
        KnowledgeChunkJpaRepository chunks = mock(KnowledgeChunkJpaRepository.class);
        KnowledgeDocumentJpaRepository documents = mock(KnowledgeDocumentJpaRepository.class);
        when(chunks.findAllEmbeddings()).thenReturn(List.of());
        var retriever = new JpaKnowledgeRetriever(
                embeddings, chunks, documents, new ObjectMapper(), 0.55);

        assertEquals(List.of(), retriever.search("杭州攻略", 5));
        verify(embeddings, never()).embed("杭州攻略");
        verify(documents, never()).findAll();
    }

    @Test
    void filtersChunksBelowTheConfiguredSimilarityThreshold() {
        KnowledgeEmbeddingService embeddings = mock(KnowledgeEmbeddingService.class);
        KnowledgeChunkJpaRepository chunks = mock(KnowledgeChunkJpaRepository.class);
        KnowledgeDocumentJpaRepository documents = mock(KnowledgeDocumentJpaRepository.class);
        KnowledgeDocumentEntity document = mock(KnowledgeDocumentEntity.class);
        when(document.getId()).thenReturn(1L);
        when(chunks.findAllEmbeddings()).thenReturn(List.of(
                new KnowledgeChunkEmbedding(1L, 1L, "[0.0,1.0]", null)));
        when(documents.findAll()).thenReturn(List.of(document));
        when(embeddings.embed("杭州攻略")).thenReturn(new float[]{1, 0});
        var retriever = new JpaKnowledgeRetriever(
                embeddings, chunks, documents, new ObjectMapper(), 0.55);

        assertEquals(List.of(), retriever.search("杭州攻略", 5));
        verify(embeddings).embed("杭州攻略");
    }

    @Test
    void reusesQueryEmbeddingWithinTheCacheWindow() {
        KnowledgeEmbeddingService embeddings = mock(KnowledgeEmbeddingService.class);
        KnowledgeChunkJpaRepository chunks = mock(KnowledgeChunkJpaRepository.class);
        KnowledgeDocumentJpaRepository documents = mock(KnowledgeDocumentJpaRepository.class);
        KnowledgeDocumentEntity document = mock(KnowledgeDocumentEntity.class);
        when(document.getId()).thenReturn(1L);
        when(chunks.findAllEmbeddings()).thenReturn(List.of(new KnowledgeChunkEmbedding(1L, 1L, "[1.0,0.0]", null)));
        when(documents.findAll()).thenReturn(List.of(document));
        when(embeddings.embed("杭州攻略")).thenReturn(new float[]{1, 0});
        var retriever = new JpaKnowledgeRetriever(embeddings, chunks, documents, new ObjectMapper(), 0.55);

        retriever.search("杭州攻略", 3);
        retriever.search("杭州攻略", 3);

        verify(embeddings, times(1)).embed("杭州攻略");
    }
}
