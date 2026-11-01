package com.ykd.claw.time;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TimeServiceTest {

    @Test
    void convertsCurrentInstantToRequestedTimezone() {
        TimeService service = new TimeService(Clock.fixed(
                Instant.parse("2026-07-23T01:30:00Z"), ZoneOffset.UTC));

        assertEquals("2026-07-23T09:30+08:00[Asia/Shanghai]",
                service.currentTime("Asia/Shanghai").toString());
    }

    @Test
    void rejectsUnknownTimezone() {
        TimeService service = new TimeService(Clock.systemUTC());
        assertThrows(IllegalArgumentException.class, () -> service.currentTime("Mars/Olympus"));
    }
}
