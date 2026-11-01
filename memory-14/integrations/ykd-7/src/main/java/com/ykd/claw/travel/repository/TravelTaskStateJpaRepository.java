package com.ykd.claw.travel.repository;

import com.ykd.claw.travel.entity.TravelTaskStateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TravelTaskStateJpaRepository extends JpaRepository<TravelTaskStateEntity, Long> {
    Optional<TravelTaskStateEntity> findFirstByUserIdAndConversationIdOrderByUpdatedTimeDesc(
            String userId, String conversationId);
}
