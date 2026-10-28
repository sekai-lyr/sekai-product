package com.sekai.memory.book.service;

import com.sekai.memory.book.model.Anime;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.time.LocalDate;
import java.nio.file.Path;
import java.nio.file.Files;
import java.nio.file.attribute.FileTime;
import java.io.IOException;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.client.ResourceAccessException;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class MetadataEnrichmentServiceTest {
    @Test
    void matchesExactTitleInsteadOfFirstSpecialAndKeepsPersonalFields() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.bgm.tv");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                .andRespond(withSuccess("""
                    {"data":[{"name_cn":"黑色五叶草 OAD","eps":1},
                    {"name_cn":"黑色五叶草","platform":"TV","date":"2017-10-03",
                    "eps":170,"total_episodes":171,"images":{"large":"https://lain.bgm.tv/cover.jpg"},
                    "tags":[{"name":"热血"}]}]}
                    """, MediaType.APPLICATION_JSON));
        Anime anime = new Anime();
        anime.setTitle("黑色五叶草");
        anime.setStatus("在看");
        anime.setCurrentEpisode(12);
        anime.setCoverUrl("https://example.com/my-cover.jpg");
        assertTrue(new MetadataEnrichmentService(builder.build()).enrichAnime(anime));
        assertEquals("TV", anime.getType());
        assertEquals(LocalDate.of(2017, 10, 3), anime.getReleaseDate());
        assertEquals(170, anime.getTotalEpisodes());
        assertEquals(12, anime.getCurrentEpisode());
        assertEquals("在看", anime.getStatus());
        assertEquals("https://example.com/my-cover.jpg", anime.getCoverUrl());
        server.verify();
    }

    @Test
    void doesNotImportRelatedSequelForUnmatchedName() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.bgm.tv");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                .andRespond(withSuccess("{\"data\":[{\"name_cn\":\"黑色五叶草 OAD\"}]}", MediaType.APPLICATION_JSON));
        Anime anime = new Anime();
        anime.setTitle("黑色五叶草");
        assertFalse(new MetadataEnrichmentService(builder.build()).enrichAnime(anime));
        assertEquals("黑色五叶草", anime.getTitle());
        assertNull(anime.getCoverUrl());
        server.verify();
    }

    @Test
    void retriesTimeoutBeforeReturningMetadata() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.bgm.tv");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                .andRespond(withException(new java.net.SocketTimeoutException("Read timed out")));
        server.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                .andRespond(withSuccess("{\"data\":[{\"name_cn\":\"黑色五叶草\",\"eps\":170}]}", MediaType.APPLICATION_JSON));
        assertEquals(170, new MetadataEnrichmentService(builder.build()).lookupAnime("黑色五叶草").getTotalEpisodes());
        server.verify();
    }

    @Test
    void persistsSuccessfulLookupAndUsesItAfterRestartEvenDuringOutage(@TempDir Path cache) throws IOException {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.bgm.tv");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                .andRespond(withSuccess("{\"data\":[{\"name_cn\":\"黑色五叶草\",\"eps\":170}]}", MediaType.APPLICATION_JSON));
        assertEquals(170, new MetadataEnrichmentService(builder.build(), cache).lookupAnime("黑色五叶草").getTotalEpisodes());
        server.verify();
        RestClient.Builder offline = RestClient.builder().baseUrl("https://api.bgm.tv");
        MockRestServiceServer offlineServer = MockRestServiceServer.bindTo(offline).build();
        MetadataEnrichmentService restarted = new MetadataEnrichmentService(offline.build(), cache);
        assertEquals(170, restarted.lookupAnime("黑色五叶草").getTotalEpisodes());
        offlineServer.verify();
        try (var files = Files.list(cache)) {
            Files.setLastModifiedTime(files.findFirst().orElseThrow(), FileTime.fromMillis(0));
        }
        offlineServer.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                .andRespond(withException(new IOException("offline")));
        offlineServer.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                .andRespond(withException(new IOException("offline")));
        assertEquals(170, restarted.lookupAnime("黑色五叶草").getTotalEpisodes());
        offlineServer.verify();
    }

    @Test
    void distinguishesNetworkFailureFromNoMatchingTitle() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.bgm.tv");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        for (int i = 0; i < 2; i++) {
            server.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                    .andRespond(withException(new IOException("offline")));
        }
        assertThrows(ResourceAccessException.class,
                () -> new MetadataEnrichmentService(builder.build()).lookupAnime("黑色五叶草"));
        server.verify();
    }

    @Test
    void savingAnExplicitCandidateUsesItsSubjectInsteadOfSearchingAgain() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.bgm.tv");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.bgm.tv/v0/subjects/120236"))
                .andRespond(withSuccess("""
                        {"id":120236,"type":2,"name_cn":"排球少年 第二季","platform":"TV","eps":25,"date":"2015-10-03"}
                        """, MediaType.APPLICATION_JSON));
        Anime anime = new Anime();
        anime.setTitle("排球少年");
        assertTrue(new MetadataEnrichmentService(builder.build()).enrichAnime(anime, 120236L));
        assertEquals("排球少年 第二季", anime.getTitle());
        assertEquals(LocalDate.of(2015, 10, 3), anime.getReleaseDate());
        server.verify();
    }

    @Test
    void fallsBackToTranslatedSearchAfterEmptyResponse() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.bgm.tv");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().string(
                        org.hamcrest.Matchers.containsString("选择项目")))
                .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.bgm.tv/v0/search/subjects?limit=20"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().string(
                        org.hamcrest.Matchers.containsString("SELECTION PROJECT")))
                .andRespond(withSuccess("""
                    {"data":[{"id":321190,"name":"SELECTION PROJECT","name_cn":"偶像选拔","platform":"TV","eps":13}]}
                    """, MediaType.APPLICATION_JSON));
        var result = new MetadataEnrichmentService(builder.build()).searchAnime("选择项目");
        assertEquals(321190L, result.recommendedSubjectId());
        server.verify();
    }
}
