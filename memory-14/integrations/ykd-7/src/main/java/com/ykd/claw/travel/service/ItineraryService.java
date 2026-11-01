package com.ykd.claw.travel.service;

import com.ykd.claw.travel.entity.ItineraryEntity;
import com.ykd.claw.travel.model.ItineraryRecord;
import com.ykd.claw.travel.repository.ItineraryJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class ItineraryService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ItineraryService.class);
    private final ItineraryJpaRepository repository;

    public ItineraryService(ItineraryJpaRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public ItineraryRecord upsertFromPlan(String userId, String conversationId, String destination,
                                          LocalDate startDate, LocalDate endDate, Integer days,
                                          String title, String content) {
        if (userId == null || userId.isBlank() || destination == null || destination.isBlank()) {
            throw new IllegalArgumentException("userId and destination are required");
        }
        Instant now = Instant.now();
        Optional<ItineraryEntity> existing = repository
                .findByUserIdAndConversationIdAndDestination(userId, conversationId, destination);
        ItineraryEntity entity = existing.orElseGet(() -> new ItineraryEntity(
                userId, conversationId, destination, startDate, endDate, days, title, content, now));
        if (existing.isPresent()) {
            entity.refresh(destination, startDate, endDate, days, title, content, now);
        }
        return toRecord(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<ItineraryRecord> list(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        return repository.findByUserIdOrderByUpdatedTimeDescIdDesc(userId).stream()
                .map(entity -> toRecord(entity, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<ItineraryRecord> get(String userId, long itineraryId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        return repository.findByIdAndUserId(itineraryId, userId).map(ItineraryService::toRecord);
    }

    @Transactional
    public boolean delete(String userId, long itineraryId) {
        if (userId == null || userId.isBlank()) return false;
        Optional<ItineraryEntity> entity = repository.findByIdAndUserId(itineraryId, userId);
        if (entity.isEmpty()) {
            LOGGER.debug("Itinerary {} not found for user {}", itineraryId, userId);
            return false;
        }
        repository.delete(entity.orElseThrow());
        return true;
    }

    private static ItineraryRecord toRecord(ItineraryEntity entity) {
        return toRecord(entity, true);
    }

    private static ItineraryRecord toRecord(ItineraryEntity entity, boolean withContent) {
        return new ItineraryRecord(entity.getId(), entity.getDestination(),
                entity.getStartDate(), entity.getEndDate(), entity.getDays(), entity.getTitle(),
                withContent ? entity.getContent() : "",
                entity.getCreatedTime(), entity.getUpdatedTime());
    }
}
