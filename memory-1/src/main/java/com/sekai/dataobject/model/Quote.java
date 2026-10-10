package com.sekai.dataobject.model;

import java.time.LocalDateTime;

public class Quote {

    /**
     * 台词ID，主键，自增
     */
    private Long id;

    /**
     * 所属番剧ID
     */
    private Long seriesId;

    /**
     * 人物ID
     */
    private Long characterId;

    /**
     * 说出台词的角色名（冗余，便于展示）
     */
    private String characterName;

    /**
     * 台词原文（官方台词）
     */
    private String content;

    /**
     * 台词所在集数
     */
    private Integer episode;

    /**
     * 台词出现的时间点（秒）
     */
    private Double timePoint;

    /**
     * 台词原音频地址（上传的原音频文件）
     */
    private String audioUrl;

    /**
     * 创建时间
     */
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
}
