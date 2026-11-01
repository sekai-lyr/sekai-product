package com.example.demo.web;

import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @GetMapping("/login")
    public String login() {
        return "forward:/login.html";
    }

    @GetMapping("/register")
    public String register() {
        return "forward:/register.html";
    }

    @GetMapping("/")
    public String index(HttpSession session) {
        if (session.getAttribute("user") != null) {
            return "redirect:/assistants";
        }
        return "forward:/index.html";
    }

    @GetMapping("/home")
    public String home(HttpSession session) {
        if (session.getAttribute("user") == null) {
            return "redirect:/login";
        }
        return "redirect:/assistants";
    }

    @GetMapping("/assistants")
    public String assistants(HttpSession session) {
        if (session.getAttribute("user") == null) {
            return "redirect:/login";
        }
        return "forward:/assistants.html";
    }

    @GetMapping("/chat")
    public String chat(HttpSession session) {
        if (session.getAttribute("user") == null) {
            return "redirect:/login";
        }
        return "forward:/chat.html";
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/login";
    }
}