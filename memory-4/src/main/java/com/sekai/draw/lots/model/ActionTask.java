package com.sekai.draw.lots.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class ActionTask {
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MM-dd");

    private Long id;
    private Long userId;
    private String title;
    private String detail;
    private String sourceType;
    private Integer priority;
    private String status;
    private LocalDate dueDate;
    private LocalDateTime completedTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public boolean isOpen() {
        return "OPEN".equals(status);
    }

    public boolean isDone() {
        return "DONE".equals(status);
    }

    public boolean isArchived() {
        return "ARCHIVED".equals(status);
    }

    public boolean isOverdue() {
        return isOpen() && dueDate != null && dueDate.isBefore(LocalDate.now());
    }

    public String getStatusText() {
        if (isDone()) {
            return "已完成";
        }
        if (isArchived()) {
            return "已搁置";
        }
        return isOverdue() ? "已逾期" : "进行中";
    }

    public String getStatusClass() {
        if (isDone()) {
            return "done";
        }
        if (isArchived()) {
            return "archived";
        }
        return isOverdue() ? "overdue" : "open";
    }

    public String getPriorityText() {
        int value = priority == null ? 3 : priority;
        if (value >= 5) {
            return "最高";
        }
        if (value >= 4) {
            return "较高";
        }
        if (value <= 1) {
            return "低";
        }
        return "普通";
    }

    public String getSourceText() {
        return switch (sourceType == null ? "" : sourceType) {
            case "coach" -> "行动计划";
            case "draw" -> "抽签";
            case "wheel" -> "转盘";
            default -> "手动";
        };
    }

    public String getDueDateText() {
        return dueDate == null ? "未设日期" : DATE_FORMATTER.format(dueDate);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public LocalDateTime getCompletedTime() { return completedTime; }
    public void setCompletedTime(LocalDateTime completedTime) { this.completedTime = completedTime; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
