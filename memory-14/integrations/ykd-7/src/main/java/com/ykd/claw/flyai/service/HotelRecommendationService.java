package com.ykd.claw.flyai.service;

import com.ykd.claw.map.GeocodeResult;
import com.ykd.claw.map.MapService;
import com.ykd.claw.map.PlaceResult;
import com.ykd.claw.map.RouteResult;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * 酒店综合推荐服务 —— 多维度评分排序。
 * <p>
 * 综合维度：价格性价比（20%）、用户评分（25%）、距目标景点距离（35%）、驾车时间/交通便利度（20%）。
 * 先通过飞猪搜索酒店，再通过高德地图计算每个酒店到目标景点的驾车路线，最终给出排名。
 * </p>
 */
@Service
public class HotelRecommendationService {

    private static final Logger LOG = Logger.getLogger(HotelRecommendationService.class.getName());

    /**
     * 距离计算前先按价格+评分预筛，避免对全部酒店逐个请求地图 API。
     */
    private static final int PRE_FILTER_COUNT = 6;

    /**
     * 最终返回的推荐数量。
     */
    private static final int DEFAULT_TOP_N = 5;

    private final FliggyHotelBookingService hotelBooking;
    private final MapService mapService;

    public HotelRecommendationService(FliggyHotelBookingService hotelBooking, MapService mapService) {
        this.hotelBooking = hotelBooking;
        this.mapService = mapService;
    }

    // ==================== 请求 / 结果模型 ====================

    public record RecommendRequest(
            String destination,
            String attraction,
            String checkInDate,
            String checkOutDate,
            Integer maxPrice,
            int topN) {
        public static RecommendRequest of(String destination, String attraction,
                                           String checkInDate, String checkOutDate,
                                           Integer maxPrice, int topN) {
            return new RecommendRequest(destination, attraction, checkInDate, checkOutDate, maxPrice, topN);
        }

        public int topN() { return topN > 0 ? topN : DEFAULT_TOP_N; }
    }

    /** 单家酒店的评分明细 */
    public record ScoredHotel(
            String name,
            String address,
            Double price,
            Double rating,
            String bookingUrl,
            String imageUrl,
            double priceScore,       // 0-10
            double ratingScore,      // 0-10
            double distanceScore,    // 0-10
            double durationScore,    // 0-10
            double compositeScore,   // 0-10 加权综合
            String distanceText,     // e.g. "3.2 km"
            String durationText,     // e.g. "8 分钟"
            String attractionName,
            String attractionLocation) {
    }

    public record RecommendResult(
            String destination,
            String attraction,
            List<ScoredHotel> hotels,
            String summary) {
    }

    // ==================== 核心推荐逻辑 ====================

    /**
     * 综合推荐酒店。
     *
     * @param req 请求参数，含目的地、景点、日期、最高价、返回数量
     * @return 按综合评分降序排列的推荐结果
     */
    public RecommendResult recommend(RecommendRequest req) {
        // 1) 搜索酒店
        List<FliggyHotelBookingService.HotelBookingResult> rawHotels =
                hotelBooking.searchHotels(req.destination(), req.checkInDate(), req.checkOutDate(),
                        null, req.maxPrice());
        if (rawHotels.isEmpty()) {
            return new RecommendResult(req.destination(), req.attraction(), List.of(),
                    "未找到 " + req.destination() + " 的酒店，请尝试放宽条件。");
        }

        // 2) 查找目标景点坐标
        String attractionName = req.attraction();
        PlaceResult targetAttraction = findAttraction(req.attraction(), req.destination());

        // 3) 预筛：按价格+评分初排，取前 PRE_FILTER_COUNT 个候选
        List<FliggyHotelBookingService.HotelBookingResult> candidates = preFilter(rawHotels);

        // 4) 多维度评分（含距离计算）
        List<ScoredHotel> scored = scoreHotels(candidates, targetAttraction, attractionName);

        // 5) 按综合分降序排列
        scored.sort(Comparator.comparingDouble(ScoredHotel::compositeScore).reversed());

        int top = req.topN();
        if (scored.size() > top) scored = scored.subList(0, top);

        String summary = generateSummary(scored, attractionName, rawHotels.size());
        return new RecommendResult(req.destination(), attractionName, scored, summary);
    }

    /**
     * 综合推荐并返回 Markdown 格式，方便 AI 直接展示给用户。
     */
    public String recommendMarkdown(RecommendRequest req) {
        RecommendResult result = recommend(req);
        return toMarkdown(result);
    }

    // ==================== 内部方法 ====================

    /**
     * 通过高德搜索景点，取第一个匹配结果。
     */
    private PlaceResult findAttraction(String attraction, String city) {
        try {
            List<PlaceResult> places = mapService.searchPlace(attraction, city);
            return places.isEmpty() ? null : places.get(0);
        } catch (Exception e) {
            LOG.log(Level.WARNING, "搜索景点失败: " + attraction, e);
            return null;
        }
    }

