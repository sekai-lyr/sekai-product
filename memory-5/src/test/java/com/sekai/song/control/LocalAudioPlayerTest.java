package com.sekai.song.control;

import com.sekai.song.model.Song;
import com.sekai.song.model.User;
import com.sekai.song.service.SongService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.ui.ExtendedModelMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LocalAudioPlayerTest {
    @Test void platformMetadataOpensPlaybackWithoutRedirectingToImportForEveryMode() {
        for (String mode : com.sekai.song.model.StageModes.ALL) {
            for (String url : List.of("https://music.163.com/song?id=36", "https://y.qq.com/n/ryqq/songDetail/test", "https://www.bilibili.com/video/BV1234567890")) {
                Song song = new Song(); song.setId(36L); song.setAudioUrl(url);
                var model = new ExtendedModelMap();
                assertEquals("local-player", render(song, mode, model));
                assertEquals(true, model.get("playbackPage"));
                assertEquals(36L, model.get("requestedSongId"));
                assertEquals(mode, model.get("stageMode"));
            }
        }
    }

    @Test void legacyServerAudioNeverBypassesBrowserLocalPlayback() {
        Song song = new Song(); song.setId(36L); song.setAudioUrl("https://www.bilibili.com/video/BV1234567890");
        song.setLocalAudioUrl("/uploads/audio/36.flac");
        for (String mode : List.of("disc", "lyrics", "folia-classic", "folia")) {
            var model = new ExtendedModelMap();
            assertEquals("local-player", render(song, mode, model));
            assertEquals(true, model.get("playbackPage"));
        }
    }

    @Test void arbitraryRemoteUrlCannotBeTreatedAsLocalAudio() {
        Song song = new Song(); song.setId(36L); song.setLocalAudioUrl("https://example.com/music.mp3");
        var model = new ExtendedModelMap();
        assertEquals("local-player", render(song, "folia", model));
        assertEquals(true, model.get("playbackPage"));
    }

    private String render(Song song, String mode, ExtendedModelMap model) {
        SongService songs = mock(SongService.class);
        when(songs.getByIdAndUserId(36L, 3L)).thenReturn(song);
        when(songs.listByUserId(3L)).thenReturn(List.of(song));
        when(songs.parseLyrics(any())).thenReturn(List.of());
        PageControl page = new PageControl(); ReflectionTestUtils.setField(page, "songService", songs);
        User user = new User(); user.setId(3L);
        var session = new MockHttpSession(); session.setAttribute("loginUser", user);
        return page.player(36L, null, null, mode, session, model);
    }
}
