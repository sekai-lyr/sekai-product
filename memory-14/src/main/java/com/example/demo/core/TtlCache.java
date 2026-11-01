package com.example.demo.core;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 简易 TTL 缓存：基于 ConcurrentHashMap，不引入第三方依赖。
 * 读取时惰性剔除过期条目；写入超过容量上限时先清过期，仍超限则淘汰最早过期的条目。
 * 仅用于外部 API 结果（天气/地理编码/以图搜番）等可容忍短暂陈旧的场景。
 */
public class TtlCache<K, V> {

    private record Slot<V>(V value, long expiresAt) {}

    private final ConcurrentHashMap<K, Slot<V>> map = new ConcurrentHashMap<>();
    private final long ttlMillis;
    private final int maxSize;

    public TtlCache(long ttlMillis, int maxSize) {
        this.ttlMillis = ttlMillis;
        this.maxSize = Math.max(1, maxSize);
    }

    /** 取值，过期返回 null 并顺手剔除 */
    public V get(K key) {
        if (key == null) return null;
        long now = System.currentTimeMillis();
        Slot<V> slot = map.get(key);
        if (slot == null) return null;
        if (slot.expiresAt() <= now) {
            map.remove(key, slot);
            return null;
        }
        return slot.value();
    }

    /** 写值；超过容量时先清过期条目，仍超限则逐个淘汰最早过期的条目 */
    public void put(K key, V value) {
        if (key == null || value == null) return;
        long now = System.currentTimeMillis();
        if (map.size() >= maxSize) {
            map.entrySet().removeIf(e -> e.getValue().expiresAt() <= now);
            while (map.size() >= maxSize) {
                K oldest = null;
                long min = Long.MAX_VALUE;
                for (Map.Entry<K, Slot<V>> e : map.entrySet()) {
                    if (e.getValue().expiresAt() < min) { min = e.getValue().expiresAt(); oldest = e.getKey(); }
                }
                if (oldest == null) { map.clear(); break; }
                map.remove(oldest);
            }
        }
        map.put(key, new Slot<>(value, now + ttlMillis));
    }

    /** 当前有效条目数（顺带清理过期） */
    public int size() {
        long now = System.currentTimeMillis();
        map.entrySet().removeIf(e -> e.getValue().expiresAt() <= now);
        return map.size();
    }
}
