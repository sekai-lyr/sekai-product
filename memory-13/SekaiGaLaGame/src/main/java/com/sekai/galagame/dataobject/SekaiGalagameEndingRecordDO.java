package com.sekai.galagame.dataobject;

public class SekaiGalagameEndingRecordDO {
    private Long id;
    private Long userId;
    private String endingKey;
    private java.time.LocalDateTime unlockTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getEndingKey() { return endingKey; }
    public void setEndingKey(String endingKey) { this.endingKey = endingKey; }
    public java.time.LocalDateTime getUnlockTime() { return unlockTime; }
    public void setUnlockTime(java.time.LocalDateTime unlockTime) { this.unlockTime = unlockTime; }
}
