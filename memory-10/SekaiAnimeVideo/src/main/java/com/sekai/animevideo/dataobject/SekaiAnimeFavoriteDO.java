package com.sekai.animevideo.dataobject;

import com.sekai.animevideo.model.Favorite;
import org.springframework.beans.BeanUtils;
import java.time.LocalDateTime;

public class SekaiAnimeFavoriteDO {
    private Long id;
    private Long userId;
    private Long siteId;
    private LocalDateTime createTime;

    public SekaiAnimeFavoriteDO() {}
    public SekaiAnimeFavoriteDO(Favorite favorite) { BeanUtils.copyProperties(favorite, this); }
    public Favorite convertToFavorite() { Favorite favorite = new Favorite(); BeanUtils.copyProperties(this, favorite); return favorite; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getSiteId() { return siteId; }
    public void setSiteId(Long siteId) { this.siteId = siteId; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
