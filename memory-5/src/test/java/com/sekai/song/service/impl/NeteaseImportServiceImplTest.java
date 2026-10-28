package com.sekai.song.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NeteaseImportServiceImplTest {
    @Test
    void limitsLongArtistWithoutSplittingUnicodeCharacter() {
        String artists = "歌".repeat(159) + "🎵" + "尾";
        String fitted = SongImportText.fit(artists, 160);
        assertEquals(160, fitted.codePointCount(0, fitted.length()));
        assertEquals("🎵", fitted.substring(fitted.length() - 2));
    }

    @Test
    void retrievesIdsBeyondTheTenVisibleTracks() throws Exception {
        ObjectMapper json = new ObjectMapper();
        var playlist = json.createObjectNode();
        var ids = playlist.putArray("trackIds");
        List<com.fasterxml.jackson.databind.JsonNode> visible = new ArrayList<>();
        for (int id = 1; id <= 190; id++) {
            ids.addObject().put("id", id);
            if (id <= 10) visible.add(json.createObjectNode().put("id", id));
        }
        List<String> missing = NeteaseImportServiceImpl.missingTrackIds(playlist, visible);
        assertEquals(180, missing.size());
        assertEquals("11", missing.get(0));
        assertEquals("190", missing.get(179));
    }
}
