package com.sekai.draw.lots.model;

import java.time.LocalDateTime;

public class DrawRecord {
    private boolean favorited;
    public boolean isFavorited() { return favorited; }
    public void setFavorited(boolean favorited) { this.favorited = favorited; }
    private String drawType = "RANDOM";
    private String ritualId;
    private Long wishId;
    private java.time.LocalDate dailyDate;

    private Long id;
    private Long userId;
    private Long characterId;
    private Long fortuneId;
    private Integer luckScore;
    private String mood;
    private String wishTopic;
    private String message;
    private LocalDateTime drawTime;
    private AnimeCharacter character;
    private Fortune fortune;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getCharacterId() { return characterId; }
    public void setCharacterId(Long characterId) { this.characterId = characterId; }
    public Long getFortuneId() { return fortuneId; }
    public void setFortuneId(Long fortuneId) { this.fortuneId = fortuneId; }
    public Integer getLuckScore() { return luckScore; }
    public void setLuckScore(Integer luckScore) { this.luckScore = luckScore; }
    public String getMood() { return mood; }
    public void setMood(String mood) { this.mood = mood; }
    public String getWishTopic() { return wishTopic; }
    public void setWishTopic(String wishTopic) { this.wishTopic = wishTopic; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public LocalDateTime getDrawTime() { return drawTime; }
    public void setDrawTime(LocalDateTime drawTime) { this.drawTime = drawTime; }
    public AnimeCharacter getCharacter() { return character; }
    public void setCharacter(AnimeCharacter character) { this.character = character; }
    public Fortune getFortune() { return fortune; }
    public void setFortune(Fortune fortune) { this.fortune = fortune; }
    public String getDrawType() { return drawType; }
    public void setDrawType(String drawType) { this.drawType = drawType; }
    public String getRitualId() { return ritualId; }
    public void setRitualId(String ritualId) { this.ritualId = ritualId; }
    public Long getWishId() { return wishId; }
    public void setWishId(Long wishId) { this.wishId = wishId; }
    public java.time.LocalDate getDailyDate() { return dailyDate; }
    public void setDailyDate(java.time.LocalDate dailyDate) { this.dailyDate = dailyDate; }
}