    /**
     * 价格+评分预筛选：选择性价比最高的候选酒店，减少后续地图API调用。
     */
    private List<FliggyHotelBookingService.HotelBookingResult> preFilter(
            List<FliggyHotelBookingService.HotelBookingResult> hotels) {
        if (hotels.size() <= PRE_FILTER_COUNT) return new ArrayList<>(hotels);

        // 分别归一化价格和评分后排序
        double maxP = hotels.stream().filter(h -> h.price() != null)
                .mapToDouble(FliggyHotelBookingService.HotelBookingResult::price).max().orElse(1);
        double minP = hotels.stream().filter(h -> h.price() != null)
                .mapToDouble(FliggyHotelBookingService.HotelBookingResult::price).min().orElse(0);

        return hotels.stream()
                .sorted(Comparator.comparingDouble((FliggyHotelBookingService.HotelBookingResult h) -> {
                    double pScore = h.price() != null
                            ? (1 - (h.price() - minP) / Math.max(1, maxP - minP)) * 10
                            : 5;
                    double rScore = h.rating() != null ? h.rating() * 2 : 5;
                    return -(pScore * 0.5 + rScore * 0.5); // 降序用负号
                }))
                .limit(PRE_FILTER_COUNT)
                .collect(Collectors.toList());
    }

    /**
     * 对候选酒店逐一评分（含地图距离计算）。
     */
    private List<ScoredHotel> scoreHotels(
            List<FliggyHotelBookingService.HotelBookingResult> candidates,
            PlaceResult attraction, String attractionName) {

        // 计算价格/评分的极值用于归一化
        double maxP = candidates.stream().filter(h -> h.price() != null)
                .mapToDouble(FliggyHotelBookingService.HotelBookingResult::price).max().orElse(1);
        double minP = candidates.stream().filter(h -> h.price() != null)
                .mapToDouble(FliggyHotelBookingService.HotelBookingResult::price).min().orElse(0);
        double maxR = candidates.stream().filter(h -> h.rating() != null)
                .mapToDouble(FliggyHotelBookingService.HotelBookingResult::rating).max().orElse(5);
        double minR = candidates.stream().filter(h -> h.rating() != null)
                .mapToDouble(FliggyHotelBookingService.HotelBookingResult::rating).min().orElse(0);

        List<ScoredHotel> scored = new ArrayList<>();
        for (var hotel : candidates) {
            // 价格评分：越低越好
            double priceScore = hotel.price() != null
                    ? Math.max(0, (1 - (hotel.price() - minP) / Math.max(1, maxP - minP)) * 10)
                    : 5;

            // 评分评分：越高越好
            double ratingScore = hotel.rating() != null
                    ? (maxR > minR ? ((hotel.rating() - minR) / (maxR - minR)) * 10 : 5)
                    : 5;

            // 地图距离计算
            double distanceKm = -1, durationMin = -1;
            String distanceText = "未知", durationText = "未知";
            String attrLoc = attraction != null ? attraction.location() : null;

            if (attraction != null && attrLoc != null && hotel.address() != null) {
                try {
                    List<GeocodeResult> geos = mapService.geocode(hotel.address());
                    if (!geos.isEmpty() && geos.get(0).location() != null) {
                        RouteResult route = mapService.getRoute(
                                geos.get(0).location(), attrLoc);
                        distanceKm = route.distanceMeters() / 1000.0;
                        durationMin = route.durationSeconds() / 60.0;
                    }
                } catch (Exception e) {
                    LOG.log(Level.FINE, "酒店 " + hotel.name() + " 距离计算失败", e);
                }
            }

            if (distanceKm >= 0) {
                distanceText = distanceKm < 1
                        ? String.format("%.0f 米", distanceKm * 1000)
                        : String.format("%.1f 公里", distanceKm);
            }
            if (durationMin >= 0) {
                durationText = durationMin < 60
                        ? String.format("%.0f 分钟", durationMin)
                        : String.format("%.1f 小时", durationMin / 60);
            }

            // 距离评分：越近越好（10km 内满分，50km 外 0 分）
            double distanceScore = distanceKm >= 0
                    ? Math.max(0, 10 - distanceKm / 5.0)
                    : 5;

            // 交通时间评分：越短越好（10 分钟满分，60 分钟 0 分）
            double durationScore = durationMin >= 0
                    ? Math.max(0, 10 - durationMin / 6.0)
                    : 5;

            // 加权综合：距离 > 评分 > 价格 > 交通时间
            double composite = priceScore * 0.20 + ratingScore * 0.25
                    + distanceScore * 0.35 + durationScore * 0.20;

            scored.add(new ScoredHotel(
                    hotel.name(), hotel.address(), hotel.price(), hotel.rating(),
                    hotel.bookingUrl(), hotel.imageUrl(),
                    round(priceScore), round(ratingScore),
                    round(distanceScore), round(durationScore),
                    round(composite), distanceText, durationText,
                    attraction != null ? attraction.name() : attractionName,
                    attrLoc));
        }
        return scored;
    }

