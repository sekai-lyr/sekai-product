package com.sekai.draw.lots.dataobject;

import com.sekai.draw.lots.model.WheelSpinRecord;
import org.springframework.beans.BeanUtils;

import java.time.LocalDateTime;

public class SekaiDrawLotsWheelSpinDO {
    private Long id;
    private Long userId;
    private Long optionId;
    private String resultTitle;
    private String resultDetail;
    private String resultColor;
    private String moodLine;
    private LocalDateTime createTime;

    public WheelSpinRecord convertToRecord() {
        WheelSpinRecord record = new WheelSpinRecord();
        BeanUtils.copyProperties(this, record);
        return record;
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
}
