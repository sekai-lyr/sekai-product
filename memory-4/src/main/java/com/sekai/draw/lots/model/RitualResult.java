package com.sekai.draw.lots.model;

import java.util.ArrayList;
import java.util.List;

public class RitualResult {
    private List<RitualCard> cards = new ArrayList<>();
    private Integer overallScore;
    private String rhythm;
    private String summary;
    private String actionPlan;
    private String luckyColor;
    private String luckyItem;

    public List<RitualCard> getCards() { return cards; }
    public void setCards(List<RitualCard> cards) { this.cards = cards; }
    public Integer getOverallScore() { return overallScore; }
    public void setOverallScore(Integer overallScore) { this.overallScore = overallScore; }
    public String getRhythm() { return rhythm; }
    public void setRhythm(String rhythm) { this.rhythm = rhythm; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getActionPlan() { return actionPlan; }
    public void setActionPlan(String actionPlan) { this.actionPlan = actionPlan; }
    public String getLuckyColor() { return luckyColor; }
    public void setLuckyColor(String luckyColor) { this.luckyColor = luckyColor; }
    public String getLuckyItem() { return luckyItem; }
    public void setLuckyItem(String luckyItem) { this.luckyItem = luckyItem; }
}
