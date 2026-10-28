package com.sekai.song.control;

import com.sekai.song.model.MusicImportResult;
import com.sekai.song.model.User;
import com.sekai.song.service.MusicImportStrategy;
import com.sekai.song.service.MusicImportCoordinator;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.servlet.mvc.support.RedirectAttributesModelMap;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MusicImportControlTest {
    @Test
    void requiresLoginBeforeCallingImporter() {
        MusicImportControl control = new MusicImportControl(new MusicImportCoordinator(List.of()));
        assertEquals("redirect:/login", control.importQqSongs(null, "link", null,
                new MockHttpSession(), new RedirectAttributesModelMap()));
    }

    @Test
    void usesLinkAndPreservesSuccessRedirect() {
        MusicImportControl control = new MusicImportControl(new MusicImportCoordinator(List.of(strategy("netease", true))));
        RedirectAttributesModelMap redirect = new RedirectAttributesModelMap();
        assertEquals("redirect:/playlists/42", control.importNeteaseSongs(null, "playlist-link", null,
                loggedIn(), redirect));
        assertEquals("imported playlist-link", redirect.getFlashAttributes().get("message"));
    }

    @Test
    void retainsInputWhenImportFails() {
        MusicImportControl control = new MusicImportControl(new MusicImportCoordinator(List.of(strategy("qq", false))));
        RedirectAttributesModelMap redirect = new RedirectAttributesModelMap();
        assertEquals("redirect:/qq", control.importQqSongs("old-input", "link", null,
                loggedIn(), redirect));
        assertEquals("old-input", redirect.getFlashAttributes().get("songIds"));
        assertEquals("imported old-input", redirect.getFlashAttributes().get("error"));
    }

    private static MusicImportStrategy strategy(String source, boolean success) {
        return new MusicImportStrategy() {
            @Override public String source() { return source; }

            @Override public MusicImportResult importSongs(String link, Long playlistId, Long userId) {
                assertEquals(7L, userId);
                MusicImportResult result = new MusicImportResult();
                result.setSuccess(success);
                result.setMessage("imported " + link);
                result.setPlaylistId(42L);
                return result;
            }
        };
    }

    private static MockHttpSession loggedIn() {
        User user = new User();
        user.setId(7L);
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("loginUser", user);
        return session;
    }
}
