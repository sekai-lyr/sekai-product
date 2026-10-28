package com.sekai.song.control;

import com.sekai.song.model.User;
import com.sekai.song.service.CloudLyricService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.ui.ExtendedModelMap;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LocalPlayerControlTest {
    @Test void anonymousLocalStageRequiresNoStoredSongOrAccount() {
        LocalPlayerControl page = new LocalPlayerControl();
        for (String mode : com.sekai.song.model.StageModes.ALL) {
            var model = new ExtendedModelMap();
            assertEquals("player", page.localStage(mode, model));
            assertEquals(mode, model.get("stageMode"));
            assertEquals(true, model.get("browserLocal"));
        }
    }
    @Test void anonymousCloudQueryDoesNotContactProviders() {
        var cloud = mock(CloudLyricService.class);var page = new LocalPlayerControl();
        ReflectionTestUtils.setField(page, "cloudLyricService", cloud);
        assertEquals(401, page.lyrics("花の塔", "さユり", new MockHttpSession()).getStatusCode().value());
        verifyNoInteractions(cloud);
    }
    @Test void authenticatedCloudQueryAcceptsOnlyBoundedMetadata() {
        var cloud = mock(CloudLyricService.class);var page = new LocalPlayerControl();
        ReflectionTestUtils.setField(page, "cloudLyricService", cloud);
        var session = new MockHttpSession();session.setAttribute("loginUser", new User());
        assertEquals(400, page.lyrics("x".repeat(161), "", session).getStatusCode().value());
        verifyNoInteractions(cloud);
        when(cloud.fetchBestLyric("花の塔", "さユり")).thenReturn("[00:14]君が持ってきた漫画");
        assertEquals(200, page.lyrics("花の塔", "さユり", session).getStatusCode().value());
        verify(cloud).fetchBestLyric("花の塔", "さユり");
    }
}
