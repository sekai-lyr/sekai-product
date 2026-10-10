package com.sekai.memory.book.service;

import tools.jackson.databind.JsonNode;
import com.sekai.memory.book.model.Anime;
import com.sekai.memory.book.model.CharacterFavorite;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class MetadataEnrichmentService {

    private static final String API_BASE_URL = "https://api.bgm.tv";
    private final RestClient client;

    public MetadataEnrichmentService() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(3000);
        requestFactory.setReadTimeout(5000);
        this.client = RestClient.builder()
                .baseUrl(API_BASE_URL)
                .requestFactory(requestFactory)
                .defaultHeader("User-Agent", "SekaiMemoryBook/1.0 (personal anime archive)")
                .build();
    }

    public boolean enrichAnime(Anime anime) {
        if (anime == null || isBlank(anime.getTitle())) {
            return false;
        }
        try {
            JsonNode result = search("/v0/search/subjects?limit=1", Map.of(
                    "keyword", anime.getTitle().trim(),
                    "sort", "match",
                    "filter", Map.of("type", List.of(2))));
            JsonNode subject = firstResult(result);
            if (subject == null) {
                applyAnimeDefaults(anime);
                return false;
            }
            anime.setTitle(firstNonBlank(subject.path("name_cn").asText(), subject.path("name").asText(), anime.getTitle()));
            anime.setType(textOrNull(subject, "platform"));
            anime.setCoverUrl(image(subject, "large"));
            anime.setReleaseDate(parseDate(textOrNull(subject, "date")));
            int episodes = subject.path("total_episodes").asInt(subject.path("eps").asInt(0));
            anime.setTotalEpisodes(episodes > 0 ? episodes : null);
            anime.setTags(topTags(subject.path("tags"), 5));
            applyAnimeDefaults(anime);
            return true;
        } catch (RuntimeException ex) {
            applyAnimeDefaults(anime);
            return false;
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
