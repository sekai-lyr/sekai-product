package com.ykd.claw.time;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@Component
public final class CurrentTimeTool implements ToolProvider {
    private final TimeService service;

    public CurrentTimeTool(TimeService service) {
        this.service = service;
    }

    @Tool(name = "get_current_time", description = "Get the exact current date and time in a requested timezone. "
            + "Use this before resolving relative dates such as today, tomorrow or next Monday.")
    public String getCurrentTime(
            @ToolParam(description = "IANA timezone, for example Asia/Shanghai, America/New_York or UTC")
            String timezone) {
        ZonedDateTime current = service.currentTime(timezone);
        return "Current time: " + current.format(DateTimeFormatter.ISO_ZONED_DATE_TIME)
                + "\nTimezone: " + current.getZone().getId()
                + "\nUTC offset: " + current.getOffset();
    }
}
