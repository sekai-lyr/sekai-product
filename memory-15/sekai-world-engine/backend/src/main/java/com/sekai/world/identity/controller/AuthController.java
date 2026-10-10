package com.sekai.world.identity.controller;

import com.sekai.world.common.auth.CurrentUser;
import com.sekai.world.identity.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public AuthService.AuthResult register(@RequestBody Credentials request) {
        return authService.register(request.email(), request.password(), request.displayName());
    }

    @PostMapping("/login")
    public AuthService.AuthResult login(@RequestBody Credentials request) {
        return authService.login(request.email(), request.password());
    }

    @GetMapping("/me")
    public CurrentUser me(HttpServletRequest request) {
        return CurrentUser.require(request);
    }

    public record Credentials(String email, String password, String displayName) {
    }
}
