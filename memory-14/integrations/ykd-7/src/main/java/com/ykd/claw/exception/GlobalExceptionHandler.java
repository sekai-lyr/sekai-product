package com.ykd.claw.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 全局异常处理模块，负责统一捕获和展示友好的错误提示。
 */
public class GlobalExceptionHandler implements Thread.UncaughtExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class.getName());
    private static final GlobalExceptionHandler INSTANCE = new GlobalExceptionHandler();

    private GlobalExceptionHandler() {
    }

    public static GlobalExceptionHandler getInstance() {
        return INSTANCE;
    }

    /**
     * 注册全局异常处理器，确保所有未捕获异常都能被妥善处理。
     */
    public static void register() {
        Thread.setDefaultUncaughtExceptionHandler(INSTANCE);
        LOGGER.info("全局异常处理器已注册");
    }

    /**
     * 优雅处理异常，输出友好的错误提示并记录日志。
     */
    @Override
    public void uncaughtException(Thread thread, Throwable throwable) {
        String threadName = thread != null ? thread.getName() : "unknown";
        String userMessage = buildUserMessage(throwable);
        System.err.println(userMessage);
        LOGGER.error( "未捕获异常 [线程: " + threadName + "]", throwable);
    }

    /**
     * 通用异常处理方法，供业务代码主动调用。
     * 返回用户友好的错误提示，同时记录完整日志。
     */
    public static String handleException(Throwable throwable) {
        if (throwable == null) {
            return "发生未知错误";
        }
        LOGGER.error( "业务异常", throwable);
        return buildUserMessage(throwable);
    }

    /**
     * 根据异常类型构建友好的用户提示消息。
     */
    private static String buildUserMessage(Throwable throwable) {
        if (throwable == null) {
            return "发生未知错误，请联系管理员";
        }

        // 业务异常：直接使用其消息
        if (throwable instanceof BusinessException be) {
            return "[" + be.getErrorCode().getCode() + "] " + be.getMessage();
        }

        String message = throwable.getMessage();

        // 网络相关异常
        if (throwable instanceof java.net.ConnectException) {
            return "网络连接失败，请检查网络设置后重试";
        }
        if (throwable instanceof java.net.SocketTimeoutException) {
            return "请求超时，请稍后重试";
        }
        if (throwable instanceof java.net.UnknownHostException) {
            return "无法解析服务器地址，请检查网络连接";
        }
        if (throwable instanceof java.io.IOException) {
            return message != null && !message.isBlank()
                    ? "网络请求异常: " + message
                    : "网络请求异常，请稍后重试";
        }

        // 参数相关异常
        if (throwable instanceof IllegalArgumentException) {
            return message != null && !message.isBlank()
                    ? "参数错误: " + message
                    : "输入参数有误，请检查后重试";
        }

        // 运行时异常
        if (message != null && !message.isBlank()) {
            return "操作失败: " + message;
        }

        return "操作失败，请稍后重试或联系管理员";
    }
}
