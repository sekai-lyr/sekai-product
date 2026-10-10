package com.sekai.galagame.control;

import com.sekai.galagame.model.Result;
import com.sekai.galagame.model.User;
import com.sekai.galagame.service.UserService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthControl {

    public static final String SESSION_USER = "loginUser";

    @Resource
    private UserService userService;

    @PostMapping("/api/register")
    public Result<User> register(@RequestParam String username,
                                 @RequestParam String password,
                                 @RequestParam(value = "nickname", required = false) String nickname,
                                 HttpSession session) {
        Result<User> result = userService.register(username, password, nickname);
        if (result.isSuccess()) {
            session.setAttribute(SESSION_USER, result.getData());
        }
        return result;
    }

    @PostMapping("/api/login")
    public Result<User> login(@RequestParam String username,
                              @RequestParam String password,
                              HttpSession session) {
        Result<User> result = userService.login(username, password);
        if (result.isSuccess()) {
            session.setAttribute(SESSION_USER, result.getData());
        }
        return result;
    }

    @PostMapping("/api/logout")
    public Result<Boolean> logout(HttpSession session) {
        session.invalidate();
        return Result.ok(true);
    }

    @GetMapping("/api/me")
    public Result<User> me(HttpSession session) {
        Object loginUser = session.getAttribute(SESSION_USER);
        if (!(loginUser instanceof User user)) {
            return Result.fail("请先登录");
        }
        return userService.me(user.getId());
    }
}
