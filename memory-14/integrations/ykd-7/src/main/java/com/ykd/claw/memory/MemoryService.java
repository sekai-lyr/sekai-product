package com.ykd.claw.memory;

import com.ykd.claw.memory.entity.MemoryEntity;
import com.ykd.claw.memory.repository.MemoryJpaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class MemoryService {
    private final MemoryJpaRepository repository;
    private final MemoryExtractor extractor;
    private final boolean extractionEnabled;
    private final int relevantLimit;
    private final int minimumTermMatches;

    public MemoryService(MemoryJpaRepository repository, MemoryExtractor extractor,
                         boolean extractionEnabled, int relevantLimit) {
        this(repository, extractor, extractionEnabled, relevantLimit, 1);
    }

    @Autowired
    public MemoryService(MemoryJpaRepository repository, MemoryExtractor extractor,
                         @Value("${memory.extraction-enabled:${memory.enabled:false}}") boolean extractionEnabled,
                         @Value("${memory.relevant-limit:8}") int relevantLimit,
                         @Value("${memory.minimum-term-matches:1}") int minimumTermMatches) {
        this.repository = repository;
        this.extractor = extractor;
        this.extractionEnabled = extractionEnabled;
        this.relevantLimit = Math.max(1, relevantLimit);
        this.minimumTermMatches = Math.max(0, minimumTermMatches);
    }

    @Transactional
    public void saveMemory(String userId, MemoryCandidate candidate) {
        if (candidate == null || candidate.content().isBlank()) return;
        if (!repository.existsByUserIdAndTypeIgnoreCaseAndContentIgnoreCase(
                userId, candidate.type(), candidate.content())) {
            repository.save(new MemoryEntity(userId, candidate.type(), candidate.content(),
                    candidate.importance(), Instant.now()));
        }
    }

    @Transactional(readOnly = true)
    public List<UserMemory> queryMemory(String userId, String currentMessage) {
        Set<String> terms = terms(currentMessage);
        return repository.findByUserIdOrderByImportanceDescCreatedTimeDescIdDesc(
                        userId, PageRequest.of(0, 50)).stream()
                .map(MemoryService::toRecord)
                .filter(memory -> matchingTerms(memory, terms) >= minimumTermMatches)
                .sorted(Comparator.<UserMemory>comparingInt(memory -> relevance(memory, terms)).reversed()
                        .thenComparing(UserMemory::importance, Comparator.reverseOrder())
                        .thenComparing(UserMemory::createdTime, Comparator.reverseOrder()))
                .limit(relevantLimit)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserMemory> profileMemory(String userId) {
        return profileMemory(userId, null);
    }

    @Transactional(readOnly = true)
    public List<UserMemory> profileMemory(String userId, String currentMessage) {
        Set<String> terms = currentMessage == null ? Set.of() : terms(currentMessage);
        return repository.findByUserIdOrderByImportanceDescCreatedTimeDescIdDesc(
                        userId, PageRequest.of(0, 50)).stream()
                .map(MemoryService::toRecord)
                .filter(memory -> memory.type().equalsIgnoreCase("preference")
                        || memory.type().equalsIgnoreCase("interest"))
                .filter(memory -> terms.isEmpty() || matchingTerms(memory, terms) >= minimumTermMatches)
                .sorted(Comparator.<UserMemory>comparingInt(memory -> relevance(memory, terms)).reversed()
                        .thenComparing(UserMemory::importance, Comparator.reverseOrder())
                        .thenComparing(UserMemory::createdTime, Comparator.reverseOrder()))
                .limit(relevantLimit)
                .toList();
    }

    /** 看板:全量记忆列表(按创建时间倒序)。 */
    @Transactional(readOnly = true)
    public List<UserMemory> listAll(int limit) {
        return repository.findAllByOrderByCreatedTimeDesc(PageRequest.of(0, Math.max(1, limit)))
                .stream().map(MemoryService::toRecord).toList();
    }

    /** 看板:某用户的记忆(按重要度倒序)。 */
    @Transactional(readOnly = true)
    public List<UserMemory> listByUser(String userId, int limit) {
        return repository.findByUserIdOrderByImportanceDescCreatedTimeDescIdDesc(
                        userId, PageRequest.of(0, Math.max(1, limit)))
                .stream().map(MemoryService::toRecord).toList();
    }

    /** 看板:删除一条记忆(校验归属)。 */
    @Transactional
    public boolean deleteMemory(String userId, Long memoryId) {
        MemoryEntity entity = repository.findByIdAndUserId(memoryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("memory not found: " + memoryId));
        repository.delete(entity);
        return true;
    }

    @Async("asyncExecutor")
    @Transactional
    public void extractMemoryAsync(String userId, String userMessage, String assistantMessage) {
        try {
            if (!extractionEnabled) return;
            List<MemoryCandidate> candidates = extractor.extract(userMessage, assistantMessage);
            if (candidates.isEmpty()) return;

            List<MemoryEntity> existing = repository.findByUserIdOrderByImportanceDescCreatedTimeDescIdDesc(
                    userId, PageRequest.of(0, 200));
            Set<String> existingKeys = new HashSet<>();
            for (MemoryEntity e : existing) {
                existingKeys.add(e.getType().toLowerCase(Locale.ROOT) + "|" + e.getContent().toLowerCase(Locale.ROOT));
            }

            List<MemoryEntity> toSave = new java.util.ArrayList<>();
            for (MemoryCandidate candidate : candidates) {
                if (candidate.content().isBlank()) continue;
                String key = candidate.type().toLowerCase(Locale.ROOT) + "|" + candidate.content().toLowerCase(Locale.ROOT);
                if (!existingKeys.contains(key)) {
                    toSave.add(new MemoryEntity(userId, candidate.type(), candidate.content(),
                            candidate.importance(), Instant.now()));
                    existingKeys.add(key);
                }
            }
            if (!toSave.isEmpty()) repository.saveAll(toSave);
        } catch (RuntimeException e) {
            // Async exceptions are not propagated to caller; silently continue
        }
    }

    @Transactional
    public List<MemoryCandidate> extractMemory(String userId, String userMessage, String assistantMessage) {
        if (!extractionEnabled) return List.of();
        List<MemoryCandidate> candidates = extractor.extract(userMessage, assistantMessage);
        if (candidates.isEmpty()) return List.of();

        // Batch: fetch existing memories once, then filter and save in one batch
        List<MemoryEntity> existing = repository.findByUserIdOrderByImportanceDescCreatedTimeDescIdDesc(
                userId, PageRequest.of(0, 200));
        Set<String> existingKeys = new HashSet<>();
        for (MemoryEntity e : existing) {
            existingKeys.add(e.getType().toLowerCase(Locale.ROOT) + "|" + e.getContent().toLowerCase(Locale.ROOT));
        }

        List<MemoryEntity> toSave = new java.util.ArrayList<>();
        for (MemoryCandidate candidate : candidates) {
            if (candidate.content().isBlank()) continue;
            String key = candidate.type().toLowerCase(Locale.ROOT) + "|" + candidate.content().toLowerCase(Locale.ROOT);
            if (!existingKeys.contains(key)) {
                toSave.add(new MemoryEntity(userId, candidate.type(), candidate.content(),
                        candidate.importance(), Instant.now()));
                existingKeys.add(key); // prevent duplicates within the same batch
            }
        }
        if (!toSave.isEmpty()) repository.saveAll(toSave);
        return candidates;
    }

    private static int relevance(UserMemory memory, Set<String> terms) {
        return matchingTerms(memory, terms) * 100 + memory.importance();
    }

    private static int matchingTerms(UserMemory memory, Set<String> terms) {
        String content = memory.content().toLowerCase(Locale.ROOT);
        return (int) terms.stream().filter(content::contains).count();
    }

    private static UserMemory toRecord(MemoryEntity entity) {
        return new UserMemory(entity.getId(), entity.getUserId(), entity.getType(), entity.getContent(),
                entity.getImportance(), entity.getCreatedTime());
    }

    private static Set<String> terms(String text) {
        if (text == null || text.isBlank()) return Set.of();
        Set<String> result = new HashSet<>();
        for (String token : text.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}+#.]+")) {
            if (token.length() >= 2) result.add(token);
            if (token.matches(".*[\\p{IsHan}].*") && token.length() > 2) {
                for (int index = 0; index < token.length() - 1; index++) {
                    result.add(token.substring(index, index + 2));
                }
            }
        }
        return result;
    }
}
