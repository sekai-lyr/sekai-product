package com.sekai.song.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CommonsAssetServiceTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void acceptsOnlyNamedCc0Metadata() throws Exception {
        assertTrue(CommonsAssetService.isCc0(json.readTree("{\"extmetadata\":{\"LicenseShortName\":{\"value\":\"CC0 1.0\"}}}")));
        assertFalse(CommonsAssetService.isCc0(json.readTree("{\"extmetadata\":{\"LicenseShortName\":{\"value\":\"CC BY-SA 4.0\"}}}")));
        assertFalse(CommonsAssetService.isCc0(json.readTree("{}")));
    }

    @Test void rejectsWrongSongAndFakeFormats() {
        assertTrue(CommonsAssetService.matchesSong("File:Singer - Song Name.flac", "Song Name", "Singer"));
        assertFalse(CommonsAssetService.matchesSong("File:Other artist - Song Name.flac", "Song Name", "Singer"));
        assertEquals("flac", CommonsAssetService.typeOf("File:Track.FLAC"));
        assertNull(CommonsAssetService.typeOf("File:Track.mp3"));
        assertTrue(CommonsAssetService.validSignature(new byte[]{'f','L','a','C',0,0,0,0,0,0,0,0}, "flac"));
        assertFalse(CommonsAssetService.validSignature(new byte[]{'I','D','3',0,0,0,0,0,0,0,0,0}, "flac"));
    }
}
