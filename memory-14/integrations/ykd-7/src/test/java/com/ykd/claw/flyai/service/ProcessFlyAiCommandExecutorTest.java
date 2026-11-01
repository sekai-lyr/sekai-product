package com.ykd.claw.flyai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProcessFlyAiCommandExecutorTest {
    @Test
    void resolvesNpmCommandWrapperOnWindows() {
        String expected = System.getProperty("os.name", "").toLowerCase().contains("win")
                ? "flyai.cmd" : "flyai";

        assertEquals(expected, ProcessFlyAiCommandExecutor.platformExecutable("flyai"));
        assertEquals("C:\\tools\\flyai.cmd",
                ProcessFlyAiCommandExecutor.platformExecutable("C:\\tools\\flyai.cmd"));
    }

    @Test
    void onlyAcceptsSuccessfulFlyAiJsonAfterAnAbnormalCliExit() {
        ObjectMapper objectMapper = new ObjectMapper();

        assertTrue(ProcessFlyAiCommandExecutor.isSuccessfulJson(
                objectMapper, "{\"status\":0,\"data\":{\"itemList\":[]}}"));
        assertFalse(ProcessFlyAiCommandExecutor.isSuccessfulJson(
                objectMapper, "{\"status\":500,\"message\":\"failed\"}"));
        assertFalse(ProcessFlyAiCommandExecutor.isSuccessfulJson(objectMapper, "not-json"));
        assertEquals("failed", ProcessFlyAiCommandExecutor.businessError(
                objectMapper, "{\"status\":500,\"message\":\"failed\"}"));
        assertNull(ProcessFlyAiCommandExecutor.businessError(
                objectMapper, "{\"status\":0,\"data\":{}}"));
    }
}
