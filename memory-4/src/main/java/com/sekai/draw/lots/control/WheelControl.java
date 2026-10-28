package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.model.WheelOption;
import com.sekai.draw.lots.model.WheelSpinResult;
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

    @GetMapping("/wheel")
    public String wheel(HttpSession session, Model model) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        model.addAttribute("loginUser", user);
        model.addAttribute("options", wheelService.options(user));
        model.addAttribute("recentSpins", wheelService.recentSpins(user, 8));
        model.addAttribute("suggestions", wheelService.suggestions(user));
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

    @PostMapping("/wheel/import-suggestions")
    public String importSuggestions(HttpSession session,
                                    RedirectAttributes redirectAttributes) {
        User user = requireLogin(session);
        if (user == null) {
            return "redirect:/login";
        }
        Result<Integer> result = wheelService.importSuggestions(user);
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
