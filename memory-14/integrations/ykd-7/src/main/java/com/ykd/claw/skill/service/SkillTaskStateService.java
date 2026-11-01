package com.ykd.claw.skill.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.skill.entity.SkillTaskEntity;
import com.ykd.claw.skill.repository.SkillTaskJpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class SkillTaskStateService {
    private static final List<String> ACTIVE_STATUSES = List.of("running", "waiting");
    private static final long STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    private final SkillTaskJpaRepository repository;
    private final ObjectMapper objectMapper;

    public SkillTaskStateService(SkillTaskJpaRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public Optional<String> findActiveSkill(String userId, String conversationId) {
        return findActive(userId, conversationId).map(SkillTaskEntity::getSkillName);
    }

    @Transactional
    public SkillTaskState beginOrResume(String userId, String conversationId,
                                        String skillName, String userMessage) {
        Instant now = Instant.now();
        Optional<SkillTaskEntity> active = findActive(userId, conversationId)
                .filter(task -> task.getSkillName().equalsIgnoreCase(skillName));
        if (active.isPresent()) {
            SkillTaskEntity task = active.get();
            task.appendInput(userMessage, now);
            return state(repository.save(task), true);
        }
        findActive(userId, conversationId).ifPresent(task -> task.supersede(now));
        SkillTaskEntity task = repository.save(new SkillTaskEntity(
                userId, conversationId, skillName, userMessage, now));
        return state(task, false);
    }

    @Transactional
    public void updateResult(Long taskId, List<String> missingInformation) {
        SkillTaskEntity task = repository.findById(taskId)
                .orElseThrow(() -> new IllegalStateException("Skill task not found: " + taskId));
        Instant now = Instant.now();
        if (missingInformation.isEmpty()) {
            task.ready(now);
        } else {
            task.waitForUser(json(missingInformation), now);
        }
    }

    private Optional<SkillTaskEntity> findActive(String userId, String conversationId) {
        Instant cutoff = Instant.now().minusMillis(STALE_THRESHOLD_MS);
        return repository.findFirstByUserIdAndConversationIdAndStatusInOrderByUpdatedTimeDesc(
                userId, conversationId, ACTIVE_STATUSES)
                .filter(task -> task.getUpdatedTime().isAfter(cutoff));
    }

    private SkillTaskState state(SkillTaskEntity task, boolean resumed) {
        return new SkillTaskState(task.getId(), task.getSkillName(), task.getAccumulatedInput(), resumed);
    }

    private String json(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unable to serialize missing skill information", e);
        }
    }
}
