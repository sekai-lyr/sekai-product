package com.ykd.claw.channel.wechat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ILinkHubService 单元测试
 */
class ILinkHubServiceTest {

    private ILinkHubService hubService;

    @BeforeEach
    void setUp() {
        hubService = new ILinkHubService();
    }

    @Test
    void testAddBot() {
        boolean result = hubService.addBot("bot1", "token1");
        assertTrue(result);
        assertEquals(1, hubService.getBotCount());

        // 重复添加应该失败
        result = hubService.addBot("bot1", "token1");
        assertFalse(result);
        assertEquals(1, hubService.getBotCount());
    }

    @Test
    void testAddBotWithEmptyParams() {
        assertFalse(hubService.addBot(null, "token1"));
        assertFalse(hubService.addBot("bot1", null));
        assertFalse(hubService.addBot("", "token1"));
        assertFalse(hubService.addBot("bot1", ""));
        assertEquals(0, hubService.getBotCount());
    }

    @Test
    void testRemoveBot() {
        hubService.addBot("bot1", "token1");
        assertEquals(1, hubService.getBotCount());

        boolean result = hubService.removeBot("bot1");
        assertTrue(result);
        assertEquals(0, hubService.getBotCount());

        // 移除不存在的 Bot 应该失败
        result = hubService.removeBot("bot1");
        assertFalse(result);
    }

    @Test
    void testGetBotForUser() {
        hubService.addBot("bot1", "token1");
        hubService.addBot("bot2", "token2");

        String userId1 = "user1";
        String userId2 = "user2";

        ILinkBotService bot1 = hubService.getBotForUser(userId1);
        ILinkBotService bot2 = hubService.getBotForUser(userId2);

        assertNotNull(bot1);
        assertNotNull(bot2);

        // 同一个用户应该分配到同一个 Bot
        ILinkBotService bot1Again = hubService.getBotForUser(userId1);
        assertEquals(bot1, bot1Again);
    }

    @Test
    void testGetBotForUserWithNoBots() {
        ILinkBotService bot = hubService.getBotForUser("user1");
        assertNull(bot);
    }

    @Test
    void testGetBotStatus() {
        hubService.addBot("bot1", "token1");
        hubService.addBot("bot2", "token2");

        Map<String, String> status = hubService.getBotStatus();
        assertEquals(2, status.size());
        assertTrue(status.containsKey("bot1"));
        assertTrue(status.containsKey("bot2"));
    }

    @Test
    void testGetUserBotMapping() {
        hubService.addBot("bot1", "token1");
        hubService.addBot("bot2", "token2");

        hubService.getBotForUser("user1");
        hubService.getBotForUser("user2");

        Map<String, String> mapping = hubService.getUserBotMapping();
        assertEquals(2, mapping.size());
        assertTrue(mapping.containsKey("user1"));
        assertTrue(mapping.containsKey("user2"));
    }

    @Test
    void testIsRunning() {
        assertFalse(hubService.isRunning());
    }

    @Test
    void testGetOnlineBotCount() {
        hubService.addBot("bot1", "token1");
        hubService.addBot("bot2", "token2");

        assertEquals(0, hubService.getOnlineBotCount());
    }
}
