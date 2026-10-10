package com.sekai.dataobject.model;

import java.time.LocalDateTime;

public class CharacterInfo {

    /**
     * 人物ID，主键，自增
     */
    private Long id;

    /**
     * 所属番剧ID
     */
    private Long seriesId;

    /**
     * 人物名称（官方中文名）
     */
    private String name;

    /**
     * 人物原名（日文名）
     */
    private String originalName;

    /**
     * 人物定位（主角/配角/反派等）
     */
    private String role;

    /**
     * 声优（CV）
     */
    private String voiceActor;

    /**
     * 人物官方简介
     */
    private String description;

    /**
     * 人物立绘/图片地址
     */
    private String imageUrl;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getOriginalName() {
        return originalName;
    }

    public void setOriginalName(String originalName) {
        this.originalName = originalName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getVoiceActor() {
        return voiceActor;
    }

    public void setVoiceActor(String voiceActor) {
        this.voiceActor = voiceActor;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }
}
