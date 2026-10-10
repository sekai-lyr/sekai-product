package com.sekai.dataobject.dataobject;

import com.sekai.dataobject.model.Quote;
import org.springframework.beans.BeanUtils;

import java.time.LocalDateTime;

public class SekaiDataObjectQuoteDO {

    private Long id;

    private Long seriesId;

    private Long characterId;

    private String characterName;

    private String content;

    private Integer episode;

    private Double timePoint;

    private String audioUrl;

    private LocalDateTime createTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSeriesId() {
        return seriesId;
    }

    public void setSeriesId(Long seriesId) {
        this.seriesId = seriesId;
    }

    public Long getCharacterId() {
        return characterId;
    }

    public void setCharacterId(Long characterId) {
        this.characterId = characterId;
    }

    public String getCharacterName() {
        return characterName;
    }

    public void setCharacterName(String characterName) {
        this.characterName = characterName;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Integer getEpisode() {
        return episode;
    }

    public void setEpisode(Integer episode) {
        this.episode = episode;
    }

    public Double getTimePoint() {
        return timePoint;
    }

    public void setTimePoint(Double timePoint) {
        this.timePoint = timePoint;
    }

    public String getAudioUrl() {
        return audioUrl;
    }

    public void setAudioUrl(String audioUrl) {
        this.audioUrl = audioUrl;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }

    public SekaiDataObjectQuoteDO() {
    }

    public SekaiDataObjectQuoteDO(Quote quote) {
        BeanUtils.copyProperties(quote, this);
    }

    public Quote convertToQuote() {
        Quote quote = new Quote();
        BeanUtils.copyProperties(this, quote);
        return quote;
    }
}
