package com.ykd.claw.media.video;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VideoGenerationServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void createsPollsAndDownloadsVideoFromDashScope() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicInteger polls = new AtomicInteger();
        AtomicReference<String> createBody = new AtomicReference<>();
        byte[] video = new byte[] {0, 0, 0, 24, 'f', 't', 'y', 'p'};

        // DashScope 创建任务 (legacy /generation endpoint)
        server.createContext("/services/aigc/video-generation/generation", exchange -> {
            createBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            assertEquals("Bearer test-key", exchange.getRequestHeaders().getFirst("Authorization"));
            respond(exchange, 200, "{\"output\":{\"task_id\":\"task-123\"},\"request_id\":\"req-1\"}");
        });
        // DashScope 查询任务状态
        server.createContext("/tasks/task-123", exchange -> {
            polls.incrementAndGet();
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/result.mp4";
            respond(exchange, 200, "{\"output\":{\"task_status\":\"SUCCEEDED\",\"video_url\":\"" + url + "\"}}");
        });
        server.createContext("/result.mp4", exchange -> {
            exchange.sendResponseHeaders(200, video.length);
            exchange.getResponseBody().write(video);
            exchange.close();
        });
        server.start();

        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            VideoGenerationService service = new VideoGenerationService(
                    "test-key", baseUrl, "wanx-v1", Duration.ZERO, Duration.ofSeconds(2), tempDir);

            Path result = service.generate("a moving cat", "http://example.com/cat.jpg", 1280, 720, null, null, null);

            assertArrayEquals(video, Files.readAllBytes(result));
            assertEquals(1, polls.get());
            assertTrue(createBody.get().contains("\"model\":\"wanx-v1\""));
            assertTrue(createBody.get().contains("\"image_url\":\"http://example.com/cat.jpg\""));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void createsPollsAndDownloadsTextToVideoFromDashScope() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicInteger polls = new AtomicInteger();
        AtomicReference<String> createBody = new AtomicReference<>();
        AtomicReference<String> asyncHeader = new AtomicReference<>();
        byte[] video = new byte[] {0, 0, 0, 24, 'f', 't', 'y', 'p'};

        // DashScope 创建任务 (wan2.1 使用 /video-synthesis 端点)
        server.createContext("/services/aigc/video-generation/video-synthesis", exchange -> {
            createBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            asyncHeader.set(exchange.getRequestHeaders().getFirst("X-DashScope-Async"));
            assertEquals("Bearer test-key", exchange.getRequestHeaders().getFirst("Authorization"));
            respond(exchange, 200, "{\"output\":{\"task_id\":\"task-456\"},\"request_id\":\"req-2\"}");
        });
        // DashScope 查询任务状态
        server.createContext("/tasks/task-456", exchange -> {
            polls.incrementAndGet();
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/result.mp4";
            respond(exchange, 200, "{\"output\":{\"task_status\":\"SUCCEEDED\",\"video_url\":\"" + url + "\"}}");
        });
        server.createContext("/result.mp4", exchange -> {
            exchange.sendResponseHeaders(200, video.length);
            exchange.getResponseBody().write(video);
            exchange.close();
        });
        server.start();

        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            VideoGenerationService service = new VideoGenerationService(
                    "test-key", baseUrl, "wan2.1-t2v-turbo", Duration.ZERO, Duration.ofSeconds(2), tempDir);

            // 文本生成视频，不需要图片
            Path result = service.generate("a cute cat rolling on the grass", null, 1280, 720, null, null, null);

            assertArrayEquals(video, Files.readAllBytes(result));
            assertEquals(1, polls.get());
            assertEquals("enable", asyncHeader.get());
            assertTrue(createBody.get().contains("\"model\":\"wan2.1-t2v-turbo\""));
            assertTrue(createBody.get().contains("\"prompt\":\"a cute cat rolling on the grass\""));
            assertTrue(createBody.get().contains("\"size\":\"1280*720\""));
            assertTrue(createBody.get().contains("\"duration\":5"));
            // 文本生成视频不应该包含 image_url
            assertFalse(createBody.get().contains("\"image_url\""));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void routesWan22ToVideoSynthesisAndUsesValidSize() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicInteger polls = new AtomicInteger();
        AtomicReference<String> createBody = new AtomicReference<>();
        AtomicReference<String> asyncHeader = new AtomicReference<>();
        byte[] video = new byte[] {0, 0, 0, 24, 'f', 't', 'y', 'p'};

        // wan2.2 使用 /video-synthesis 端点（修复前的 bug 是错误路由到 /generation）
        server.createContext("/services/aigc/video-generation/video-synthesis", exchange -> {
            createBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            asyncHeader.set(exchange.getRequestHeaders().getFirst("X-DashScope-Async"));
            respond(exchange, 200, "{\"output\":{\"task_id\":\"task-wan22\"},\"request_id\":\"req-5\"}");
        });
        server.createContext("/tasks/task-wan22", exchange -> {
            polls.incrementAndGet();
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/result.mp4";
            respond(exchange, 200, "{\"output\":{\"task_status\":\"SUCCEEDED\",\"video_url\":\"" + url + "\"}}");
        });
        server.createContext("/result.mp4", exchange -> {
            exchange.sendResponseHeaders(200, video.length);
            exchange.getResponseBody().write(video);
            exchange.close();
        });
        server.start();

        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            VideoGenerationService service = new VideoGenerationService(
                    "test-key", baseUrl, "wan2.2-t2v-plus", Duration.ZERO, Duration.ofSeconds(2), tempDir);

            // wan2.2 不支持 720P；请求 720P 时应抬升到原生 1080P (1920*1080)
            Path result = service.generate("a cute orange cat eating fish", null, 5, "720P", "16:9",
                    true, true, null, null, null);

            assertArrayEquals(video, Files.readAllBytes(result));
            assertEquals(1, polls.get());
            assertEquals("enable", asyncHeader.get());
            assertTrue(createBody.get().contains("\"model\":\"wan2.2-t2v-plus\""));
            assertTrue(createBody.get().contains("\"prompt\":\"a cute orange cat eating fish\""));
            assertTrue(createBody.get().contains("\"size\":\"1920*1080\""));
            assertTrue(createBody.get().contains("\"duration\":5"));
            assertTrue(createBody.get().contains("\"prompt_extend\":true"));
            assertTrue(createBody.get().contains("\"watermark\":true"));
            assertFalse(createBody.get().contains("\"image_url\""));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void createsPollsAndDownloadsVideoFromNewWanModel() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicInteger polls = new AtomicInteger();
        AtomicReference<String> createBody = new AtomicReference<>();
        AtomicReference<String> asyncHeader = new AtomicReference<>();
        byte[] video = new byte[] {0, 0, 0, 24, 'f', 't', 'y', 'p'};

        // 新 Wan 模型使用 /video-synthesis 端点
        server.createContext("/services/aigc/video-generation/video-synthesis", exchange -> {
            createBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            asyncHeader.set(exchange.getRequestHeaders().getFirst("X-DashScope-Async"));
            assertEquals("Bearer test-key", exchange.getRequestHeaders().getFirst("Authorization"));
            respond(exchange, 200, "{\"output\":{\"task_id\":\"task-789\"},\"request_id\":\"req-3\"}");
        });
        server.createContext("/tasks/task-789", exchange -> {
            polls.incrementAndGet();
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/result.mp4";
            respond(exchange, 200, "{\"output\":{\"task_status\":\"SUCCEEDED\",\"video_url\":\"" + url + "\"}}");
        });
        server.createContext("/result.mp4", exchange -> {
            exchange.sendResponseHeaders(200, video.length);
            exchange.getResponseBody().write(video);
            exchange.close();
        });
        server.start();

        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            VideoGenerationService service = new VideoGenerationService(
                    "test-key", baseUrl, "wan2.6-t2v", Duration.ZERO, Duration.ofSeconds(2), tempDir);

            Path result = service.generate("a cute cat rolling on the grass", null, 5, "720P", "16:9",
                    true, true, null, null, null);

            assertArrayEquals(video, Files.readAllBytes(result));
            assertEquals(1, polls.get());
            // 验证新端点和异步 header
            assertEquals("enable", asyncHeader.get());
            assertTrue(createBody.get().contains("\"model\":\"wan2.6-t2v\""));
            assertTrue(createBody.get().contains("\"prompt\":\"a cute cat rolling on the grass\""));
            assertTrue(createBody.get().contains("\"size\":\"1280*720\""));
            assertTrue(createBody.get().contains("\"duration\":5"));
            assertTrue(createBody.get().contains("\"prompt_extend\":true"));
            assertTrue(createBody.get().contains("\"watermark\":true"));
            assertFalse(createBody.get().contains("\"image_url\""));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void createsPollsAndDownloadsVideoFromWan27Model() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> createBody = new AtomicReference<>();
        byte[] video = new byte[] {0, 0, 0, 24, 'f', 't', 'y', 'p'};

        server.createContext("/services/aigc/video-generation/video-synthesis", exchange -> {
            createBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, 200, "{\"output\":{\"task_id\":\"task-wan27\"},\"request_id\":\"req-4\"}");
        });
        server.createContext("/tasks/task-wan27", exchange -> {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/result.mp4";
            respond(exchange, 200, "{\"output\":{\"task_status\":\"SUCCEEDED\",\"video_url\":\"" + url + "\"}}");
        });
        server.createContext("/result.mp4", exchange -> {
            exchange.sendResponseHeaders(200, video.length);
            exchange.getResponseBody().write(video);
            exchange.close();
        });
        server.start();

        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            VideoGenerationService service = new VideoGenerationService(
                    "test-key", baseUrl, "wan2.7-t2v-2026-06-12", Duration.ZERO, Duration.ofSeconds(2), tempDir);

            Path result = service.generate("a futuristic city", null, 10, "1080P", "16:9",
                    true, true, null, "blurry, dark", 42);

            assertArrayEquals(video, Files.readAllBytes(result));
            // wan2.7 使用 resolution + ratio 而非 size
            assertTrue(createBody.get().contains("\"model\":\"wan2.7-t2v-2026-06-12\""));
            assertTrue(createBody.get().contains("\"resolution\":\"1080P\""));
            assertTrue(createBody.get().contains("\"ratio\":\"16:9\""));
            assertTrue(createBody.get().contains("\"duration\":10"));
            assertTrue(createBody.get().contains("\"negative_prompt\":\"blurry, dark\""));
            assertTrue(createBody.get().contains("\"seed\":42"));
            assertFalse(createBody.get().contains("\"size\""));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void rejectsFramesThatDoNotFollowEightNPlusOneRule() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> VideoGenerationService.validateParameters(1152, 768, 120, 24));
        assertTrue(error.getMessage().contains("8n+1"));
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
