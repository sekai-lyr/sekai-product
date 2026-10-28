package com.sekai.song.service.impl;

import com.sekai.song.model.MusicImportResult;
import com.sekai.song.model.NeteaseImportResult;
import com.sekai.song.service.MusicImportStrategy;
import com.sekai.song.service.NeteaseImportService;
import org.springframework.stereotype.Service;

@Service
public class NeteaseMusicImportStrategy implements MusicImportStrategy {
    private final NeteaseImportService importer;

    public NeteaseMusicImportStrategy(NeteaseImportService importer) {
        this.importer = importer;
    }

    @Override
    public String source() {
        return "netease";
    }

    @Override
    public MusicImportResult importSongs(String link, Long playlistId, Long userId) {
        NeteaseImportResult sourceResult = importer.importSongs(link, playlistId, userId);
        MusicImportResult result = new MusicImportResult();
        result.setFailedInputs(sourceResult.getFailedInputs());
        result.setSuccess(sourceResult.isSuccess());
        result.setMessage(sourceResult.getMessage());
        result.setPlaylistId(sourceResult.getPlaylistId());
        result.setPlaylistName(sourceResult.getPlaylistName());
        result.setImportedCount(sourceResult.getImportedCount());
        result.setSkippedCount(sourceResult.getSkippedCount());
        return result;
    }
}
