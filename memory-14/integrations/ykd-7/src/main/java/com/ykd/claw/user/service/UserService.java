package com.ykd.claw.user.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.user.entity.UserEntity;
import com.ykd.claw.user.model.UserRecord;
import com.ykd.claw.user.repository.UserJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class UserService {
    private static final Logger LOGGER = LoggerFactory.getLogger(UserService.class);
    private static final TypeReference<List<String>> PREFERENCES_TYPE = new TypeReference<>() { };

    private final UserJpaRepository repository;
    private final ObjectMapper objectMapper;

    public UserService(UserJpaRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public UserRecord touch(String userId, String channel) {
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException("userId is required");
        Instant now = Instant.now();
        UserEntity entity = repository.findByUserId(userId)
                .orElseGet(() -> repository.save(new UserEntity(userId, channel, now)));
        entity.touch(now);
        return toRecord(entity);
    }

    @Transactional(readOnly = true)
    public Optional<UserRecord> find(String userId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        return repository.findByUserId(userId).map(this::toRecord);
    }

    @Transactional(readOnly = true)
    public List<String> preferences(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        return repository.findByUserId(userId)
                .map(entity -> readPreferences(entity.getPreferences()))
                .orElse(List.of());
    }

    @Transactional
    public List<String> mergePreferences(String userId, List<String> preferences) {
        if (userId == null || userId.isBlank() || preferences == null || preferences.isEmpty()) {
            return List.of();
        }
        UserEntity entity = repository.findByUserId(userId)
                .orElseGet(() -> repository.save(new UserEntity(userId, null, Instant.now())));
        Set<String> merged = new LinkedHashSet<>(readPreferences(entity.getPreferences()));
        preferences.stream().map(String::trim).filter(value -> !value.isBlank()).forEach(merged::add);
        List<String> result = List.copyOf(merged);
        entity.setPreferences(writePreferences(result));
        return result;
    }

    private List<String> readPreferences(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<String> values = objectMapper.readValue(json, PREFERENCES_TYPE);
            return values == null ? List.of() : values.stream().filter(value -> !value.isBlank()).toList();
        } catch (JsonProcessingException e) {
            LOGGER.warn("Unable to parse user preferences JSON", e);
            return List.of();
        }
    }

    private String writePreferences(List<String> preferences) {
        try {
            return objectMapper.writeValueAsString(new ArrayList<>(preferences));
        } catch (JsonProcessingException e) {
            LOGGER.warn("Unable to serialize user preferences", e);
            return "[]";
        }
    }

    private UserRecord toRecord(UserEntity entity) {
        return new UserRecord(entity.getUserId(), entity.getName(), entity.getChannel(),
                readPreferences(entity.getPreferences()), entity.getCreatedTime(),
                entity.getLastActiveTime());
    }
}
