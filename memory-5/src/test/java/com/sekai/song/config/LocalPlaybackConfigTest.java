package com.sekai.song.config;

import com.sekai.song.mapper.SekaiSongTrackMapper;
import com.sekai.song.model.User;
import com.sekai.song.control.MusicControl;
import com.sekai.song.model.Song;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.beans.MutablePropertyValues;
import org.springframework.web.bind.WebDataBinder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LocalPlaybackConfigTest {
    private final SekaiSongTrackMapper songs = mock(SekaiSongTrackMapper.class);
    private final LocalPlaybackConfig.AudioAccess access = new LocalPlaybackConfig.AudioAccess(songs);
    private static final String AUDIO = "/uploads/audio/2-36-1778404055914.flac";

    private MockHttpServletRequest request(String path, Long userId) {
        var request = new MockHttpServletRequest("GET", path);
        if (userId != null) {
            User user = new User(); user.setId(userId);
            request.getSession().setAttribute("loginUser", user);
        }
        return request;
    }

    @Test void rejectsAnonymousAudio() throws Exception {
        var response = new MockHttpServletResponse();
        assertFalse(access.preHandle(request(AUDIO, null), response, new Object()));
        assertEquals(401, response.getStatus()); verifyNoInteractions(songs);
    }

    @Test void rejectsAnonymousCovers() throws Exception {
        var response = new MockHttpServletResponse();
        assertFalse(access.preHandle(request("/uploads/covers/2-36-1778404055914.jpg", null), response, new Object()));
        assertEquals(401, response.getStatus()); verifyNoInteractions(songs);
    }

    @Test void allowsLoggedInUsersToViewCovers() throws Exception {
        assertTrue(access.preHandle(request("/uploads/covers/2-36-1778404055914.jpg", 4L),
                new MockHttpServletResponse(), new Object()));
        assertTrue(access.preHandle(request("/external-uploads/covers/cover.jpg", 4L),
                new MockHttpServletResponse(), new Object()));
        verifyNoInteractions(songs);
    }

    @Test void rejectsCoverDirectoryTraversalForLoggedInUsers() throws Exception {
        var response = new MockHttpServletResponse();
        assertFalse(access.preHandle(request("/uploads/covers/sub/dir.jpg", 3L), response, new Object()));
        assertEquals(404, response.getStatus());
    }

    @Test void allowsOwnerAndRangeRequestsWithoutChangingLegacyFileNames() throws Exception {
        when(songs.countOwnedAudio(3L, AUDIO)).thenReturn(1);
        var request = request(AUDIO, 3L); request.addHeader("Range", "bytes=0-1023");
        assertTrue(access.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test void rejectsOtherAccount() throws Exception {
        var response = new MockHttpServletResponse();
        assertFalse(access.preHandle(request(AUDIO, 4L), response, new Object()));
        assertEquals(404, response.getStatus());
    }

    @Test void servesOnlyOwnedCommonsVideos() throws Exception {
        String video = "/uploads/video/commons-3-36-test.mp4";
        when(songs.countOwnedVideo(3L, video)).thenReturn(1);
        assertTrue(access.preHandle(request(video, 3L), new MockHttpServletResponse(), new Object()));
        var other = new MockHttpServletResponse();
        assertFalse(access.preHandle(request(video, 4L), other, new Object()));
        assertEquals(404, other.getStatus());
        var legacy = new MockHttpServletResponse();
        assertFalse(access.preHandle(request("/uploads/video/legacy.mp4", 3L), legacy, new Object()));
        assertEquals(410, legacy.getStatus());
    }

    @Test void rejectsEncodedTraversalThroughPublicCoverDirectory() throws Exception {
        var response = new MockHttpServletResponse();
        assertFalse(access.preHandle(request("/uploads/covers/%2e%2e/audio/file.flac", 3L), response, new Object()));
        assertEquals(404, response.getStatus()); verifyNoInteractions(songs);
    }

    @Test void stopsOnlineProxyAndServerFolderImports() throws Exception {
        for (String path : new String[]{"/bilibili/stream/36", "/bilibili/direct/36",
                "/playlists/6/audio-folder-path", "/playlists/local-audio-folder-path"}) {
            var response = new MockHttpServletResponse();
            assertFalse(access.preHandle(request(path, 3L), response, new Object()));
            assertEquals(410, response.getStatus());
        }
        verifyNoInteractions(songs);
    }

    @Test void cannotForgeAudioOwnershipUsingSongFormFields() {
        Song song = new Song(); WebDataBinder binder = new WebDataBinder(song);
        new MusicControl().restrictMediaBinding(binder);
        var fields = new MutablePropertyValues();
        fields.add("title", "Test"); fields.add("localAudioUrl", AUDIO); fields.add("localVideoUrl", "/uploads/video/other.mp4");
        binder.bind(fields);
        assertEquals("Test", song.getTitle()); assertNull(song.getLocalAudioUrl()); assertNull(song.getLocalVideoUrl());
    }
}
