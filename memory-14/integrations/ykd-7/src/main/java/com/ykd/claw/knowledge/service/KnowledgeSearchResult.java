package com.ykd.claw.knowledge.service;

public record KnowledgeSearchResult(
        String content,
        double score,
        String fileName,
        String sourcePath,
        Integer pageNumber) {
}
