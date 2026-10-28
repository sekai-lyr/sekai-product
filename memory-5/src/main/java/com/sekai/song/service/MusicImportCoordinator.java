package com.sekai.song.service;

import com.sekai.song.model.MusicImportResult;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MusicImportCoordinator {
    private final List<MusicImportStrategy> strategies;

    public MusicImportCoordinator(List<MusicImportStrategy> strategies) {
        this.strategies = strategies;
    }

    public MusicImportResult importSongs(String source, String link, Long playlistId, Long userId) {
        MusicImportStrategy strategy = strategies.stream()
                .filter(candidate -> candidate.source().equals(source))
                .findFirst().orElseThrow();
        return strategy.importSongs(link, playlistId, userId);
    }
}
