package com.ykd.claw.knowledge.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class TextChunker {
    private final int chunkSize;
    private final int overlap;

    public TextChunker(@Value("${knowledge.chunk-size:1200}") int chunkSize,
                       @Value("${knowledge.chunk-overlap:150}") int overlap) {
        if (chunkSize < 100 || overlap < 0 || overlap >= chunkSize) {
            throw new IllegalArgumentException("Invalid knowledge chunk size/overlap");
        }
        this.chunkSize = chunkSize;
        this.overlap = overlap;
    }

    public List<String> split(String text) {
        if (text == null || text.isBlank()) return List.of();
        String normalized = text.replace("\r\n", "\n").replace('\r', '\n').trim();
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < normalized.length()) {
            int end = Math.min(start + chunkSize, normalized.length());
            if (end < normalized.length()) {
                int paragraph = normalized.lastIndexOf("\n\n", end);
                int sentence = normalized.lastIndexOf('。', end);
                int boundary = Math.max(paragraph, sentence);
                if (boundary > start + chunkSize / 2) end = boundary + 1;
            }
            chunks.add(normalized.substring(start, end).trim());
            if (end == normalized.length()) break;
            start = Math.max(start + 1, end - overlap);
        }
        return List.copyOf(chunks);
    }
}
