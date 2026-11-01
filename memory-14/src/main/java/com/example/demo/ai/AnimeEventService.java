package com.example.demo.ai;

import org.springframework.stereotype.Service;

/**
 * 漫展情报服务。
 * 注意：不做条件装配——SpringAiTools 构造器硬依赖本 Bean，
 * 若加 @ConditionalOnProperty(spring.ai.enabled)，AI 关闭的 profile 下会因 Bean 缺失导致整个应用启动失败。
 * AI 关闭时本服务自动降级为提示文案。
 */
@Service
public class AnimeEventService {

    public String searchUpcoming(String city, int limit) {
        return "Anime event search is temporarily disabled. Please try again later.";
    }

    public String searchIntelligence(String city, String keywords, int limit) {
        return "Anime intelligence search is temporarily disabled. Please try again later.";
    }
}
