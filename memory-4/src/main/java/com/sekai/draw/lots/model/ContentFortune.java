package com.sekai.draw.lots.model;

public class ContentFortune {
    private Long id;
    private String levelName;
    private int scoreMin;
    private int scoreMax;
    private String luckyColor;
    private String luckyItem;
    private String summary;
    private String advice;
    private boolean enabled = true;
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getLevelName() { return levelName; }
    public void setLevelName(String levelName) { this.levelName = levelName; }
    public int getScoreMin() { return scoreMin; }
    public void setScoreMin(int scoreMin) { this.scoreMin = scoreMin; }
    public int getScoreMax() { return scoreMax; }
    public void setScoreMax(int scoreMax) { this.scoreMax = scoreMax; }
    public String getLuckyColor() { return luckyColor; }
    public void setLuckyColor(String luckyColor) { this.luckyColor = luckyColor; }
    public String getLuckyItem() { return luckyItem; }
    public void setLuckyItem(String luckyItem) { this.luckyItem = luckyItem; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getAdvice() { return advice; }
    public void setAdvice(String advice) { this.advice = advice; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
