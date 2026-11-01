package com.ykd.claw.travel.repository;

import com.ykd.claw.travel.entity.ItineraryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ItineraryJpaRepository extends JpaRepository<ItineraryEntity, Long> {
    List<ItineraryEntity> findByUserIdOrderByUpdatedTimeDescIdDesc(String userId);

    Optional<ItineraryEntity> findByIdAndUserId(Long id, String userId);

    Optional<ItineraryEntity> findByUserIdAndConversationIdAndDestination(
            String userId, String conversationId, String destination);
}
