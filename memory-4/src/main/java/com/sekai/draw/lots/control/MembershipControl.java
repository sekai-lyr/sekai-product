package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.PaymentOrder;
import com.sekai.draw.lots.model.MembershipStatus;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.MembershipService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Controller
public class MembershipControl {

    @Resource
    private MembershipService membershipService;

    @GetMapping("/membership")
    public String membership(HttpSession session,
                             Model model,
                             @RequestParam(value = "orderNo", required = false) String orderNo,
                             @RequestParam(value = "locked", required = false) String locked) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("membership", membershipService.getStatus(user));
        model.addAttribute("trialEligible", membershipService.canStartTrial(user));
        model.addAttribute("plans", membershipService.plans());
        model.addAttribute("paymentQrUrl", membershipService.paymentQrUrl());
        model.addAttribute("recentOrders", membershipService.recentOrders(user, 5));
        model.addAttribute("locked", locked);
        PaymentOrder order = membershipService.getOrderForUser(user, orderNo);
        if (order == null) {
            order = membershipService.latestPendingOrder(user);
            model.addAttribute("recoveredOrder", order != null);
        }
        if (order != null) {
            model.addAttribute("order", order);
        }
        return "membership";
    }

    @PostMapping("/membership/trial")
    public String activateTrial(HttpSession session,
                                RedirectAttributes redirectAttributes) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        Result<MembershipStatus> result = membershipService.activateTrial(user);
        if (result.isSuccess()) {
            redirectAttributes.addFlashAttribute("message", result.getMessage());
        } else {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
        }
        return "redirect:/membership";
    }

    @PostMapping("/membership/orders")
    public String createOrder(HttpSession session,
                              @RequestParam("planCode") String planCode,
                              @RequestParam(value = "contact", required = false) String contact,
                              RedirectAttributes redirectAttributes) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        Result<PaymentOrder> result = membershipService.createOrder(user, planCode, contact);
        if (!result.isSuccess()) {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
            return "redirect:/membership";
        }
        redirectAttributes.addFlashAttribute("message", result.getMessage());
        return "redirect:/membership?orderNo=" + result.getData().getOrderNo();
    }

    @PostMapping("/membership/orders/{orderNo}/cancel")
    public String cancelOrder(HttpSession session,
                              @PathVariable("orderNo") String orderNo,
                              RedirectAttributes redirectAttributes) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        Result<PaymentOrder> result = membershipService.cancelOrder(user, orderNo);
        if (result.isSuccess()) {
            redirectAttributes.addFlashAttribute("message", result.getMessage());
        } else {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
        }
        return "redirect:/membership";
    }

    @GetMapping("/admin/membership")
    public String adminMembership(Model model,
                                  @RequestParam(value = "token", required = false) String token,
                                  @RequestParam(value = "limit", defaultValue = "50") int limit) {
        boolean tokenProvided = token != null && !token.trim().isEmpty();
        boolean adminReady = membershipService.hasAdminAccess(token);
        model.addAttribute("adminToken", token == null ? "" : token);
        model.addAttribute("tokenProvided", tokenProvided);
        model.addAttribute("adminReady", adminReady);
        model.addAttribute("plans", membershipService.plans());
        model.addAttribute("limit", Math.max(1, Math.min(limit, 100)));
        model.addAttribute("pendingOrders", adminReady ? membershipService.pendingOrders(token, limit) : List.of());
        return "membership-admin";
    }

    @PostMapping("/admin/membership/orders/{id}/approve-page")
    public String approveOrderFromPage(@PathVariable("id") Long id,
                                       @RequestParam(value = "token", required = false) String token,
                                       RedirectAttributes redirectAttributes) {
        Result<PaymentOrder> result = membershipService.approveOrder(id, token);
        addAdminFlash(result, redirectAttributes);
        return "redirect:/admin/membership?token=" + safeRedirectToken(token);
    }

    @PostMapping("/admin/membership/orders/{id}/reject-page")
    public String rejectOrderFromPage(@PathVariable("id") Long id,
                                      @RequestParam(value = "token", required = false) String token,
                                      RedirectAttributes redirectAttributes) {
        Result<PaymentOrder> result = membershipService.rejectOrder(id, token);
        addAdminFlash(result, redirectAttributes);
        return "redirect:/admin/membership?token=" + safeRedirectToken(token);
    }

    @PostMapping("/admin/membership/grants-page")
    public String grantMembershipFromPage(@RequestParam("userId") Long userId,
                                          @RequestParam("planCode") String planCode,
                                          @RequestParam(value = "days", required = false) Integer days,
                                          @RequestParam(value = "token", required = false) String token,
                                          RedirectAttributes redirectAttributes) {
        Result<MembershipStatus> result = membershipService.grantMembership(userId, planCode, days, token);
        addAdminFlash(result, redirectAttributes);
        return "redirect:/admin/membership?token=" + safeRedirectToken(token);
    }

    @GetMapping("/admin/membership/orders")
    @ResponseBody
    public Result<List<PaymentOrder>> pendingOrders(@RequestParam(value = "token", required = false) String token,
                                                    @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return Result.ok(membershipService.pendingOrders(token, limit));
    }

    @PostMapping("/admin/membership/orders/{id}/approve")
    @ResponseBody
    public Result<PaymentOrder> approveOrder(@PathVariable("id") Long id,
                                             @RequestParam(value = "token", required = false) String token) {
        return membershipService.approveOrder(id, token);
    }

    @PostMapping("/admin/membership/orders/{id}/reject")
    @ResponseBody
    public Result<PaymentOrder> rejectOrder(@PathVariable("id") Long id,
                                            @RequestParam(value = "token", required = false) String token) {
        return membershipService.rejectOrder(id, token);
    }

    @PostMapping("/admin/membership/grants")
    @ResponseBody
    public Result<MembershipStatus> grantMembership(@RequestParam("userId") Long userId,
                                                    @RequestParam("planCode") String planCode,
                                                    @RequestParam(value = "days", required = false) Integer days,
                                                    @RequestParam(value = "token", required = false) String token) {
        return membershipService.grantMembership(userId, planCode, days, token);
    }

    @GetMapping("/membership/wechat-qr")
    public ResponseEntity<byte[]> wechatQrPlaceholder() {
        String svg = """
                <svg xmlns="http://www.w3.org/2000/svg" width="520" height="520" viewBox="0 0 520 520">
                  <rect width="520" height="520" rx="28" fill="#f8fafc"/>
                  <rect x="58" y="58" width="404" height="404" rx="18" fill="#ffffff" stroke="#dfe5ef" stroke-width="8"/>
                  <g fill="#111827">
                    <rect x="98" y="98" width="96" height="96" rx="8"/>
                    <rect x="326" y="98" width="96" height="96" rx="8"/>
                    <rect x="98" y="326" width="96" height="96" rx="8"/>
                    <rect x="236" y="110" width="34" height="34" rx="4"/>
                    <rect x="236" y="182" width="62" height="34" rx="4"/>
                    <rect x="220" y="252" width="34" height="34" rx="4"/>
                    <rect x="288" y="252" width="34" height="34" rx="4"/>
                    <rect x="360" y="236" width="34" height="34" rx="4"/>
                    <rect x="236" y="344" width="86" height="34" rx="4"/>
                    <rect x="360" y="344" width="34" height="78" rx="4"/>
                    <rect x="254" y="400" width="34" height="34" rx="4"/>
                  </g>
                  <text x="260" y="486" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#475467">设置 WECHAT_QR_URL 替换为你的微信收款码</text>
                </svg>
                """;
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS))
                .contentType(MediaType.valueOf("image/svg+xml"))
                .body(svg.getBytes(StandardCharsets.UTF_8));
    }

    private User requireLogin(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        return loginUser instanceof User user ? user : null;
    }

    private void addAdminFlash(Result<?> result, RedirectAttributes redirectAttributes) {
        if (result.isSuccess()) {
            redirectAttributes.addFlashAttribute("message", result.getMessage());
        } else {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
        }
    }

    private String safeRedirectToken(String token) {
        return token == null ? "" : UriUtils.encodeQueryParam(token.replace("\r", "").replace("\n", ""), StandardCharsets.UTF_8);
    }
}
