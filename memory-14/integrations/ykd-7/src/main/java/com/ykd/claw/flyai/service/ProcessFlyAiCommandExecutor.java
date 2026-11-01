package com.ykd.claw.flyai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public final class ProcessFlyAiCommandExecutor implements FlyAiCommandExecutor {
    private static final Logger LOGGER = LoggerFactory.getLogger(ProcessFlyAiCommandExecutor.class.getName());
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);
    private static final int CACHE_MAX_SIZE = 100;

    private final String executable;
    private final String apiKey;
    private final Duration timeout;
    private final int maxOutputChars;
    private final ObjectMapper objectMapper;

    // Cache FlyAI results to avoid repeated slow CLI process calls
    private record CachedResult(String result, Instant expiresAt) {
        boolean isExpired() { return Instant.now().isAfter(expiresAt); }
    }
    private final Map<String, CachedResult> resultCache = new ConcurrentHashMap<>();

    public ProcessFlyAiCommandExecutor(
            @Value("${flyai.executable:flyai}") String executable,
            @Value("${flyai.api-key:}") String apiKey,
            @Value("${flyai.timeout:45s}") Duration timeout,
            @Value("${flyai.max-output-chars:200000}") int maxOutputChars,
            ObjectMapper objectMapper) {
        this.executable = platformExecutable(executable);
        this.apiKey = apiKey;
        this.timeout = timeout;
        if (maxOutputChars <= 0) throw new IllegalArgumentException("flyai.max-output-chars must be positive");
        this.maxOutputChars = maxOutputChars;
        this.objectMapper = objectMapper;
    }

    @Override
    public String execute(List<String> arguments) {
        // Check cache first
        String cacheKey = String.join(" ", arguments);
        CachedResult cached = resultCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) return cached.result();

        // Evict expired entries if cache is full
        if (resultCache.size() >= CACHE_MAX_SIZE) {
            resultCache.entrySet().removeIf(e -> e.getValue().isExpired());
            // If every entry is still fresh the size cap would otherwise be exceeded
            // indefinitely; drop the whole cache rather than grow without bound.
            if (resultCache.size() >= CACHE_MAX_SIZE) resultCache.clear();
        }

        List<String> command = new ArrayList<>(arguments.size() + 1);
        command.add(executable);
        command.addAll(arguments);
        ProcessBuilder builder = new ProcessBuilder(command);
        if (!apiKey.isBlank()) builder.environment().put("FLYAI_API_KEY", apiKey);

        try {
            Process process = builder.start();
            try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
                Future<String> stdout = executor.submit(() ->
                        new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8));
                Future<String> stderr = executor.submit(() ->
                        new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8));
                if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                    process.destroyForcibly();
                    throw new IllegalStateException("FlyAI request timed out after " + timeout);
                }
                String output = await(stdout);
                String error = await(stderr);
                if (process.exitValue() != 0) {
                    if (!isSuccessfulJson(objectMapper, output)) {
                        throw new IllegalStateException("FlyAI request failed: " + compact(error));
                    }
                    LOGGER.warn("FlyAI returned successful JSON but the CLI exited abnormally: "
                            + compact(error));
                }
                if (output.isBlank()) throw new IllegalStateException("FlyAI returned an empty result");
                String businessError = businessError(objectMapper, output);
                if (businessError != null) {
                    throw new IllegalStateException("FlyAI request failed: " + businessError);
                }
                String result = limit(unwrapFliggyRouterLinks(output.trim()));
                resultCache.put(cacheKey, new CachedResult(result, Instant.now().plus(CACHE_TTL)));
                return result;
            }
        } catch (IOException e) {
            throw new IllegalStateException(
                    "Cannot start FlyAI CLI. Install @fly-ai/flyai-cli and ensure '" + executable
                            + "' is available on PATH.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("FlyAI request was interrupted", e);
        }
    }

    private String await(Future<String> future) {
        try {
            return future.get(Math.max(timeout.toMillis(), 1000), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("FlyAI output reading was interrupted", e);
        } catch (ExecutionException | TimeoutException e) {
            throw new IllegalStateException("Cannot read FlyAI output", e);
        }
    }

    private String limit(String value) {
        if (value.length() <= maxOutputChars) return value;
        return value.substring(0, maxOutputChars) + "\n[FlyAI output truncated]";
    }

    private static String compact(String value) {
        if (value == null || value.isBlank()) return "unknown CLI error";
        return value.strip().replaceAll("\\s+", " ");
    }

    /**
     * Unwrap Fliggy router.feizhu.com/multi/webview?url=... links to their inner target URLs.
     * FlyAI CLI sometimes returns train links wrapped in this internal redirect format
     * which fails when opened directly in a browser.
     */
    static String unwrapFliggyRouterLinks(String json) {
        if (json == null || !json.contains("router.feizhu.com/multi/webview")) return json;
        // Match: "https://router.feizhu.com/multi/webview?url=<encoded-url>" or similar
        Pattern pattern = Pattern.compile(
                "(https?://router\\.feizhu\\.com/multi/webview\\?url=)([^\"\\\\\\s]+)");
        Matcher matcher = pattern.matcher(json);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String encodedUrl = matcher.group(2);
            try {
                String innerUrl = URLDecoder.decode(encodedUrl, StandardCharsets.UTF_8);
                // Avoid double-unwrapping if inner URL is also a router link
                if (innerUrl.contains("router.feizhu.com/multi/webview")) {
                    Matcher innerMatcher = pattern.matcher(innerUrl);
                    if (innerMatcher.find()) {
                        innerUrl = URLDecoder.decode(innerMatcher.group(2), StandardCharsets.UTF_8);
                    }
                }
                matcher.appendReplacement(sb, Matcher.quoteReplacement(innerUrl));
            } catch (Exception e) {
                // Keep original if decode fails
                LOGGER.debug("Failed to unwrap Fliggy router URL: " + e.getMessage());
            }
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    static String platformExecutable(String executable) {
        String value = executable == null || executable.isBlank() ? "flyai" : executable.trim();
        boolean windows = System.getProperty("os.name", "").toLowerCase().contains("win");
        boolean bareName = !value.contains("/") && !value.contains("\\") && !value.contains(".");
        return windows && bareName ? value + ".cmd" : value;
    }

    static boolean isSuccessfulJson(ObjectMapper objectMapper, String output) {
        if (output == null || output.isBlank()) return false;
        try {
            return objectMapper.readTree(output).path("status").asInt(-1) == 0;
        } catch (Exception e) {
            LOGGER.debug("FlyAI output is not valid JSON: " + e.getMessage());
            return false;
        }
    }

    static String businessError(ObjectMapper objectMapper, String output) {
        if (output == null || output.isBlank()) return null;
        try {
            var root = objectMapper.readTree(output);
            if (!root.has("status") || root.path("status").asInt(-1) == 0) return null;
            String message = root.path("message").asText("").trim();
            if (message.isBlank()) message = root.path("msg").asText("").trim();
            return message.isBlank() ? "status=" + root.path("status").asText() : message;
        } catch (Exception e) {
            LOGGER.debug("FlyAI output JSON parse failed: " + e.getMessage());
            return null;
        }
    }
}
