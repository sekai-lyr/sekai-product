package com.example.demo.ai;

import org.springframework.stereotype.Service;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Service
@ConditionalOnProperty(prefix = "spring.ai", name = "enabled", havingValue = "true", matchIfMissing = false)
public class AnimeEventService {

    public String searchUpcoming(String city, int limit) {
        return "Anime event search is temporarily disabled. Please try again later.";
    }

    public String searchIntelligence(String city, String keywords, int limit) {
        return "Anime intelligence search is temporarily disabled. Please try again later.";
    }
}
