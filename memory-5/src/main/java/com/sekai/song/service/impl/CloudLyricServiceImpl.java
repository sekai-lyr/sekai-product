package com.sekai.song.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sekai.song.service.CloudLyricService;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class CloudLyricServiceImpl implements CloudLyricService {
    private static final String NETEASE_LYRIC_API = "https://music.163.com/api/song/lyric?id=%s&lv=1&kv=1&tv=-1";
    private static final String NETEASE_SEARCH_API = "https://music.163.com/api/search/get/web?s=%s&type=1&limit=20&offset=0";
    private static final String QQ_MUSICU_API = "https://u.y.qq.com/cgi-bin/musicu.fcg?data=";
    private static final String LRCLIB_GET_API = "https://lrclib.net/api/get";
    private static final String LRCLIB_SEARCH_API = "https://lrclib.net/api/search";
    private static final Pattern TIMED_LYRIC = Pattern.compile("(?m)^\\[(?:\\d{1,3}:)?\\d{1,2}(?:[.:]\\d{1,3})?].+");
    private static final Pattern TITLE_DECORATION = Pattern.compile("\\s*[（(【\\[][^）)】\\]]*(?:ver(?:sion)?|版本|翻唱|伴奏|instrumental|remaster(?:ed)?|live|cover|feat\\.?)[^）)】\\]]*[）)】\\]]", Pattern.CASE_INSENSITIVE);
    private static final Set<String> GENERIC_ARTISTS = Set.of("本地文件", "未知歌手", "unknown", "unknownartist", "variousartists");
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String fetchNeteaseLyric(String songId) {
        if (isBlank(songId)) {
            return null;
        }
        try {
            WebResponse response = get(String.format(NETEASE_LYRIC_API, songId), "https://music.163.com/");
            if (!ok(response)) {
                return null;
            }
            JsonNode root = objectMapper.readTree(response.body());
            return cleanLyric(firstText(root.path("lrc"), "lyric"));
        } catch (IOException | IllegalArgumentException e) {
            return null;
        }
    }

    @Override
    public String fetchQqLyric(String songMid, Long songId) {
        if (!isBlank(songMid) && songMid.chars().allMatch(Character::isDigit) && (songId == null || songId <= 0)) {
            songId = Long.parseLong(songMid);
            songMid = null;
        }
        if (isBlank(songMid) && (songId == null || songId <= 0)) {
            return null;
        }
        String lyric = fetchQqLyricByMusicu(songMid, songId);
        if (!isBlank(lyric)) {
            return lyric;
        }
        return fetchQqLyricByLegacyApi(songMid, songId);
    }

    @Override
    public String fetchBestLyric(String title, String artist, String album, Integer durationSeconds) {
        if (isBlank(title)) {
            return null;
        }
        String lyric = fetchBestNeteaseLyric(title, artist);
        if (!isBlank(lyric)) {
            return lyric;
        }
        lyric = fetchBestQqLyric(title, artist);
        if (!isBlank(lyric)) {
            return lyric;
        }
        return fetchBestLrclibLyric(title, artist, album, durationSeconds);
    }

    private String fetchBestLrclibLyric(String title, String artist, String album, Integer durationSeconds) {
        String cleanTitle = cleanSearchText(title);
        String cleanArtist = cleanArtist(artist);
        if (cleanTitle.isBlank()) {
            return null;
        }
        if (!cleanArtist.isBlank()) {
            try {
                StringBuilder exactUrl = new StringBuilder(LRCLIB_GET_API)
                        .append("?track_name=").append(encoded(cleanTitle))
                        .append("&artist_name=").append(encoded(cleanArtist));
                if (!isBlank(album) && !"本地音乐".equals(album)) {
                    exactUrl.append("&album_name=").append(encoded(album));
                }
                if (durationSeconds != null && durationSeconds > 0 && durationSeconds <= 3600) {
                    exactUrl.append("&duration=").append(durationSeconds);
                }
                WebResponse response = get(exactUrl.toString(), "https://lrclib.net/");
                if (ok(response)) {
                    String lyric = cleanLyric(firstText(objectMapper.readTree(response.body()), "syncedLyrics"));
                    if (!isBlank(lyric)) {
                        return lyric;
                    }
                }
            } catch (IOException | IllegalArgumentException ignored) {
                // The broader search below is the fallback for exact-match misses.
            }
        }
        for (String queryTitle : List.of(cleanTitle, title.trim())) {
            try {
                StringBuilder searchUrl = new StringBuilder(LRCLIB_SEARCH_API)
                        .append("?track_name=").append(encoded(queryTitle));
                if (!cleanArtist.isBlank()) {
                    searchUrl.append("&artist_name=").append(encoded(cleanArtist));
                }
                WebResponse response = get(searchUrl.toString(), "https://lrclib.net/");
                if (!ok(response)) {
                    continue;
                }
                JsonNode records = objectMapper.readTree(response.body());
                if (!records.isArray()) {
                    continue;
                }
                List<ScoredSong> candidates = new ArrayList<>();
                for (JsonNode record : records) {
                    String syncedLyric = firstText(record, "syncedLyrics");
                    if (isBlank(syncedLyric)) {
                        continue;
                    }
                    int score = matchScore(title, artist,
                            firstText(record, "trackName", "name"), firstText(record, "artistName"));
                    int recordDuration = record.path("duration").asInt(0);
                    if (durationSeconds != null && recordDuration > 0
                            && Math.abs(durationSeconds - recordDuration) <= 3) {
                        score += 18;
                    }
                    if (score >= 45) {
                        candidates.add(new ScoredSong(record, score));
                    }
                }
                candidates.sort(Comparator.comparingInt(ScoredSong::score).reversed());
                for (ScoredSong candidate : candidates) {
                    String lyric = cleanLyric(firstText(candidate.song(), "syncedLyrics"));
                    if (!isBlank(lyric)) {
                        return lyric;
                    }
                }
            } catch (IOException | IllegalArgumentException ignored) {
                // Continue with the remaining title variant.
            }
        }
        return null;
    }

    private String fetchBestNeteaseLyric(String title, String artist) {
        Set<Long> attemptedIds = new HashSet<>();
        for (String query : searchQueries(title, artist)) {
            try {
                WebResponse response = get(String.format(NETEASE_SEARCH_API, URLEncoder.encode(query, StandardCharsets.UTF_8)), "https://music.163.com/");
                if (!ok(response)) {
                    continue;
                }
                JsonNode songs = objectMapper.readTree(response.body()).path("result").path("songs");
                if (!songs.isArray()) {
                    continue;
                }
                List<ScoredSong> candidates = new ArrayList<>();
                for (JsonNode song : songs) {
                    int score = matchScore(title, artist, firstText(song, "name"), joinArtists(song.path("artists")));
                    if (score >= 45) {
                        candidates.add(new ScoredSong(song, score));
                    }
                }
                candidates.sort(Comparator.comparingInt(ScoredSong::score).reversed());
                for (ScoredSong candidate : candidates) {
                    long id = candidate.song().path("id").asLong(0);
                    if (id > 0 && attemptedIds.add(id)) {
                        String lyric = fetchNeteaseLyric(String.valueOf(id));
                        if (!isBlank(lyric)) {
                            return lyric;
                        }
                    }
                }
            } catch (IOException | IllegalArgumentException ignored) {
                // Continue with the next query variant and then the other provider.
            }
        }
        return null;
    }

    private String fetchBestQqLyric(String title, String artist) {
        Set<String> attemptedIds = new HashSet<>();
        for (String query : searchQueries(title, artist)) {
            try {
                String payload = qqSearchPayload(query);
                WebResponse response = get(QQ_MUSICU_API + URLEncoder.encode(payload, StandardCharsets.UTF_8), "https://y.qq.com/");
                if (!ok(response)) {
                    continue;
                }
                JsonNode list = objectMapper.readTree(response.body())
                        .path("search").path("data").path("body").path("song").path("list");
                if (!list.isArray()) {
                    continue;
                }
                List<ScoredSong> candidates = new ArrayList<>();
                for (JsonNode song : list) {
                    int score = matchScore(title, artist, firstText(song, "title", "name"), joinArtists(song.path("singer")));
                    if (score >= 45) {
                        candidates.add(new ScoredSong(song, score));
                    }
                }
                candidates.sort(Comparator.comparingInt(ScoredSong::score).reversed());
                for (ScoredSong candidate : candidates) {
                    String mid = firstText(candidate.song(), "mid", "songmid");
                    long id = candidate.song().path("id").asLong(0);
                    String key = !isBlank(mid) ? mid : String.valueOf(id);
                    if (!isBlank(key) && attemptedIds.add(key)) {
                        String lyric = fetchQqLyric(mid, id > 0 ? id : null);
                        if (!isBlank(lyric)) {
                            return lyric;
                        }
                    }
                }
            } catch (IOException | IllegalArgumentException ignored) {
                // Continue with the next query variant.
            }
        }
        return null;
    }

    private String fetchQqLyricByMusicu(String songMid, Long songId) {
        try {
            String payload = qqLyricPayload(songMid, songId);
            WebResponse response = get(QQ_MUSICU_API + URLEncoder.encode(payload, StandardCharsets.UTF_8), "https://y.qq.com/");
            if (!ok(response)) {
                return null;
            }
            JsonNode data = objectMapper.readTree(response.body()).path("lyric").path("data");
            return firstDecodedLyric(data, "lyric", "trans");
        } catch (IOException | IllegalArgumentException e) {
            return null;
        }
    }

    private String fetchQqLyricByLegacyApi(String songMid, Long songId) {
        try {
            StringBuilder url = new StringBuilder("https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?format=json&nobase64=0");
            if (!isBlank(songMid)) {
                url.append("&songmid=").append(URLEncoder.encode(songMid, StandardCharsets.UTF_8));
            }
            if (songId != null && songId > 0) {
                url.append("&songid=").append(songId);
            }
            WebResponse response = get(url.toString(), "https://y.qq.com/");
            if (!ok(response)) {
                return null;
            }
            JsonNode root = objectMapper.readTree(response.body());
            return firstDecodedLyric(root, "lyric", "trans");
        } catch (IOException | IllegalArgumentException e) {
            return null;
        }
    }

    private String qqLyricPayload(String songMid, Long songId) throws IOException {
        ObjectNode root = objectMapper.createObjectNode();
        ObjectNode comm = root.putObject("comm");
        comm.put("ct", 24);
        comm.put("cv", 0);
        ObjectNode lyric = root.putObject("lyric");
        lyric.put("method", "GetPlayLyricInfo");
        lyric.put("module", "music.musichallSong.PlayLyricInfo");
        ObjectNode param = lyric.putObject("param");
        param.put("songMID", isBlank(songMid) ? "" : songMid);
        param.put("songID", songId == null ? 0 : songId);
        param.put("qrc", 0);
        param.put("roma", 0);
        param.put("trans", 1);
        return objectMapper.writeValueAsString(root);
    }

    private String qqSearchPayload(String keyword) throws IOException {
        ObjectNode root = objectMapper.createObjectNode();
        ObjectNode comm = root.putObject("comm");
        comm.put("ct", 24);
        comm.put("cv", 0);
        ObjectNode search = root.putObject("search");
        search.put("method", "DoSearchForQQMusicDesktop");
        search.put("module", "music.search.SearchCgiService");
        ObjectNode param = search.putObject("param");
        param.put("query", keyword);
        param.put("page_num", 1);
        param.put("num_per_page", 20);
        param.put("search_type", 0);
        return objectMapper.writeValueAsString(root);
    }

    private String firstDecodedLyric(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = firstText(node, field);
            if (!isBlank(value)) {
                String decoded = decodeBase64IfNeeded(value);
                String cleaned = cleanLyric(decoded);
                if (!isBlank(cleaned)) {
                    return cleaned;
                }
            }
        }
        return null;
    }

    private String decodeBase64IfNeeded(String value) {
        String trimmed = value.trim();
        if (trimmed.contains("[") && trimmed.contains("]")) {
            return trimmed;
        }
        try {
            return new String(Base64.getDecoder().decode(trimmed), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return trimmed;
        }
    }

    private String cleanLyric(String value) {
        if (isBlank(value)) {
            return null;
        }
        String lyric = value.replace("\r\n", "\n").replace('\r', '\n').trim();
        return TIMED_LYRIC.matcher(lyric).find() ? lyric : null;
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = node.path(field);
            if (!value.isMissingNode() && !value.isNull() && !isBlank(value.asText(null))) {
                return value.asText(null);
            }
        }
        return null;
    }

    private String joinQuery(String title, String artist) {
        return isGenericArtist(artist) ? title.trim() : title.trim() + " " + artist.trim();
    }

    private List<String> searchQueries(String title, String artist) {
        LinkedHashSet<String> queries = new LinkedHashSet<>();
        String cleanTitle = cleanSearchText(title);
        String cleanArtist = cleanArtist(artist);
        queries.add(joinQuery(title, artist));
        if (!cleanTitle.isBlank()) {
            queries.add(joinQuery(cleanTitle, cleanArtist));
            queries.add(cleanTitle);
        }
        queries.add(title.trim());
        queries.removeIf(String::isBlank);
        return List.copyOf(queries);
    }

    private String cleanSearchText(String value) {
        if (isBlank(value)) {
            return "";
        }
        return TITLE_DECORATION.matcher(value).replaceAll("")
                .replaceFirst("(?i)\\.(?:flac|mp3|m4a|wav|aac)$", "")
                .trim();
    }

    private String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String cleanArtist(String artist) {
        if (isGenericArtist(artist)) {
            return "";
        }
        return artist.split("(?i)\\s+(?:feat\\.?|ft\\.?)\\s+|[/、;&]", 2)[0].trim();
    }

    private boolean isGenericArtist(String artist) {
        return isBlank(artist) || GENERIC_ARTISTS.contains(normalize(artist));
    }

    private String joinArtists(JsonNode artists) {
        if (!artists.isArray()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (JsonNode artist : artists) {
            String name = firstText(artist, "name", "title");
            if (!isBlank(name)) {
                if (!builder.isEmpty()) {
                    builder.append(' ');
                }
                builder.append(name);
            }
        }
        return builder.toString();
    }

    private int matchScore(String expectedTitle, String expectedArtist, String actualTitle, String actualArtist) {
        String expectedTitleKey = normalize(expectedTitle);
        String actualTitleKey = normalize(actualTitle);
        if (expectedTitleKey.isEmpty() || actualTitleKey.isEmpty()) {
            return 0;
        }
        int score = 0;
        if (expectedTitleKey.equals(actualTitleKey)) {
            score += 80;
        } else if (expectedTitleKey.contains(actualTitleKey) || actualTitleKey.contains(expectedTitleKey)) {
            score += 62;
        } else {
            score += overlapScore(expectedTitleKey, actualTitleKey);
        }
        String expectedArtistKey = normalize(expectedArtist);
        String actualArtistKey = normalize(actualArtist);
        if (!expectedArtistKey.isEmpty() && !actualArtistKey.isEmpty()) {
            if (expectedArtistKey.equals(actualArtistKey)) {
                score += 25;
            } else if (expectedArtistKey.contains(actualArtistKey) || actualArtistKey.contains(expectedArtistKey)) {
                score += 16;
            } else if (overlapScore(expectedArtistKey, actualArtistKey) >= 18) {
                score += 8;
            }
        }
        return score;
    }

    private int overlapScore(String left, String right) {
        int common = 0;
        int max = Math.min(left.length(), right.length());
        for (int size = max; size >= 2; size--) {
            for (int start = 0; start + size <= left.length(); start++) {
                if (right.contains(left.substring(start, start + size))) {
                    common = Math.max(common, size);
                }
            }
            if (common > 0) {
                break;
            }
        }
        return common == 0 ? 0 : Math.min(50, common * 50 / Math.max(left.length(), right.length()));
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String lower = value.toLowerCase();
        StringBuilder builder = new StringBuilder(lower.length());
        for (int i = 0; i < lower.length(); i++) {
            char ch = lower.charAt(i);
            if (Character.isLetterOrDigit(ch)) {
                builder.append(ch);
            }
        }
        return builder.toString();
    }

    private WebResponse get(String url, String referer) throws IOException {
        IOException lastError = null;
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                WebResponse response = getOnce(url, referer);
                if (response.statusCode() < 500 || attempt == 1) {
                    return response;
                }
            } catch (IOException e) {
                lastError = e;
                if (attempt == 1) {
                    throw e;
                }
            }
        }
        throw lastError == null ? new IOException("Cloud lyric request failed") : lastError;
    }

    private WebResponse getOnce(String url, String referer) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(15000);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 SekaiSong/1.0");
        connection.setRequestProperty("Referer", referer);
        connection.setRequestProperty("Origin", referer.endsWith("/") ? referer.substring(0, referer.length() - 1) : referer);
        try {
            int statusCode = connection.getResponseCode();
            if (statusCode < 200 || statusCode >= 300) {
                return new WebResponse(statusCode, "");
            }
            return new WebResponse(statusCode,
                    new String(connection.getInputStream().readAllBytes(), StandardCharsets.UTF_8));
        } finally {
            connection.disconnect();
        }
    }

    private boolean ok(WebResponse response) {
        return response.statusCode() >= 200 && response.statusCode() < 300;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private record WebResponse(int statusCode, String body) {
    }

    private record ScoredSong(JsonNode song, int score) {
    }
}
