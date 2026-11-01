package com.ykd.claw.user.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.user.entity.UserEntity;
import com.ykd.claw.user.repository.UserJpaRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserServiceTest {

    private final List<UserEntity> stored = new ArrayList<>();
    private final UserJpaRepository repository = mock(UserJpaRepository.class);
    private final UserService service = new UserService(repository, new ObjectMapper());

    UserServiceTest() {
        when(repository.findByUserId(anyString())).thenAnswer(invocation ->
                stored.stream().filter(entity -> entity.getUserId().equals(invocation.getArgument(0)))
                        .findFirst());
        when(repository.existsByUserId(anyString())).thenAnswer(invocation ->
                stored.stream().anyMatch(entity -> entity.getUserId().equals(invocation.getArgument(0))));
        when(repository.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity entity = invocation.getArgument(0);
            stored.add(entity);
            return entity;
        });
    }

    @Test
    void touchRegistersANewUserOnceAndRefreshesActivityOnLaterCalls() {
        var first = service.touch("wx_1001", "wechat");
        var again = service.touch("wx_1001", "wechat");

        assertEquals(1, stored.size());
        assertEquals("wx_1001", first.userId());
        assertEquals("wechat", first.channel());
        assertFalse(again.lastActiveTime().isBefore(first.lastActiveTime()));
    }

    @Test
    void mergePreferencesPersistsAndMergesDeduplicatedValues() {
        service.touch("u1", "cli");
        service.mergePreferences("u1", List.of("徒步", "自然风景"));
        service.mergePreferences("u1", List.of("徒步", "安静酒店"));

        assertEquals(List.of("徒步", "自然风景", "安静酒店"), service.preferences("u1"));
        assertEquals(List.of("徒步", "自然风景", "安静酒店"),
                service.find("u1").map(record -> record.preferences()).orElseThrow());
    }

    @Test
    void mergePreferencesCreatesUserWhenOnlyMemoryPreferencesExist() {
        service.mergePreferences("u9", List.of("亲子游"));

        assertEquals(Optional.of(List.of("亲子游")), Optional.of(service.preferences("u9")));
        assertEquals(1, stored.size());
    }

    @Test
    void preferencesAreEmptyForUnknownUsers() {
        assertTrue(service.preferences("nobody").isEmpty());
        assertTrue(service.find("nobody").isEmpty());
    }
}
