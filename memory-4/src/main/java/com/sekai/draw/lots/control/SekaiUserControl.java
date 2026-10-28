package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.UserService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class SekaiUserControl {

    @Resource
    private UserService userService;

    @GetMapping("/user/login")
    public String loginPageAlias() {
        return "redirect:/login";
    }

    @GetMapping("/user/register")
    public String registerPageAlias() {
        return "redirect:/register";
    }

    @PostMapping("/user/register")
    public String register(@ModelAttribute User user,
                           @RequestParam("confirmPassword") String confirmPassword,
                           RedirectAttributes redirectAttributes) {
        if (user == null || user.getPassword() == null || !user.getPassword().equals(confirmPassword)) {
            redirectAttributes.addFlashAttribute("error", "Passwords do not match");
            return "redirect:/register";
        }
        Result<User> result;
        String rawPassword = user.getPassword();
        try {
            result = userService.register(user);
        } catch (CannotCreateTransactionException | DataAccessException e) {
            redirectAttributes.addFlashAttribute("error", databaseUnavailableMessage());
            return "redirect:/register";
        }
        if (!result.isSuccess()) {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
            return "redirect:/register";
        }
        Result<String> recovery = userService.rotateRecoveryCode(result.getData(), rawPassword);
        redirectAttributes.addFlashAttribute("recoveryCode", recovery.getData());
        redirectAttributes.addFlashAttribute("message", "注册成功。请先保存下方恢复码，再登录。");
        return "redirect:/login";
    }

    @PostMapping("/user/login")
    public String login(@RequestParam("userName") String userName,
                        @RequestParam("password") String password,
                        HttpSession session,
                        jakarta.servlet.http.HttpServletRequest request,
                        RedirectAttributes redirectAttributes) {
        Result<User> result;
        try {
            result = userService.login(userName, password);
        } catch (CannotCreateTransactionException | DataAccessException e) {
            redirectAttributes.addFlashAttribute("error", databaseUnavailableMessage());
            return "redirect:/login";
        }
        if (!result.isSuccess()) {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
            return "redirect:/login";
        }
        request.changeSessionId();
        session.setAttribute("loginUser", result.getData());
        return "redirect:/home";
    }

    @PostMapping("/user/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/login";
    }

    @PostMapping("/user/reset-password")
    @ResponseBody
    public Result<Boolean> resetPassword(@RequestParam("token") String token,
                                      @RequestParam("newPassword") String newPassword) {
        try {
            return userService.resetPassword(token, newPassword);
        } catch (CannotCreateTransactionException | DataAccessException e) {
            return Result.fail("Database connection failed");
        }
    }

    @GetMapping("/recover")
    public String recoveryPage() { return "recover"; }

    @PostMapping("/user/recovery-token")
    @ResponseBody
    public Result<String> recoveryToken(@RequestParam String userName, @RequestParam String recoveryCode) {
        return userService.beginReset(userName, recoveryCode);
    }

    @GetMapping("/account")
    public String account(HttpSession session, org.springframework.ui.Model model) {
        model.addAttribute("loginUser", session.getAttribute("loginUser"));
        return "account";
    }

    @PostMapping("/user/recovery-code")
    public String recoveryCode(@RequestParam String currentPassword, HttpSession session, RedirectAttributes redirect) {
        Result<String> result = userService.rotateRecoveryCode((User) session.getAttribute("loginUser"), currentPassword);
        redirect.addFlashAttribute(result.isSuccess() ? "recoveryCode" : "error", result.isSuccess() ? result.getData() : result.getMessage());
        return "redirect:/account";
    }

    private String databaseUnavailableMessage() {
        return "暂时无法连接服务，请稍后重试";
    }
}
