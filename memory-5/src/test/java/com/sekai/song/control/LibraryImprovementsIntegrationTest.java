package com.sekai.song.control;

import com.sekai.song.model.*;
import com.sekai.song.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.containsString;

@SpringBootTest @AutoConfigureMockMvc @Transactional
class LibraryImprovementsIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired SongService songs;
    @Autowired PlaylistService playlists;
    @Autowired LibraryQueryService queries;
    @Autowired LibraryArchiveService archives;
    @Autowired LibraryMergeService merges;
    @Autowired ImportTaskService tasks;
    @MockitoBean MusicImportCoordinator importer;
    final ObjectMapper json=new ObjectMapper();
    Long owner,other;
    MockHttpSession session;
    @BeforeEach void setup(){owner=user();other=user();session=new MockHttpSession();User u=new User();u.setId(owner);u.setNickName("测试听众");session.setAttribute("loginUser",u);session.setAttribute("libraryToolsCsrf","qa-token");}
    Long user(){String name="qa_"+UUID.randomUUID().toString().replace("-","");jdbc.update("INSERT INTO sekai_song_user(user_name,password,nick_name) VALUES (?,'unused','测试')",name);return jdbc.queryForObject("SELECT id FROM sekai_song_user WHERE user_name=?",Long.class,name);}
    Song song(Long user,String title){Song s=new Song();s.setUserId(user);s.setTitle(title);s.setArtist("歌手");s.setAlbumName("专辑");assertTrue(songs.add(s));return s;}
    Playlist playlist(Long user,String title){Playlist p=new Playlist();p.setUserId(user);p.setName(title);assertTrue(playlists.add(p));return p;}
    void bind(Song s){jdbc.update("INSERT INTO sekai_song_local_binding(song_id,user_id,file_name,file_size,last_modified,preferences_json) VALUES (?,?,'test.mp3',1234,1,JSON_OBJECT())",s.getId(),s.getUserId());}

    @Test void emptyLibraryAndNoMatchesRenderBothViews() throws Exception {
        for(String view:List.of("cover","list"))mvc.perform(get("/songs").session(session).param("view",view).param("keyword","不存在")).andExpect(status().isOk());
        mvc.perform(get("/home").session(session)).andExpect(status().isOk()).andExpect(content().string(containsString("添加第一首音乐")));
        mvc.perform(get("/library-tools").session(session)).andExpect(status().isOk()).andExpect(content().string(containsString("备份与恢复")));
    }
    @Test void databasePaginationSearchAndListeningHistoryAreScoped() throws Exception {
        Playlist p=playlist(owner,"分页歌单");
        for(int i=0;i<65;i++){Song s=song(owner,"Music "+i);bind(s);playlists.addSong(p.getId(),s.getId(),owner);}
        Song stranger=song(other,"Music stranger");bind(stranger);
        assertEquals(65,queries.searchCount(owner,"MUSIC","song"));
        assertEquals(0,queries.searchCount(owner,"%","song"));
        assertEquals(5,queries.playlistSongs(p.getId(),owner,60,30).size());
        assertEquals(0,queries.playlistSongs(p.getId(),other,0,30).size());
        assertEquals(20,queries.search(owner,"Music","all",20,20).size());
        Song heard=song(owner,"真正听过");bind(heard);
        jdbc.update("INSERT INTO sekai_song_listen_session(id,user_id,song_id,start_day,played_ms,reported_ms,last_ms) VALUES (?,?,?,CURRENT_DATE,12000,12000,?)",UUID.randomUUID().toString(),owner,heard.getId(),System.currentTimeMillis());
        assertEquals(heard.getId(),queries.recent(owner).get(0).getId());
        assertEquals(heard.getId(),queries.smart(owner,"frequent",1).get(0).getId());
        mvc.perform(get("/search").session(session).param("q","Music").param("page","999")).andExpect(status().isOk()).andExpect(model().attribute("currentPage",4));
    }
    @Test void backupRoundTripIsIdempotentAndNeverRestoresLocalPaths() {
        Song s=song(owner,"备份歌曲");s.setLyricText("[00:01]歌词");s.setCoverUrl("file:///private/cover.png");songs.update(s,owner);songs.toggleFavorite(s.getId(),owner);bind(s);
        Playlist p=playlist(owner,"收藏歌单");playlists.addSong(p.getId(),s.getId(),owner);
        var archive=archives.export(owner);assertNull(archive.tracks().get(0).cover());
        assertEquals(0,archives.preview(other,archive).conflicts());
        var result=archives.restore(other,archive,"fill");assertEquals(1,result.added());
        assertEquals(1,archives.preview(other,archive).conflicts());
        assertEquals(0,archives.restore(other,archive,"fill").added());
        var restored=songs.listByUserId(other);assertEquals(1,restored.size());assertEquals("[00:01]歌词",restored.get(0).getLyricText());assertTrue(restored.get(0).getFavorite());
        assertNull(restored.get(0).getLocalAudioUrl());
        assertEquals(1,playlists.listSongs(playlists.listByUserId(other).get(0).getId(),other).size());
        var invalid=new LibraryArchiveService.Archive(1,archive.tracks(),List.of(new LibraryArchiveService.Collection("错误",null,List.of(999999L))));
        assertThrows(ResponseStatusException.class,()->archives.restore(other,invalid,"fill"));
    }
    @Test void restoreNeedsCsrfAndExactPreview() throws Exception {
        var archive=new LibraryArchiveService.Archive(1,List.of(),List.of());String body=json.writeValueAsString(archive);
        mvc.perform(post("/api/library-tools/backup-preview").session(session).contentType("application/json").content(body)).andExpect(status().isForbidden());
        var response=mvc.perform(post("/api/library-tools/backup-preview").session(session).header("X-Library-CSRF","qa-token").contentType("application/json").content(body)).andExpect(status().isOk()).andReturn();
        String confirmation=json.readTree(response.getResponse().getContentAsString()).get("confirmation").asText();
        String payload=json.writeValueAsString(new LibraryToolsControl.Restore(archive,"skip",confirmation));
        mvc.perform(post("/api/library-tools/restore").session(session).header("X-Library-CSRF","qa-token").contentType("application/json").content(payload)).andExpect(status().isOk());
        mvc.perform(post("/api/library-tools/restore").session(session).header("X-Library-CSRF","qa-token").contentType("application/json").content(payload)).andExpect(status().isConflict());
        mvc.perform(get("/api/library-tools/backup")).andExpect(status().isUnauthorized());
    }
    @Test void mergePreservesMembershipFavoriteAndRejectsCrossAccountAndStalePreview() {
        Song a=song(owner,"重复"),b=song(owner,"重复"),stranger=song(other,"重复");bind(b);songs.toggleFavorite(b.getId(),owner);
        Playlist p=playlist(owner,"保留关系");playlists.addSong(p.getId(),b.getId(),owner);
        String firstFingerprint=(String)merges.preview(owner,a.getId(),b.getId()).get("fingerprint");
        jdbc.update("UPDATE sekai_song_track SET lyric_text='changed' WHERE id=?",b.getId());
        assertThrows(ResponseStatusException.class,()->merges.merge(owner,a.getId(),b.getId(),firstFingerprint));
        assertThrows(ResponseStatusException.class,()->merges.preview(owner,a.getId(),stranger.getId()));
        String fingerprint=(String)merges.preview(owner,a.getId(),b.getId()).get("fingerprint");
        merges.merge(owner,a.getId(),b.getId(),fingerprint);
        assertNull(songs.getByIdAndUserId(b.getId(),owner));assertTrue(songs.getByIdAndUserId(a.getId(),owner).getFavorite());
        assertEquals("changed",songs.getByIdAndUserId(a.getId(),owner).getLyricText());assertEquals(a.getId(),playlists.listSongs(p.getId(),owner).get(0).getId());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_local_binding WHERE song_id=?",Integer.class,a.getId()));
    }
    @Test void importTasksPersistProgressAndRetryOnlyFailedInputs() {
        MusicImportResult ok=new MusicImportResult();ok.setSuccess(true);ok.setMessage("已导入");ok.setImportedCount(1);
        MusicImportResult bad=new MusicImportResult();bad.setMessage("暂不可用");
        when(importer.importSongs(eq("netease"),eq("12345"),isNull(),eq(owner))).thenReturn(ok);
        when(importer.importSongs(eq("netease"),eq("67890"),isNull(),eq(owner))).thenReturn(bad);
        String id=tasks.submit(owner,"netease","12345\n67890",null);
        assertThrows(ResponseStatusException.class,()->tasks.get(other,id));
        ReflectionTestUtils.invokeMethod(tasks,"poll");
        assertEquals("partial",tasks.get(owner,id).state());
        String retry=tasks.retry(owner,id);assertEquals(List.of("67890"),tasks.get(owner,retry).items().stream().map(ImportTaskService.Item::input).toList());
        assertThrows(ResponseStatusException.class,()->tasks.retry(owner,retry));
        verify(importer,times(1)).importSongs(eq("netease"),eq("12345"),isNull(),eq(owner));
    }
}
