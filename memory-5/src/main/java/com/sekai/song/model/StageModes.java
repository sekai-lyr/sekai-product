package com.sekai.song.model;

import java.util.List;
import java.util.Locale;

public final class StageModes {
    private StageModes() {}
    public static final String PATTERN = "disc|lyrics|folia-classic|folia|folia-(sonnet|tempera|lumiere|luminous|cadenza|partita|fume|tilt|claddagh|monet|pendolo|cappella|diorama|still)|derived-(stars|fold|sea|dialogue|gather)";
    public static final List<String> ALL = List.of("disc", "lyrics", "folia-classic", "folia",
            "folia-sonnet", "folia-tempera", "folia-lumiere", "folia-luminous", "folia-cadenza",
            "folia-partita", "folia-fume", "folia-tilt", "folia-claddagh", "folia-monet",
            "folia-pendolo", "folia-cappella", "folia-diorama", "folia-still",
            "derived-stars", "derived-fold", "derived-sea", "derived-dialogue", "derived-gather");
    public static String normalize(String mode) {
        String value = mode == null ? "disc" : mode.toLowerCase(Locale.ROOT);
        return ALL.contains(value) ? value : "disc";
    }
}
