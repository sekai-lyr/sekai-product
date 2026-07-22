package com.sekai.draw.lots.dataobject;

import com.sekai.draw.lots.model.PaymentOrder;
import org.springframework.beans.BeanUtils;

import java.time.LocalDateTime;

public class SekaiDrawLotsPaymentOrderDO {
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

    public PaymentOrder convertToOrder() {
        PaymentOrder order = new PaymentOrder();
        BeanUtils.copyProperties(this, order);
        return order;
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
