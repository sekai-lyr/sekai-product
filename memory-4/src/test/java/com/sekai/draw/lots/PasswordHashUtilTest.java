package com.sekai.draw.lots;

import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.util.PasswordHashUtil;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PasswordHashUtilTest {
    @Test void bcryptPreservesWhitespaceAndRejectsWrongPassword() {
        String hash = PasswordHashUtil.hash("  a-valid-password  ");
        assertTrue(PasswordHashUtil.isCurrentHash(hash));
        assertTrue(PasswordHashUtil.matches("  a-valid-password  ", hash));
        assertFalse(PasswordHashUtil.matches("a-valid-password", hash));
    }
    @Test void migratesLegacyHashesWithoutAcceptingMalformedHashes() throws Exception {
        byte[] salt = "legacy-salt".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var digest = java.security.MessageDigest.getInstance("SHA-256"); digest.update(salt);
        String hash = "sha256$" + java.util.Base64.getEncoder().encodeToString(salt) + "$" + java.util.Base64.getEncoder().encodeToString(digest.digest("legacy123".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assertTrue(PasswordHashUtil.matches("legacy123", hash));
        assertFalse(PasswordHashUtil.isCurrentHash(hash));
        assertFalse(PasswordHashUtil.matches("legacy123", "sha256$%%%$%%%"));
        assertTrue(PasswordHashUtil.matches("old-cleartext", "old-cleartext"));
    }
    @Test void enforcesBcryptByteLimitAndNeverSerializesPassword() throws Exception {
        assertFalse(PasswordHashUtil.validNewPassword("short"));
        assertFalse(PasswordHashUtil.validNewPassword("密".repeat(25)));
        assertTrue(PasswordHashUtil.validNewPassword("密".repeat(24)));
        User user = new User(); user.setUserName("test"); user.setPassword("must-not-leak");
        String json = new tools.jackson.databind.json.JsonMapper().writeValueAsString(user);
        assertFalse(json.contains("password")); assertFalse(json.contains("must-not-leak"));
    }
}
