package com.ykd.claw.media.video;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.ykd.claw.config.SecretsManager;
import org.springframework.stereotype.Service;

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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Generates and downloads videos through Alibaba Cloud Model Studio's asynchronous Wan API.
 *
 * <p>For DashScope, two API formats are supported:
 * <ul>
 *   <li>Wan models (wan2.1, wanx2.1, wan2.2, wan2.5, wan2.6, wan2.7) → {@code /video-synthesis}
 *       endpoint. wan2.7 uses {@code resolution} + {@code ratio}; the other wan2.x models use
 *       {@code size}.</li>
 *   <li>Legacy models (wanx-v1, cogvideox) → {@code /generation} endpoint with
 *       {@code size} parameter.</li>
 * </ul>
 */
@Service
public class VideoGenerationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(VideoGenerationService.class.getName());
    private static final String DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
    private static final String DEFAULT_MODEL = "wan2.2-t2v-plus";
    private static final Duration REQUEST_TIMEOUT = Duration.ofMinutes(2);
    private static final Duration DEFAULT_POLL_INTERVAL = Duration.ofSeconds(5);
    private static final Duration DEFAULT_GENERATION_TIMEOUT = Duration.ofMinutes(15);
    private static final Path DEFAULT_OUTPUT_DIR = Path.of("generated");

    private final HttpClient httpClient;
    private final Gson gson = new Gson();
    private final String apiKey;
    private final String baseUrl;
    private final String model;
    private final Duration pollInterval;
    private final Duration generationTimeout;
    private final Path outputDir;

    public VideoGenerationService() {
        this(resolveApiKey(), resolveBaseUrl(), resolveModel(), DEFAULT_POLL_INTERVAL,
                DEFAULT_GENERATION_TIMEOUT, DEFAULT_OUTPUT_DIR);
    }

    public VideoGenerationService(String apiKey, String baseUrl, String model, Duration pollInterval,
                                  Duration generationTimeout, Path outputDir) {
        this.apiKey = apiKey;
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.model = (model != null && !model.isBlank()) ? model : DEFAULT_MODEL;
        this.pollInterval = pollInterval != null ? pollInterval : DEFAULT_POLL_INTERVAL;
        this.generationTimeout = generationTimeout != null ? generationTimeout : DEFAULT_GENERATION_TIMEOUT;
        this.outputDir = outputDir != null ? outputDir : DEFAULT_OUTPUT_DIR;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * Generate a video using Wan-style parameters (duration, resolution, ratio).
     * This is the primary entry point for wan2.5+ models.
     */
    public Path generate(String prompt, String imageUrl, int duration, String resolution,
                         String ratio, boolean promptExtend, boolean watermark,
                         String audioUrl, String negativePrompt, Integer seed)
            throws IOException, InterruptedException {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IOException("Video generation is not configured; set dashscope.api.key or DASHSCOPE_API_KEY");
        }
        String cleanPrompt = prompt == null ? "" : prompt.trim();
        if (cleanPrompt.isEmpty()) {
            throw new IllegalArgumentException("Video prompt must not be empty");
        }

        return generateDashScope(cleanPrompt, imageUrl, duration, resolution, ratio,
                promptExtend, watermark, audioUrl, negativePrompt, seed);
    }

    /**
     * Legacy entry point for backward compatibility with old-style parameters (width, height, numFrames, frameRate).
     * Used by older callers and converted to Wan parameters.
     */
    public Path generate(String prompt, String imageUrl, Integer width, Integer height,
                         Integer numFrames, Integer frameRate, String negativePrompt)
            throws IOException, InterruptedException {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IOException("Video generation is not configured; set dashscope.api.key or DASHSCOPE_API_KEY");
        }
        String cleanPrompt = prompt == null ? "" : prompt.trim();
        if (cleanPrompt.isEmpty()) {
            throw new IllegalArgumentException("Video prompt must not be empty");
        }

        int effectiveWidth = width == null ? 1152 : width;
        int effectiveHeight = height == null ? 768 : height;
        int effectiveFrames = numFrames == null ? 121 : numFrames;
        int effectiveFrameRate = frameRate == null ? 24 : frameRate;

        String resolution = effectiveHeight >= 1080 ? "1080P" : "720P";
        String ratio = dimensionsToRatio(effectiveWidth, effectiveHeight);
        int duration = Math.max(2, Math.min(15, effectiveFrames / effectiveFrameRate));
        return generateDashScope(cleanPrompt, imageUrl, duration, resolution, ratio,
                true, true, null, negativePrompt, null);
    }

    /**
     * DashScope video generation – supports both new Wan models (wan2.5+) and legacy models.
     */
    private Path generateDashScope(String prompt, String imageUrl, int duration, String resolution,
                                   String ratio, boolean promptExtend, boolean watermark,
                                   String audioUrl, String negativePrompt, Integer seed)
            throws IOException, InterruptedException {
        // All wan2.x / wanx2.1 models use the /video-synthesis endpoint.
        // Only wanx-v1 and cogvideox use the legacy /generation endpoint.
        boolean isNewWan = model.startsWith("wan2.") || model.startsWith("wanx2.1");

        if (isNewWan) {
            return generateDashScopeNewWan(prompt, imageUrl, duration, resolution, ratio,
                    promptExtend, watermark, audioUrl, negativePrompt, seed);
        } else {
            // Legacy models (wanx-v1, cogvideox) use the /generation endpoint
            boolean isTextToVideo = model.contains("cogvideox");
            return generateDashScopeLegacy(prompt, imageUrl, isTextToVideo);
        }
    }

    /**
     * New Wan models (wan2.5, wan2.6, wan2.7) – uses /video-synthesis endpoint.
     * wan2.7: uses resolution + ratio in parameters
     * wan2.6: uses size in parameters
     */
    private Path generateDashScopeNewWan(String prompt, String imageUrl, int duration,
                                         String resolution, String ratio, boolean promptExtend,
                                         boolean watermark, String audioUrl, String negativePrompt,
                                         Integer seed)
            throws IOException, InterruptedException {
        boolean isWan27 = model.startsWith("wan2.7");
        boolean isMultiShot = prompt.contains("第1个镜头") || prompt.contains("镜头[") || prompt.contains("Shot 1");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);

        Map<String, Object> input = new LinkedHashMap<>();
        input.put("prompt", prompt);
        if (imageUrl != null && !imageUrl.isBlank()) {
            input.put("image_url", imageUrl.trim());
        }
        if (audioUrl != null && !audioUrl.isBlank()) {
            input.put("audio_url", audioUrl.trim());
        }
        body.put("input", input);

        Map<String, Object> parameters = new LinkedHashMap<>();
        if (isWan27) {
            // wan2.7 uses resolution + ratio
            parameters.put("resolution", resolution != null ? resolution : "1080P");
            parameters.put("ratio", ratio != null ? ratio : "16:9");
        } else {
            // wan2.5/wan2.6 uses size
            parameters.put("size", resolveSize(resolution, ratio));
        }
        parameters.put("duration", duration > 0 ? duration : 5);
        if (promptExtend) parameters.put("prompt_extend", true);
        if (watermark) parameters.put("watermark", true);
        if (isMultiShot) parameters.put("shot_type", "multi");
        if (negativePrompt != null && !negativePrompt.isBlank()) {
            parameters.put("negative_prompt", negativePrompt.trim());
        }
        if (seed != null) parameters.put("seed", seed);
        body.put("parameters", parameters);

        LOGGER.info("DashScope Wan video generation: model=" + model + ", resolution=" + resolution
                + ", ratio=" + ratio + ", duration=" + duration);

        Map<String, Object> created = sendJson(HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/services/aigc/video-generation/video-synthesis"))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .header("X-DashScope-Async", "enable")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body), StandardCharsets.UTF_8))
                .build(), "create video task");

        String taskId = extractTaskId(created);
        LOGGER.info("DashScope Wan video task created: " + taskId);

        return pollDashScopeTask(taskId);
    }

    /**
     * Resolve a valid DashScope {@code size} value for the configured model.
     *
     * <p>Most wan2.x models accept standard 480P/720P/1080P tiers via
     * {@link #ratioToDimensions(String, String)}. The wan2.2 series only supports the 480P and
     * 1080P tiers (no 720P), so a requested 720P is raised to the model's native 1080P default
     * instead of producing an unsupported {@code 1280*720}.
     */
    private String resolveSize(String resolution, String ratio) {
        if (model.startsWith("wan2.2")) {
            boolean tall = "9:16".equalsIgnoreCase(ratio);
            if ("480P".equalsIgnoreCase(resolution)) {
                return tall ? "480*832" : "832*480";
            }
            // wan2.2 has no 720P tier; fall back to the model's native 1080P default
            return tall ? "1080*1920" : "1920*1080";
        }
        int[] dims = ratioToDimensions(ratio, resolution);
        return dims[0] + "*" + dims[1];
    }

    /**
     * Legacy DashScope models (wanx-v1, cogvideox) – uses /generation endpoint.
     */
    private Path generateDashScopeLegacy(String prompt, String imageUrl, boolean isTextToVideo)
            throws IOException, InterruptedException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);

        Map<String, Object> input = new LinkedHashMap<>();
        input.put("prompt", prompt);

        if (isTextToVideo) {
            LOGGER.info("Using text-to-video model: " + model);
        } else {
            if (imageUrl == null || imageUrl.isBlank()) {
                throw new IOException("wanx-v1 model requires an image URL for video generation. "
                        + "Please provide an image URL or use a text-to-video model like cogvideox.");
            }
            input.put("image_url", imageUrl.trim());
        }

        body.put("input", input);
        body.put("parameters", new LinkedHashMap<>() {{
            put("size", "1280*720");
            put("n", 1);
        }});

        LOGGER.info("DashScope legacy video generation: model=" + model);

        Map<String, Object> created = sendJson(HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/services/aigc/video-generation/generation"))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body), StandardCharsets.UTF_8))
                .build(), "create video task");

        String taskId = extractTaskId(created);
        LOGGER.info("DashScope legacy video task created: " + taskId);

        return pollDashScopeTask(taskId);
    }

    private String extractTaskId(Map<String, Object> response) throws IOException {
        Object output = response.get("output");
        if (output instanceof Map<?, ?> outputMap) {
            Object taskId = outputMap.get("task_id");
            if (taskId instanceof String id && !id.isBlank()) return id;
        }
        Object taskId = response.get("task_id");
        if (taskId instanceof String id && !id.isBlank()) return id;
        throw new IOException("DashScope response did not contain task_id. Response: " + gson.toJson(response));
    }

    private Path pollDashScopeTask(String taskId) throws IOException, InterruptedException {
        String videoUrl = null;
        long deadline = System.nanoTime() + generationTimeout.toNanos();
        while (videoUrl == null && System.nanoTime() < deadline) {
            if (!pollInterval.isZero() && !pollInterval.isNegative()) {
                Thread.sleep(pollInterval.toMillis());
            }

            Map<String, Object> status = sendJson(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/tasks/" + taskId))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Authorization", "Bearer " + apiKey)
                    .GET().build(), "query video task");

            String state = null;
            Object statusOutput = status.get("output");
            if (statusOutput instanceof Map<?, ?> outputMap) {
                state = (String) outputMap.get("task_status");
            }
            if (state == null) {
                state = (String) status.get("task_status");
            }

            LOGGER.info("DashScope video task status: " + state);

            if ("failed".equalsIgnoreCase(state) || "canceled".equalsIgnoreCase(state)) {
                throw new IOException("DashScope video task failed: " + gson.toJson(status));
            }

            if ("succeeded".equalsIgnoreCase(state) || "SUCCEEDED".equalsIgnoreCase(state)) {
                Object succeededOutput = status.get("output");
                if (succeededOutput instanceof Map<?, ?> outputMap) {
                    videoUrl = (String) outputMap.get("video_url");
                }
            }
        }

        if (videoUrl == null) {
            throw new IOException("DashScope video task timed out after " + generationTimeout.toMinutes() + " minutes");
        }

        LOGGER.info("DashScope video generated: " + videoUrl);
        return downloadVideo(videoUrl);
    }

    static void validateParameters(int width, int height, int numFrames, int frameRate) {
        if (width <= 0 || height <= 0) throw new IllegalArgumentException("Video dimensions must be positive");
        if (numFrames < 1 || numFrames > 441 || (numFrames - 1) % 8 != 0) {
            throw new IllegalArgumentException("num_frames must be <= 441 and follow the 8n+1 rule");
        }
        if (frameRate < 1 || frameRate > 60) {
            throw new IllegalArgumentException("frame_rate must be between 1 and 60");
        }
    }

    /**
     * Convert a ratio string (e.g. "16:9") and resolution (e.g. "1080P") to pixel dimensions.
     */
    static int[] ratioToDimensions(String ratio, String resolution) {
        int baseHeight = "1080P".equalsIgnoreCase(resolution) ? 1080 : 720;
        if (ratio == null || ratio.isBlank()) ratio = "16:9";
        return switch (ratio) {
            case "16:9" -> new int[]{baseHeight * 16 / 9, baseHeight};
            case "9:16" -> new int[]{baseHeight, baseHeight * 16 / 9};
            case "1:1" -> new int[]{baseHeight, baseHeight};
            case "4:3" -> new int[]{baseHeight * 4 / 3, baseHeight};
            case "3:4" -> new int[]{baseHeight, baseHeight * 4 / 3};
            default -> new int[]{baseHeight * 16 / 9, baseHeight};
        };
    }

    /**
     * Convert pixel dimensions to a ratio string.
     */
    static String dimensionsToRatio(int width, int height) {
        double ratio = (double) width / height;
        if (Math.abs(ratio - 16.0 / 9.0) < 0.1) return "16:9";
        if (Math.abs(ratio - 9.0 / 16.0) < 0.1) return "9:16";
        if (Math.abs(ratio - 1.0) < 0.1) return "1:1";
        if (Math.abs(ratio - 4.0 / 3.0) < 0.1) return "4:3";
        if (Math.abs(ratio - 3.0 / 4.0) < 0.1) return "3:4";
        return "16:9"; // default
    }

    private Map<String, Object> sendJson(HttpRequest request, String operation)
            throws IOException, InterruptedException {
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("DashScope " + operation + " failed: HTTP " + response.statusCode()
                    + " - " + response.body());
        }
        Map<String, Object> value = gson.fromJson(response.body(),
                new TypeToken<Map<String, Object>>() {}.getType());
        if (value == null) throw new IOException("DashScope " + operation + " returned an empty response");
        return value;
    }

    private Path downloadVideo(String videoUrl) throws IOException, InterruptedException {
        Files.createDirectories(outputDir);
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Path output = outputDir.resolve("video_" + timestamp + "_" + suffix + ".mp4");
        Path partial = output.resolveSibling(output.getFileName() + ".part");

        HttpResponse<InputStream> response = httpClient.send(HttpRequest.newBuilder()
                        .uri(URI.create(videoUrl)).timeout(Duration.ofMinutes(5)).GET().build(),
                HttpResponse.BodyHandlers.ofInputStream());
        try (InputStream input = response.body()) {
            if (response.statusCode() != 200) {
                throw new IOException("Video download failed: HTTP " + response.statusCode());
            }
            Files.copy(input, partial, StandardCopyOption.REPLACE_EXISTING);
        }
        if (Files.size(partial) == 0) {
            Files.deleteIfExists(partial);
            throw new IOException("Video download returned an empty file");
        }
        Files.move(partial, output, StandardCopyOption.REPLACE_EXISTING);
        LOGGER.info("Video saved: " + output.toAbsolutePath());
        return output.toAbsolutePath();
    }

    private static String resolveApiKey() {
        return SecretsManager.getOptional("dashscope.api.key", "DASHSCOPE_API_KEY");
    }

    private static String resolveBaseUrl() {
        String configured = System.getenv("DASHSCOPE_BASE_URL");
        return configured == null || configured.isBlank() ? DEFAULT_BASE_URL : configured;
    }

    private static String resolveModel() {
        String configured = System.getenv("DASHSCOPE_VIDEO_MODEL");
        return configured == null || configured.isBlank() ? DEFAULT_MODEL : configured;
    }

    private static String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) return DEFAULT_BASE_URL;
        String result = value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }
}
