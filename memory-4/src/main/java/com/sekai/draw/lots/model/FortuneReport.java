package com.sekai.draw.lots.model;

import java.util.ArrayList;
import java.util.List;

public class FortuneReport {
    private String title;
    private String summary;
    private String momentum;
    private String riskLevel;
    private String nextAction;
    private Integer recentAverage;
    private Integer highestScore;
    private Integer lowestScore;
    private Integer volatility;
    private List<ReportPoint> points = new ArrayList<>();

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getMomentum() { return momentum; }
    public void setMomentum(String momentum) { this.momentum = momentum; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getNextAction() { return nextAction; }
    public void setNextAction(String nextAction) { this.nextAction = nextAction; }
    public Integer getRecentAverage() { return recentAverage; }
    public void setRecentAverage(Integer recentAverage) { this.recentAverage = recentAverage; }
    public Integer getHighestScore() { return highestScore; }
    public void setHighestScore(Integer highestScore) { this.highestScore = highestScore; }
    public Integer getLowestScore() { return lowestScore; }
    public void setLowestScore(Integer lowestScore) { this.lowestScore = lowestScore; }
    public Integer getVolatility() { return volatility; }
    public void setVolatility(Integer volatility) { this.volatility = volatility; }
    public List<ReportPoint> getPoints() { return points; }
    public void setPoints(List<ReportPoint> points) { this.points = points; }
}
