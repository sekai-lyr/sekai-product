package com.sekai.draw.lots.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class WheelSpinRecord {
    private Long deckId;

    private static final DateTimeFormatter DISPLAY_FORMATTER = DateTimeFormatter.ofPattern("MM-dd HH:mm");

    private Long id;
    private Long userId;
    private Long optionId;
    private String resultTitle;
    private String resultDetail;
    private String resultColor;
    private String moodLine;
    private LocalDateTime createTime;

    public String getCreateTimeText() {
        return createTime == null ? "" : DISPLAY_FORMATTER.format(createTime);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getOptionId() { return optionId; }
    public void setOptionId(Long optionId) { this.optionId = optionId; }
    public String getResultTitle() { return resultTitle; }
    public void setResultTitle(String resultTitle) { this.resultTitle = resultTitle; }
    public String getResultDetail() { return resultDetail; }
    public void setResultDetail(String resultDetail) { this.resultDetail = resultDetail; }
    public String getResultColor() { return resultColor; }
    public void setResultColor(String resultColor) { this.resultColor = resultColor; }
    public String getMoodLine() { return moodLine; }
    public void setMoodLine(String moodLine) { this.moodLine = moodLine; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public Long getDeckId() { return deckId; }
    public void setDeckId(Long deckId) { this.deckId = deckId; }
}
