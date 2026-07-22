package com.nightcord.duel.controller;

import com.nightcord.duel.entity.User;
import com.nightcord.duel.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserService userService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        try {
            String username = body.get("username");
            String password = body.get("password");
            String nickname = body.get("nickname");
            User user = userService.register(username, password, nickname);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "userId", user.getId(),
                "username", user.getUsername(),
                "nickname", user.getNickname()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "reason", e.getMessage()
            ));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        return userService.login(username, password)
            .map(user -> ResponseEntity.ok((Object) Map.of(
                "success", true,
                "userId", user.getId(),
                "username", user.getUsername(),
                "nickname", user.getNickname(),
                "duelCoins", user.getDuelCoins()
            )))
            .orElse(ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "reason", "用户名或密码错误"
            )));
    }
}
