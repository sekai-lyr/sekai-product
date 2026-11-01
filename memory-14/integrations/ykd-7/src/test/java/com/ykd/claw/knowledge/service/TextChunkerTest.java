package com.ykd.claw.knowledge.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TextChunkerTest {
    @Test
    void splitsLongTextWithOverlap() {
        TextChunker chunker = new TextChunker(100, 20);
        var chunks = chunker.split("A".repeat(250));

        assertEquals(3, chunks.size());
        assertTrue(chunks.get(1).startsWith("A".repeat(20)));
    }
}
