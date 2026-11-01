package com.ykd.claw.map;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.LocalDate;

import java.io.IOException;

@Service
public class WeatherService {

    private final AmapWebService amapWebService;

    @Autowired
    public WeatherService(AmapWebService amapWebService) {
        this.amapWebService = amapWebService;
    }

    public WeatherService(String apiKey) {
        this(new AmapWebService(apiKey, "https://restapi.amap.com", 5, Duration.ofSeconds(15),
                HttpClient.newHttpClient(), new ObjectMapper()));
    }

    public WeatherResult queryByCity(String cityName) throws IOException {
        if (cityName == null || cityName.isBlank()) {
            throw new IllegalArgumentException("City name is required");
        }
        try {
            return amapWebService.currentWeather(cityName);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("AMap weather request interrupted", e);
        }
    }

    public WeatherForecastResult queryForecastByCity(String cityName, LocalDate date) throws IOException {
        if (cityName == null || cityName.isBlank()) {
            throw new IllegalArgumentException("City name is required");
        }
        if (date == null) throw new IllegalArgumentException("Forecast date is required");
        try {
            return amapWebService.weatherForecast(cityName, date);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("AMap weather forecast request interrupted", e);
        }
    }
}
