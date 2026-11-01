package com.ykd.claw.media.speech;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.ykd.claw.config.SecretsManager;

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
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Alibaba Cloud Model Studio non-streaming text-to-speech service.
 */
public class TtsService {
    private static final Logger LOGGER = LoggerFactory.getLogger(TtsService.class.getName());
    private static final String DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
    private static final String TTS_PATH = "/services/audio/tts/SpeechSynthesizer";
    private static final String DEFAULT_MODEL = "qwen-audio-3.0-tts-flash";
    private static final String DEFAULT_FEMALE_VOICE = "longanhuan_v3.6";
    private static final String DEFAULT_MALE_VOICE = "longjielidou_v3.6";
    private static final Duration TIMEOUT = Duration.ofSeconds(120);
    private static volatile TtsService INSTANCE;

    private final HttpClient httpClient;
    private final Gson gson = new Gson();
    private final String apiKey;
    private final String baseUrl;
    private final Path outputDir;
    private final String model;
    private final String femaleVoice;
    private final String maleVoice;

    private TtsService() {
        this(SecretsManager.getOptional("dashscope.api.key", "DASHSCOPE_API_KEY"),
                environmentOrDefault("DASHSCOPE_BASE_URL", DEFAULT_BASE_URL), Path.of("generated"),
                configuredVoice("dashscope.tts.voice.female", "DASHSCOPE_TTS_FEMALE_VOICE", DEFAULT_FEMALE_VOICE),
                configuredVoice("dashscope.tts.voice.male", "DASHSCOPE_TTS_MALE_VOICE", DEFAULT_MALE_VOICE));
    }

    TtsService(String apiKey, String baseUrl, Path outputDir, String femaleVoice, String maleVoice) {
        this.apiKey = apiKey;
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.outputDir = outputDir;
        this.model = environmentOrDefault("DASHSCOPE_TTS_MODEL", DEFAULT_MODEL);
        this.femaleVoice = femaleVoice;
        this.maleVoice = maleVoice;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public static TtsService getInstance() {
        if (INSTANCE == null) {
            synchronized (TtsService.class) {
                if (INSTANCE == null) INSTANCE = new TtsService();
            }
        }
        return INSTANCE;
    }

    public String synthesize(String text, String voice) throws IOException, InterruptedException {
        return synthesize(text, new TtsOptions(voice, null, null, null, null));
    }

    public String synthesize(String text, TtsOptions options) throws IOException, InterruptedException {
        if (apiKey == null || apiKey.isBlank()) {
            return "TTS not configured (set dashscope.api.key in secrets.properties)";
        }
        if (text == null || text.isBlank()) return "No text to synthesize";

        TtsOptions effective = options == null ? new TtsOptions(null, null, null, null, null) : options;
        String voice = resolveVoice(effective.voice(), effective.gender());
        double speed = normalizeMultiplier("speed", effective.speed());
        double pitch = normalizeMultiplier("pitch", effective.pitch());
        double volume = normalizeMultiplier("volume", effective.volume());

        Map<String, Object> input = new LinkedHashMap<>();
        input.put("text", text);
        input.put("voice", voice);
        input.put("format", "mp3");
        input.put("sample_rate", 24000);
        input.put("rate", speed);
        input.put("pitch", pitch);
        input.put("volume", Math.round(volume * 50));
        Map<String, Object> body = Map.of("model", model, "input", input);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + TTS_PATH))
                .timeout(TIMEOUT)
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body), StandardCharsets.UTF_8))
                .build();
        LOGGER.info("DashScope TTS request: model=" + model + ", voice=" + voice + ", text_len=" + text.length());
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("DashScope TTS failed: HTTP " + response.statusCode() + " - " + concise(response.body()));
        }

        JsonObject root = gson.fromJson(response.body(), JsonObject.class);
        String audioUrl = nestedString(root, "output", "audio", "url");
        if (audioUrl.isBlank()) throw new IOException("DashScope TTS returned no audio URL");

        Files.createDirectories(outputDir);
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        Path outputPath = outputDir.resolve("tts_" + timestamp + ".mp3");
        HttpResponse<InputStream> download = httpClient.send(HttpRequest.newBuilder(URI.create(audioUrl))
                .timeout(Duration.ofSeconds(60)).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
        try (InputStream audio = download.body()) {
            if (download.statusCode() != 200) {
                throw new IOException("TTS audio download failed: HTTP " + download.statusCode());
            }
            Files.copy(audio, outputPath, StandardCopyOption.REPLACE_EXISTING);
        }
        if (Files.size(outputPath) <= 0) {
            Files.deleteIfExists(outputPath);
            throw new IOException("TTS audio download returned an empty file");
        }
        return "TTS audio: " + outputPath.toAbsolutePath();
    }

    String resolveVoice(String voice, String gender) {
        String voiceGender = normalizeGender(voice);
        if (voice != null && !voice.isBlank() && voiceGender == null) return voice.trim();
        String requestedGender = voiceGender != null ? voiceGender : normalizeGender(gender);
        return "male".equals(requestedGender) ? maleVoice : femaleVoice;
    }

    private static String nestedString(JsonObject root, String... path) {
        if (root == null) return "";
        JsonObject current = root;
        for (int i = 0; i < path.length - 1; i++) {
            if (!current.has(path[i]) || !current.get(path[i]).isJsonObject()) return "";
            current = current.getAsJsonObject(path[i]);
        }
        String leaf = path[path.length - 1];
        return current.has(leaf) && !current.get(leaf).isJsonNull() ? current.get(leaf).getAsString() : "";
    }

    private static String normalizeGender(String value) {
        if (value == null || value.isBlank()) return null;
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "male", "man", "boy", "男", "男声", "男音", "男性" -> "male";
            case "female", "woman", "girl", "女", "女声", "女音", "女性" -> "female";
            default -> null;
        };
    }

    private static double normalizeMultiplier(String name, Double value) {
        double result = value == null ? 1.0 : value;
        if (result < 0.5 || result > 2.0 || !Double.isFinite(result)) {
            throw new IllegalArgumentException(name + " must be between 0.5 and 2.0");
        }
        return result;
    }

    private static String configuredVoice(String property, String environment, String fallback) {
        String value = SecretsManager.getOptional(property, environment);
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String environmentOrDefault(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String stripTrailingSlash(String value) {
        String result = value == null || value.isBlank() ? DEFAULT_BASE_URL : value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }

    private static String concise(String value) {
        if (value == null) return "";
        return value.length() <= 500 ? value : value.substring(0, 500) + "...";
    }

    public record TtsOptions(String voice, String gender, Double speed, Double pitch, Double volume) {}
}
