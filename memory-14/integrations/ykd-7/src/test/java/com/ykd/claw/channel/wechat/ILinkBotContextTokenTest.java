package com.ykd.claw.channel.wechat;

import com.openilink.ILinkClient;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ILinkBotContextTokenTest {
    @Test
    void persistsInboundTokenAndRestoresItIntoClientCache() {
        RecordingStore store = new RecordingStore();
        store.tokens.put("existing-user", "persisted-token");
        ILinkBotService service = new ILinkBotService("", 10, "target/context-test.buf", store);

        service.restoreContextTokens();
        ILinkClient client = (ILinkClient) ReflectionTestUtils.getField(service, "client");
        assertEquals("persisted-token", client.getContextToken("existing-user").orElseThrow());

        service.persistContextToken("new-user", "new-token");
        assertEquals("new-token", store.tokens.get("new-user"));
    }

    private static final class RecordingStore implements WechatContextTokenStore {
        private final Map<String, String> tokens = new LinkedHashMap<>();

        @Override
        public void save(String userId, String contextToken) {
            tokens.put(userId, contextToken);
        }

        @Override
        public Map<String, String> findAll() {
            return Map.copyOf(tokens);
        }
    }
}
