package com.ykd.claw.memory;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ConversationServiceTest {
    private final ConversationService service =
            new ConversationService(TestJpaRepositories.conversationRepository(), 4);

    @Test
    void isolatesUsersAndConversationsAndKeepsRecentHistory() {
        service.saveTurn("u1", "c1", "one", "reply-one");
        service.saveTurn("u1", "c1", "two", "reply-two");
        service.saveTurn("u1", "c1", "three", "reply-three");
        service.saveTurn("u1", "c2", "other", "other-reply");
        service.saveTurn("u2", "c1", "foreign", "foreign-reply");

        var history = service.getHistory("u1", "c1");
        assertEquals(4, history.size());
        assertEquals("two", history.getFirst().content());
        assertEquals("reply-three", history.getLast().content());
        assertEquals(2, service.count("u1", "c2"));
        assertEquals(2, service.count("u2", "c1"));
    }

    @Test
    void clearsOnlyRequestedConversation() {
        service.saveTurn("u1", "c1", "one", "reply");
        service.saveTurn("u1", "c2", "two", "reply");
        service.clear("u1", "c1");

        assertTrue(service.getHistory("u1", "c1").isEmpty());
        assertEquals(2, service.count("u1", "c2"));
    }
}
