package com.ykd.claw.memory;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MemoryServiceTest {

    @Test
    void extractsDeduplicatesAndIsolatesLongTermMemory() {
        MemoryExtractor extractor = (user, assistant) -> List.of(
                new MemoryCandidate("technology_stack", "User develops with Java and Spring", 9));
        MemoryService service = new MemoryService(
                TestJpaRepositories.memoryRepository(), extractor, true, 8);

        service.extractMemory("u1", "I use Java", "OK");
        service.extractMemory("u1", "I use Java", "OK");

        assertEquals(1, service.queryMemory("u1", "Spring project").size());
        assertEquals(0, service.queryMemory("u2", "Spring project").size());
    }

    @Test
    void ranksLexicallyRelevantMemoryBeforeUnrelatedMemory() {
        MemoryService service = new MemoryService(
                TestJpaRepositories.memoryRepository(), (user, assistant) -> List.of(), false, 2);
        service.saveMemory("u1", new MemoryCandidate("interest", "Enjoys landscape photography", 10));
        service.saveMemory("u1", new MemoryCandidate("technology_stack", "Uses Java Spring Boot", 6));

        var result = service.queryMemory("u1", "Help with my Java project");
        assertEquals("Uses Java Spring Boot", result.getFirst().content());
        assertEquals(1, result.size());
    }

    @Test
    void doesNotInjectUnrelatedHighImportanceMemory() {
        MemoryService service = new MemoryService(
                TestJpaRepositories.memoryRepository(), (user, assistant) -> List.of(), false, 8);
        service.saveMemory("u1", new MemoryCandidate("interest", "喜欢新疆自然风景", 10));

        assertEquals(0, service.queryMemory("u1", "帮我分析Java代码").size());
        assertEquals(1, service.profileMemory("u1").size());
    }

    @Test
    void profileMemoryFiltersByCurrentMessage() {
        MemoryService service = new MemoryService(
                TestJpaRepositories.memoryRepository(), (user, assistant) -> List.of(), false, 8);
        service.saveMemory("u1", new MemoryCandidate("preference", "住宿地点偏好选在文城镇", 10));
        service.saveMemory("u1", new MemoryCandidate("preference", "喜欢云南美食", 8));

        // Without message filter - returns all preferences
        assertEquals(2, service.profileMemory("u1").size());

        // With message filter - returns only relevant preferences
        assertEquals(1, service.profileMemory("u1", "云南有什么好吃的").size());
        assertEquals(0, service.profileMemory("u1", "帮我分析Java代码").size());
    }
}
