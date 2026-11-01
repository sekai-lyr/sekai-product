package com.example.demo.core;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TtlCacheTest {

    @Test
    void putThenGetReturnsValue() {
        TtlCache<String, String> cache = new TtlCache<>(60_000, 16);
        cache.put("k", "v");
        assertEquals("v", cache.get("k"));
    }

    @Test
    void expiredEntryReturnsNullAndIsRemoved() throws InterruptedException {
        TtlCache<String, String> cache = new TtlCache<>(50, 16);
        cache.put("k", "v");
        assertEquals("v", cache.get("k"));
        Thread.sleep(120);
        assertNull(cache.get("k"));
        assertEquals(0, cache.size());
    }

    @Test
    void capacityEvictsOldestAndKeepsRecent() {
        TtlCache<Integer, Integer> cache = new TtlCache<>(60_000, 8);
        for (int i = 0; i < 100; i++) {
            cache.put(i, i);
            assertTrue(cache.size() <= 8, "cache size must stay within limit");
        }
        assertEquals(8, cache.size());
        assertEquals(99, cache.get(99), "most recent entry must be retained");
        assertNull(cache.get(0), "oldest entry must be evicted");
    }

    @Test
    void nullKeyAndValueAreIgnored() {
        TtlCache<String, String> cache = new TtlCache<>(60_000, 16);
        cache.put(null, "v");
        cache.put("k", null);
        assertEquals(0, cache.size());
        assertNull(cache.get(null));
    }
}
