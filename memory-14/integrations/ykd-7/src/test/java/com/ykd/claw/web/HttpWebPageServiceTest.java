package com.ykd.claw.web;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HttpWebPageServiceTest {

    @Test
    void followsRedirectAndExtractsHtmlTitleAndBody() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/start", exchange -> {
            exchange.getResponseHeaders().set("Location", "/article");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/article", exchange -> {
            byte[] body = """
                    <!doctype html><html><head><title>Example Article</title></head>
                    <body><nav>Navigation</nav><main><h1>Agent Tools</h1>
                    <p>This page explains safe web access.</p></main></body></html>
                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/start";
            HttpWebPageService service = new HttpWebPageService(100_000, 10_000, 3,
                    Duration.ofSeconds(2), HttpClient.newHttpClient(), true);

            WebPageContent page = service.fetch(url);

            assertEquals("Example Article", page.title());
            assertTrue(page.finalUrl().endsWith("/article"));
            assertTrue(page.content().contains("Agent Tools"));
            assertTrue(page.content().contains("safe web access"));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void blocksLocalNetworkUrlsInProductionMode() {
        HttpWebPageService service = new HttpWebPageService(100_000, 10_000, 3,
                Duration.ofSeconds(2), HttpClient.newHttpClient(), false);

        IOException error = assertThrows(IOException.class,
                () -> service.fetch("http://127.0.0.1/private"));
        assertTrue(error.getMessage().contains("private network"));
    }
}
