package com.ykd.claw.memory;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MemoryExtractionCoordinatorTest {

    @Test
    void schedulesOnlyMessagesWithDurableUserFacts() {
        assertTrue(MemoryExtractionCoordinator.hasDurableSignal("我喜欢自然风景，以后旅行都优先安排徒步。"));
        assertTrue(MemoryExtractionCoordinator.hasDurableSignal("I prefer quiet hotels."));
        assertFalse(MemoryExtractionCoordinator.hasDurableSignal("周日去杭州西湖玩一天。"));
        assertFalse(MemoryExtractionCoordinator.hasDurableSignal("查一下杭州天气。"));
    }
}
