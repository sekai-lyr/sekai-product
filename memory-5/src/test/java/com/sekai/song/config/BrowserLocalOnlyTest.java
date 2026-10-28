package com.sekai.song.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;

class BrowserLocalOnlyTest {
    @Test void retiredUploadEntryRejectsRequestsBeforeControllerWritesFiles() throws Exception {
        var request = new MockHttpServletRequest("POST", "/songs/audio/36");
        var response = new MockHttpServletResponse();
        assertFalse(new LocalPlaybackConfig.BrowserLocalOnly().preHandle(request, response, new Object()));
        assertEquals(410, response.getStatus());
    }
}
