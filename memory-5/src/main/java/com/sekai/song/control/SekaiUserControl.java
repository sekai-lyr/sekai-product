package com.sekai.song.control;

import com.sekai.song.model.Result;
import com.sekai.song.model.User;
import com.sekai.song.service.UserService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class SekaiUserControl {

    @Resource
    private UserService userService;
    @Resource
    private com.sekai.song.service.WebsiteFeedbackService websiteFeedback;

    @PostMapping("/user/register")
    public String register(@ModelAttribute User user,
                           @RequestParam("confirmPassword") String confirmPassword,
                           RedirectAttributes redirectAttributes) {
        if (user == null || user.getPassword() == null || !user.getPassword().equals(confirmPassword)) {
            redirectAttributes.addFlashAttribute("error", "两次输入的密码不一致");
            return "redirect:/register";
        }
        Result<User> result = userService.register(user);
        if (!result.isSuccess()) {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
            return "redirect:/register";
        }
        redirectAttributes.addFlashAttribute("message", "注册成功，请登录你的歌单宇宙");
        return "redirect:/login";
    }

    @GetMapping("/user/keep-alive")
    public ResponseEntity<Void> keepAlive(HttpSession session) {
        if (session.getAttribute("loginUser") instanceof User) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    @PostMapping("/user/login")
    public String login(@RequestParam("userName") String userName,
                        @RequestParam("password") String password,
                        HttpServletRequest request,
                        HttpSession session,
                        RedirectAttributes redirectAttributes) {
        Result<User> result = userService.login(userName, password);
        if (!result.isSuccess()) {
            redirectAttributes.addFlashAttribute("error", result.getMessage());
            return "redirect:/login";
        }
        try {
            request.changeSessionId();
        } catch (IllegalStateException ignored) {
        }
        session.setAttribute("loginUser", result.getData());
        try {
            websiteFeedback.login(result.getData().getId());
        } catch (org.springframework.dao.DataAccessException error) {
            org.slf4j.LoggerFactory.getLogger(SekaiUserControl.class).warn("登录统计暂不可用，登录流程继续");
        }
        return "redirect:/home";
    }
}
