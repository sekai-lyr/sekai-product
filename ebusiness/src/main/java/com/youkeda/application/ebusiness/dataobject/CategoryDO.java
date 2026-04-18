package com.youkeda.application.ebusiness.dataobject;

import com.youkeda.application.ebusiness.model.BaseDate;
import com.youkeda.application.ebusiness.model.BaseID;

import java.time.LocalDateTime;

public class CategoryDO extends BaseDate {

    private String name;

    private String description;

    private Long parentCategoryId;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Long getParentCategoryId() {
        return parentCategoryId;
    }

    public void setParentCategoryId(Long parentCategoryId) {
        this.parentCategoryId = parentCategoryId;
    }
}
