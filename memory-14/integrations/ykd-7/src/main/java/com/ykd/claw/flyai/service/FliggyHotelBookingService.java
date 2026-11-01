package com.ykd.claw.flyai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 飞猪酒店预订服务 —— 搜索酒店并返回购买链接。
 * <p>
 * 底层通过 {@link FlyAiCliService} 调用飞猪 FlyAI MCP，解析 JSON 响应，
 * 提取每个酒店的详情/预订链接（detailUrl / jumpUrl），方便用户直接下单。
 * </p>
 */
@Service
public class FliggyHotelBookingService {

    private final FlyAiCliService cliService;
    private final ObjectMapper objectMapper;

    public FliggyHotelBookingService(FlyAiCliService cliService, ObjectMapper objectMapper) {
        this.cliService = cliService;
        this.objectMapper = objectMapper;
    }

    /**
     * 搜索酒店并以结构化格式返回，包含预订链接。
     *
     * @param destination 目的地城市（如：杭州市）
     * @param checkInDate 入住日期 yyyy-MM-dd
     * @param checkOutDate 退房日期 yyyy-MM-dd
     * @param keyword 可选关键词（酒店名/商圈/地标）
     * @param maxPrice 可选最高房价（元/晚）
     * @return 结构化酒店列表，每项含名称、价格、图片和预订链接
     */
    public List<HotelBookingResult> searchHotels(String destination,
                                                  String checkInDate,
                                                  String checkOutDate,
                                                  String keyword,
                                                  Integer maxPrice) {
        String rawJson = cliService.searchHotel(destination, checkInDate, checkOutDate, keyword, maxPrice);
        return parseHotelResponse(rawJson);
    }

    /**
     * 搜索酒店并返回 Markdown 格式的预订链接列表，方便直接在聊天中展示。
     */
    public String searchHotelsMarkdown(String destination,
                                        String checkInDate,
                                        String checkOutDate,
                                        String keyword,
                                        Integer maxPrice) {
        List<HotelBookingResult> hotels = searchHotels(destination, checkInDate, checkOutDate, keyword, maxPrice);
        if (hotels.isEmpty()) {
            return "未找到符合条件的酒店，请尝试修改搜索条件。";
        }
        StringBuilder sb = new StringBuilder("## 🏨 " + destination + " 酒店搜索结果\n\n");
        for (int i = 0; i < hotels.size(); i++) {
            HotelBookingResult h = hotels.get(i);
            sb.append("### ").append(i + 1).append(". ").append(h.name()).append("\n");
            if (h.price() != null) sb.append("- **价格**: ¥").append(h.price()).append("/晚\n");
            if (h.rating() != null) sb.append("- **评分**: ").append(h.rating()).append(" / 5\n");
            if (h.address() != null) sb.append("- **地址**: ").append(h.address()).append("\n");
            if (h.bookingUrl() != null) {
                sb.append("- **🔗 [").append(h.name()).append("](").append(h.bookingUrl()).append(")**\n");
            } else if (h.detailUrl() != null) {
                sb.append("- **🔗 [").append(h.name()).append("](").append(h.detailUrl()).append(")**\n");
            }
            if (h.imageUrl() != null) sb.append("- ![预览](").append(h.imageUrl()).append(")\n");
            sb.append("\n");
        }
        return sb.toString();
    }

    /**
     * 解析 flyai search-hotel 返回的 JSON，提取酒店列表。
     */
    List<HotelBookingResult> parseHotelResponse(String json) {
        List<HotelBookingResult> results = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            // 尝试多个可能的 data 路径
            JsonNode items = findHotelItems(root);
            if (items != null && items.isArray()) {
                for (JsonNode item : items) {
                    results.add(HotelBookingResult.fromJson(item));
                }
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("无法解析飞猪酒店搜索结果: " + e.getMessage(), e);
        }
        return results;
    }

