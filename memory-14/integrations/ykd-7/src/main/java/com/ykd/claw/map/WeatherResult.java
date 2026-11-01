package com.ykd.claw.map;

public class WeatherResult {

    private String city;
    private String description;
    private String temperature;
    private String tempMin;
    private String tempMax;
    private String humidity;
    private String wind;
    private String windSpeed;
    private String reportTime;

    public WeatherResult() {}

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTemperature() { return temperature; }
    public void setTemperature(String temperature) { this.temperature = temperature; }
    public String getTempMin() { return tempMin; }
    public void setTempMin(String tempMin) { this.tempMin = tempMin; }
    public String getTempMax() { return tempMax; }
    public void setTempMax(String tempMax) { this.tempMax = tempMax; }
    public String getHumidity() { return humidity; }
    public void setHumidity(String humidity) { this.humidity = humidity; }
    public String getWind() { return wind; }
    public void setWind(String wind) { this.wind = wind; }
    public String getWindSpeed() { return windSpeed; }
    public void setWindSpeed(String windSpeed) { this.windSpeed = windSpeed; }
    public String getReportTime() { return reportTime; }
    public void setReportTime(String reportTime) { this.reportTime = reportTime; }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(city != null ? city : "?");
        sb.append(": ").append(description != null ? description : "?").append(", ");
        if (temperature != null) sb.append(temperature).append("℃");
        if (tempMin != null) sb.append(" (").append(tempMin).append("~");
        if (tempMax != null) sb.append(tempMax).append(")");
        if (humidity != null) sb.append(" 湿").append(humidity).append("%");
        if (wind != null && !wind.isBlank()) sb.append(" ").append(wind);
        if (windSpeed != null && !windSpeed.isBlank()) sb.append("风").append(windSpeed).append("级");
        if (reportTime != null && !reportTime.isBlank()) sb.append("（").append(reportTime).append("发布）");
        return sb.toString();
    }
}
