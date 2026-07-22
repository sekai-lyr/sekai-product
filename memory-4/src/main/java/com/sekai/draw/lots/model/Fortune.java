package com.sekai.draw.lots.model;

public class Fortune {
    private Long id;
    private String title;
    private String levelName;
    private Integer luckScore;
    private String advice;
    private String luckyColor;
    private String luckyItem;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getLevelName() { return levelName; }
    public void setLevelName(String levelName) { this.levelName = levelName; }
    public Integer getLuckScore() { return luckScore; }
    public void setLuckScore(Integer luckScore) { this.luckScore = luckScore; }
    public String getAdvice() { return advice; }
    public void setAdvice(String advice) { this.advice = advice; }
    public String getLuckyColor() { return luckyColor; }
    public void setLuckyColor(String luckyColor) { this.luckyColor = luckyColor; }
    public String getLuckyItem() { return luckyItem; }
    public void setLuckyItem(String luckyItem) { this.luckyItem = luckyItem; }
}
