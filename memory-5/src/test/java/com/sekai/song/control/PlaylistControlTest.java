package com.sekai.song.control;

import com.sekai.song.model.Playlist;
import com.sekai.song.model.User;
import com.sekai.song.service.PlaylistService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.servlet.mvc.support.RedirectAttributesModelMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PlaylistControlTest {
    @Test
    void anonymousUserCannotCreatePlaylist() {
        PlaylistService service = mock(PlaylistService.class);
        assertEquals("redirect:/login", new PlaylistControl(service)
                .addPlaylist(new Playlist(), new MockHttpSession(), new RedirectAttributesModelMap()));
        verifyNoInteractions(service);
    }

    @Test
    void createsPlaylistForCurrentUser() {
        PlaylistService service = mock(PlaylistService.class);
        Playlist playlist = new Playlist();
        when(service.add(playlist)).thenReturn(true);
        User user = new User();
        user.setId(7L);
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("loginUser", user);
        assertEquals("redirect:/playlists", new PlaylistControl(service)
                .addPlaylist(playlist, session, new RedirectAttributesModelMap()));
        assertEquals(7L, playlist.getUserId());
        verify(service).add(playlist);
    }
}
