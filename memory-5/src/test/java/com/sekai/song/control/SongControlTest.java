package com.sekai.song.control;

import com.sekai.song.model.Song;
import com.sekai.song.model.User;
import com.sekai.song.service.SongService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.servlet.mvc.support.RedirectAttributesModelMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SongControlTest {
    @Test
    void anonymousUserCannotAddSong() {
        SongService service = mock(SongService.class);
        assertEquals("redirect:/login", new SongControl(service)
                .addSong(new Song(), new MockHttpSession(), new RedirectAttributesModelMap()));
        verifyNoInteractions(service);
    }

    @Test
    void songUpdatesCannotBindLocalMediaPaths() {
        WebDataBinder binder = new WebDataBinder(new Song());
        new SongControl(mock(SongService.class)).restrictMediaBinding(binder);
        assertEquals(2, binder.getDisallowedFields().length);
    }

    @Test
    void addsSongForLoggedInUser() {
        SongService service = mock(SongService.class);
        Song song = new Song();
        when(service.add(song)).thenReturn(true);
        User user = new User();
        user.setId(7L);
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("loginUser", user);
        RedirectAttributesModelMap redirect = new RedirectAttributesModelMap();
        assertEquals("redirect:/songs", new SongControl(service).addSong(song, session, redirect));
        assertEquals(7L, song.getUserId());
        assertTrue(redirect.getFlashAttributes().containsKey("message"));
    }
}
