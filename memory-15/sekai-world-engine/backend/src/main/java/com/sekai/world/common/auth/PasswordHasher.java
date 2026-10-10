package com.sekai.world.common.auth;

import org.springframework.stereotype.Component;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class PasswordHasher {
    private static final int ITERATIONS = 120_000;
    private static final int KEY_LENGTH = 256;
    private final SecureRandom secureRandom = new SecureRandom();

    public String hash(String password) {
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must contain at least 8 characters");
        }
        byte[] salt = new byte[16];
        secureRandom.nextBytes(salt);
        byte[] digest = derive(password, salt, ITERATIONS);
        return "pbkdf2$" + ITERATIONS + "$" + encode(salt) + "$" + encode(digest);
    }

    public boolean matches(String password, String encoded) {
        try {
            String[] parts = encoded.split("\\$");
            if (parts.length != 4 || !"pbkdf2".equals(parts[0])) {
                return false;
            }
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getUrlDecoder().decode(parts[2]);
            byte[] expected = Base64.getUrlDecoder().decode(parts[3]);
            byte[] actual = derive(password, salt, iterations);
            return java.security.MessageDigest.isEqual(expected, actual);
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private byte[] derive(String password, byte[] salt, int iterations) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, KEY_LENGTH);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash password", exception);
        }
    }

    private String encode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }
}
