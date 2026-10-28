package com.sekai.song.control;

import com.sekai.song.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LocalImportIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.sekai.song.service.LocalLibraryService library;
    private final ObjectMapper json=new ObjectMapper();

    @Test void importedFieldsAppearInOriginalPlaylistAndDuplicateConfirmationIsSafe() throws Exception {
        // Use an existing QA account; all writes roll back, including playlist membership.
        Long userId=jdbc.queryForObject("SELECT id FROM sekai_song_user WHERE id=31",Long.class);
        MockHttpSession session=session(userId);
        mvc.perform(post("/local-player/library/playlists").session(session).contentType("application/json")
                .content("{\"name\":\"import test\"}")).andExpect(status().isForbidden());
        long playlistId=id(mvc.perform(post("/local-player/library/playlists").session(session)
                .header("X-Local-Library-CSRF","test-token").contentType("application/json")
                .content("{\"name\":\"本地导入事务测试\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String input="{\"title\":\"导入测试歌曲\",\"artist\":\"测试\",\"album\":\"测试\",\"file\":{\"fileName\":\"qa-import-20261012.mp3\",\"fileSize\":1234,\"lastModified\":1}}";
        long songId=id(mvc.perform(post("/local-player/library/songs").session(session).header("X-Local-Library-CSRF","test-token")
                .contentType("application/json").content(input)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long duplicate=id(mvc.perform(post("/local-player/library/songs").session(session).header("X-Local-Library-CSRF","test-token")
                .contentType("application/json").content(input)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertEquals(songId,duplicate);
        for(int i=0;i<2;i++)mvc.perform(post("/local-player/library/playlists/"+playlistId+"/songs/"+songId).session(session)
                .header("X-Local-Library-CSRF","test-token")).andExpect(status().isOk());
        mvc.perform(post("/local-player/library/songs/"+songId+"/lyrics").session(session).header("X-Local-Library-CSRF","test-token")
                .contentType("application/json").content("{\"lyrics\":\"[00:01.000]测试歌词\"}")).andExpect(status().isOk());
        assertEquals("[00:01.000]测试歌词",jdbc.queryForObject("SELECT lyric_text FROM sekai_song_track WHERE id=?",String.class,songId));
        String html=mvc.perform(get("/playlists/"+playlistId).session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(html.contains("导入测试歌曲"));
        String songsHtml=mvc.perform(get("/songs").param("keyword","导入测试歌曲").session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(songsHtml.contains("导入测试歌曲"));
        mvc.perform(get("/player/"+songId).session(session)).andExpect(status().isOk())
                .andExpect(model().attribute("playbackPage",true))
                .andExpect(model().attribute("requestedSongId",songId));
        String library=mvc.perform(get("/local-player/library").session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var lists=json.readTree(library).get("playlists");
        var target=java.util.stream.StreamSupport.stream(lists.spliterator(),false).filter(p->p.get("id").asLong()==playlistId).findFirst().orElseThrow();
        assertEquals(1,target.get("songIds").size());assertEquals(songId,target.get("songIds").get(0).asLong());
        mvc.perform(post("/local-player/library/playlists/"+playlistId+"/songs/"+songId).session(session(3L))
                .header("X-Local-Library-CSRF","test-token")).andExpect(status().isNotFound());
        mvc.perform(post("/local-player/library/songs/"+songId+"/lyrics").session(session(3L)).header("X-Local-Library-CSRF","test-token")
                .contentType("application/json").content("{\"lyrics\":\"wrong owner\"}")).andExpect(status().isNotFound());
    }
    @Test void legacyVideoFilenameIsAvailableForBrowserAssociation() throws Exception {
        var session=session(31L);
        String input="{\"title\":\"旧视频关联测试\",\"file\":{\"fileName\":\"qa-local-video.mp4\",\"fileSize\":1234,\"lastModified\":1}}";
        long songId=id(mvc.perform(post("/local-player/library/songs").session(session).header("X-Local-Library-CSRF","test-token")
                .contentType("application/json").content(input)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        jdbc.update("DELETE FROM sekai_song_local_binding WHERE song_id=?",songId);
        jdbc.update("UPDATE sekai_song_track SET local_audio_url=NULL,local_video_url=? WHERE id=?","/uploads/video/qa-local-video.mp4",songId);
        var body=json.readTree(mvc.perform(get("/local-player/library").session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        var song=java.util.stream.StreamSupport.stream(body.get("songs").spliterator(),false).filter(s->s.get("id").asLong()==songId).findFirst().orElseThrow();
        assertEquals("qa-local-video.mp4",song.get("fileName").asText());
        assertEquals("qa-local-video.mp4",song.path("videoFileName").asText());
        mvc.perform(post("/local-player/library/songs/"+songId+"/binding").session(session(3L)).header("X-Local-Library-CSRF","test-token")
                .contentType("application/json").content("{\"fileName\":\"qa-local-video.mp4\",\"fileSize\":1234,\"lastModified\":1}"))
                .andExpect(status().isNotFound());
    }
    @Test void existingAccountVideosExposeOwnedVideoFilenames() {
        var expected=jdbc.queryForList("SELECT id,local_video_url FROM sekai_song_track WHERE user_id=3 AND local_video_url LIKE '/uploads/video/%'");
        var entries=library.list(3L);
        for(var row:expected){
            String url=String.valueOf(row.get("local_video_url"));
            var entry=entries.stream().filter(e->e.id().equals(((Number)row.get("id")).longValue())).findFirst().orElseThrow();
            assertEquals(url.substring(url.lastIndexOf('/')+1),entry.videoFileName());
        }
        System.out.println("Existing account video filenames verified: "+expected.size());
    }
    private long id(String body) throws Exception{return json.readTree(body).get("id").asLong();}
    private MockHttpSession session(Long id){var session=new MockHttpSession();var user=new User();user.setId(id);user.setUserName("qa");user.setNickName("测试");session.setAttribute("loginUser",user);session.setAttribute("localLibraryCsrf","test-token");return session;}
}
