package com.ykd.claw.agent;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class GeneratedArtifactsTest {
    @Test
    void isolatesGeneratedFilesByConversation() {
        GeneratedArtifacts artifacts = new GeneratedArtifacts();
        artifacts.beginScope("wx_user_1");
        artifacts.document("one.pdf");
        artifacts.endScope();
        artifacts.beginScope("wx_user_2");
        artifacts.document("two.pdf");
        artifacts.endScope();

        assertEquals("one.pdf", artifacts.consumeDocument("wx_user_1"));
        assertEquals("two.pdf", artifacts.consumeDocument("wx_user_2"));
        assertNull(artifacts.consumeDocument("wx_user_1"));
    }

    @Test
    void clearsAnUnconsumedArtifactWhenANewTurnStartsInTheSameConversation() {
        GeneratedArtifacts artifacts = new GeneratedArtifacts();
        artifacts.beginScope("wx_user_1");
        artifacts.document("old-trip.pdf");
        artifacts.endScope();

        artifacts.beginScope("wx_user_1");
        artifacts.endScope();

        assertNull(artifacts.consumeDocument("wx_user_1"));
    }
}
