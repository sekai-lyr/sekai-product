package com.sekai.memory.book.service;

import tools.jackson.databind.JsonNode;
import com.sekai.memory.book.model.Anime;
import com.sekai.memory.book.model.CharacterFavorite;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.Duration;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.io.IOException;
import java.util.HexFormat;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.HttpServerErrorException;
import java.net.URI;
import java.net.Proxy;
import java.net.InetSocketAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

@Service
public class MetadataEnrichmentService {

    private static final String API_BASE_URL = "https://api.bgm.tv";
    private static final Logger log = LoggerFactory.getLogger(MetadataEnrichmentService.class);
    private final RestClient client;
    private final Path animeCacheDirectory;
    private final JsonMapper json = JsonMapper.builder().build();

    public MetadataEnrichmentService() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        String proxyUrl = System.getenv("HTTPS_PROXY");
        if (proxyUrl != null && !proxyUrl.isBlank()) {
            URI proxy = URI.create(proxyUrl);
            if ("http".equalsIgnoreCase(proxy.getScheme()) && proxy.getHost() != null) {
                requestFactory.setProxy(new Proxy(Proxy.Type.HTTP,
                        new InetSocketAddress(proxy.getHost(), proxy.getPort() > 0 ? proxy.getPort() : 80)));
            }
        }
        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(15000);
        this.client = RestClient.builder()
                .baseUrl(API_BASE_URL)
                .requestFactory(requestFactory)
                .defaultHeader("User-Agent", "SekaiMemoryBook/1.0 (personal anime archive)")
                .build();
        this.animeCacheDirectory = Path.of("data", "metadata", "anime");
    }

    MetadataEnrichmentService(RestClient client) {
        this(client, null);
    }

    MetadataEnrichmentService(RestClient client, Path cacheDirectory) {
        this.client = client;
        this.animeCacheDirectory = cacheDirectory;
    }

    public record Candidate(long subjectId, String originalTitle, Anime anime, String matchReason) {}
    public record AnimeSearch(List<Candidate> candidates, Long recommendedSubjectId) {}

    public boolean enrichAnime(Anime anime) {
        return enrichAnime(anime, null);
    }

    public boolean enrichAnime(Anime anime, Long subjectId) {
        if (anime == null || isBlank(anime.getTitle())) {
            return false;
        }
        try {
            Anime found = subjectId == null ? lookupAnime(anime.getTitle()) : lookupAnimeSubject(subjectId);
            if (found == null) {
                applyAnimeDefaults(anime);
                return false;
            }
            anime.setTitle(found.getTitle());
            if (isBlank(anime.getType())) anime.setType(found.getType());
            if (isBlank(anime.getCoverUrl())) anime.setCoverUrl(found.getCoverUrl());
            if (anime.getReleaseDate() == null) anime.setReleaseDate(found.getReleaseDate());
            if (anime.getTotalEpisodes() == null) anime.setTotalEpisodes(found.getTotalEpisodes());
            if (isBlank(anime.getTags())) anime.setTags(found.getTags());
            applyAnimeDefaults(anime);
            return true;
        } catch (RuntimeException ex) {
            log.warn("Anime metadata lookup failed for {}: {}", anime.getTitle(), ex.getMessage());
            applyAnimeDefaults(anime);
            return false;
        }
    }

    public AnimeSearch searchAnime(String title) {
        if (isBlank(title)) return new AnimeSearch(List.of(), null);
        String term = AnimeTitleMatcher.searchTerm(title.trim());
        if (term.isBlank()) return new AnimeSearch(List.of(), null);
        JsonNode result = cachedAnimeResponse("search-v2:" + term, () -> search("/v0/search/subjects?limit=20", Map.of(
                "keyword", term, "sort", "match", "filter", Map.of("type", List.of(2)))));
        List<AnimeTitleMatcher.Match> matches = AnimeTitleMatcher.rank(result, title);
        if (!AnimeTitleMatcher.confident(matches)) {
            var combined = json.createObjectNode();
            var data = combined.putArray("data");
            var seen = new java.util.HashSet<Long>();
            for (JsonNode subject : result.path("data")) {
                data.add(subject);
                seen.add(subject.path("id").asLong());
            }
            for (String fallback : AnimeTitleMatcher.fallbackTerms(title)) {
                try {
                    JsonNode extra = cachedAnimeResponse("search-v2:" + fallback, () -> search("/v0/search/subjects?limit=20", Map.of(
                            "keyword", fallback, "sort", "match", "filter", Map.of("type", List.of(2)))));
                    for (JsonNode subject : extra.path("data")) {
                        if (seen.add(subject.path("id").asLong())) data.add(subject);
                    }
                } catch (ResourceAccessException | HttpServerErrorException ex) {
                    log.warn("Supplementary anime search unavailable: {}", fallback);
                }
                matches = AnimeTitleMatcher.rank(combined, title);
                if (AnimeTitleMatcher.confident(matches)) break;
            }
        }
        List<Candidate> candidates = matches.stream().map(match -> {
            JsonNode subject = match.subject();
            long id = subject.path("id").asLong();
            if (id > 0) writeAnimeCache(animeCacheFile("subject:" + id), subject);
            return new Candidate(id, subject.path("name").asText(""), animeFromSubject(subject), match.reason());
        }).toList();
        Long recommended = AnimeTitleMatcher.confident(matches) ? candidates.getFirst().subjectId() : null;
        return new AnimeSearch(candidates, recommended);
    }

    public Anime lookupAnime(String title) {
        AnimeSearch result = searchAnime(title);
        return result.recommendedSubjectId() == null ? null : result.candidates().getFirst().anime();
    }

    public Anime lookupAnimeSubject(long id) {
        if (id <= 0) return null;
        JsonNode subject = cachedAnimeResponse("subject:" + id,
                () -> client.get().uri("/v0/subjects/{id}", id).retrieve().body(JsonNode.class));
        return subject != null && subject.path("type").asInt(2) == 2 ? animeFromSubject(subject) : null;
    }

    private Anime animeFromSubject(JsonNode subject) {
        Anime anime = new Anime();
        anime.setTitle(firstNonBlank(subject.path("name_cn").asText(), subject.path("name").asText()));
        anime.setType(textOrNull(subject, "platform"));
        anime.setCoverUrl(image(subject, "large"));
        anime.setReleaseDate(parseDate(textOrNull(subject, "date")));
        int episodes = subject.path("eps").asInt(0);
        if (episodes <= 0) episodes = subject.path("total_episodes").asInt(0);
        anime.setTotalEpisodes(episodes > 0 ? episodes : null);
        anime.setTags(topTags(subject.path("tags"), 5));
        return anime;
    }

    private JsonNode cachedAnimeResponse(String key, Supplier<JsonNode> request) {
        Path cacheFile = animeCacheFile(key);
        JsonNode cached = readAnimeCache(cacheFile);
        if (cached != null) {
            try {
                if (Files.getLastModifiedTime(cacheFile).toMillis() > System.currentTimeMillis() - Duration.ofHours(6).toMillis()) {
                    return cached;
                }
            } catch (IOException ex) {
                log.debug("Cannot read anime cache timestamp", ex);
            }
        }
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                JsonNode result = request.get();
                if (result != null) writeAnimeCache(cacheFile, result);
                return result == null ? json.createObjectNode() : result;
            } catch (ResourceAccessException | HttpServerErrorException ex) {
                log.warn("Anime metadata request attempt {} failed for {}: {}", attempt + 1, key, ex.getMessage());
                if (attempt == 1) {
                    if (cached != null) return cached;
                    throw ex;
                }
            }
        }
        return null;
    }

    private void writeAnimeCache(Path file, JsonNode value) {
        if (file == null) return;
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, value.toString(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            log.warn("Cannot save anime metadata cache: {}", ex.getMessage());
        }
    }

    private Path animeCacheFile(String title) {
        if (animeCacheDirectory == null) return null;
        try {
            String key = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(normalizeTitle(title).getBytes(StandardCharsets.UTF_8)));
            return animeCacheDirectory.resolve(key + ".json");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private JsonNode readAnimeCache(Path file) {
        if (file == null || !Files.isRegularFile(file)) return null;
        try {
            return json.readTree(Files.readString(file, StandardCharsets.UTF_8));
        } catch (IOException | RuntimeException ex) {
            log.warn("Cannot read anime metadata cache: {}", ex.getMessage());
            return null;
        }
    }

    public boolean enrichCharacter(CharacterFavorite character, List<Anime> animeLibrary) {
        if (character == null || isBlank(character.getCharacterName())) {
            return false;
        }
        try {
            JsonNode result = search("/v0/search/characters?limit=1", Map.of("keyword", character.getCharacterName().trim()));
            JsonNode found = firstResult(result);
            if (found == null) {
                return false;
            }
            character.setCharacterName(characterChineseName(found, character.getCharacterName()));
            character.setImageUrl(image(found, "large"));
            Long characterId = found.path("id").canConvertToLong() ? found.path("id").longValue() : null;
            if (character.getAnimeId() == null && characterId != null) {
                character.setAnimeId(findOwnedAnime(characterId, animeLibrary));
            }
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }

    private JsonNode search(String path, Map<String, ?> body) {
        return client.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class);
    }

    private Long findOwnedAnime(long characterId, List<Anime> animeLibrary) {
        if (animeLibrary == null || animeLibrary.isEmpty()) {
            return null;
        }
        JsonNode related = client.get().uri("/v0/characters/{id}/subjects", characterId).retrieve().body(JsonNode.class);
        if (related == null || !related.isArray()) {
            return null;
        }
        for (JsonNode subject : related) {
            String remoteTitle = firstNonBlank(subject.path("name_cn").asText(), subject.path("name").asText());
            for (Anime anime : animeLibrary) {
                if (anime.getTitle() != null && remoteTitle != null
                        && normalizeTitle(anime.getTitle()).equals(normalizeTitle(remoteTitle))) {
                    return anime.getId();
                }
            }
        }
        return null;
    }

    private void applyAnimeDefaults(Anime anime) {
        if (isBlank(anime.getStatus())) {
            anime.setStatus("看完");
        }
        if (anime.getWatchDate() == null) {
            anime.setWatchDate(LocalDate.now());
        }
        if (anime.getTotalEpisodes() != null && anime.getCurrentEpisode() == null) {
            anime.setCurrentEpisode(anime.getTotalEpisodes());
        }
        if (anime.getLastWatchDate() == null) {
            anime.setLastWatchDate(anime.getWatchDate());
        }
    }

    private JsonNode firstResult(JsonNode result) {
        if (result == null || !result.path("data").isArray() || result.path("data").isEmpty()) {
            return null;
        }
        return result.path("data").get(0);
    }

    private String characterChineseName(JsonNode character, String fallback) {
        for (JsonNode item : character.path("infobox")) {
            if ("简体中文名".equals(item.path("key").asText())) {
                return firstNonBlank(item.path("value").asText(), fallback);
            }
        }
        return firstNonBlank(character.path("name").asText(), fallback);
    }

    private String topTags(JsonNode tags, int limit) {
        if (!tags.isArray()) {
            return null;
        }
        List<String> names = new ArrayList<>();
        for (JsonNode tag : tags) {
            String name = tag.path("name").asText();
            if (!isBlank(name)) {
                names.add(name);
            }
            if (names.size() == limit) {
                break;
            }
        }
        return names.isEmpty() ? null : String.join(", ", names);
    }

    private String image(JsonNode node, String size) {
        return firstNonBlank(node.path("images").path(size).asText(), node.path("image").asText());
    }

    private LocalDate parseDate(String value) {
        try {
            return isBlank(value) ? null : LocalDate.parse(value);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private String textOrNull(JsonNode node, String field) {
        return firstNonBlank(node.path(field).asText());
    }

    private String normalizeTitle(String value) {
        return value.replaceAll("[\\s·・:：!！?？\\-—_]", "").toLowerCase();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
