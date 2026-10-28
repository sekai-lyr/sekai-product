package com.sekai.song.service.impl;

final class SongImportText {
    private SongImportText() {}

    static String fit(String value, int maxCharacters) {
        if (value == null || value.codePointCount(0, value.length()) <= maxCharacters) return value;
        return value.substring(0, value.offsetByCodePoints(0, maxCharacters));
    }
}
