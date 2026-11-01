package com.ykd.claw.web;

import com.ykd.claw.infrastructure.http.WebHttpClientFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BingRssWebSearchService implements WebSearchService {
    private static final String USER_AGENT = "Mozilla/5.0 (compatible; OpenClaw/1.0; web-search-tool)";
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);

    private final HttpClient client;
    private final String baseUrl;
    private final int maxResults;
    private final Duration timeout;

    // Simple TTL cache for search results
    private record CachedSearch(List<WebSearchResult> results, Instant expiresAt) {
        boolean isExpired() { return Instant.now().isAfter(expiresAt); }
    }
    private final Map<String, CachedSearch> searchCache = new ConcurrentHashMap<>();

    // Cached XML parser factory to avoid reconfiguration on every parse
    private final DocumentBuilderFactory documentBuilderFactory;

    {
        try {
            documentBuilderFactory = DocumentBuilderFactory.newInstance();
            documentBuilderFactory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            documentBuilderFactory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            documentBuilderFactory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            documentBuilderFactory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            documentBuilderFactory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            documentBuilderFactory.setExpandEntityReferences(false);
        } catch (ParserConfigurationException e) {
            throw new IllegalStateException("Failed to configure XML parser", e);
        }
    }

    @Autowired
    public BingRssWebSearchService(
            @Value("${websearch.base-url:https://www.bing.com/search}") String baseUrl,
            @Value("${websearch.max-results:5}") int maxResults,
            @Value("${websearch.timeout:15}") long timeoutSeconds,
            @Value("${web.proxy-url:}") String proxyUrl) {
        this(baseUrl, maxResults, Duration.ofSeconds(Math.max(1, timeoutSeconds)),
                WebHttpClientFactory.create(proxyUrl, HttpClient.Redirect.NORMAL));
    }

    BingRssWebSearchService(String baseUrl, int maxResults, Duration timeout, HttpClient client) {
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.maxResults = Math.max(1, Math.min(10, maxResults));
        this.timeout = timeout;
        this.client = client;
    }

    @Override
    public List<WebSearchResult> search(String keyword) throws IOException, InterruptedException {
        String query = keyword == null ? "" : keyword.trim();
        if (query.isEmpty()) throw new IllegalArgumentException("keyword is required");
        if (query.length() > 300) throw new IllegalArgumentException("keyword must not exceed 300 characters");

        // Check cache
        CachedSearch cached = searchCache.get(query);
        if (cached != null && !cached.isExpired()) return cached.results();

        String separator = baseUrl.contains("?") ? "&" : "?";
        URI uri = URI.create(baseUrl + separator + "format=rss&q="
                + URLEncoder.encode(query, StandardCharsets.UTF_8));
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(timeout)
                .header("Accept", "application/rss+xml, application/xml, text/xml")
                .header("User-Agent", USER_AGENT).GET().build();
        HttpResponse<String> response = client.send(request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Web search failed: HTTP " + response.statusCode());
        }
        List<WebSearchResult> results = parse(response.body());
        searchCache.put(query, new CachedSearch(results, Instant.now().plus(CACHE_TTL)));
        return results;
    }

    private List<WebSearchResult> parse(String xml) throws IOException {
        try {
            Document document = documentBuilderFactory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
            NodeList items = document.getElementsByTagName("item");
            List<WebSearchResult> results = new ArrayList<>();
            for (int index = 0; index < items.getLength() && results.size() < maxResults; index++) {
                Element item = (Element) items.item(index);
                String title = text(item, "title");
                String link = text(item, "link");
                String summary = cleanSummary(text(item, "description"));
                if (!title.isBlank() && !link.isBlank()) {
                    results.add(new WebSearchResult(title, summary, link));
                }
            }
            return List.copyOf(results);
        } catch (Exception e) {
            throw new IOException("Web search returned invalid RSS", e);
        }
    }

    private static String text(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent().trim();
    }

    private static String cleanSummary(String value) {
        return value.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }

    private static String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) return "https://www.bing.com/search";
        String result = value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }
}
