package com.sekai.galagame.model;

import java.time.LocalDateTime;

public class SaveInfo {
    private Long id;
    private Integer slotNo;
    private String chapterTitle;
    private String progress;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getSlotNo() { return slotNo; }
    public void setSlotNo(Integer slotNo) { this.slotNo = slotNo; }
    public String getChapterTitle() { return chapterTitle; }
    public void setChapterTitle(String chapterTitle) { this.chapterTitle = chapterTitle; }
    public String getProgress() { return progress; }
    public void setProgress(String progress) { this.progress = progress; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
