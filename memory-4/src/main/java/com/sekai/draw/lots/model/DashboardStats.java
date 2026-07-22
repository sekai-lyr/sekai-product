package com.sekai.draw.lots.model;

public class DashboardStats {
    private int totalCharacters;
    private int totalDraws;
    private int todayDraws;
    private int bestScore;
    private int favoriteCharacters;

    public int getTotalCharacters() { return totalCharacters; }
    public void setTotalCharacters(int totalCharacters) { this.totalCharacters = totalCharacters; }
    public int getTotalDraws() { return totalDraws; }
    public void setTotalDraws(int totalDraws) { this.totalDraws = totalDraws; }
    public int getTodayDraws() { return todayDraws; }
    public void setTodayDraws(int todayDraws) { this.todayDraws = todayDraws; }
    public int getBestScore() { return bestScore; }
    public void setBestScore(int bestScore) { this.bestScore = bestScore; }
    public int getFavoriteCharacters() { return favoriteCharacters; }
    public void setFavoriteCharacters(int favoriteCharacters) { this.favoriteCharacters = favoriteCharacters; }
}
