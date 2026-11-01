package com.ykd.claw.time;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Service
public class TimeService {
    private final Clock clock;

    public TimeService() {
        this(Clock.systemUTC());
    }

    TimeService(Clock clock) {
        this.clock = clock;
    }

    public ZonedDateTime currentTime(String timezone) {
        String requested = timezone == null || timezone.isBlank() ? "Asia/Shanghai" : timezone.trim();
        try {
            return ZonedDateTime.now(clock).withZoneSameInstant(ZoneId.of(requested));
        } catch (DateTimeException e) {
            throw new IllegalArgumentException("Unknown timezone '" + requested
                    + "'. Use an IANA timezone such as Asia/Shanghai or Europe/London.", e);
        }
    }
}
