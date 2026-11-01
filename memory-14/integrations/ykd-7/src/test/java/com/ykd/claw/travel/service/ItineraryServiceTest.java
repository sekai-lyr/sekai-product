package com.ykd.claw.travel.service;

import com.ykd.claw.travel.entity.ItineraryEntity;
import com.ykd.claw.travel.repository.ItineraryJpaRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ItineraryServiceTest {

    private final List<ItineraryEntity> stored = new ArrayList<>();
    private final ItineraryJpaRepository repository = mock(ItineraryJpaRepository.class);
    private final ItineraryService service = new ItineraryService(repository);
    private long nextId = 1L;

    ItineraryServiceTest() {
        when(repository.findByUserIdOrderByUpdatedTimeDescIdDesc(anyString())).thenAnswer(invocation ->
                stored.stream()
                        .filter(entity -> entity.getUserId().equals(invocation.getArgument(0)))
                        .sorted(Comparator.comparing(ItineraryEntity::getUpdatedTime).reversed())
                        .toList());
        when(repository.findByIdAndUserId(anyLong(), anyString())).thenAnswer(invocation ->
                stored.stream().filter(entity -> entity.getId().equals(invocation.getArgument(0))
                                && entity.getUserId().equals(invocation.getArgument(1)))
                        .findFirst());
        when(repository.findByUserIdAndConversationIdAndDestination(
                anyString(), anyString(), anyString())).thenAnswer(invocation ->
                stored.stream().filter(entity -> entity.getUserId().equals(invocation.getArgument(0))
                                && entity.getConversationId().equals(invocation.getArgument(1))
                                && entity.getDestination().equals(invocation.getArgument(2)))
                        .findFirst());
        when(repository.save(any(ItineraryEntity.class))).thenAnswer(invocation -> {
            ItineraryEntity entity = invocation.getArgument(0);
            if (entity.getId() == null) {
                id(entity, nextId++);
            }
            stored.removeIf(existing -> existing.equals(entity));
            stored.add(entity);
            return entity;
        });
        org.mockito.Mockito.doAnswer(invocation -> {
            stored.remove(invocation.getArgument(0));
            return null;
        }).when(repository).delete(any(ItineraryEntity.class));
    }

    @Test
    void upsertCreatesNewItineraryThenUpdatesItForTheSameConversationAndDestination() {
        LocalDate start = LocalDate.of(2026, 8, 10);
        LocalDate end = LocalDate.of(2026, 8, 13);
        var created = service.upsertFromPlan("u1", "c1", "杭州", start, end, 3,
                "杭州 3日游", "第一天 西湖");
        var updated = service.upsertFromPlan("u1", "c1", "杭州", start, end, 3,
                "杭州 3日游", "第一天 西湖 第二天 灵隐寺");

        assertEquals(1, stored.size());
        assertEquals(created.id(), updated.id());
        assertEquals("第一天 西湖 第二天 灵隐寺", updated.content());
        assertFalse(updated.updatedTime().isBefore(created.updatedTime()));
    }

    @Test
    void sameDestinationInAnotherConversationCreatesASeparateItinerary() {
        service.upsertFromPlan("u1", "c1", "杭州", null, null, 2, "杭州 2日游", "A");
        service.upsertFromPlan("u1", "c2", "杭州", null, null, 2, "杭州 2日游", "B");

        assertEquals(2, stored.size());
    }

    @Test
    void listReturnsOnlyTheUsersOwnItineraries() {
        service.upsertFromPlan("u1", "c1", "杭州", null, null, 2, "杭州 2日游", "A");
        service.upsertFromPlan("u2", "c1", "北京", null, null, 2, "北京 2日游", "B");

        var result = service.list("u1");

        assertEquals(1, result.size());
        assertEquals("杭州", result.getFirst().destination());
        assertTrue(result.getFirst().content().isEmpty(), "list summaries must not carry full content");
    }

    @Test
    void getReturnsContentOnlyForTheOwner() {
        var saved = service.upsertFromPlan("u1", "c1", "杭州", null, null, 2, "杭州 2日游", "完整行程内容");

        assertEquals(Optional.of("完整行程内容"), service.get("u1", saved.id()).map(record -> record.content()));
        assertTrue(service.get("u2", saved.id()).isEmpty());
    }

    @Test
    void deleteOnlyRemovesTheOwnersItinerary() {
        var saved = service.upsertFromPlan("u1", "c1", "杭州", null, null, 2, "杭州 2日游", "A");

        assertFalse(service.delete("u2", saved.id()));
        assertEquals(1, stored.size());
        assertTrue(service.delete("u1", saved.id()));
        assertTrue(stored.isEmpty());
    }

    @Test
    void requiresUserIdAndDestination() {
        try {
            service.upsertFromPlan("u1", "c1", "", null, null, null, "t", "c");
            throw new AssertionError("expected IllegalArgumentException");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("userId"));
        }
    }

    private static void id(ItineraryEntity entity, long value) {
        try {
            java.lang.reflect.Field field = ItineraryEntity.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(entity, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Unable to assign itinerary id", e);
        }
    }
}
