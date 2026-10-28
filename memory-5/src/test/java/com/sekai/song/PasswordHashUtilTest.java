package com.sekai.song;

import com.sekai.song.util.PasswordHashUtil;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordHashUtilTest {

    private static final String LEGACY_HASH_OF_123456 =
            "fc32e479ff7c6fb690468680fd3b371f620ed7b9b93f259755b1beb8654253a0";

    @Test
    void matchesHashedPassword() {
        assertTrue(PasswordHashUtil.matches("123456", PasswordHashUtil.hash("123456")));
    }

    @Test
    void hashesWithSaltedBcrypt() {
        String first = PasswordHashUtil.hash("123456");
        String second = PasswordHashUtil.hash("123456");
        assertTrue(first.startsWith("$2a$"), first);
        assertTrue(second.startsWith("$2a$"), second);
        assertFalse(first.equals(second), "每次哈希都应使用独立盐值");
        assertEquals(60, first.length());
    }

    @Test
    void rejectsWrongPassword() {
        assertFalse(PasswordHashUtil.matches("1234567", PasswordHashUtil.hash("123456")));
    }

    @Test
    void stillVerifiesLegacySha256HashesForMigration() {
        assertTrue(PasswordHashUtil.matches("123456", LEGACY_HASH_OF_123456));
        assertFalse(PasswordHashUtil.matches("654321", LEGACY_HASH_OF_123456));
    }

    @Test
    void flagsOnlyLegacyHashesForUpgrade() {
        assertTrue(PasswordHashUtil.needsUpgrade(LEGACY_HASH_OF_123456));
        assertFalse(PasswordHashUtil.needsUpgrade(PasswordHashUtil.hash("123456")));
        assertFalse(PasswordHashUtil.needsUpgrade(null));
        assertFalse(PasswordHashUtil.needsUpgrade(""));
    }

    @Test
    void parsesNeteaseUserLink() {
        assertEquals("user", com.sekai.song.util.NeteaseMusicLinkUtil
                .parse("https://y.music.163.com/m/user?id=1454476260").getType());
    }

    @Test
    void parsesNeteasePlaylistLink() {
        assertEquals("playlist", com.sekai.song.util.NeteaseMusicLinkUtil
                .parse("https://music.163.com/#/playlist?id=123456").getType());
    }

    @Test
    void parsesQqSongDetailLink() {
        assertEquals("song", com.sekai.song.util.QqMusicLinkUtil
                .parse("https://y.qq.com/n/ryqq/songDetail/001Qu4I30eVFYb").getType());
    }

    @Test
    void parsesQqSongIdLink() {
        assertEquals("102636799", com.sekai.song.util.QqMusicLinkUtil
                .parse("https://y.qq.com/n/ryqq/songDetail?songid=102636799").getId());
    }

}
