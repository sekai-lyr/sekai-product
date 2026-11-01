package com.ykd.claw.map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public final class MapTool implements ToolProvider {
    private final MapService service;
    private final ObjectMapper objectMapper;

    public MapTool(MapService service, ObjectMapper objectMapper) {
        this.service = service;
        this.objectMapper = objectMapper;
    }

    @Tool(name = "search_place", description = "Search AMap for physical places, businesses, landmarks or POIs "
            + "in China. Use for restaurants, stations, hospitals or attractions, not general web information. "
            + "Restaurant results include a 'type' cuisine field (e.g. 杭帮菜/川菜/粤菜), rating, average cost, "
            + "opening hours, tags, photos and a mapUrl link. ALWAYS show the 'type' cuisine when recommending "
            + "restaurants, and keep the mapUrl link so the user can tap into AMap details. "
            + "When a 'location' (longitude,latitude or a place name like 西湖) is provided, results are sorted "
            + "by distance to that location (nearest first). "
            + "Never invent missing business fields.")
    public String searchPlace(
            @ToolParam(description = "Place name, category or keyword, for example West Lake or coffee shop")
            String keyword,
            @ToolParam(description = "Optional city name or adcode; pass an empty string when unknown",
                    required = false)
            String city,
            @ToolParam(description = "Optional user location as longitude,latitude (e.g. 120.15,30.28) or a place "
                    + "name (e.g. 西湖). When provided, results are sorted nearest-first by distance. "
                    + "Pass an empty string when unknown.",
                    required = false)
            String location) throws Exception {
        List<PlaceResult> places = service.searchPlace(keyword, city, location);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("keyword", keyword == null ? "" : keyword.trim());
        result.put("city", city == null ? "" : city.trim());
        result.put("location", location == null ? "" : location.trim());
        result.put("places", places);
        return json(result);
    }

    @Tool(name = "get_route", description = "Plan a driving route in China with AMap. Use for driving directions, "
            + "route distance or estimated duration. Inputs may be addresses, place names, or coordinates.")
    public String getRoute(
            @ToolParam(description = "Starting address, place name, or longitude,latitude coordinates")
            String origin,
            @ToolParam(description = "Destination address, place name, or longitude,latitude coordinates")
            String destination) throws Exception {
        return json(service.getRoute(origin, destination));
    }

    @Tool(name = "geocode", description = "Convert a Chinese address or named location into longitude and latitude "
            + "coordinates using AMap. Do not use for route planning or place recommendations.")
    public String geocode(
            @ToolParam(description = "Complete address or named location to convert into coordinates")
            String address) throws Exception {
        List<GeocodeResult> geocodes = service.geocode(address);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("address", address == null ? "" : address.trim());
        result.put("results", geocodes);
        return json(result);
    }

    private String json(Object value) throws JsonProcessingException {
        return objectMapper.writeValueAsString(value);
    }
}
