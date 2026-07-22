package com.sekai.draw.lots.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class PaymentOrder {
    private static final DateTimeFormatter DISPLAY_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private Long id;
    private String orderNo;
    private Long userId;
    private String planCode;
    private String planName;
    private Integer amountCent;
    private String contact;
    private String payNote;
    private String payMethod;
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime paidTime;

    public String getAmountText() {
        if (amountCent == null) {
            return "0.00";
        }
        return String.format("%.2f", amountCent / 100.0);
    }

    public String getStatusText() {
        if ("PENDING".equals(status)) {
            return "待付款";
        }
        if ("PAID".equals(status)) {
            return "已开通";
        }
        if ("CANCELED".equals(status)) {
            return "已取消";
        }
        if ("REJECTED".equals(status)) {
            return "已拒绝";
        }
        return status == null ? "未知" : status;
    }

    public String getPayMethodText() {
        if ("wechat_qr".equals(payMethod)) {
            return "微信扫码";
        }
        return payMethod == null ? "手动付款" : payMethod;
    }

    public String getCreateTimeText() {
        return createTime == null ? "" : DISPLAY_FORMATTER.format(createTime);
    }

    public String getPaidTimeText() {
        return paidTime == null ? "" : DISPLAY_FORMATTER.format(paidTime);
    }

    public boolean isPending() {
        return "PENDING".equals(status);
    }

    public boolean isPaid() {
        return "PAID".equals(status);
    }

    public boolean isCanceled() {
        return "CANCELED".equals(status);
    }

    public boolean isRejected() {
        return "REJECTED".equals(status);
    }

    public boolean isCancelable() {
        return isPending();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getPlanCode() { return planCode; }
    public void setPlanCode(String planCode) { this.planCode = planCode; }
    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }
    public Integer getAmountCent() { return amountCent; }
    public void setAmountCent(Integer amountCent) { this.amountCent = amountCent; }
    public String getContact() { return contact; }
    public void setContact(String contact) { this.contact = contact; }
    public String getPayNote() { return payNote; }
    public void setPayNote(String payNote) { this.payNote = payNote; }
    public String getPayMethod() { return payMethod; }
    public void setPayMethod(String payMethod) { this.payMethod = payMethod; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getPaidTime() { return paidTime; }
    public void setPaidTime(LocalDateTime paidTime) { this.paidTime = paidTime; }
}
