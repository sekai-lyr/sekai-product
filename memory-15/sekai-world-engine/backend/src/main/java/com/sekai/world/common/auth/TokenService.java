package com.sekai.world.common.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

@Component
public class TokenService {
    private final String secret;
    private final long ttlHours;

    public TokenService(
            @Value("${sekai.auth.token-secret}") String secret,
            @Value("${sekai.auth.token-ttl-hours:24}") long ttlHours) {
        this.secret = secret;
        this.ttlHours = ttlHours;
    }

    public String issue(CurrentUser user) {
        long expiresAt = Instant.now().plusSeconds(ttlHours * 3600).getEpochSecond();
        String payload = user.id() + ":" + expiresAt;
        String encodedPayload = encode(payload.getBytes(StandardCharsets.UTF_8));
        return encodedPayload + "." + encode(sign(encodedPayload));
    }

    public TokenClaims verify(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 2 || !java.security.MessageDigest.isEqual(
                    sign(parts[0]), Base64.getUrlDecoder().decode(parts[1]))) {
                return null;
            }
            String[] values = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8).split(":");
            long userId = Long.parseLong(values[0]);
            long expiresAt = Long.parseLong(values[1]);
            return expiresAt > Instant.now().getEpochSecond() ? new TokenClaims(userId) : null;
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private byte[] sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to sign token", exception);
        }
    }

    private String encode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    public record TokenClaims(Long userId) {
    }
}
