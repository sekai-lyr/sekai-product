package com.ykd.claw.travel.service;

import com.ykd.claw.travel.entity.TravelTaskStateEntity;
import com.ykd.claw.travel.repository.TravelTaskStateJpaRepository;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TravelTaskStateServiceTest {
    @Test
    void mergesDestinationPeopleAndBudgetAcrossMessages() {
        TravelTaskStateJpaRepository repository = mock(TravelTaskStateJpaRepository.class);
        AtomicReference<TravelTaskStateEntity> stored = new AtomicReference<>();
        when(repository.findFirstByUserIdAndConversationIdOrderByUpdatedTimeDesc("u", "c"))
                .thenAnswer(ignored -> Optional.ofNullable(stored.get()));
        when(repository.save(any())).thenAnswer(invocation -> {
            TravelTaskStateEntity value = invocation.getArgument(0);
            stored.set(value);
            return value;
        });
        TravelTaskStateService service = new TravelTaskStateService(repository);

        service.merge("u", "c", Map.of("destination", "杭州"));
        service.merge("u", "c", Map.of("people", 2));
        var result = service.merge("u", "c", Map.of("budget", 3000, "budgetSpecified", true));

        assertEquals("杭州", result.destination());
        assertEquals(2, result.people());
        assertEquals(3000.0, result.budget());
    }

    @Test
    void clearsOldTripFieldsWhenANewTaskStarts() {
        TravelTaskStateJpaRepository repository = mock(TravelTaskStateJpaRepository.class);
        AtomicReference<TravelTaskStateEntity> stored = new AtomicReference<>();
        when(repository.findFirstByUserIdAndConversationIdOrderByUpdatedTimeDesc("u", "c"))
                .thenAnswer(ignored -> Optional.ofNullable(stored.get()));
        when(repository.save(any())).thenAnswer(invocation -> {
            TravelTaskStateEntity value = invocation.getArgument(0);
            stored.set(value);
            return value;
        });
        TravelTaskStateService service = new TravelTaskStateService(repository);
        service.merge("u", "c", Map.of("destination", "杭州", "people", 2, "budget", 3000));

        var result = service.merge("u", "c", Map.of("destination", "北京"), true);

        assertEquals("北京", result.destination());
        assertEquals(null, result.people());
        assertEquals(null, result.budget());
    }
}
