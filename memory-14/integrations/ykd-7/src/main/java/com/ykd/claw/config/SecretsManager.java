package com.ykd.claw.config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 统一密钥管理器。
 *
 * 加载优先级（高 → 低）：
 *   1. 环境变量（适合 CI/CD）
 *   2. secrets.properties（本地开发，gitignored）
 *   3. 返回 null（调用方自行处理缺失）
 *
 * 新增密钥流程：
 *   1. 在 secrets.properties 添加一行
 *   2. 在 secrets.properties.example 添加对应的占位行
 *   3. 调用 SecretsManager.get("你的key") 即可
 */
public class SecretsManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(SecretsManager.class.getName());
    private static final String SECRETS_FILE = "secrets.properties";

    private static final SecretsManager INSTANCE = new SecretsManager();
    private final Properties secrets;

    private SecretsManager() {
        secrets = new Properties();
        loadFromFile();
    }

    public static SecretsManager getInstance() {
        return INSTANCE;
    }

    /**
     * 获取必填密钥值，未找到时记录警告日志。
     */
    public static String get(String key, String envVarName) {
        return INSTANCE.resolve(key, envVarName, true);
    }

    public static String get(String key) {
        return INSTANCE.resolve(key, null, true);
    }

    /**
     * 获取可选密钥值，未找到时静默返回 null（不记录警告）。
     * 适用于 ilink token、weather key 等可选配置。
     */
    public static String getOptional(String key, String envVarName) {
        return INSTANCE.resolve(key, envVarName, false);
    }

    public static String getOptional(String key) {
        return INSTANCE.resolve(key, null, false);
    }

    private String resolve(String key, String envVarName, boolean warn) {
        // 1. 环境变量优先
        if (envVarName != null) {
            String envValue = System.getenv(envVarName);
            if (envValue != null && !envValue.isBlank()) {
                LOGGER.info("从环境变量加载密钥: " + envVarName);
                return envValue;
            }
        }

        // 2. secrets.properties
        String fileValue = secrets.getProperty(key);
        if (fileValue != null && !fileValue.isBlank()) {
            LOGGER.info("从 secrets.properties 加载密钥: " + key);
            return fileValue;
        }

        // 3. 未找到
        if (warn) {
            LOGGER.warn("未找到密钥: " + key
                    + (envVarName != null ? " (环境变量: " + envVarName + ")" : "")
                    + "，请在 secrets.properties 中配置");
        }
        return null;
    }

    private void loadFromFile() {
        Path path = Paths.get(SECRETS_FILE);
        if (!Files.exists(path)) {
            LOGGER.warn("未找到" + SECRETS_FILE + "，密钥管理仅依赖环境变量。"
                    + "请复制 secrets.properties.example 为 secrets.properties 并填入真实密钥。");
            return;
        }

        try (InputStream is = Files.newInputStream(path)) {
            secrets.load(is);
            LOGGER.info("已加载 " + SECRETS_FILE + " (" + secrets.size() + " 项)");
        } catch (IOException e) {
            LOGGER.error( "加载 " + SECRETS_FILE + " 失败", e);
        }
    }
}