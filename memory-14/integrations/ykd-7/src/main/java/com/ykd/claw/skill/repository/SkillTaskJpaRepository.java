package com.ykd.claw.skill.repository;

import com.ykd.claw.skill.entity.SkillTaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

public interface SkillTaskJpaRepository extends JpaRepository<SkillTaskEntity, Long> {
    Optional<SkillTaskEntity> findFirstByUserIdAndConversationIdAndStatusInOrderByUpdatedTimeDesc(
            String userId, String conversationId, Collection<String> statuses);

    Optional<SkillTaskEntity> findFirstByUserIdAndConversationIdOrderByUpdatedTimeDesc(
            String userId, String conversationId);
}
