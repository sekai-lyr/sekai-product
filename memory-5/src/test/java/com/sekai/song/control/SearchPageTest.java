package com.sekai.song.control;

import com.sekai.song.model.Playlist;
import com.sekai.song.model.Song;
import com.sekai.song.model.User;
import com.sekai.song.service.PlaylistService;
import com.sekai.song.service.SongService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.spring6.view.ThymeleafViewResolver;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.stream.IntStream;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SearchPageTest {
    private final com.sekai.song.service.LibraryQueryService queries = mock(com.sekai.song.service.LibraryQueryService.class);
    private final SongService songs = mock(SongService.class);
    private final PlaylistService playlists = mock(PlaylistService.class);
    private final MockHttpSession session = new MockHttpSession();
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        PageControl controller = new PageControl();
        ReflectionTestUtils.setField(controller, "songService", songs);
        ReflectionTestUtils.setField(controller, "libraryQueries", queries);
        ReflectionTestUtils.setField(controller, "playlistService", playlists);
        User user = new User();
        user.setId(7L);
        user.setNickName("搜索测试");
        session.setAttribute("loginUser", user);
        var templates = new ClassLoaderTemplateResolver();
        templates.setPrefix("templates/");
        templates.setSuffix(".html");
        templates.setCharacterEncoding("UTF-8");
        var engine = new SpringTemplateEngine();
        engine.setTemplateResolver(templates);
        var views = new ThymeleafViewResolver();
        views.setTemplateEngine(engine);
        views.setCharacterEncoding("UTF-8");
        mvc = MockMvcBuilders.standaloneSetup(controller).setViewResolvers(views).build();
        when(queries.searchCount(eq(7L),argThat(q -> q.equalsIgnoreCase("Music")),eq("song"))).thenReturn(25);
        when(queries.searchCount(eq(7L),argThat(q -> q.equalsIgnoreCase("Music")),eq("playlist"))).thenReturn(1);
        when(queries.search(eq(7L),anyString(),anyString(),anyInt(),anyInt())).thenAnswer(invocation -> {
            String type=invocation.getArgument(2);int offset=invocation.getArgument(3),limit=invocation.getArgument(4);
            var result=new java.util.ArrayList<com.sekai.song.model.SearchResult>();
            if(!type.equals("playlist"))IntStream.rangeClosed(1,25).forEach(i -> result.add(new com.sekai.song.model.SearchResult("歌曲","Music "+i,"测试歌手","/player/"+i)));
            if(!type.equals("song"))result.add(new com.sekai.song.model.SearchResult("歌单","Music 歌单","","/playlists/30"));
            return result.subList(Math.min(offset,result.size()),Math.min(offset+limit,result.size()));
        });
    }

    @Test
    void anonymousSearchDoesNotReadLibrary() throws Exception {
        mvc.perform(get("/search").param("q", "Music"))
                .andExpect(status().is3xxRedirection()).andExpect(redirectedUrl("/login"));
        verifyNoInteractions(songs, playlists);
    }

    @Test
    void blankSearchShowsGuidanceWithoutReadingLibrary() throws Exception {
        var response = mvc.perform(get("/search").session(session).param("q", "  \u2003 "))
                .andExpect(status().isOk()).andExpect(model().attribute("searched", false))
                .andExpect(content().string(containsString("想听什么？从一个关键词开始。"))).andReturn();
        verifyNoInteractions(songs, playlists);
        snapshot("empty", response.getResponse().getContentAsString());
    }

    @Test
    void searchRendersCountsAndBoundedResults() throws Exception {
        var response = mvc.perform(get("/search").session(session).param("q", " Music "))
                .andExpect(status().isOk()).andExpect(model().attribute("q", "Music"))
                .andExpect(model().attribute("allCount", 26)).andExpect(model().attribute("songCount", 25))
                .andExpect(model().attribute("playlistCount", 1)).andExpect(model().attribute("totalPages", 2))
                .andExpect(model().attribute("results", hasSize(20)))
                .andExpect(content().string(containsString("下一页"))).andReturn();
        verify(queries).search(7L,"Music","all",0,20);
        verifyNoInteractions(songs, playlists);
        snapshot("results", response.getResponse().getContentAsString());
    }

    @Test
    void playlistFilterKeepsTotalsAndResetsOutOfRangePage() throws Exception {
        mvc.perform(get("/search").session(session).param("q", "Music").param("type", "playlist").param("page", "999"))
                .andExpect(status().isOk()).andExpect(model().attribute("currentPage", 1))
                .andExpect(model().attribute("allCount", 26)).andExpect(model().attribute("results", hasSize(1)))
                .andExpect(content().string(containsString("/playlists/30")));
    }

    @Test
    void lastPageAndNegativePageStayInBounds() throws Exception {
        mvc.perform(get("/search").session(session).param("q", "Music").param("type", "song").param("page", "2147483647"))
                .andExpect(status().isOk()).andExpect(model().attribute("currentPage", 2))
                .andExpect(model().attribute("results", hasSize(5)))
                .andExpect(content().string(containsString("type=song&amp;page=1")));
        mvc.perform(get("/search").session(session).param("q", "Music").param("page", "-1").param("type", "unknown"))
                .andExpect(status().isOk()).andExpect(model().attribute("currentPage", 1))
                .andExpect(model().attribute("type", "all"));
    }

    @Test
    void missingResultExplainsHowToRecoverAndEscapesQuery() throws Exception {
        var response = mvc.perform(get("/search").session(session).param("q", "<script>alert(1)</script>"))
                .andExpect(status().isOk()).andExpect(model().attribute("searched", true))
                .andExpect(content().string(containsString("没有找到匹配的")))
                .andExpect(content().string(not(containsString("<script>alert(1)</script>")))).andReturn();
        snapshot("no-results", response.getResponse().getContentAsString());
    }

    @Test
    void overlongQueryDoesNotReadLibrary() throws Exception {
        mvc.perform(get("/search").session(session).param("q", "x".repeat(161)))
                .andExpect(status().isOk()).andExpect(content().string(containsString("关键词最多 160 个字符")));
        verifyNoInteractions(songs, playlists);
    }

    @Test
    void searchCaseFoldingDoesNotDependOnServerLocale() throws Exception {
        Locale before = Locale.getDefault();
        try {
            Locale.setDefault(Locale.forLanguageTag("tr-TR"));
            mvc.perform(get("/search").session(session).param("q", "MUSIC"))
                    .andExpect(status().isOk()).andExpect(model().attribute("allCount", 26));
        } finally {
            Locale.setDefault(before);
        }
    }

    private void snapshot(String name, String html) throws Exception {
        String output = System.getProperty("search.qa.output");
        if (output != null) {
            Files.createDirectories(Path.of(output));
            Files.writeString(Path.of(output, name + ".html"), html);
        }
    }
}
