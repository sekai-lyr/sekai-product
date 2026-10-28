package com.sekai.song.service.impl;

import com.sekai.song.model.MusicImportResult;
import com.sekai.song.model.NeteaseImportResult;
import com.sekai.song.service.NeteaseImportService;
import com.sekai.song.service.QqImportService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MusicImportStrategyTest {
    @Test
    void adaptsNeteaseResultWithoutLosingCounts() {
        NeteaseImportService importer = mock(NeteaseImportService.class);
        NeteaseImportResult source = new NeteaseImportResult();
        source.setSuccess(true);
        source.setPlaylistId(42L);
        source.setImportedCount(11);
        source.setSkippedCount(2);
        when(importer.importSongs("link", 4L, 7L)).thenReturn(source);

        MusicImportResult result = new NeteaseMusicImportStrategy(importer).importSongs("link", 4L, 7L);
        assertEquals(42L, result.getPlaylistId());
        assertEquals(11, result.getImportedCount());
        assertEquals(2, result.getSkippedCount());
    }

    @Test
    void delegatesQqImportUnchanged() {
        QqImportService importer = mock(QqImportService.class);
        MusicImportResult source = new MusicImportResult();
        when(importer.importSongs("link", 4L, 7L)).thenReturn(source);
        assertSame(source, new QqMusicImportStrategy(importer).importSongs("link", 4L, 7L));
    }
}
