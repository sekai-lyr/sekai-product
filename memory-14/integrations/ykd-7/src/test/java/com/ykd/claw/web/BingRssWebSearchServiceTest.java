package com.ykd.claw.web;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BingRssWebSearchServiceTest {

    @Test
    void returnsTitlesSummariesAndLinksFromRss() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> query = new AtomicReference<>();
        server.createContext("/search", exchange -> {
            query.set(exchange.getRequestURI().getRawQuery());
            byte[] body = """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <rss version="2.0"><channel>
                      <item><title>Spring AI</title><link>https://example.com/spring-ai</link>
                      <description>Current &amp; useful summary</description></item>
                      <item><title>Second result</title><link>https://example.com/second</link>
                      <description>Another summary</description></item>
                    </channel></rss>
                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/xml; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/search";
            BingRssWebSearchService service = new BingRssWebSearchService(baseUrl, 1,
                    Duration.ofSeconds(2), HttpClient.newHttpClient());

            List<WebSearchResult> results = service.search("Spring AI tools");

            assertEquals(1, results.size());
            assertEquals("Spring AI", results.getFirst().title());
            assertEquals("Current & useful summary", results.getFirst().summary());
            assertEquals("https://example.com/spring-ai", results.getFirst().url());
            assertTrue(query.get().contains("format=rss"));
            assertTrue(query.get().contains("Spring+AI+tools"));
        } finally {
            server.stop(0);
        }
    }
}
