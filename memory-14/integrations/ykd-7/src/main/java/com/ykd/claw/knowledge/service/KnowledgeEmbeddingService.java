package com.ykd.claw.knowledge.service;

import java.util.List;

public interface KnowledgeEmbeddingService {
    List<float[]> embed(List<String> texts);

    default float[] embed(String text) {
        return embed(List.of(text)).getFirst();
    }
}
