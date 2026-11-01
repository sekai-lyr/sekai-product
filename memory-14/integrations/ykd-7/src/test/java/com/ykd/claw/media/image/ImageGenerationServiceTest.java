package com.ykd.claw.media.image;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImageGenerationServiceTest {
    @TempDir
    Path tempDir;

    @Test
    void createsPollsAndDownloadsDashScopeImage() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicReference<String> createBody = new AtomicReference<>();
        byte[] image = new byte[] {1, 2, 3, 4};
        server.createContext("/api/v1/services/aigc/text2image/image-synthesis", exchange -> {
            createBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, "{\"output\":{\"task_id\":\"image-task-1\"}}");
        });
        server.createContext("/api/v1/tasks/image-task-1", exchange -> {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/result.png";
            respond(exchange, "{\"output\":{\"task_status\":\"SUCCEEDED\",\"results\":[{\"url\":\""
                    + url + "\"}]}}");
        });
        server.createContext("/result.png", exchange -> {
            exchange.sendResponseHeaders(200, image.length);
            exchange.getResponseBody().write(image);
            exchange.close();
        });
        server.start();
        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/api/v1";
            ImageGenerationService service = new ImageGenerationService("key", baseUrl,
                    "wanx2.1-t2i-turbo", "1024*1024", Duration.ofMillis(1),
                    Duration.ofSeconds(2), HttpClient.newHttpClient(), new ObjectMapper(), tempDir);
            Path result = service.generate("一只小猫");
            assertArrayEquals(image, Files.readAllBytes(result));
            assertTrue(createBody.get().contains("\"model\":\"wanx2.1-t2i-turbo\""));
            assertTrue(createBody.get().contains("\"prompt\":\"一只小猫\""));
        } finally {
            server.stop(0);
        }
    }

    private static void respond(com.sun.net.httpserver.HttpExchange exchange, String body)
            throws java.io.IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