    /**
     * 兼容多种飞猪 API 返回格式，定位酒店数据节点。
     */
    private static JsonNode findHotelItems(JsonNode root) {
        if (root == null) return null;
        String[] dataPaths = {
                "data.itemList", "data.items", "data.list", "data.records",
                "data.result", "data.hotelList", "data.searchResult",
                "items", "records", "list", "hotels"
        };
        for (String path : dataPaths) {
            JsonNode node = root;
            for (String key : path.split("\\.")) {
                if (node == null) break;
                node = node.get(key);
            }
            if (node != null && node.isArray()) return node;
        }
        // 兜底：root 本身是数组
        if (root.isArray()) return root;
        return null;
    }

    /**
     * 酒店预订结果。
     *
     * @param name        酒店名称
     * @param price       价格（元/晚）
     * @param rating      评分
     * @param address     地址
     * @param bookingUrl  预订链接（跳转飞猪购买）
     * @param detailUrl   详情页链接
     * @param imageUrl    封面图片
     * @param rawJson     原始 JSON（调试用）
     */
    public record HotelBookingResult(
            String name,
            Double price,
            Double rating,
            String address,
            String bookingUrl,
            String detailUrl,
            String imageUrl,
            String rawJson
    ) {
        static HotelBookingResult fromJson(JsonNode node) {
            String name = firstNonBlank(
                    path(node, "name"), path(node, "hotelName"), path(node, "title"),
                    path(node, "hotel_name"), path(node, "productName"));
            String priceStr = firstNonBlank(
                    path(node, "price"), path(node, "minPrice"), path(node, "avgPrice"),
                    path(node, "totalPrice"), path(node, "salePrice"));
            String address = firstNonBlank(
                    path(node, "address"), path(node, "addr"), path(node, "hotelAddress"),
                    path(node, "location"), path(node, "businessDistrict"));
            String bookingUrl = firstNonBlank(
                    path(node, "jumpUrl"), path(node, "bookingUrl"), path(node, "buyUrl"),
                    path(node, "detailUrl"), path(node, "url"), path(node, "link"),
                    path(node, "actionUrl"));
            String detailUrl = firstNonBlank(
                    path(node, "detailUrl"), path(node, "detail_url"), path(node, "itemUrl"));
            String imageUrl = firstNonBlank(
                    path(node, "mainPic"), path(node, "picUrl"), path(node, "image"),
                    path(node, "imageUrl"), path(node, "cover"), path(node, "pictureUrl"));

            // 评分：优先数字评分，兜底用星级文本映射
            String ratingStr = firstNonBlank(
                    path(node, "rating"), path(node, "score"), path(node, "userRating"),
                    path(node, "commentScore"), path(node, "rate"));
            if (ratingStr == null) {
                String star = path(node, "star");
                if (star != null) {
                    ratingStr = mapStarRating(star);
                }
            }

            Double price = parseDouble(priceStr);
            Double rating = parseDouble(ratingStr);
            return new HotelBookingResult(
                    name != null ? name : "未知酒店",
                    price, rating, address,
                    bookingUrl, detailUrl, imageUrl,
                    node.toString());
        }

        /** 将飞猪星级文本（如"经济型"、"舒适型"、"豪华型"）映射为评分 */
        private static String mapStarRating(String star) {
            if (star == null || star.isBlank()) return null;
            return switch (star.replace("钻级", "").trim()) {
                case "豪华型" -> "4.5";
                case "高档型" -> "4.0";
                case "舒适型" -> "3.5";
                case "经济型" -> "2.5";
                case "精品型" -> "4.0";
                default -> star; // 可能是数字
            };
        }

        private static String path(JsonNode node, String field) {
            return node.has(field) ? node.get(field).asText(null) : null;
        }

        private static String firstNonBlank(String... values) {
            for (String v : values) {
                if (v != null && !v.isBlank()) return v.trim();
            }
            return null;
        }

        private static Double parseDouble(String s) {
            if (s == null || s.isBlank()) return null;
            String cleaned = s.replace(",", "").replace("¥", "").trim();
            try { return Double.parseDouble(cleaned); }
            catch (NumberFormatException ignored) { return null; }
        }
    }
}
