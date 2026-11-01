package com.ykd.claw.map;

import java.time.LocalDate;

public record WeatherForecastResult(
        String city,
        LocalDate date,
        String dayWeather,
        String nightWeather,
        String dayTemperature,
        String nightTemperature,
        String dayWind,
        String nightWind,
        String dayWindPower,
        String nightWindPower,
        String reportTime) {

    @Override
    public String toString() {
        if (dayTemperature == null || dayTemperature.isBlank()) {
            return "%s %s：%s".formatted(city, date,
                    dayWeather == null || dayWeather.isBlank() ? "暂无天气预报数据" : dayWeather);
        }
        return "%s %s：白天%s %s℃，夜间%s %s℃，白天%s风%s级，夜间%s风%s级（%s发布）"
                .formatted(city, date, dayWeather, dayTemperature, nightWeather, nightTemperature,
                        dayWind, dayWindPower, nightWind, nightWindPower, reportTime);
    }
}
