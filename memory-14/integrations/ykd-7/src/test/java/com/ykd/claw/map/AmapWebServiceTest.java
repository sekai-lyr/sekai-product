package com.ykd.claw.map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AmapWebServiceTest {
    private HttpServer server;
    private AmapWebService service;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v5/place/text", exchange -> respond(exchange, """
                {"status":"1","info":"OK","infocode":"10000","pois":[{
                  "id":"B001","name":"West Lake Restaurant","type":"Restaurant",
                  "address":"No. 1 Longjing Road","location":"120.148926,30.242111",
                  "cityname":"Hangzhou","adname":"Xihu",
                  "business":{"business_area":"West Lake","opentime_today":"10:00-22:00",
                    "tel":"0571-12345678","tag":"Local cuisine","rating":"4.7","cost":"88"},
                  "photos":[{"url":"https://example.test/restaurant.jpg"}]
                }]}
                """));
        server.createContext("/v3/geocode/geo", exchange -> {
            String query = URLDecoder.decode(exchange.getRequestURI().getRawQuery(), StandardCharsets.UTF_8);
            String location = query.contains("Hangzhou East Railway Station")
                    ? "120.212001,30.290850" : "120.148926,30.242111";
            respond(exchange, """
                    {"status":"1","info":"OK","infocode":"10000","geocodes":[{
                      "formatted_address":"Hangzhou test address","province":"Zhejiang","city":"Hangzhou",
                      "district":"Xihu","adcode":"330106","location":"%s","level":"POI"
                    }]}
                    """.formatted(location));
        });
        server.createContext("/v5/direction/driving", exchange -> respond(exchange, """
                {"status":"1","info":"OK","infocode":"10000","route":{"paths":[{
                  "distance":"12500","strategy":"Recommended",
                  "cost":{"duration":"1800","tolls":"0","traffic_lights":"12"},
                  "steps":[{"instruction":"Drive east for 100 meters"},{"instruction":"Turn right"}]
                }]}}
                """));
        server.createContext("/v3/weather/weatherInfo", exchange -> {
            String query = URLDecoder.decode(exchange.getRequestURI().getRawQuery(), StandardCharsets.UTF_8);
            if (query.contains("extensions=all")) {
                respond(exchange, """
                        {"status":"1","info":"OK","infocode":"10000","forecasts":[{
                          "city":"Hangzhou","adcode":"330106","province":"Zhejiang",
                          "reporttime":"2026-07-31 10:00:00","casts":[{
                            "date":"2026-08-02","week":"7","dayweather":"Cloudy",
                            "nightweather":"Rain","daytemp":"34","nighttemp":"27",
                            "daywind":"south","nightwind":"south",
                            "daypower":"3","nightpower":"3"
                          }]
                        }]}
                        """);
            } else {
                respond(exchange, """
                        {"status":"1","info":"OK","infocode":"10000","lives":[{
                          "province":"Zhejiang","city":"Hangzhou","adcode":"330106",
                          "weather":"Sunny","temperature":"31","winddirection":"east",
                          "windpower":"3","humidity":"55","reporttime":"2026-07-24 10:00:00"
                        }]}
                        """);
            }
        });
        server.start();
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        service = new AmapWebService("test-key", baseUrl, 5, Duration.ofSeconds(2),
                HttpClient.newHttpClient(), new ObjectMapper());
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void searchesPlacesAndParsesCompactResults() throws Exception {
        List<PlaceResult> results = service.searchPlace("West Lake", "Hangzhou");
        assertEquals(1, results.size());
        assertEquals("West Lake Restaurant", results.get(0).name());
        assertEquals("120.148926,30.242111", results.get(0).location());
        assertEquals("Xihu", results.get(0).district());
        assertEquals(4.7, results.get(0).rating());
        assertEquals(88.0, results.get(0).averageCost());
        assertEquals("10:00-22:00", results.get(0).openingHours());
        assertEquals("Local cuisine", results.get(0).tags());
        assertEquals("https://example.test/restaurant.jpg", results.get(0).photoUrl());
        assertEquals("B001", results.get(0).id());
        // 有 POI id 时优先生成 poidetail 详情链接（可查看菜系、评分等完整信息）
        assertTrue(results.get(0).mapUrl().startsWith("https://uri.amap.com/poidetail?poiid=B001"));
    }

    @Test
    void fallsBackToMarkerLinkWhenPoiIdIsMissing() throws Exception {
        server.removeContext("/v5/place/text");
        server.createContext("/v5/place/text", exchange -> respond(exchange, """
                {"status":"1","info":"OK","infocode":"10000","pois":[{
                  "id":"","name":"No Id Restaurant","type":"Restaurant",
                  "address":"No. 2 Longjing Road","location":"120.148926,30.242111",
                  "cityname":"Hangzhou","adname":"Xihu",
                  "business":{"business_area":"West Lake","tag":"Local cuisine","rating":"4.5"},
                  "photos":[]
                }]}
                """));
        List<PlaceResult> results = service.searchPlace("Restaurant", "Hangzhou");
        assertEquals(1, results.size());
        assertEquals("", results.get(0).id());
        assertTrue(results.get(0).mapUrl().startsWith(
                "https://uri.amap.com/marker?position=120.148926%2C30.242111"));
        assertTrue(results.get(0).mapUrl().contains("name=No+Id+Restaurant"));
    }

    @Test
    void geocodesAnAddress() throws Exception {
        List<GeocodeResult> results = service.geocode("West Lake, Hangzhou");
        assertEquals(1, results.size());
        assertEquals("Hangzhou test address", results.get(0).formattedAddress());
        assertEquals("330106", results.get(0).adcode());
    }

    @Test
    void geocodesTextLocationsBeforePlanningDrivingRoute() throws Exception {
        RouteResult route = service.getRoute("Hangzhou East Railway Station", "West Lake");
        assertEquals("120.212001,30.290850", route.originLocation());
        assertEquals("120.148926,30.242111", route.destinationLocation());
        assertEquals(12_500, route.distanceMeters());
        assertEquals(1_800, route.durationSeconds());
        assertEquals(List.of("Drive east for 100 meters", "Turn right"), route.instructions());
    }

    @Test
    void acceptsCoordinatesWithoutGeocoding() throws Exception {
        RouteResult route = service.getRoute("120.1, 30.2", "120.2,30.3");
        assertEquals("120.1,30.2", route.originLocation());
        assertEquals("120.2,30.3", route.destinationLocation());
        assertTrue(route.strategy().contains("Recommended"));
    }

    @Test
    void resolvesCityCodeAndReturnsCurrentWeather() throws Exception {
        var weather = service.currentWeather("Hangzhou");
        assertEquals("Hangzhou", weather.getCity());
        assertEquals("Sunny", weather.getDescription());
        assertEquals("31", weather.getTemperature());
        assertEquals("55", weather.getHumidity());
        assertEquals("2026-07-24 10:00:00", weather.getReportTime());
    }

    @Test
    void returnsForecastForRequestedDate() throws Exception {
        var forecast = service.weatherForecast("Hangzhou", java.time.LocalDate.of(2026, 8, 2));
        assertEquals("Hangzhou", forecast.city());
        assertEquals("Cloudy", forecast.dayWeather());
        assertEquals("Rain", forecast.nightWeather());
        assertEquals("34", forecast.dayTemperature());
    }

    @Test
    void returnsBusinessNoDataInsteadOfThrowingForAnUnavailableRoute() throws Exception {
        server.removeContext("/v5/direction/driving");
        server.createContext("/v5/direction/driving", exchange -> respond(exchange, """
                {"status":"1","info":"OK","infocode":"10000","route":{"paths":[]}}
                """));

        RouteResult route = service.getRoute("Hangzhou East Railway Station", "West Lake");

        assertEquals(0, route.distanceMeters());
        assertEquals("暂无可用驾车路线", route.strategy());
    }

    @Test
    void returnsBusinessNoDataForADateOutsideTheForecastWindow() throws Exception {
        var forecast = service.weatherForecast("Hangzhou", java.time.LocalDate.of(2026, 8, 20));

        assertEquals("暂无天气预报数据", forecast.dayWeather());
        assertTrue(forecast.toString().contains("暂无天气预报数据"));
    }

    private static void respond(HttpExchange exchange, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
