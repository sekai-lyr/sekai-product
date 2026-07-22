package com.sekai.draw.lots.dataobject;

import com.sekai.draw.lots.model.WheelOption;
import org.springframework.beans.BeanUtils;

import java.time.LocalDateTime;

public class SekaiDrawLotsWheelOptionDO {
    private Long id;
    private Long userId;
    private String title;
    private String detail;
    private Integer weight;
    private String color;
    private Integer sortOrder;
    private Boolean enabled;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public WheelOption convertToOption() {
        WheelOption option = new WheelOption();
        BeanUtils.copyProperties(this, option);
        option.setEnabled(Boolean.TRUE.equals(enabled));
        return option;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
