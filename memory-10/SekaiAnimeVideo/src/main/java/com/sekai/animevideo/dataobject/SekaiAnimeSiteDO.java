package com.sekai.animevideo.dataobject;

import com.sekai.animevideo.model.AnimeSite;
import org.springframework.beans.BeanUtils;
import java.time.LocalDateTime;

public class SekaiAnimeSiteDO {
    private Long id;
    private Long userId;
    private Long categoryId;
    private String siteName;
    private String siteUrl;
    private String description;
    private String tags;
    private Integer clickCount;
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public SekaiAnimeSiteDO() {}
    public SekaiAnimeSiteDO(AnimeSite site) { BeanUtils.copyProperties(site, this); }
    public AnimeSite convertToSite() { AnimeSite site = new AnimeSite(); BeanUtils.copyProperties(this, site); return site; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }
    public String getSiteUrl() { return siteUrl; }
    public void setSiteUrl(String siteUrl) { this.siteUrl = siteUrl; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    public Integer getClickCount() { return clickCount; }
    public void setClickCount(Integer clickCount) { this.clickCount = clickCount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
