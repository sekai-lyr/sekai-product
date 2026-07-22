package com.sekai.draw.lots.dataobject;

import com.sekai.draw.lots.model.DrawRecord;
import org.springframework.beans.BeanUtils;

import java.time.LocalDateTime;

public class SekaiDrawLotsRecordDO {
    private Long id;
    private Long userId;
    private Long characterId;
    private Long fortuneId;
    private Integer luckScore;
    private String mood;
    private String wishTopic;
    private String message;
    private LocalDateTime drawTime;

    public DrawRecord convertToRecord() {
        DrawRecord record = new DrawRecord();
        BeanUtils.copyProperties(this, record);
        return record;
    }

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
}
