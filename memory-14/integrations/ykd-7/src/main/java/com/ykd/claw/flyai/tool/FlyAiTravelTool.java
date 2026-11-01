package com.ykd.claw.flyai.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.agent.ToolProvider;
import com.ykd.claw.flyai.service.FliggyHotelBookingService;
import com.ykd.claw.flyai.service.FlyAiCliService;
import com.ykd.claw.flyai.service.HotelRecommendationService;
import com.ykd.claw.travel.service.TravelDateValidationException;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

@Component
public final class FlyAiTravelTool implements ToolProvider {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final FlyAiCliService service;
    private final FliggyHotelBookingService hotelBooking;
    private final HotelRecommendationService hotelRecommendation;

    public FlyAiTravelTool(FlyAiCliService service, FliggyHotelBookingService hotelBooking,
                           HotelRecommendationService hotelRecommendation) {
        this.service = service;
        this.hotelBooking = hotelBooking;
        this.hotelRecommendation = hotelRecommendation;
    }

    @Tool(name = "flyai_search_hotel", description = "Search Fliggy hotel products and return live result JSON. "
            + "Use for hotel names, prices, images and booking/detail links. Never claim that a booking was made.")
    public String searchHotel(
            @ToolParam(description = "Destination city name in Chinese, for example 杭州市") String destination,
            @ToolParam(description = "Check-in date in yyyy-MM-dd; must not be in the past") String checkInDate,
            @ToolParam(description = "Check-out date in yyyy-MM-dd; must be after check-in") String checkOutDate,
            @ToolParam(description = "Optional landmark, business district or hotel name", required = false)
            String poiName,
            @ToolParam(description = "Optional maximum nightly price in CNY", required = false)
            Integer maxPrice) {
        return withStructuredDateError(
                () -> service.searchHotel(destination, checkInDate, checkOutDate, poiName, maxPrice));
    }

    @Tool(name = "flyai_book_hotel", description = "Search Fliggy hotels and return results with direct booking links. "
            + "Use when user asks to book/find a hotel and needs purchase links. "
            + "Returns structured hotel list: name, price, rating, address, bookingUrl, imageUrl. "
            + "Present the bookingUrl as a clickable link for the user to complete the booking.")
    public String bookHotel(
            @ToolParam(description = "Destination city name in Chinese, for example 杭州市") String destination,
            @ToolParam(description = "Check-in date in yyyy-MM-dd; must not be in the past") String checkInDate,
            @ToolParam(description = "Check-out date in yyyy-MM-dd; must be after check-in") String checkOutDate,
            @ToolParam(description = "Optional landmark, business district or hotel name", required = false)
            String keyword,
            @ToolParam(description = "Optional maximum nightly price in CNY", required = false)
            Integer maxPrice) {
        return withStructuredDateError(() -> {
            List<FliggyHotelBookingService.HotelBookingResult> hotels =
                    hotelBooking.searchHotels(destination, checkInDate, checkOutDate, keyword, maxPrice);
            try {
                return JSON.writeValueAsString(Map.of(
                        "success", true,
                        "total", hotels.size(),
                        "message", "以下酒店可在飞猪完成预订，请点击 bookingUrl 链接跳转购买",
                        "hotels", hotels));
            } catch (Exception e) {
                return hotelBooking.searchHotelsMarkdown(
                        destination, checkInDate, checkOutDate, keyword, maxPrice);
            }
        });
    }

    @Tool(name = "flyai_recommend_hotel", description = "综合酒店推荐：按价格、评分、距指定景点距离、驾车交通便利度"
            + " 等多维度评分排序。当用户说想去某地玩/旅游/参观并需要酒店时，优先使用此工具。"
            + " 返回 Markdown 格式的综合推荐报告，包含排名、评分明细表和预订链接。")
    public String recommendHotel(
            @ToolParam(description = "目的地城市名（中文），如 杭州市、东海县") String destination,
            @ToolParam(description = "用户计划游玩的景点/地标名称（中文），如 西湖、东海高级中学") String attraction,
            @ToolParam(description = "入住日期 yyyy-MM-dd") String checkInDate,
            @ToolParam(description = "退房日期 yyyy-MM-dd") String checkOutDate,
            @ToolParam(description = "可选最高每晚价格（元）", required = false) Integer maxPrice) {
        return withStructuredDateError(() -> {
            var req = HotelRecommendationService.RecommendRequest.of(
                    destination, attraction, checkInDate, checkOutDate, maxPrice, 5);
            return hotelRecommendation.recommendMarkdown(req);
        });
    }

    @Tool(name = "flyai_search_flight", description = "Search Fliggy flight products and return live result JSON "
            + "including prices and jump links. Never claim availability is guaranteed or make a booking.")
    public String searchFlight(
            @ToolParam(description = "Departure city name in Chinese") String origin,
            @ToolParam(description = "Arrival city name in Chinese") String destination,
            @ToolParam(description = "Departure date in yyyy-MM-dd; must not be in the past") String departureDate,
            @ToolParam(description = "Optional return date in yyyy-MM-dd", required = false) String returnDate,
            @ToolParam(description = "Optional maximum price in CNY", required = false) Integer maxPrice) {
        return withStructuredDateError(
                () -> service.searchFlight(origin, destination, departureDate, returnDate, maxPrice));
    }

    @Tool(name = "flyai_search_train", description = "Search Fliggy train products and return live schedules, "
            + "prices and jump links. Never claim that a ticket was reserved.")
    public String searchTrain(
            @ToolParam(description = "Departure city name in Chinese") String origin,
            @ToolParam(description = "Arrival city name in Chinese") String destination,
            @ToolParam(description = "Departure date in yyyy-MM-dd; must not be in the past") String departureDate) {
        return withStructuredDateError(() -> service.searchTrain(origin, destination, departureDate));
    }

    @Tool(name = "flyai_search_poi", description = "Search Fliggy for attractions and travel POIs with current "
            + "product/detail links. Use when the user needs attraction links or bookable travel products.")
    public String searchPoi(
            @ToolParam(description = "City name in Chinese, preferably including 市") String city,
            @ToolParam(description = "Attraction or POI keyword") String keyword,
            @ToolParam(description = "Optional POI category", required = false) String category) {
        return service.searchPoi(city, keyword, category);
    }

    @Tool(name = "flyai_ai_search", description = "Search Fliggy travel content with a natural-language query. "
            + "Use for broad travel product questions requiring current Fliggy links.")
    public String aiSearch(
            @ToolParam(description = "Focused natural-language travel query with city and dates when relevant")
            String query) {
        return service.aiSearch(query);
    }

    private static String withStructuredDateError(Supplier<String> action) {
        try {
            return action.get();
        } catch (TravelDateValidationException e) {
            try {
                return JSON.writeValueAsString(Map.of(
                        "success", false,
                        "error", Map.of(
                                "code", "INVALID_TRAVEL_DATE",
                                "field", e.field(),
                                "message", e.getMessage(),
                                "today", e.today().toString())));
            } catch (Exception ignored) {
                return "{\"success\":false,\"error\":{\"code\":\"INVALID_TRAVEL_DATE\"}}";
            }
        }
    }
}
