package com.ykd.claw.travel.service;

import com.ykd.claw.travel.entity.TravelTaskStateEntity;
import com.ykd.claw.travel.model.TravelTaskState;
import com.ykd.claw.travel.repository.TravelTaskStateJpaRepository;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

@Service
public class TravelTaskStateService {
    private static final Logger LOGGER = LoggerFactory.getLogger(TravelTaskStateService.class);
    private final TravelTaskStateJpaRepository repository;

    public TravelTaskStateService(TravelTaskStateJpaRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public TravelTaskState merge(String userId, String conversationId, Map<String, Object> entities) {
        return merge(userId, conversationId, entities, false);
    }

    @Transactional
    public TravelTaskState merge(String userId, String conversationId,
                                 Map<String, Object> entities, boolean reset) {
        Instant now = Instant.now();
        TravelTaskStateEntity entity = repository
                .findFirstByUserIdAndConversationIdOrderByUpdatedTimeDesc(userId, conversationId)
                .orElseGet(() -> new TravelTaskStateEntity(userId, conversationId, now));
        if (reset) entity.reset(now);
        entity.merge(text(entities, "destination"), date(entities.get("startDate")),
                integer(entities.get("days")), text(entities, "departure"),
                integer(entities.get("people")), decimal(entities.get("budget")),
                bool(entities.get("budgetSpecified")), text(entities, "preference"),
                text(entities, "transport"), text(entities, "hotelLevel"),
                text(entities, "foodPreference"), now);
        return record(repository.save(entity));
    }

    @Transactional
    public void updateStage(Long id, String stage) {
        if (id == null) return;
        repository.findById(id).ifPresent(entity -> entity.stage(stage, Instant.now()));
    }

    @Transactional(readOnly = true)
    public Optional<TravelTaskState> find(String userId, String conversationId) {
        return repository.findFirstByUserIdAndConversationIdOrderByUpdatedTimeDesc(userId, conversationId)
                .map(TravelTaskStateService::record);
    }

    private static TravelTaskState record(TravelTaskStateEntity entity) {
        return new TravelTaskState(entity.getId(), entity.getUserId(), entity.getConversationId(),
                entity.getDestination(), entity.getDate(), entity.getDuration(), entity.getDeparture(),
                entity.getPeople(), entity.getBudget(), entity.isBudgetSpecified(), entity.getPreference(),
                entity.getTransport(), entity.getHotelLevel(), entity.getFoodPreference(),
                entity.getCurrentStage());
    }

    private static String text(Map<String, Object> values, String key) {
        Object value = values.get(key);
        if (value instanceof java.util.Collection<?> collection) {
            String joined = collection.stream().map(String::valueOf).map(String::trim)
                    .filter(item -> !item.isBlank()).collect(java.util.stream.Collectors.joining("；"));
            return joined.isBlank() ? null : joined;
        }
        return value == null ? null : String.valueOf(value).trim();
    }
    private static Integer integer(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }
    private static Double decimal(Object value) {
        return value instanceof Number number ? number.doubleValue() : null;
    }
    private static Boolean bool(Object value) {
        return value instanceof Boolean bool ? bool : null;
    }
    private static LocalDate date(Object value) {
        if (value == null) return null;
        try { return LocalDate.parse(String.valueOf(value)); }
        catch (RuntimeException e) {
            LOGGER.debug("无法解析日期: " + value, e);
            return null;
        }
    }
}
