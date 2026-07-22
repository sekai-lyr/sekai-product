package com.sekai.draw.lots.service;

import com.sekai.draw.lots.model.MembershipPlan;
import com.sekai.draw.lots.model.MembershipStatus;
import com.sekai.draw.lots.model.PaymentOrder;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;

import java.util.List;

public interface MembershipService {
    List<MembershipPlan> plans();
    MembershipStatus getStatus(User user);
    boolean isPremium(User user);
    boolean canStartTrial(User user);
    boolean hasAdminAccess(String adminToken);
    String paymentQrUrl();
    Result<MembershipStatus> activateTrial(User user);
    Result<PaymentOrder> createOrder(User user, String planCode, String contact);
    Result<PaymentOrder> cancelOrder(User user, String orderNo);
    PaymentOrder getOrderForUser(User user, String orderNo);
    PaymentOrder latestPendingOrder(User user);
    List<PaymentOrder> recentOrders(User user, int limit);
    List<PaymentOrder> pendingOrders(String adminToken, int limit);
    Result<PaymentOrder> approveOrder(Long orderId, String adminToken);
    Result<PaymentOrder> rejectOrder(Long orderId, String adminToken);
    Result<MembershipStatus> grantMembership(Long userId, String planCode, Integer days, String adminToken);
}
