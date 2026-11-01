package com.ykd.claw.exception;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;

class GlobalExceptionHandlerTest {

    @Test
    void testHandleConnectException() {
        String result = GlobalExceptionHandler.handleException(
                new ConnectException("Connection refused"));
        assertTrue(result.contains("网络连接失败"));
    }

    @Test
    void testHandleSocketTimeoutException() {
        String result = GlobalExceptionHandler.handleException(
                new SocketTimeoutException("Read timed out"));
        assertTrue(result.contains("请求超时"));
    }

    @Test
    void testHandleUnknownHostException() {
        String result = GlobalExceptionHandler.handleException(
                new UnknownHostException("unknown-host"));
        assertTrue(result.contains("无法解析服务器地址"));
    }

    @Test
    void testHandleIOException() {
        String result = GlobalExceptionHandler.handleException(
                new IOException("Broken pipe"));
        assertTrue(result.contains("网络请求异常"));
    }

    @Test
    void testHandleIllegalArgumentException() {
        String result = GlobalExceptionHandler.handleException(
                new IllegalArgumentException("参数不能为空"));
        assertTrue(result.contains("参数错误"));
    }

    @Test
    void testHandleNullThrowable() {
        String result = GlobalExceptionHandler.handleException(null);
        assertNotNull(result);
        assertFalse(result.isEmpty());
    }

    @Test
    void testHandleRuntimeExceptionWithMessage() {
        String result = GlobalExceptionHandler.handleException(
                new RuntimeException("数据库连接池耗尽"));
        assertTrue(result.contains("操作失败"));
        assertTrue(result.contains("数据库连接池耗尽"));
    }

    @Test
    void testHandleRuntimeExceptionWithoutMessage() {
        String result = GlobalExceptionHandler.handleException(
                new RuntimeException());
        assertTrue(result.contains("操作失败"));
    }

    @Test
    void testHandleBusinessException() {
        String result = GlobalExceptionHandler.handleException(
                new BusinessException(ErrorCode.AI_API_ERROR, "API超时"));
        assertTrue(result.contains("5001"));
        assertTrue(result.contains("API超时"));
    }
}
