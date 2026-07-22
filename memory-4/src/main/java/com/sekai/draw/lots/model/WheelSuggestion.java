package com.sekai.draw.lots.model;

public class WheelSuggestion {
    private String title;
    private String detail;
    private Integer weight;
    private String color;
    private String reason;

    public WheelSuggestion() {
    }

    public WheelSuggestion(String title, String detail, Integer weight, String color, String reason) {
        this.title = title;
        this.detail = detail;
        this.weight = weight;
        this.color = color;
        this.reason = reason;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
