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
        redirectAttributes.addFlashAttribute("message", "Registration successful, please login");
        return "redirect:/login";
    }

    @PostMapping("/user/login")
    public String login(@RequestParam("userName") String userName,
                        @RequestParam("password") String password,
                        HttpSession session,
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
    public Result<User> resetPassword(@RequestParam("userName") String userName,
                                      @RequestParam("newPassword") String newPassword) {
        try {
            return userService.resetPassword(userName, newPassword);
        } catch (CannotCreateTransactionException | DataAccessException e) {
            return Result.fail("Database connection failed");
        }
    }

    private String databaseUnavailableMessage() {
        return "Database connection failed. Check DB_URL, DB_USERNAME, DB_PASSWORD env vars and restart.";
    }
}