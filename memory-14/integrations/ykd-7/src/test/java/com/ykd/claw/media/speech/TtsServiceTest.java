package com.ykd.claw.media.speech;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TtsServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void dynamicallySelectsMaleVoiceAndSendsAdjustments() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicReference<String> requestBody = new AtomicReference<>();
        byte[] audio = new byte[] {'I', 'D', '3', 4};

        server.createContext("/services/audio/tts/SpeechSynthesizer", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            String audioUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/audio.mp3";
            respond(exchange, 200, "{\"output\":{\"audio\":{\"url\":\"" + audioUrl + "\"}}}");
        });
        server.createContext("/audio.mp3", exchange -> {
            exchange.sendResponseHeaders(200, audio.length);
            exchange.getResponseBody().write(audio);
            exchange.close();
        });
        server.start();

        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            TtsService service = new TtsService("test-key", baseUrl, tempDir,
                    "female-id", "male-id");

            String result = service.synthesize("你好", new TtsService.TtsOptions(
                    null, "male", 1.2, 0.9, 1.1));

            Path generated = Path.of(result.substring("TTS audio: ".length()));
            assertArrayEquals(audio, Files.readAllBytes(generated));
            assertTrue(requestBody.get().contains("\"voice\":\"male-id\""));
            assertTrue(requestBody.get().contains("\"rate\":1.2"));
            assertTrue(requestBody.get().contains("\"pitch\":0.9"));
            assertTrue(requestBody.get().contains("\"volume\":55"));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void understandsChineseGenderAliasesAndPreservesExplicitVoiceId() {
        TtsService service = new TtsService("key", "http://localhost", tempDir,
                "female-id", "male-id");

        assertEquals("male-id", service.resolveVoice("男声", null));
        assertEquals("female-id", service.resolveVoice(null, "女音"));
        assertEquals("zh-CN-XiaoyiNeural", service.resolveVoice("zh-CN-XiaoyiNeural", "male"));
    }

    @Test
    void rejectsOutOfRangeAdjustment() {
        TtsService service = new TtsService("key", "http://localhost", tempDir,
                "female-id", "male-id");
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.synthesize("test",
                        new TtsService.TtsOptions(null, "female", 2.1, null, null)));
        assertTrue(error.getMessage().contains("speed"));
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
