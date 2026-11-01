package com.ykd.claw.web;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public final class NewsTool implements ToolProvider {
    private final WebSearchService service;

    public NewsTool(WebSearchService service) {
        this.service = service;
    }

    /**
     * Search news by keyword
     * @param query search keyword (e.g., "technology", "AI", "sports")
     * @param pageSize number of results to return (default 10, max 100)
     * @return news search results
     */
    @Tool(name = "search_news", description = "Search news articles by keyword. Returns recent news matching the query.")
    public String searchNews(
            @ToolParam(description = "Search keyword or phrase (e.g., 'technology', 'AI', 'sports')") String query,
            @ToolParam(description = "Number of results to return (1-100, default 10)", required = false) Integer pageSize) throws Exception {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search query is required");
        }
        int size = (pageSize != null && pageSize > 0 && pageSize <= 100) ? pageSize : 10;
        return format(service.search(query + " 最新新闻"), size);
    }

    /**
     * Get top headlines by country and category
     * @param country country code (e.g., "cn" for China, "us" for USA)
     * @param category category (business, entertainment, general, health, science, sports, technology)
     * @param pageSize number of results to return (default 10, max 100)
     * @return top headlines
     */
    @Tool(name = "get_top_headlines", description = "Get top news headlines by country and category.")
    public String getTopHeadlines(
            @ToolParam(description = "Country code (e.g., 'cn' for China, 'us' for USA, 'global' for worldwide)") String country,
            @ToolParam(description = "Category: business, entertainment, general, health, science, sports, technology", required = false) String category,
            @ToolParam(description = "Number of results to return (1-100, default 10)", required = false) Integer pageSize) throws Exception {
        int size = (pageSize != null && pageSize > 0 && pageSize <= 100) ? pageSize : 10;
        String cat = (category != null && !category.isBlank()) ? category : null;
        String ctry = (country != null && !country.isBlank()) ? country : null;
        StringBuilder query = new StringBuilder();
        if (ctry != null && !"global".equalsIgnoreCase(ctry)) query.append(ctry).append(' ');
        if (cat != null) query.append(cat).append(' ');
        query.append("今日头条 最新新闻");
        return format(service.search(query.toString()), size);
    }

    private static String format(java.util.List<WebSearchResult> results, int limit) {
        if (results.isEmpty()) return "No news found";
        StringBuilder text = new StringBuilder("News results:\n");
        for (int i = 0; i < Math.min(limit, results.size()); i++) {
            WebSearchResult result = results.get(i);
            text.append(i + 1).append(". ").append(result.title()).append('\n')
                    .append("   ").append(result.summary()).append('\n')
                    .append("   URL: ").append(result.url()).append('\n');
        }
        return text.toString().trim();
    }
}
