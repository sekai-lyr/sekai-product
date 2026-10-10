package com.sekai.song.service;

public interface CloudLyricService {
    String fetchNeteaseLyric(String songId);

    String fetchQqLyric(String songMid, Long songId);

    default String fetchBestLyric(String title, String artist) {
        return fetchBestLyric(title, artist, null, null);
    }

    String fetchBestLyric(String title, String artist, String album, Integer durationSeconds);
}
