package com.ykd.claw.knowledge.service;

import java.util.List;

public interface KnowledgeRetriever {
    List<KnowledgeSearchResult> search(String query, int limit);

    /** Invalidate any cached data after indexing new documents. */
    default void invalidateCache() {}
}
