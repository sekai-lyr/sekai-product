package com.ykd.claw.travel.service;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TravelDateResolverTest {
    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");
    private final TravelDateResolver resolver = new TravelDateResolver(
            Clock.fixed(Instant.parse("2026-07-31T02:00:00Z"), SHANGHAI));

    @Test
    void resolvesRelativeChineseDates() {
        assertEquals(LocalDate.of(2026, 7, 31), resolver.resolveFirst("今天去西湖").orElseThrow());
        assertEquals(LocalDate.of(2026, 8, 1), resolver.resolveFirst("明天去西湖").orElseThrow());
        assertEquals(LocalDate.of(2026, 8, 2), resolver.resolveFirst("我这周日要去杭州西湖").orElseThrow());
        assertEquals(LocalDate.of(2026, 8, 9), resolver.resolveFirst("下周日去杭州").orElseThrow());
        assertEquals(LocalDate.of(2026, 8, 3), resolver.resolveFirst("三天后去杭州").orElseThrow());
        assertEquals(LocalDate.of(2026, 8, 12), resolver.resolveFirst("十二天后去北京").orElseThrow());
    }

    @Test
    void resolvesExplicitDatesAndRejectsUnknownText() {
        assertEquals(LocalDate.of(2026, 8, 3), resolver.resolveFirst("2026-8-3出发").orElseThrow());
        assertEquals(LocalDate.of(2027, 1, 2), resolver.resolveFirst("1月2日出发").orElseThrow());
        assertTrue(resolver.resolveFirst("有空再去").isEmpty());
    }
}
