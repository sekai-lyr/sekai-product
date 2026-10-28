package com.sekai.song.service.impl;

import com.sekai.song.model.MusicImportResult;
import com.sekai.song.service.MusicImportStrategy;
import com.sekai.song.service.QqImportService;
import org.springframework.stereotype.Service;

@Service
public class QqMusicImportStrategy implements MusicImportStrategy {
    private final QqImportService importer;

    public QqMusicImportStrategy(QqImportService importer) {
        this.importer = importer;
    }

    @Override
    public String source() {
        return "qq";
    }

    @Override
    public MusicImportResult importSongs(String link, Long playlistId, Long userId) {
        return importer.importSongs(link, playlistId, userId);
    }
}
