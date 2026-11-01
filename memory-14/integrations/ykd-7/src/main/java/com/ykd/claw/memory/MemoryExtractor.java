package com.ykd.claw.memory;


import java.util.List;

public interface MemoryExtractor {
    List<MemoryCandidate> extract(String userMessage, String assistantMessage);
}
