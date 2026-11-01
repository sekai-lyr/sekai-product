package com.example.demo.utils;

import lombok.extern.slf4j.Slf4j;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * 安全的 java.net.http.HttpClient 工厂。
 *
 * 背景：Windows 下 HttpClient 构造时需要在 127.0.0.1 上建立 NIO 回环管道（PipeImpl）。
 * 当防火墙/杀毒软件/VPN 劫持或 Winsock 目录损坏时，会抛出
 * "IOException: Unable to establish loopback connection"，
 * 导致持有 HttpClient 的 Bean 初始化失败、整个 Spring 应用无法启动。
 *
 * 策略：
 * 1. 先用默认配置创建；
 * 2. 失败则尝试切换 IPv4 栈（-Djava.net.preferIPv4Stack=true）后重建；
 * 3. 仍失败则返回 null，由调用方降级（相关联网功能不可用，但应用可正常启动）。
 *
 * 注意：返回值可能为 null，调用方必须做判空防护（调用处一般已有 try-catch 降级逻辑）。
 */
@Slf4j
public final class SafeHttpClientFactory {

    private SafeHttpClientFactory() {
    }

    public static HttpClient create() {
        return create(Duration.ofSeconds(10));
    }

    public static HttpClient create(Duration connectTimeout) {
        try {
            return build(connectTimeout);
        } catch (Throwable first) {
            log.warn("HttpClient 创建失败（默认配置）：{}", first.toString());
            try {
                System.setProperty("java.net.preferIPv4Stack", "true");
                HttpClient client = build(connectTimeout);
                log.info("HttpClient 切换 IPv4 栈后创建成功");
                return client;
            } catch (Throwable second) {
                log.error("HttpClient 创建彻底失败，相关联网功能将降级不可用（应用继续启动）。"
                        + "请检查防火墙/杀毒软件/VPN，或以管理员身份执行 netsh winsock reset 后重启电脑。原因：{}",
                        second.toString());
                return null;
            }
        }
    }

    private static HttpClient build(Duration connectTimeout) {
        HttpClient.Builder builder = HttpClient.newBuilder();
        if (connectTimeout != null) {
            builder.connectTimeout(connectTimeout);
        }
        return builder.build();
    }
}
