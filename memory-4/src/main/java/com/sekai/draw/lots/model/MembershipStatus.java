package com.sekai.draw.lots.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

public class MembershipStatus {
    private static final DateTimeFormatter DISPLAY_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private Long id;
    private Long userId;
    private String planCode;
    private String planName;
    private String status;
    private Long sourceOrderId;
    private LocalDateTime startTime;
    private LocalDateTime expireTime;
    private boolean active;

    public long getDaysLeft() {
        if (!active || expireTime == null) {
            return 0;
        }
        return Math.max(1, ChronoUnit.DAYS.between(LocalDateTime.now(), expireTime) + 1);
    }

    public boolean isExpiringSoon() {
        return active && getDaysLeft() <= 7;
    }

    public boolean isTrial() {
        return "trial".equals(planCode);
    }

    public String getExpireDateText() {
        return expireTime == null ? "未开通" : DISPLAY_FORMATTER.format(expireTime);
    }

    public String getRenewalHint() {
        if (!active) {
            return "开通后立即解锁会员能力";
        }
        if (isTrial()) {
            return "试用结束前续费，会员时间会自动顺延";
        }
        if (isExpiringSoon()) {
            return "会员即将到期，续费会自动顺延";
        }
        return "续费会从当前到期时间后顺延";
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getPlanCode() { return planCode; }
    public void setPlanCode(String planCode) { this.planCode = planCode; }
    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getSourceOrderId() { return sourceOrderId; }
    public void setSourceOrderId(Long sourceOrderId) { this.sourceOrderId = sourceOrderId; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getExpireTime() { return expireTime; }
    public void setExpireTime(LocalDateTime expireTime) { this.expireTime = expireTime; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