    /**
     * 生成总结文字。
     */
    private String generateSummary(List<ScoredHotel> hotels, String attraction, int totalCount) {
        if (hotels.isEmpty()) return "暂无符合条件的推荐。";
        var best = hotels.get(0);
        return String.format(
                "从 %d 家酒店中综合评分选出 Top %d。"
                        + "「%s」综合得分最高（%.1f/10），%s%s。",
                totalCount, hotels.size(), best.name(), best.compositeScore(),
                best.distanceScore() >= 8 ? "距" + attraction + "极近"
                        : best.distanceScore() >= 6 ? "距" + attraction + "较近" : "",
                best.ratingScore() >= 8 ? "，评分高" : "");
    }

    // ==================== Markdown 输出 ====================

    /**
     * 将推荐结果转为美观的 Markdown 文本。
     */
    private String toMarkdown(RecommendResult result) {
        List<ScoredHotel> hotels = result.hotels();
        if (hotels.isEmpty()) {
            return "## 🏨 " + result.destination() + " 酒店综合推荐\n\n"
                    + result.summary() + "\n";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("## 🏨 ").append(result.destination())
                .append(" · 综合酒店推荐报告\n\n");
        sb.append("> 🎯 参考景点：**").append(result.attraction())
                .append("**\n");
        sb.append("> 📊 综合维度：价格性价比 · 用户评分 · 距景点距离 · 驾车交通便利度\n\n");
        sb.append("---\n\n");

        String[] medals = {"🥇", "🥈", "🥉", "4️⃣", "5️⃣"};
        for (int i = 0; i < hotels.size(); i++) {
            ScoredHotel h = hotels.get(i);
            String medal = i < medals.length ? medals[i] : (i + 1) + ". ";

            sb.append("### ").append(medal).append(" ")
                    .append(h.name())
                    .append(" · 综合评分 **").append(h.compositeScore()).append("/10**\n\n");

            sb.append("| 维度 | 评分 | 说明 |\n");
            sb.append("|------|------|------|\n");
            if (h.price() != null) sb.append("| 💰 价格 | ").append(h.priceScore())
                    .append("/10 | ¥").append(String.format("%.0f", h.price())).append("/晚 |\n");
            if (h.rating() != null) sb.append("| ⭐ 评分 | ").append(h.ratingScore())
                    .append("/10 | ").append(h.rating()).append(" / 5 |\n");
            sb.append("| 📍 距离 | ").append(h.distanceScore())
                    .append("/10 | 距").append(result.attraction()).append(" ")
                    .append(h.distanceText()).append(" |\n");
            sb.append("| 🚗 驾车 | ").append(h.durationScore())
                    .append("/10 | 约").append(h.durationText()).append(" |\n\n");

            if (h.address() != null) {
                sb.append("- 📍 地址：").append(h.address()).append("\n");
            }
            if (h.bookingUrl() != null) {
                sb.append("- 🔗 [").append(h.name()).append("](").append(h.bookingUrl()).append(")\n");
            } else if (h.imageUrl() != null) {
                sb.append("- ![预览](").append(h.imageUrl()).append(")\n");
            }
            sb.append("\n");
        }

        // 总结表格
        sb.append("---\n\n### 📋 快速对比\n\n");
        sb.append("| 排名 | 酒店 | 价格/晚 | 评分 | 距").append(result.attraction()).append(" | 驾车 | 综合 |\n");
        sb.append("|------|------|---------|------|------|------|------|\n");
        for (int i = 0; i < hotels.size(); i++) {
            ScoredHotel h = hotels.get(i);
            sb.append("| ").append(i + 1).append(" | ");
            if (h.bookingUrl() != null) {
                sb.append("[").append(h.name()).append("](").append(h.bookingUrl()).append(")");
            } else {
                sb.append(h.name());
            }
            sb.append(" | ¥").append(h.price() != null ? String.format("%.0f", h.price()) : "-")
                    .append(" | ").append(h.rating() != null ? h.rating() : "-")
                    .append(" | ").append(h.distanceText())
                    .append(" | ").append(h.durationText())
                    .append(" | **").append(h.compositeScore()).append("** |\n");
        }
        sb.append("\n> 💡 ").append(result.summary()).append("\n");

        return sb.toString();
    }

    private static double round(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
