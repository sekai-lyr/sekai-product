package com.example.demo.basic;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/basic")
public class BasicController {

    @GetMapping("/health")
    public String health() {
        return "Anime AI Basic Service is running!";
    }

    @GetMapping("/status")
    public String status() {
        return "Service is healthy and ready for requests.";
    }
}
