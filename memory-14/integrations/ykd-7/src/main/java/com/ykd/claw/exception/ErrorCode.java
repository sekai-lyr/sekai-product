package com.ykd.claw.exception;

public enum ErrorCode {

    // Generic
    UNKNOWN_ERROR(1000, "未知错误"),
    INVALID_PARAM(1001, "参数错误"),
    NETWORK_ERROR(1002, "网络请求异常"),
    TIMEOUT_ERROR(1003, "请求超时"),

    // ILink / WeChat
    ILINK_NOT_LOGGED_IN(3001, "未登录iLink"),
    ILINK_LOGIN_FAILED(3002, "iLink登录失败"),
    ILINK_SEND_FAILED(3003, "消息发送失败"),

    // Config
    CONFIG_MISSING(4001, "缺少必要配置"),

    // AI / DeepSeek
    AI_API_ERROR(5001, "AI API调用失败"),
    AI_API_KEY_MISSING(5002, "AI API密钥未配置");

    private final int code;
    private final String defaultMessage;

    ErrorCode(int code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }

    public int getCode() {
        return code;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }
}
