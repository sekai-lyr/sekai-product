package com.sekai.galagame.model;

import java.time.LocalDateTime;

public class EndingVO {
    private String endingKey;
    private String title;
    private String description;
    private String bgImage;
    private String bgUrl;
    private boolean unlocked;
    private LocalDateTime unlockTime;

    public String getEndingKey() { return endingKey; }
    public void setEndingKey(String endingKey) { this.endingKey = endingKey; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getBgImage() { return bgImage; }
    public void setBgImage(String bgImage) { this.bgImage = bgImage; }
    public String getBgUrl() { return bgUrl; }
    public void setBgUrl(String bgUrl) { this.bgUrl = bgUrl; }
    public boolean isUnlocked() { return unlocked; }
    public void setUnlocked(boolean unlocked) { this.unlocked = unlocked; }
    public LocalDateTime getUnlockTime() { return unlockTime; }
    public void setUnlockTime(LocalDateTime unlockTime) { this.unlockTime = unlockTime; }
}
