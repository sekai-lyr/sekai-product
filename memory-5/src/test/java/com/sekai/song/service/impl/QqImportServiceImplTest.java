package com.sekai.song.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QqImportServiceImplTest {
    @Test
    void continuesWhenApiReturnsTenSongsButReportsMore() {
        assertTrue(QqImportServiceImpl.hasMorePlaylistSongs(10, 10, 190));
        assertFalse(QqImportServiceImpl.hasMorePlaylistSongs(190, 10, 190));
        assertFalse(QqImportServiceImpl.hasMorePlaylistSongs(10, 10, 0));
    }

    @Test
    void convertsOfficialPlaylistResponseIntoImportableSongFields() throws Exception {
        var source = new ObjectMapper().readTree("""
                {"code":0,"cdlist":[{"songnum":563,"songlist":[{"songid":105905415,
                "songmid":"004fneUm24gD2c","songname":"爱错","interval":238,
                "singer":[{"name":"王力宏"}],"albumname":"心中的日月","albummid":"002ElVxf43rOue"}]}]}
                """);
        var data = new QqImportServiceImpl().normalizeLegacyPlaylist(source);
        assertEquals(563, data.path("total_song_num").asInt());
        assertEquals("004fneUm24gD2c", data.path("songlist").path(0).path("mid").asText());
        assertEquals("爱错", data.path("songlist").path(0).path("title").asText());
        assertEquals("王力宏", data.path("songlist").path(0).path("singer").path(0).path("name").asText());
    }
}
