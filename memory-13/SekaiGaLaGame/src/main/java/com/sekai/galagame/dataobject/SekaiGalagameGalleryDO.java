package com.sekai.galagame.dataobject;

public class SekaiGalagameGalleryDO {
    private Long id;
    private Long userId;
    private String imageKey;
    private java.time.LocalDateTime unlockTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getImageKey() { return imageKey; }
    public void setImageKey(String imageKey) { this.imageKey = imageKey; }
    public java.time.LocalDateTime getUnlockTime() { return unlockTime; }
    public void setUnlockTime(java.time.LocalDateTime unlockTime) { this.unlockTime = unlockTime; }
}
