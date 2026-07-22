package com.sekai.draw.lots.model;

import java.util.List;

public class VipCoachPlan {
    private String title;
    private String summary;
    private String rhythm;
    private String riskLevel;
    private String primaryTheme;
    private Integer averageScore;
    private Integer highScore;
    private Integer lowScore;
    private Integer totalSamples;
    private List<String> signals;
    private List<CoachStep> steps;
    private List<DrawRecord> basisRecords;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getRhythm() { return rhythm; }
    public void setRhythm(String rhythm) { this.rhythm = rhythm; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getPrimaryTheme() { return primaryTheme; }
    public void setPrimaryTheme(String primaryTheme) { this.primaryTheme = primaryTheme; }
    public Integer getAverageScore() { return averageScore; }
    public void setAverageScore(Integer averageScore) { this.averageScore = averageScore; }
    public Integer getHighScore() { return highScore; }
    public void setHighScore(Integer highScore) { this.highScore = highScore; }
    public Integer getLowScore() { return lowScore; }
    public void setLowScore(Integer lowScore) { this.lowScore = lowScore; }
    public Integer getTotalSamples() { return totalSamples; }
    public void setTotalSamples(Integer totalSamples) { this.totalSamples = totalSamples; }
    public List<String> getSignals() { return signals; }
    public void setSignals(List<String> signals) { this.signals = signals; }
    public List<CoachStep> getSteps() { return steps; }
    public void setSteps(List<CoachStep> steps) { this.steps = steps; }
    public List<DrawRecord> getBasisRecords() { return basisRecords; }
    public void setBasisRecords(List<DrawRecord> basisRecords) { this.basisRecords = basisRecords; }
}
