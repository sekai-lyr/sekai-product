package com.sekai.draw.lots.control;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsCharacterDO;
import com.sekai.draw.lots.mapper.SekaiDrawLotsCharacterMapper;
import jakarta.annotation.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

@RestController
public class ImageControl {

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private static final Path CACHE_DIR = Path.of("build-data", "image-cache");
    private static final String[][] AVATAR_PALETTES = {
            {"#f97316", "#fef3c7", "#7c2d12"},
            {"#0ea5e9", "#dbeafe", "#0c4a6e"},
            {"#22c55e", "#dcfce7", "#14532d"},
            {"#a855f7", "#f3e8ff", "#581c87"},
            {"#14b8a6", "#ccfbf1", "#134e4a"},
            {"#f43f5e", "#ffe4e6", "#881337"},
            {"#64748b", "#f1f5f9", "#0f172a"},
            {"#eab308", "#fef9c3", "#713f12"}
    };

    @Resource
    private SekaiDrawLotsCharacterMapper characterMapper;

    @GetMapping("/character/image/{id}")
    public ResponseEntity<byte[]> characterImage(@PathVariable("id") Long id) {
        SekaiDrawLotsCharacterDO character = characterMapper.selectByPrimaryKey(id);
        if (character == null) {
            return generatedAvatar(null);
        }
        if (isBlank(character.getImageUrl())) {
            return generatedAvatar(character);
        }

        try {
            Path cachePath = CACHE_DIR.resolve(id + ".jpg");
            if (Files.exists(cachePath) && Files.size(cachePath) > 0) {
                return ResponseEntity.ok()
                        .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS))
                        .contentType(MediaType.IMAGE_JPEG)
                        .body(Files.readAllBytes(cachePath));
            }

            HttpRequest request = HttpRequest.newBuilder(URI.create(character.getImageUrl()))
                    .timeout(Duration.ofSeconds(10))
                    .header("User-Agent", "Mozilla/5.0 SekaiDrawLots/1.0")
                    .header("Referer", "https://myanimelist.net/")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300 || response.body().length == 0) {
                return generatedAvatar(character);
            }
            String contentType = response.headers().firstValue(HttpHeaders.CONTENT_TYPE).orElse(MediaType.IMAGE_JPEG_VALUE);
            if (!contentType.startsWith("image/")) {
                return generatedAvatar(character);
            }
            Files.createDirectories(CACHE_DIR);
            Files.write(cachePath, response.body(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS))
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(response.body());
        } catch (IllegalArgumentException | IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return generatedAvatar(character);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private ResponseEntity<byte[]> generatedAvatar(SekaiDrawLotsCharacterDO character) {
        String name = character == null || isBlank(character.getEnglishName()) ? "Sekai" : character.getEnglishName();
        String element = character == null || isBlank(character.getElement()) ? "Fortune" : character.getElement();
        String initials = initials(name);
        String[] palette = AVATAR_PALETTES[Math.floorMod((name + element).hashCode(), AVATAR_PALETTES.length)];
        String svg = """
                <svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                      <stop stop-color="__PRIMARY__"/>
                      <stop offset="100%" stop-color="__SECONDARY__"/>
                    </linearGradient>
                  </defs>
                  <rect width="480" height="480" fill="url(#g)"/>
                  <circle cx="82" cy="96" r="44" fill="#ffffff" opacity=".22"/>
                  <circle cx="396" cy="112" r="76" fill="#ffffff" opacity=".18"/>
                  <circle cx="240" cy="212" r="124" fill="#ffffff" opacity=".62"/>
                  <circle cx="240" cy="212" r="92" fill="#ffffff" opacity=".78"/>
                  <text x="240" y="232" text-anchor="middle" font-family="Arial, sans-serif" font-size="78" font-weight="800" fill="__INK__">__INITIALS__</text>
                  <rect x="82" y="336" width="316" height="78" rx="39" fill="#ffffff" opacity=".74"/>
                  <text x="240" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="__INK__">__NAME__</text>
                  <text x="240" y="397" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="__INK__">__ELEMENT__</text>
                </svg>
                """
                .replace("__PRIMARY__", palette[0])
                .replace("__SECONDARY__", palette[1])
                .replace("__INK__", palette[2])
                .replace("__INITIALS__", escapeXml(initials))
                .replace("__NAME__", escapeXml(shorten(name, 22)))
                .replace("__ELEMENT__", escapeXml(element));
        return ResponseEntity.status(HttpStatus.OK)
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS))
                .contentType(MediaType.valueOf("image/svg+xml"))
                .body(svg.getBytes(StandardCharsets.UTF_8));
    }

    private String initials(String name) {
        String compact = name == null ? "" : name.replaceAll("[^A-Za-z0-9]", "");
        if (compact.length() >= 2) {
            return compact.substring(0, 2).toUpperCase();
        }
        return compact.isEmpty() ? "SK" : compact.toUpperCase();
    }

    private String shorten(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, Math.max(0, maxLength - 1)) + "...";
    }

    private String escapeXml(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
