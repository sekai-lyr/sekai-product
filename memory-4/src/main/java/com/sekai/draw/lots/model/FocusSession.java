package com.sekai.draw.lots.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class FocusSession {
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("MM-dd HH:mm");

    private Long id;
    private Long userId;
    private Long taskId;
    private String taskTitle;
    private Integer plannedMinutes;
    private Integer actualMinutes;
    private String energyLabel;
    private String note;
    private LocalDateTime completedTime;
    private LocalDateTime createTime;

    public String getDurationText() {
        int minutes = actualMinutes == null ? 0 : actualMinutes;
        if (minutes >= 60) {
            int hours = minutes / 60;
            int rest = minutes % 60;
            return rest == 0 ? hours + " 小时" : hours + " 小时 " + rest + " 分钟";
        }
        return minutes + " 分钟";
    }

    public String getCompletedText() {
        return completedTime == null ? "刚刚" : TIME_FORMATTER.format(completedTime);
    }

    public String getEnergyText() {
        return energyLabel == null || energyLabel.isBlank() ? "专注" : energyLabel;
    }

    public String getTaskTitleText() {
        return taskTitle == null || taskTitle.isBlank() ? "自由专注" : taskTitle;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public String getTaskTitle() { return taskTitle; }
    public void setTaskTitle(String taskTitle) { this.taskTitle = taskTitle; }
    public Integer getPlannedMinutes() { return plannedMinutes; }
    public void setPlannedMinutes(Integer plannedMinutes) { this.plannedMinutes = plannedMinutes; }
    public Integer getActualMinutes() { return actualMinutes; }
    public void setActualMinutes(Integer actualMinutes) { this.actualMinutes = actualMinutes; }
    public String getEnergyLabel() { return energyLabel; }
    public void setEnergyLabel(String energyLabel) { this.energyLabel = energyLabel; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public LocalDateTime getCompletedTime() { return completedTime; }
    public void setCompletedTime(LocalDateTime completedTime) { this.completedTime = completedTime; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
