package com.sekai.song.service;

import com.sekai.song.model.MusicImportResult;

public interface MusicImportStrategy {
    String source();

    MusicImportResult importSongs(String link, Long playlistId, Long userId);
}
