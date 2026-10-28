package com.sekai.song.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class CommonsAssetService {
    private static final String API = "https://commons.wikimedia.org/w/api.php";
    private static final String USER_AGENT = "SekaiSongPlayer/1.0 (media discovery)";
    private final ObjectMapper json = new ObjectMapper();

    public record Candidate(String title, String type, String pageUrl, String license, long size) {}

    public List<Candidate> find(String songTitle, String artist, String album) throws IOException, InterruptedException {
        if (songTitle == null || songTitle.isBlank()) return List.of();
        List<Candidate> found = search(songTitle, artist, false);
        if (album != null && !album.isBlank() && !album.equalsIgnoreCase(songTitle)) {
            try {
                for (Candidate candidate : search(album, artist, true)) {
                    if (found.stream().noneMatch(previous -> previous.title().equals(candidate.title()))) found.add(candidate);
                }
            } catch (IOException ignored) {
                // Keep the song-title candidates when the optional album lookup fails.
            }
        }
        found.sort(Comparator.comparing(Candidate::type).thenComparing(Candidate::title));
        return found;
    }

    private List<Candidate> search(String term, String artist, boolean coverOnly) throws IOException, InterruptedException {
        String query = term.trim() + (artist == null || artist.isBlank() ? "" : " " + artist.trim());
        URI uri = URI.create(API + "?action=query&generator=search&gsrnamespace=6&gsrlimit=50"
                + "&gsrsearch=" + encode(query) + "&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&format=json");
        JsonNode pages = readJson(uri).path("query").path("pages");
        if (!pages.isObject()) return List.of();
        List<Candidate> found = new ArrayList<>();
        pages.elements().forEachRemaining(page -> {
            String title = page.path("title").asText("");
            String type = typeOf(title);
            if (type == null || coverOnly && !"png".equals(type) || !matchesSong(title, term, artist)) return;
            JsonNode info = page.path("imageinfo").path(0);
            if (!isCc0(info)) return;
            String pageUrl = info.path("descriptionurl").asText("");
            long size = info.path("size").asLong(0);
            if (!pageUrl.startsWith("https://commons.wikimedia.org/wiki/File:") || size < 1 || size > limit(type)) return;
            found.add(new Candidate(title, type, pageUrl, "CC0", size));
        });
        return found;
    }

    public void download(String title, String expectedType, Path target) throws IOException, InterruptedException {
        if (title == null || title.length() > 255 || !title.startsWith("File:")
                || !expectedType.equals(typeOf(title))) throw new IOException("无效的素材候选");
        URI uri = URI.create(API + "?action=query&titles=" + encode(title)
                + "&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&format=json");
        JsonNode pages = readJson(uri).path("query").path("pages");
        if (!pages.isObject() || pages.isEmpty()) throw new IOException("无法核对素材");
        JsonNode page = pages.elements().next();
        JsonNode info = page.path("imageinfo").path(0);
        long size = info.path("size").asLong(0);
        if (!title.equals(page.path("title").asText()) || !isCc0(info) || size < 1 || size > limit(expectedType)) {
            throw new IOException("素材许可或大小已变化");
        }
        URI file = URI.create(info.path("url").asText(""));
        if (!"https".equals(file.getScheme()) || !"upload.wikimedia.org".equals(file.getHost())) {
            throw new IOException("素材地址不可信");
        }
        Files.createFile(target);
        try {
            HttpURLConnection connection = open(file);
            try (InputStream stream = connection.getInputStream()) {
                if (connection.getResponseCode() != 200) throw new IOException("素材下载失败");
                try (var output = Files.newOutputStream(target, StandardOpenOption.WRITE)) {
                    byte[] buffer = new byte[8192];
                    long written = 0;
                    int count;
                    while ((count = stream.read(buffer)) != -1) {
                        written += count;
                        if (written > limit(expectedType)) throw new IOException("素材超出大小限制");
                        output.write(buffer, 0, count);
                    }
                    if (written != size) throw new IOException("素材大小不符");
                }
                try (InputStream saved = Files.newInputStream(target)) {
                    if (!validSignature(saved.readNBytes(12), expectedType)) throw new IOException("素材格式不符");
                }
            } finally {
                connection.disconnect();
            }
        } catch (IOException | RuntimeException error) {
            Files.deleteIfExists(target);
            throw error;
        }
    }

    private JsonNode readJson(URI uri) throws IOException, InterruptedException {
        HttpURLConnection connection = open(uri);
        try {
            if (connection.getResponseCode() != 200) throw new IOException("素材来源暂不可用");
            try (InputStream stream = connection.getInputStream()) {
                return json.readTree(stream);
            }
        } finally {
            connection.disconnect();
        }
    }

    private static HttpURLConnection open(URI uri) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(25000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("User-Agent", USER_AGENT);
        return connection;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    static String typeOf(String title) {
        String lower = title.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".flac")) return "flac";
        if (lower.endsWith(".mp4")) return "mp4";
        if (lower.endsWith(".png")) return "png";
        return null;
    }

    public static boolean matchesSong(String fileTitle, String songTitle, String artist) {
        String name = normalize(fileTitle);
        String song = normalize(songTitle);
        if (song.isEmpty() || !name.contains(song)) return false;
        String performer = normalize(artist);
        return performer.isEmpty() || name.contains(performer);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    static boolean isCc0(JsonNode info) {
        String license = info.path("extmetadata").path("LicenseShortName").path("value").asText("");
        return license.equalsIgnoreCase("CC0") || license.equalsIgnoreCase("CC0 1.0");
    }

    private static long limit(String type) {
        return switch (type) {
            case "flac" -> 100L * 1024 * 1024;
            case "mp4" -> 300L * 1024 * 1024;
            case "png" -> 15L * 1024 * 1024;
            default -> 0;
        };
    }

    static boolean validSignature(byte[] bytes, String type) {
        if (bytes.length < 12) return false;
        return switch (type) {
            case "flac" -> bytes[0] == 'f' && bytes[1] == 'L' && bytes[2] == 'a' && bytes[3] == 'C';
            case "mp4" -> bytes[4] == 'f' && bytes[5] == 't' && bytes[6] == 'y' && bytes[7] == 'p';
            case "png" -> (bytes[0] & 255) == 137 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G'
                    && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10;
            default -> false;
        };
    }
}
