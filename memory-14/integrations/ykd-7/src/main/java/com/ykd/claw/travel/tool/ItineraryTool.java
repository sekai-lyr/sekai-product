package com.ykd.claw.travel.tool;

import com.ykd.claw.agent.ToolProvider;
import com.ykd.claw.travel.model.ItineraryRecord;
import com.ykd.claw.travel.service.ItineraryService;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.Map;

@Component
public final class ItineraryTool implements ToolProvider {
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private final ItineraryService service;

    public ItineraryTool(ItineraryService service) {
        this.service = service;
    }

    @Tool(name = "list_my_itineraries", description = "List saved travel itineraries of the current "
            + "user. Use when the user asks about 我的行程/保存的行程/之前的行程. Returns IDs, titles, "
            + "destinations and dates; content is available via get_my_itinerary.")
    public String listItineraries(ToolContext toolContext) {
        var itineraries = service.list(userId(toolContext));
        if (itineraries.isEmpty()) return "暂无保存的行程。完成一次完整行程规划后会自动保存到我的行程。";
        StringBuilder result = new StringBuilder();
        itineraries.forEach(itinerary -> result.append("ID: ").append(itinerary.id())
                .append(" | ").append(itinerary.title())
                .append(" | ").append(destinationText(itinerary))
                .append(" | 更新于 ").append(itinerary.updatedTime()).append('\n'));
        return result.toString().trim();
    }

    @Tool(name = "get_my_itinerary", description = "Return the full content of one saved itinerary "
            + "belonging to the current user. Use the ID returned by list_my_itineraries.")
    public String getItinerary(
            @ToolParam(description = "Itinerary ID from list_my_itineraries") long itineraryId,
            ToolContext toolContext) {
        var itinerary = service.get(userId(toolContext), itineraryId);
        if (itinerary.isEmpty()) return "未找到该行程(ID: " + itineraryId + "),请先用 list_my_itineraries 确认。";
        ItineraryRecord record = itinerary.orElseThrow();
        return "【" + record.title() + "】" + destinationText(record) + "\n\n" + record.content();
    }

    @Tool(name = "delete_my_itinerary", description = "Delete one saved itinerary belonging to the "
            + "current user. Use the ID returned by list_my_itineraries.")
    public String deleteItinerary(
            @ToolParam(description = "Itinerary ID from list_my_itineraries") long itineraryId,
            ToolContext toolContext) {
        boolean deleted = service.delete(userId(toolContext), itineraryId);
        return deleted ? "行程 " + itineraryId + " 已删除。" : "未找到行程 " + itineraryId + ",可能已删除。";
    }

    private static String userId(ToolContext toolContext) {
        Map<String, Object> context = toolContext == null ? Map.of() : toolContext.getContext();
        Object value = context.get("userId");
        return value instanceof String text && !text.isBlank() ? text : "local";
    }

    private static String destinationText(ItineraryRecord record) {
        String dates = record.startDate() == null ? ""
                : DATE_FORMAT.format(record.startDate())
                        + (record.endDate() != null && !record.endDate().equals(record.startDate())
                        ? "~" + DATE_FORMAT.format(record.endDate()) : "");
        return record.destination() + (dates.isBlank() ? "" : " " + dates);
    }
}
