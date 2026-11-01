package com.ykd.claw.map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.infrastructure.http.WebHttpClientFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AmapWebService implements MapService {
    private static final String USER_AGENT = "OpenClaw/1.0 (AMap Web Service client)";

    private static final Duration GEOCODE_CACHE_TTL = Duration.ofHours(24);
    private static final int GEOCODE_CACHE_MAX_SIZE = 500;
    private static final Duration PLACE_CACHE_TTL = Duration.ofMinutes(15);
    private static final int PLACE_CACHE_MAX_SIZE = 200;

    private final String apiKey;
    private final String baseUrl;
    private final int maxResults;
    private final Duration timeout;
    private final HttpClient client;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, CachedGeocode> geocodeCache = new ConcurrentHashMap<>();

    // Place search cache
    private record CachedPlace(List<PlaceResult> results, Instant expiresAt) {
        boolean isExpired() { return Instant.now().isAfter(expiresAt); }
    }
    private final ConcurrentHashMap<String, CachedPlace> placeCache = new ConcurrentHashMap<>();

    @Autowired
    public AmapWebService(
            @Value("${amap.api.key:}") String apiKey,
            @Value("${amap.base-url:https://restapi.amap.com}") String baseUrl,
            @Value("${amap.max-results:5}") int maxResults,
            @Value("${amap.timeout:15}") long timeoutSeconds,
            @Value("${web.proxy-url:}") String proxyUrl,
            ObjectMapper objectMapper) {
        this(apiKey, baseUrl, maxResults, Duration.ofSeconds(Math.max(1, timeoutSeconds)),
                WebHttpClientFactory.create(proxyUrl, HttpClient.Redirect.NORMAL), objectMapper);
    }

    AmapWebService(String apiKey, String baseUrl, int maxResults, Duration timeout,
                   HttpClient client, ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.maxResults = Math.max(1, Math.min(10, maxResults));
        this.timeout = timeout;
        this.client = client;
        this.objectMapper = objectMapper;
    }

    @Override
    public List<PlaceResult> searchPlace(String keyword, String city) throws IOException, InterruptedException {
        return searchPlace(keyword, city, "");
    }

    @Override
    public List<PlaceResult> searchPlace(String keyword, String city, String userLocation)
            throws IOException, InterruptedException {
        String normalizedKeyword = required(keyword, "keyword");
        String normalizedCity = optional(city);

        // Check place cache
        String cacheKey = normalizedKeyword + "|" + normalizedCity;
        CachedPlace cached = placeCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) return cached.results();

        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("keywords", normalizedKeyword);
        if (!normalizedCity.isEmpty()) {
            parameters.put("region", normalizedCity);
            parameters.put("city_limit", "true");
        }
        parameters.put("page_size", Integer.toString(maxResults));
        parameters.put("page_num", "1");
        parameters.put("show_fields", "business,photos");

        JsonNode pois = getJson("/v5/place/text", parameters).path("pois");
        if (!pois.isArray()) return List.of();
        List<PlaceResult> results = new ArrayList<>();
        for (JsonNode poi : pois) {
            if (results.size() >= maxResults) break;
            String name = text(poi, "name");
            if (name.isEmpty()) continue;
            JsonNode business = poi.path("business");
            JsonNode photos = poi.path("photos");
            String location = text(poi, "location");
            String openingHours = text(business, "opentime_today");
            if (openingHours.isBlank()) openingHours = text(business, "opentime_week");
            String poiId = text(poi, "id");
            results.add(new PlaceResult(
                    poiId,
                    name,
                    text(poi, "address"),
                    location,
                    text(poi, "cityname"),
                    text(poi, "adname"),
                    firstNonBlank(cuisine(text(poi, "type")), text(poi, "subtype")),
                    text(business, "business_area"),
                    openingHours,
                    text(business, "tel"),
                    text(business, "tag"),
                    decimal(business, "rating"),
                    decimal(business, "cost"),
                    photos.isArray() && !photos.isEmpty() ? text(photos.get(0), "url") : "",
                    mapUrl(location, name, poiId)));
        }
        // 缓存原始搜索结果（cacheKey 不含 location，供不同用户位置复用），
        // 返回前再按当前用户位置做距离排序。
        List<PlaceResult> immutable = List.copyOf(results);
        evictPlaceCache();
        placeCache.put(cacheKey, new CachedPlace(immutable, Instant.now().plus(PLACE_CACHE_TTL)));
        // 用户提供了位置时，按到用户位置的距离由近到远排序
        double[] userCoords = resolveUserCoordinates(userLocation);
        if (userCoords != null && immutable.size() > 1) {
            List<PlaceResult> sorted = new ArrayList<>(immutable);
            sorted.sort((left, right) -> Double.compare(
                    distanceKm(userCoords, coordinates(left.location())),
                    distanceKm(userCoords, coordinates(right.location()))));
            return List.copyOf(sorted);
        }
        return immutable;
    }

    private void evictPlaceCache() {
        if (placeCache.size() >= PLACE_CACHE_MAX_SIZE) {
            placeCache.entrySet().removeIf(e -> e.getValue().isExpired());
        }
    }

    /** 解析用户位置：优先当作经纬度，否则尝试地理编码为坐标。无法解析时返回 null。 */
    private double[] resolveUserCoordinates(String userLocation) {
        if (userLocation == null || userLocation.isBlank()) return null;
        double[] direct = coordinates(userLocation);
        if (direct != null) return direct;
        try {
            String resolved = resolveLocation(userLocation, "userLocation");
            if (!resolved.isBlank()) return coordinates(resolved);
        } catch (Exception ignored) {
            // 地理编码失败不影响主流程
        }
        return null;
    }

    /** 解析 location 字符串（"lng,lat"）为坐标数组，非法时返回 null。 */
    private static double[] coordinates(String location) {
        if (location == null || location.isBlank()) return null;
        String[] values = location.split(",", -1);
        if (values.length != 2) return null;
        try {
            return new double[]{Double.parseDouble(values[0].trim()), Double.parseDouble(values[1].trim())};
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    /** Haversine 公式计算两点（经纬度）之间的球面距离，单位 km。坐标缺失时返回正无穷。 */
    private static double distanceKm(double[] a, double[] b) {
        if (a == null || b == null) return Double.POSITIVE_INFINITY;
        double latitude1 = Math.toRadians(a[1]);
        double latitude2 = Math.toRadians(b[1]);
        double deltaLatitude = latitude2 - latitude1;
        double deltaLongitude = Math.toRadians(b[0] - a[0]);
        double value = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2)
                + Math.cos(latitude1) * Math.cos(latitude2)
                * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
        return 6371.0 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    }

    @Override
    public RouteResult getRoute(String origin, String destination) throws IOException, InterruptedException {
        String normalizedOrigin = required(origin, "origin");
        String normalizedDestination = required(destination, "destination");
        String originLocation = resolveLocation(normalizedOrigin, "origin");
        String destinationLocation = resolveLocation(normalizedDestination, "destination");
        if (originLocation.isBlank() || destinationLocation.isBlank()) {
            return unavailableRoute(normalizedOrigin, normalizedDestination,
                    originLocation, destinationLocation);
        }

        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("origin", originLocation);
        parameters.put("destination", destinationLocation);
        parameters.put("strategy", "32");
        parameters.put("show_fields", "cost,navi");
        JsonNode route = getJson("/v5/direction/driving", parameters).path("route");
        JsonNode paths = route.path("paths");
        if (!paths.isArray() || paths.isEmpty()) {
            return unavailableRoute(normalizedOrigin, normalizedDestination,
                    originLocation, destinationLocation);
        }

        JsonNode path = paths.get(0);
        List<String> instructions = new ArrayList<>();
        JsonNode steps = path.path("steps");
        if (steps.isArray()) {
            for (JsonNode step : steps) {
                String instruction = text(step, "instruction");
                if (!instruction.isEmpty()) instructions.add(instruction);
                if (instructions.size() >= 8) break;
            }
        }
        JsonNode cost = path.path("cost");
        return new RouteResult(
                normalizedOrigin,
                normalizedDestination,
                originLocation,
                destinationLocation,
                number(path, "distance"),
                number(cost, "duration"),
                text(cost, "tolls"),
                text(path, "strategy"),
                List.copyOf(instructions));
    }

    @Override
    public List<GeocodeResult> geocode(String address) throws IOException, InterruptedException {
        String normalizedAddress = required(address, "address");

        // Check cache first
        CachedGeocode cached = geocodeCache.get(normalizedAddress);
        if (cached != null && !cached.isExpired()) {
            return cached.results();
        }

        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("address", normalizedAddress);
        JsonNode geocodes = getJson("/v3/geocode/geo", parameters).path("geocodes");
        if (!geocodes.isArray()) return List.of();

        List<GeocodeResult> results = new ArrayList<>();
        for (JsonNode geocode : geocodes) {
            if (results.size() >= maxResults) break;
            String location = text(geocode, "location");
            if (location.isEmpty()) continue;
            results.add(new GeocodeResult(
                    text(geocode, "formatted_address"),
                    location,
                    text(geocode, "province"),
                    text(geocode, "city"),
                    text(geocode, "district"),
                    text(geocode, "adcode"),
                    text(geocode, "level")));
        }
        List<GeocodeResult> immutable = List.copyOf(results);
        // Evict expired entries and enforce size limit before inserting
        evictGeocodeCache();
        if (geocodeCache.size() >= GEOCODE_CACHE_MAX_SIZE) {
            geocodeCache.entrySet().stream()
                    .min(Map.Entry.comparingByKey())
                    .ifPresent(e -> geocodeCache.remove(e.getKey()));
        }
        geocodeCache.put(normalizedAddress, new CachedGeocode(immutable, Instant.now().plus(GEOCODE_CACHE_TTL)));
        return immutable;
    }

    private void evictGeocodeCache() {
        geocodeCache.entrySet().removeIf(entry -> entry.getValue().isExpired());
    }

    private record CachedGeocode(List<GeocodeResult> results, Instant expiresAt) {
        boolean isExpired() { return Instant.now().isAfter(expiresAt); }
    }

    public WeatherResult currentWeather(String city) throws IOException, InterruptedException {
        String normalizedCity = required(city, "city");
        List<GeocodeResult> geocodes = geocode(normalizedCity);
        if (geocodes.isEmpty() || geocodes.get(0).adcode().isBlank()) {
            return unavailableCurrentWeather(normalizedCity);
        }
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("city", geocodes.get(0).adcode());
        parameters.put("extensions", "base");
        JsonNode lives = getJson("/v3/weather/weatherInfo", parameters).path("lives");
        if (!lives.isArray() || lives.isEmpty()) {
            return unavailableCurrentWeather(normalizedCity);
        }
        JsonNode live = lives.get(0);
        WeatherResult result = new WeatherResult();
        result.setCity(text(live, "city"));
        result.setDescription(text(live, "weather"));
        result.setTemperature(text(live, "temperature"));
        result.setHumidity(text(live, "humidity"));
        result.setWind(text(live, "winddirection"));
        result.setWindSpeed(text(live, "windpower"));
        result.setReportTime(text(live, "reporttime"));
        return result;
    }

    public WeatherForecastResult weatherForecast(String city, LocalDate date)
            throws IOException, InterruptedException {
        String normalizedCity = required(city, "city");
        if (date == null) throw new IllegalArgumentException("date is required");
        List<GeocodeResult> geocodes = geocode(normalizedCity);
        if (geocodes.isEmpty() || geocodes.get(0).adcode().isBlank()) {
            return unavailableForecast(normalizedCity, date);
        }
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("city", geocodes.get(0).adcode());
        parameters.put("extensions", "all");
        JsonNode forecasts = getJson("/v3/weather/weatherInfo", parameters).path("forecasts");
        if (!forecasts.isArray() || forecasts.isEmpty()) {
            return unavailableForecast(normalizedCity, date);
        }
        JsonNode forecast = forecasts.get(0);
        JsonNode casts = forecast.path("casts");
        if (casts.isArray()) {
            for (JsonNode cast : casts) {
                if (date.toString().equals(text(cast, "date"))) {
                    return new WeatherForecastResult(
                            firstNonBlank(text(forecast, "city"), normalizedCity),
                            date,
                            text(cast, "dayweather"),
                            text(cast, "nightweather"),
                            text(cast, "daytemp"),
                            text(cast, "nighttemp"),
                            text(cast, "daywind"),
                            text(cast, "nightwind"),
                            text(cast, "daypower"),
                            text(cast, "nightpower"),
                            text(forecast, "reporttime"));
                }
            }
        }
        return unavailableForecast(normalizedCity, date);
    }

    private String resolveLocation(String value, String fieldName) throws IOException, InterruptedException {
        if (isCoordinate(value)) return value.replaceAll("\\s+", "");
        List<GeocodeResult> results = geocode(value);
        return results.isEmpty() ? "" : results.get(0).location();
    }

    private JsonNode getJson(String path, Map<String, String> parameters)
            throws IOException, InterruptedException {
        if (apiKey.isEmpty()) {
            throw new IllegalStateException("AMap is not configured; set amap.api.key or AMAP_API_KEY");
        }
        Map<String, String> query = new LinkedHashMap<>();
        query.put("key", apiKey);
        query.putAll(parameters);
        query.put("output", "JSON");

        StringBuilder url = new StringBuilder(baseUrl).append(path).append('?');
        query.forEach((name, value) -> url.append(encode(name)).append('=').append(encode(value)).append('&'));
        url.setLength(url.length() - 1);
        HttpRequest request = HttpRequest.newBuilder(URI.create(url.toString()))
                .timeout(timeout)
                .header("Accept", "application/json")
                .header("User-Agent", USER_AGENT)
                .GET()
                .build();
        HttpResponse<String> response = client.send(request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("AMap request failed: HTTP " + response.statusCode());
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(response.body());
        } catch (Exception e) {
            throw new IOException("AMap returned invalid JSON", e);
        }
        if (!"1".equals(text(root, "status"))) {
            throw new IOException("AMap request failed: " + text(root, "info")
                    + " (infocode=" + text(root, "infocode") + ")");
        }
        return root;
    }

    private static RouteResult unavailableRoute(String origin, String destination,
                                                String originLocation, String destinationLocation) {
        return new RouteResult(origin, destination, originLocation, destinationLocation,
                0, 0, "", "暂无可用驾车路线", List.of());
    }

    private static WeatherResult unavailableCurrentWeather(String city) {
        WeatherResult result = new WeatherResult();
        result.setCity(city);
        result.setDescription("暂无实时天气数据");
        return result;
    }

    private static WeatherForecastResult unavailableForecast(String city, LocalDate date) {
        return new WeatherForecastResult(city, date, "暂无天气预报数据", "", "", "",
                "", "", "", "", "");
    }

    private static boolean isCoordinate(String value) {
        String[] parts = value.replaceAll("\\s+", "").split(",", -1);
        if (parts.length != 2) return false;
        try {
            double longitude = Double.parseDouble(parts[0]);
            double latitude = Double.parseDouble(parts[1]);
            return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private static String text(JsonNode parent, String fieldName) {
        if (parent == null || parent.isMissingNode() || parent.isNull()) return "";
        JsonNode value = parent.path(fieldName);
        if (value.isArray()) {
            return value.isEmpty() ? "" : value.get(0).asText("").trim();
        }
        return value.isValueNode() ? value.asText("").trim() : "";
    }

    private static long number(JsonNode parent, String fieldName) {
        String value = text(parent, fieldName);
        if (value.isEmpty()) return 0;
        try {
            return Math.round(Double.parseDouble(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static Double decimal(JsonNode parent, String fieldName) {
        String value = text(parent, fieldName);
        if (value.isEmpty()) return null;
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static String firstNonBlank(String first, String second) {
        return first == null || first.isBlank() ? second : first;
    }

    /**
     * 从高德 type 字段（如 "餐饮服务;中餐厅;杭州菜"）提取最具体的菜系/子类。
     * 高德 type 用分号分隔大类;中类;小类，取最后一个非空子类作为菜系展示，
     * 同时避免 "餐饮服务" 这类无区分度的顶层分类。
     */
    private static String cuisine(String type) {
        if (type == null || type.isBlank()) return "";
        String[] parts = type.split(";");
        for (int i = parts.length - 1; i >= 0; i--) {
            String candidate = parts[i].trim();
            if (candidate.isEmpty()) continue;
            if (i == 0) return candidate;
            // 跳过无区分度的顶层分类
            if (isGenericCategory(candidate)) continue;
            return candidate;
        }
        return type.trim();
    }

    private static boolean isGenericCategory(String category) {
        if (category == null) return true;
        return category.equals("餐饮服务") || category.equals("美食") || category.equals("中餐厅")
                || category.equals("餐厅") || category.equals("旅游服务") || category.equals("风景名胜")
                || category.equals("购物服务") || category.equals("休闲服务") || category.equals("住宿服务");
    }

    static String mapUrl(String location, String name) {
        return mapUrl(location, name, "");
    }

    /**
     * 生成高德链接。
     * 优先用 POI id 生成 poidetail 详情链接（打开后能看到餐厅完整信息：菜系/评分/人均/营业时间/图片），
     * 仅当没有 POI id 时才降级为 marker 定位链接。
     */
    static String mapUrl(String location, String name, String poiId) {
        if (poiId != null && !poiId.isBlank()) {
            return "https://uri.amap.com/poidetail?poiid=" + encode(poiId)
                    + "&src=openclaw&callnative=0";
        }
        if (location == null || location.isBlank()) return "";
        return "https://uri.amap.com/marker?position=" + encode(location.trim())
                + "&name=" + encode(name == null ? "" : name.trim())
                + "&src=openclaw&callnative=0";
    }

    private static String required(String value, String fieldName) {
        String result = optional(value);
        if (result.isEmpty()) throw new IllegalArgumentException(fieldName + " is required");
        if (result.length() > 300) {
            throw new IllegalArgumentException(fieldName + " must not exceed 300 characters");
        }
        return result;
    }

    private static String optional(String value) {
        return value == null ? "" : value.trim();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) return "https://restapi.amap.com";
        String result = value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }
}
