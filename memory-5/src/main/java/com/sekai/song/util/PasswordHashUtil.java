package com.sekai.song.util;

import org.apache.commons.codec.digest.DigestUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public final class PasswordHashUtil {
    private static final String LEGACY_SALT = "sekai-song-player";
    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(10);

    private PasswordHashUtil() {
    }

    public static String hash(String rawPassword) {
        if (rawPassword == null) {
            return null;
        }
        return ENCODER.encode(rawPassword);
    }

    public static boolean matches(String rawPassword, String hashedPassword) {
        if (rawPassword == null || hashedPassword == null || hashedPassword.isEmpty()) {
            return false;
        }
        if (isBcrypt(hashedPassword)) {
            return ENCODER.matches(rawPassword, hashedPassword);
        }
        return legacyHash(rawPassword).equals(hashedPassword);
    }

    public static boolean needsUpgrade(String hashedPassword) {
        return hashedPassword != null && !hashedPassword.isEmpty() && !isBcrypt(hashedPassword);
    }

    static String legacyHash(String rawPassword) {
        return DigestUtils.sha256Hex(LEGACY_SALT + ":" + rawPassword);
    }

    private static boolean isBcrypt(String hashedPassword) {
        return hashedPassword.startsWith("$2a$")
                || hashedPassword.startsWith("$2b$")
                || hashedPassword.startsWith("$2y$");
    }
}
