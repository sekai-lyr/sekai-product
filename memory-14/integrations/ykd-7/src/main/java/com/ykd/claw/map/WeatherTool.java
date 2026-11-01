package com.ykd.claw.map;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

@Component
public final class WeatherTool implements ToolProvider {
    private final WeatherService service;

    public WeatherTool(String apiKey) {
        this(new WeatherService(apiKey));
    }

    @Autowired
    public WeatherTool(WeatherService service) {
        this.service = service;
    }

    @Tool(name = "query_weather", description = "Get current weather from AMap for a city in China.")
    public String queryWeather(@ToolParam(description = "City name, for example Hangzhou") String city) throws Exception {
        if (city == null || city.isBlank()) throw new IllegalArgumentException("city is required");
        return service.queryByCity(city).toString();
    }

    @Tool(name = "query_weather_forecast",
            description = "Get AMap weather forecast for a Chinese city on a specific ISO date.")
    public String queryWeatherForecast(
            @ToolParam(description = "City name, for example Hangzhou") String city,
            @ToolParam(description = "Forecast date in yyyy-MM-dd format") String date) throws Exception {
        if (city == null || city.isBlank()) throw new IllegalArgumentException("city is required");
        try {
            return service.queryForecastByCity(city, LocalDate.parse(date)).toString();
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("date must use yyyy-MM-dd format", e);
        }
    }
}
