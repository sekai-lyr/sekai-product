package com.sekai.dataobject.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class Series {

    /**
     * 番剧ID，主键，自增
     */
    private Long id;

    /**
     * 番剧官方名称（中文名）
     */
    private String title;

    /**
     * 番剧原名（日文/英文）
     */
    private String originalTitle;

    /**
     * 番剧类型：TV / 剧场版 / OVA / 网络动画
     */
    private String type;

    /**
     * 制作公司（动画制作公司）
     */
    private String studio;

    /**
     * 首播日期
     */
    private LocalDate releaseDate;

    /**
     * 总集数
     */
    private Integer totalEpisodes;

    /**
     * 官方评分（权威评分，如 Bangumi/MAL 均分）
     */
    private Double score;

    /**
     * 剧情简介（官方/权威简介）
     */
    private String synopsis;

    /**
     * 封面图片地址
     */
    private String coverUrl;

    /**
     * 标签，用逗号分隔
     */
    private String tags;

    /**
     * 官网链接
     */
    private String officialUrl;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 修改时间
     */
    private LocalDateTime updateTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getOriginalTitle() {
        return originalTitle;
    }

    public void setOriginalTitle(String originalTitle) {
        this.originalTitle = originalTitle;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getStudio() {
        return studio;
    }

    public void setStudio(String studio) {
        this.studio = studio;
    }

    public LocalDate getReleaseDate() {
        return releaseDate;
    }

    public void setReleaseDate(LocalDate releaseDate) {
        this.releaseDate = releaseDate;
    }

    public Integer getTotalEpisodes() {
        return totalEpisodes;
    }

    public void setTotalEpisodes(Integer totalEpisodes) {
        this.totalEpisodes = totalEpisodes;
    }

    public Double getScore() {
        return score;
    }

    public void setScore(Double score) {
        this.score = score;
    }

    public String getSynopsis() {
        return synopsis;
    }

    public void setSynopsis(String synopsis) {
        this.synopsis = synopsis;
    }

    public String getCoverUrl() {
        return coverUrl;
    }

    public void setCoverUrl(String coverUrl) {
        this.coverUrl = coverUrl;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public String getOfficialUrl() {
        return officialUrl;
    }

    public void setOfficialUrl(String officialUrl) {
        this.officialUrl = officialUrl;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }

    public LocalDateTime getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(LocalDateTime updateTime) {
        this.updateTime = updateTime;
    }
}
