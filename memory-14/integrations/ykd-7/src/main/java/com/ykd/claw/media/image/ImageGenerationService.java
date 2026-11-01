package com.ykd.claw.media.image;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.media.ImageProcessor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ImageGenerationService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ImageGenerationService.class);
    private final String apiKey;
    private final String baseUrl;
    private final String model;
    private final String size;
    private final Duration pollInterval;
    private final Duration generationTimeout;
    private final HttpClient client;
    private final ObjectMapper objectMapper;
    private final Path outputDirectory;

    @Autowired
    public ImageGenerationService(
            @Value("${dashscope.api.key:}") String apiKey,
            @Value("${dashscope.base-url:https://dashscope.aliyuncs.com/api/v1}") String baseUrl,
            @Value("${dashscope.image.model:wanx2.1-t2i-turbo}") String model,
            @Value("${dashscope.image.size:1024*1024}") String size,
            @Value("${dashscope.image.poll-interval:5}") long pollSeconds,
            @Value("${dashscope.image.timeout:300}") long timeoutSeconds,
            ObjectMapper objectMapper) {
        this(apiKey, baseUrl, model, size, Duration.ofSeconds(Math.max(1, pollSeconds)),
                Duration.ofSeconds(Math.max(1, timeoutSeconds)),
                HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL)
                        .connectTimeout(Duration.ofSeconds(15)).build(),
                objectMapper, Path.of("generated"));
    }

    ImageGenerationService(String apiKey, String baseUrl, String model, String size,
                           Duration pollInterval, Duration generationTimeout, HttpClient client,
                           ObjectMapper objectMapper, Path outputDirectory) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.model = model;
        this.size = size;
        this.pollInterval = pollInterval;
        this.generationTimeout = generationTimeout;
        this.client = client;
        this.objectMapper = objectMapper;
        this.outputDirectory = outputDirectory;
    }

    public Path generate(String prompt) throws IOException, InterruptedException {
        if (apiKey.isBlank()) {
            throw new IOException("Image generation is not configured; set dashscope.api.key or DASHSCOPE_API_KEY");
        }
        String cleanPrompt = prompt == null ? "" : prompt.trim();
        if (cleanPrompt.isEmpty()) throw new IllegalArgumentException("prompt is required");

        Map<String, Object> input = Map.of("prompt", cleanPrompt);
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("size", size);
        parameters.put("n", 1);
        parameters.put("prompt_extend", true);
        parameters.put("watermark", false);
        Map<String, Object> body = Map.of("model", model, "input", input, "parameters", parameters);

        JsonNode created = sendJson(HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/services/aigc/text2image/image-synthesis"))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .header("X-DashScope-Async", "enable")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                .build());
        String taskId = created.path("output").path("task_id").asText("");
        if (taskId.isBlank()) throw new IOException("DashScope image response did not contain task_id");

        String imageUrl = poll(taskId);
        Files.createDirectories(outputDirectory);
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        Path downloaded = outputDirectory.resolve("img_" + timestamp + ".png");
        HttpResponse<InputStream> response = client.send(HttpRequest.newBuilder(URI.create(imageUrl))
                .timeout(Duration.ofSeconds(60)).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
        try (InputStream stream = response.body()) {
            if (response.statusCode() != 200) {
                throw new IOException("Image download failed: HTTP " + response.statusCode());
            }
            Files.copy(stream, downloaded, StandardCopyOption.REPLACE_EXISTING);
        }
        try {
            Path optimized = ImageProcessor.optimize(downloaded);
            if (!optimized.equals(downloaded)) Files.deleteIfExists(downloaded);
            return optimized;
        } catch (Exception e) {
            LOGGER.warn("Image optimization failed, returning original", e);
            return downloaded;
        }
    }

    private String poll(String taskId) throws IOException, InterruptedException {
        Instant deadline = Instant.now().plus(generationTimeout);
        while (Instant.now().isBefore(deadline)) {
            JsonNode result = sendJson(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/tasks/" + taskId))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + apiKey)
                    .GET().build());
            JsonNode output = result.path("output");
            String status = output.path("task_status").asText("");
            if ("SUCCEEDED".equals(status)) {
                JsonNode results = output.path("results");
                if (results.isArray() && !results.isEmpty()) {
                    String url = results.get(0).path("url").asText("");
                    if (!url.isBlank()) return url;
                }
                throw new IOException("DashScope image task succeeded without an image URL");
            }
            if ("FAILED".equals(status) || "CANCELED".equals(status) || "UNKNOWN".equals(status)) {
                throw new IOException("DashScope image task " + status + ": "
                        + output.path("message").asText(result.path("message").asText("unknown error")));
            }
            Thread.sleep(pollInterval.toMillis());
        }
        throw new IOException("DashScope image generation timed out after "
                + generationTimeout.toSeconds() + " seconds");
    }

    private JsonNode sendJson(HttpRequest request) throws IOException, InterruptedException {
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("DashScope image request failed: HTTP " + response.statusCode()
                    + " - " + concise(response.body()));
        }
        return objectMapper.readTree(response.body());
    }

    private static String stripTrailingSlash(String value) {
        String result = value == null || value.isBlank()
                ? "https://dashscope.aliyuncs.com/api/v1" : value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }

    private static String concise(String value) {
        if (value == null) return "";
        return value.length() <= 500 ? value : value.substring(0, 500) + "...";
    }
}
