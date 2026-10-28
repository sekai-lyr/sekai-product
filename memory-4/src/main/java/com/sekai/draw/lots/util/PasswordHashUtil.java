package com.sekai.draw.lots.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

public final class PasswordHashUtil {
    private static final org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder ENCODER =
            new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(12);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String PREFIX = "sha256$";

    private PasswordHashUtil() {
    }

    public static String hash(String rawPassword) {
        return ENCODER.encode(rawPassword);
    }

    public static boolean matches(String rawPassword, String storedPassword) {
        if (rawPassword == null || storedPassword == null) {
            return false;
        }
        if (isCurrentHash(storedPassword)) {
            return ENCODER.matches(rawPassword, storedPassword);
        }
        if (!isHashed(storedPassword)) {
            return rawPassword.equals(storedPassword);
        }
        String[] parts = storedPassword.split("\\$");
        if (parts.length != 3) {
            return false;
        }
        try {
            byte[] salt = Base64.getDecoder().decode(parts[1]);
            byte[] expected = Base64.getDecoder().decode(parts[2]);
            return MessageDigest.isEqual(expected, digest(salt, rawPassword));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    public static boolean isHashed(String storedPassword) {
        return storedPassword != null && (storedPassword.startsWith(PREFIX) || isCurrentHash(storedPassword));
    }

    public static boolean isCurrentHash(String value) {
        return value != null && value.matches("^\\$2[aby]\\$.*");
    }

    public static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String tokenHash(String value) {
        return java.util.HexFormat.of().formatHex(digest(new byte[0], value));
    }

    public static boolean validNewPassword(String value) {
        return value != null && value.length() >= 8 && value.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    private static byte[] digest(byte[] salt, String rawPassword) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(salt);
            return digest.digest(rawPassword.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
