package com.example.demo.chat;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** VectorStoreService 的向量序列化与余弦相似度纯函数测试 */
class VectorStoreMathTest {

    @Test
    void serializeDeserializeRoundTrip() {
        float[] vector = {0.25f, -1.5f, 3.125f, 0f, 7f};
        byte[] bytes = VectorStoreService.serializeVector(vector);
        assertEquals(vector.length * 4, bytes.length);
        assertArrayEquals(vector, VectorStoreService.deserializeVector(bytes), 1e-6f);
    }

    @Test
    void deserializeInvalidInputReturnsEmpty() {
        assertEquals(0, VectorStoreService.deserializeVector(null).length);
        assertEquals(0, VectorStoreService.deserializeVector(new byte[0]).length);
        assertEquals(0, VectorStoreService.deserializeVector(new byte[]{1, 2, 3}).length); // 非 4 的倍数
    }

    @Test
    void cosineIdenticalVectorsIsOne() {
        float[] a = {1f, 2f, 3f};
        assertEquals(1.0, VectorStoreService.cosine(a, a.clone()), 1e-9);
    }

    @Test
    void cosineOrthogonalVectorsIsZero() {
        assertEquals(0.0, VectorStoreService.cosine(new float[]{1f, 0f}, new float[]{0f, 1f}), 1e-9);
    }

    @Test
    void cosineZeroVectorIsZero() {
        assertEquals(0.0, VectorStoreService.cosine(new float[]{0f, 0f}, new float[]{1f, 2f}), 1e-9);
    }

    @Test
    void cosineOppositeVectorsIsNegativeOne() {
        assertEquals(-1.0, VectorStoreService.cosine(new float[]{1f, 2f}, new float[]{-1f, -2f}), 1e-9);
    }
}
