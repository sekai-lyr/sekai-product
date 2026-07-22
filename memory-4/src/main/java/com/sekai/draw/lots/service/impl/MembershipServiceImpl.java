package com.sekai.draw.lots.service.impl;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsMembershipDO;
import com.sekai.draw.lots.dataobject.SekaiDrawLotsPaymentOrderDO;
import com.sekai.draw.lots.mapper.SekaiDrawLotsMembershipMapper;
import com.sekai.draw.lots.mapper.SekaiDrawLotsPaymentOrderMapper;
import com.sekai.draw.lots.mapper.SekaiDrawLotsUserMapper;
import com.sekai.draw.lots.model.MembershipPlan;
import com.sekai.draw.lots.model.MembershipStatus;
import com.sekai.draw.lots.model.PaymentOrder;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.MembershipService;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class MembershipServiceImpl implements MembershipService {

    private static final String TRIAL_PLAN_CODE = "trial";
    private static final String TRIAL_PLAN_NAME = "试用会员";
    private static final int TRIAL_DAYS = 3;

    private static final List<MembershipPlan> PLANS = List.of(
            new MembershipPlan("monthly", "月度会员", 1990, 31, "适合先体验完整会员能力",
                    "轻量体验", false,
                    List.of("三连签仪式不限次", "深度趋势分析", "行动任务看板", "专注冲刺记录")),
            new MembershipPlan("season", "季度会员", 4990, 93, "适合持续记录运势趋势",
                    "推荐续费", true,
                    List.of("包含月度会员全部能力", "任务和专注 Markdown 导出", "更适合做限时优惠和留存")),
            new MembershipPlan("creator", "创作者定制版", 9900, 365, "给社群和创作者卖服务",
                    "年度定制", false,
                    List.of("可人工定制伙伴库", "行动计划、任务和专注沉淀", "可作为后续 B 端报价入口"))
    );
    private static final Map<String, MembershipPlan> PLAN_MAP = PLANS.stream()
            .collect(Collectors.toUnmodifiableMap(MembershipPlan::getCode, Function.identity()));

    @Resource
    private SekaiDrawLotsPaymentOrderMapper paymentOrderMapper;

    @Resource
    private SekaiDrawLotsMembershipMapper membershipMapper;

    @Resource
    private SekaiDrawLotsUserMapper userMapper;

    @Value("${sekai.admin-token:}")
    private String adminToken;

    @Value("${sekai.payment.wechat-qr-url:/membership/wechat-qr}")
    private String wechatQrUrl;

    @Override
    public List<MembershipPlan> plans() {
        return PLANS;
    }

    @Override
    public MembershipStatus getStatus(User user) {
        MembershipStatus fallback = new MembershipStatus();
        fallback.setActive(false);
        fallback.setStatus("FREE");
        if (user == null || user.getId() == null) {
            return fallback;
        }
        SekaiDrawLotsMembershipDO membershipDO = membershipMapper.selectActiveByUserId(user.getId());
        if (membershipDO == null) {
            return fallback;
        }
        MembershipStatus status = membershipDO.convertToStatus();
        status.setPlanName(resolvePlanName(status.getPlanCode()));
        return status;
    }

    @Override
    public boolean isPremium(User user) {
        return getStatus(user).isActive();
    }

    @Override
    public boolean canStartTrial(User user) {
        return user != null && user.getId() != null && membershipMapper.selectByUserId(user.getId()) == null;
    }

    @Override
    public String paymentQrUrl() {
        return wechatQrUrl;
    }

    @Override
    @Transactional
    public Result<MembershipStatus> activateTrial(User user) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        if (!canStartTrial(user)) {
            return Result.fail("你已经领取过试用或开通过会员，请选择续费方案。");
        }
        LocalDateTime now = LocalDateTime.now();
        SekaiDrawLotsMembershipDO membershipDO = new SekaiDrawLotsMembershipDO();
        membershipDO.setUserId(user.getId());
        membershipDO.setPlanCode(TRIAL_PLAN_CODE);
        membershipDO.setStatus("ACTIVE");
        membershipDO.setSourceOrderId(null);
        membershipDO.setStartTime(now);
        membershipDO.setExpireTime(now.plusDays(TRIAL_DAYS));
        membershipMapper.upsert(membershipDO);

        MembershipStatus status = membershipMapper.selectActiveByUserId(user.getId()).convertToStatus();
        status.setPlanName(TRIAL_PLAN_NAME);
        Result<MembershipStatus> result = Result.ok(status);
        result.setMessage("已领取 3 天试用会员，三连签和深度分析已解锁。");
        return result;
    }

    @Override
    @Transactional
    public Result<PaymentOrder> createOrder(User user, String planCode, String contact) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        MembershipPlan plan = PLAN_MAP.get(trimToNull(planCode));
        if (plan == null) {
            return Result.fail("请选择可购买的会员方案");
        }
        String normalizedContact = trimToNull(contact);
        if (normalizedContact != null && normalizedContact.length() > 120) {
            return Result.fail("联系方式不能超过 120 个字符");
        }

        SekaiDrawLotsPaymentOrderDO pending = paymentOrderMapper.selectLatestPendingByUserAndPlan(user.getId(), plan.getCode());
        if (pending != null) {
            Result<PaymentOrder> result = Result.ok(pending.convertToOrder());
            result.setMessage("已找到同套餐待付款订单，请继续扫码付款。");
            return result;
        }

        SekaiDrawLotsPaymentOrderDO orderDO = new SekaiDrawLotsPaymentOrderDO();
        orderDO.setOrderNo(generateOrderNo(user.getId()));
        orderDO.setUserId(user.getId());
        orderDO.setPlanCode(plan.getCode());
        orderDO.setPlanName(plan.getName());
        orderDO.setAmountCent(plan.getAmountCent());
        orderDO.setContact(normalizedContact);
        orderDO.setPayNote("SK-" + orderDO.getOrderNo());
        orderDO.setPayMethod("wechat_qr");
        orderDO.setStatus("PENDING");
        paymentOrderMapper.insert(orderDO);
        Result<PaymentOrder> result = Result.ok(paymentOrderMapper.selectByPrimaryKey(orderDO.getId()).convertToOrder());
        result.setMessage("订单已生成，请扫码付款并填写付款备注。");
        return result;
    }

    @Override
    @Transactional
    public Result<PaymentOrder> cancelOrder(User user, String orderNo) {
        if (user == null || user.getId() == null) {
            return Result.fail("请先登录");
        }
        String normalizedOrderNo = trimToNull(orderNo);
        if (normalizedOrderNo == null) {
            return Result.fail("订单不存在");
        }
        SekaiDrawLotsPaymentOrderDO orderDO = paymentOrderMapper.selectByOrderNo(normalizedOrderNo);
        if (orderDO == null || !user.getId().equals(orderDO.getUserId())) {
            return Result.fail("订单不存在");
        }
        if (!"PENDING".equals(orderDO.getStatus())) {
            return Result.fail("只有待付款订单可以取消");
        }
        paymentOrderMapper.cancelPendingForUser(normalizedOrderNo, user.getId());
        Result<PaymentOrder> result = Result.ok(paymentOrderMapper.selectByOrderNo(normalizedOrderNo).convertToOrder());
        result.setMessage("订单已取消。");
        return result;
    }

    @Override
    public PaymentOrder getOrderForUser(User user, String orderNo) {
        if (user == null || user.getId() == null || trimToNull(orderNo) == null) {
            return null;
        }
        SekaiDrawLotsPaymentOrderDO orderDO = paymentOrderMapper.selectByOrderNo(orderNo);
        if (orderDO == null || !user.getId().equals(orderDO.getUserId())) {
            return null;
        }
        return orderDO.convertToOrder();
    }

    @Override
    public PaymentOrder latestPendingOrder(User user) {
        if (user == null || user.getId() == null) {
            return null;
        }
        SekaiDrawLotsPaymentOrderDO orderDO = paymentOrderMapper.selectLatestPendingByUserId(user.getId());
        return orderDO == null ? null : orderDO.convertToOrder();
    }

    @Override
    public List<PaymentOrder> recentOrders(User user, int limit) {
        if (user == null || user.getId() == null) {
            return List.of();
        }
        return paymentOrderMapper.selectRecentByUserId(user.getId(), Math.max(1, Math.min(limit, 20))).stream()
                .map(SekaiDrawLotsPaymentOrderDO::convertToOrder)
                .toList();
    }

    @Override
    public List<PaymentOrder> pendingOrders(String adminToken, int limit) {
        if (!hasAdminAccess(adminToken)) {
            return List.of();
        }
        return paymentOrderMapper.selectPending(Math.max(1, Math.min(limit, 100))).stream()
                .map(SekaiDrawLotsPaymentOrderDO::convertToOrder)
                .toList();
    }

    @Override
    @Transactional
    public Result<PaymentOrder> approveOrder(Long orderId, String token) {
        if (!hasAdminAccess(token)) {
            return Result.fail("后台密钥不正确，或还没有设置 ADMIN_TOKEN");
        }
        if (orderId == null) {
            return Result.fail("订单不存在");
        }
        SekaiDrawLotsPaymentOrderDO orderDO = paymentOrderMapper.selectByPrimaryKey(orderId);
        if (orderDO == null) {
            return Result.fail("订单不存在");
        }
        MembershipPlan plan = PLAN_MAP.get(orderDO.getPlanCode());
        if (plan == null) {
            return Result.fail("订单方案已失效，无法开通");
        }
        if ("PAID".equals(orderDO.getStatus())) {
            Result<PaymentOrder> result = Result.ok(orderDO.convertToOrder());
            result.setMessage("订单已经开通过会员，无需重复审批。");
            return result;
        }
        if (!"PENDING".equals(orderDO.getStatus())) {
            return Result.fail("只有待付款订单可以批准");
        }

        LocalDateTime now = LocalDateTime.now();
        paymentOrderMapper.markPaid(orderDO.getId(), now);

        SekaiDrawLotsMembershipDO existing = membershipMapper.selectActiveByUserId(orderDO.getUserId());
        LocalDateTime startTime = existing == null || existing.getExpireTime() == null || existing.getExpireTime().isBefore(now)
                ? now
                : existing.getExpireTime();
        SekaiDrawLotsMembershipDO membershipDO = new SekaiDrawLotsMembershipDO();
        membershipDO.setUserId(orderDO.getUserId());
        membershipDO.setPlanCode(plan.getCode());
        membershipDO.setStatus("ACTIVE");
        membershipDO.setSourceOrderId(orderDO.getId());
        membershipDO.setStartTime(now);
        membershipDO.setExpireTime(startTime.plusDays(plan.getDays()));
        membershipMapper.upsert(membershipDO);

        return Result.ok(paymentOrderMapper.selectByPrimaryKey(orderDO.getId()).convertToOrder());
    }

    @Override
    @Transactional
    public Result<PaymentOrder> rejectOrder(Long orderId, String token) {
        if (!hasAdminAccess(token)) {
            return Result.fail("后台密钥不正确，或还没有设置 ADMIN_TOKEN");
        }
        if (orderId == null) {
            return Result.fail("订单不存在");
        }
        SekaiDrawLotsPaymentOrderDO orderDO = paymentOrderMapper.selectByPrimaryKey(orderId);
        if (orderDO == null) {
            return Result.fail("订单不存在");
        }
        if (!"PENDING".equals(orderDO.getStatus())) {
            return Result.fail("只有待付款订单可以拒绝");
        }
        paymentOrderMapper.markRejected(orderId);
        Result<PaymentOrder> result = Result.ok(paymentOrderMapper.selectByPrimaryKey(orderId).convertToOrder());
        result.setMessage("订单已拒绝。");
        return result;
    }

    @Override
    @Transactional
    public Result<MembershipStatus> grantMembership(Long userId, String planCode, Integer days, String token) {
        if (!hasAdminAccess(token)) {
            return Result.fail("后台密钥不正确，或还没有设置 ADMIN_TOKEN");
        }
        if (userId == null || userMapper.selectByPrimaryKey(userId) == null) {
            return Result.fail("用户不存在");
        }
        MembershipPlan plan = PLAN_MAP.get(trimToNull(planCode));
        if (plan == null) {
            return Result.fail("请选择可开通的会员方案");
        }
        int grantDays = days == null ? plan.getDays() : days;
        grantDays = Math.max(1, Math.min(grantDays, 3660));

        LocalDateTime now = LocalDateTime.now();
        SekaiDrawLotsMembershipDO existing = membershipMapper.selectActiveByUserId(userId);
        LocalDateTime startTime = existing == null || existing.getExpireTime() == null || existing.getExpireTime().isBefore(now)
                ? now
                : existing.getExpireTime();

        SekaiDrawLotsMembershipDO membershipDO = new SekaiDrawLotsMembershipDO();
        membershipDO.setUserId(userId);
        membershipDO.setPlanCode(plan.getCode());
        membershipDO.setStatus("ACTIVE");
        membershipDO.setSourceOrderId(null);
        membershipDO.setStartTime(now);
        membershipDO.setExpireTime(startTime.plusDays(grantDays));
        membershipMapper.upsert(membershipDO);

        MembershipStatus status = membershipMapper.selectActiveByUserId(userId).convertToStatus();
        status.setPlanName(plan.getName());
        Result<MembershipStatus> result = Result.ok(status);
        result.setMessage("会员已开通/顺延 " + grantDays + " 天。");
        return result;
    }

    @Override
    public boolean hasAdminAccess(String token) {
        String expected = trimToNull(adminToken);
        return expected != null && expected.equals(trimToNull(token));
    }

    private String generateOrderNo(Long userId) {
        String time = DateTimeFormatter.ofPattern("yyyyMMddHHmmss", Locale.ROOT).format(LocalDateTime.now());
        int random = ThreadLocalRandom.current().nextInt(1000, 10000);
        return "SK" + time + userId + random;
    }

    private String resolvePlanName(String planCode) {
        if (TRIAL_PLAN_CODE.equals(planCode)) {
            return TRIAL_PLAN_NAME;
        }
        MembershipPlan plan = PLAN_MAP.get(planCode);
        return plan == null ? planCode : plan.getName();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
