package com.sekai.draw.lots.model;

import java.util.List;

public class FortuneInsight {
    private int totalDraws;
    private int averageScore;
    private int bestScore;
    private int streakDays;
    private List<InsightMetric> moodStats = List.of();
    private List<InsightMetric> characterStats = List.of();
    private List<InsightMetric> wishStats = List.of();
    private List<DrawRecord> recentHighScoreRecords = List.of();

    public int getTotalDraws() { return totalDraws; }
    public void setTotalDraws(int totalDraws) { this.totalDraws = totalDraws; }
    public int getAverageScore() { return averageScore; }
    public void setAverageScore(int averageScore) { this.averageScore = averageScore; }
    public int getBestScore() { return bestScore; }
    public void setBestScore(int bestScore) { this.bestScore = bestScore; }
    public int getStreakDays() { return streakDays; }
    public void setStreakDays(int streakDays) { this.streakDays = streakDays; }
    public List<InsightMetric> getMoodStats() { return moodStats; }
    public void setMoodStats(List<InsightMetric> moodStats) { this.moodStats = moodStats; }
    public List<InsightMetric> getCharacterStats() { return characterStats; }
    public void setCharacterStats(List<InsightMetric> characterStats) { this.characterStats = characterStats; }
    public List<InsightMetric> getWishStats() { return wishStats; }
    public void setWishStats(List<InsightMetric> wishStats) { this.wishStats = wishStats; }
    public List<DrawRecord> getRecentHighScoreRecords() { return recentHighScoreRecords; }
    public void setRecentHighScoreRecords(List<DrawRecord> recentHighScoreRecords) { this.recentHighScoreRecords = recentHighScoreRecords; }
}
