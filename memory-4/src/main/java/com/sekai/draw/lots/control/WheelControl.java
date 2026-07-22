package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.MembershipStatus;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.model.WheelOption;
import com.sekai.draw.lots.model.WheelSpinResult;
import com.sekai.draw.lots.service.MembershipService;
import com.sekai.draw.lots.service.WheelService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class WheelControl {

    @Resource
    private WheelService wheelService;

    @Resource
    private MembershipService membershipService;

    @GetMapping("/wheel")
    public String wheel(HttpSession session, Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        MembershipStatus membership = membershipService.getStatus(user);
        boolean premium = membershipService.isPremium(user);
        model.addAttribute("loginUser", user);
        model.addAttribute("membership", membership);
        model.addAttribute("premium", premium);
        model.addAttribute("options", wheelService.options(user));
        model.addAttribute("recentSpins", wheelService.recentSpins(user, 8));
        model.addAttribute("vipSuggestions", premium ? wheelService.vipSuggestions(user) : java.util.List.of());
        return "wheel";
    }

    @PostMapping("/wheel/options")
    public String addOption(HttpSession session,
                            @RequestParam("title") String title,
                            @RequestParam(value = "detail", required = false) String detail,
                            @RequestParam(value = "weight", required = false) Integer weight,
                            @RequestParam(value = "color", required = false) String color,
                            RedirectAttributes redirectAttributes) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        Result<WheelOption> result = wheelService.addOption(user, title, detail, weight, color);
        addFlash(result, redirectAttributes);
        return "redirect:/wheel";
    }

    @PostMapping("/wheel/options/{id}/delete")
    public String deleteOption(HttpSession session,
                               @PathVariable("id") Long id,
                               RedirectAttributes redirectAttributes) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        Result<Boolean> result = wheelService.deleteOption(user, id);
        addFlash(result, redirectAttributes);
        return "redirect:/wheel";
    }

    @PostMapping("/wheel/vip/import")
    public String importVipSuggestions(HttpSession session,
                                       RedirectAttributes redirectAttributes) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        if (!membershipService.isPremium(user)) {
            redirectAttributes.addFlashAttribute("error", "智能补全转盘是会员功能，请先开通会员。");
            return "redirect:/membership?locked=wheel-vip";
        }
        Result<Integer> result = wheelService.importVipSuggestions(user);
        addFlash(result, redirectAttributes);
        return "redirect:/wheel";
    }

    @PostMapping("/wheel/spin")
    @ResponseBody
    public Result<WheelSpinResult> spin(HttpSession session) {
        User user = requireLogin(session);
        if (user == null) {
            return Result.fail("请先登录");
        }
        return wheelService.spin(user);
    }

    private User requireLogin(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        return loginUser instanceof User user ? user : null;
    }

    private void addFlash(Result<?> result, RedirectAttributes redirectAttributes) {
        if (result.isSuccess()) {
            redirectAttributes.addFlashAttribute("message", result.getMessage());
        } else {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
        }
    }
}
