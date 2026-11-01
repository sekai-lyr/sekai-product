package com.ykd.claw.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.logging.Logger;

/**
 * iLink Hub 配置管理
 * 支持从配置文件加载多个 Bot Token
 */
public class ILinkHubConfig {

    private static final Logger LOGGER = Logger.getLogger(ILinkHubConfig.class.getName());
    private static final String CONFIG_FILE = "ilinkhub.properties";
    private static final String DEFAULT_BOT_PREFIX = "bot";

    // Bot 配置映射：botId -> BotConfig
    private final Map<String, BotConfig> botConfigs = new LinkedHashMap<>();

    /**
     * 内部类：Bot 配置
     */
    public static class BotConfig {
        private final String botId;
        private final String token;
        private final String description;
        private final int maxMessages;

        public BotConfig(String botId, String token, String description, int maxMessages) {
            this.botId = botId;
            this.token = token;
            this.description = description;
            this.maxMessages = maxMessages;
        }

        public String getBotId() { return botId; }
        public String getToken() { return token; }
        public String getDescription() { return description; }
        public int getMaxMessages() { return maxMessages; }
    }

    /**
     * 从配置文件加载配置
     */
    public void loadFromFile() {
        Path configPath = Paths.get(CONFIG_FILE);
        if (!Files.exists(configPath)) {
            LOGGER.info("配置文件 " + CONFIG_FILE + " 不存在，使用默认配置");
            return;
        }

        try {
            Properties props = new Properties();
            props.load(Files.newInputStream(configPath));

            // 解析 Bot 配置
            int botIndex = 1;
            while (true) {
                String botIdKey = "bot." + botIndex + ".id";
                String tokenKey = "bot." + botIndex + ".token";
                String descKey = "bot." + botIndex + ".description";
                String maxMsgKey = "bot." + botIndex + ".maxMessages";

                if (!props.containsKey(tokenKey)) {
                    break;
                }

                String botId = props.getProperty(botIdKey, DEFAULT_BOT_PREFIX + botIndex);
                String token = props.getProperty(tokenKey);
                String description = props.getProperty(descKey, "");
                int maxMessages = Integer.parseInt(props.getProperty(maxMsgKey, "200"));

                if (token != null && !token.isBlank()) {
                    botConfigs.put(botId, new BotConfig(botId, token, description, maxMessages));
                    LOGGER.info("加载 Bot 配置: " + botId);
                }

                botIndex++;
            }

            LOGGER.info("共加载 " + botConfigs.size() + " 个 Bot 配置");
        } catch (IOException e) {
            LOGGER.warning("读取配置文件失败: " + e.getMessage());
        } catch (NumberFormatException e) {
            LOGGER.warning("解析配置文件失败: " + e.getMessage());
        }
    }

    /**
     * 保存配置到文件
     */
    public void saveToFile() {
        Path configPath = Paths.get(CONFIG_FILE);
        Properties props = new Properties();

        int index = 1;
        for (BotConfig config : botConfigs.values()) {
            String prefix = "bot." + index;
            props.setProperty(prefix + ".id", config.getBotId());
            props.setProperty(prefix + ".token", config.getToken());
            props.setProperty(prefix + ".description", config.getDescription());
            props.setProperty(prefix + ".maxMessages", String.valueOf(config.getMaxMessages()));
            index++;
        }

        try {
            props.store(Files.newOutputStream(configPath), "iLink Hub 配置文件");
            LOGGER.info("配置已保存到 " + CONFIG_FILE);
        } catch (IOException e) {
            LOGGER.warning("保存配置文件失败: " + e.getMessage());
        }
    }

    /**
     * 添加一个 Bot 配置
     */
    public void addBotConfig(String botId, String token, String description, int maxMessages) {
        botConfigs.put(botId, new BotConfig(botId, token, description, maxMessages));
    }

    /**
     * 移除一个 Bot 配置
     */
    public void removeBotConfig(String botId) {
        botConfigs.remove(botId);
    }

    /**
     * 获取所有 Bot 配置
     */
    public Map<String, BotConfig> getBotConfigs() {
        return Collections.unmodifiableMap(botConfigs);
    }

    /**
     * 获取指定 Bot 的配置
     */
    public BotConfig getBotConfig(String botId) {
        return botConfigs.get(botId);
    }

    /**
     * 获取 Bot 数量
     */
    public int getBotCount() {
        return botConfigs.size();
    }

    /**
     * 生成示例配置文件
     */
    public static void generateSampleConfig() {
        Properties props = new Properties();

        props.setProperty("bot.1.id", "bot1");
        props.setProperty("bot.1.token", "your_token_here_1");
        props.setProperty("bot.1.description", "主 Bot");
        props.setProperty("bot.1.maxMessages", "200");

        props.setProperty("bot.2.id", "bot2");
        props.setProperty("bot.2.token", "your_token_here_2");
        props.setProperty("bot.2.description", "备用 Bot");
        props.setProperty("bot.2.maxMessages", "200");

        try {
            props.store(Files.newOutputStream(Paths.get(CONFIG_FILE + ".example")), 
                       "iLink Hub 配置文件示例");
            System.out.println("示例配置文件已生成: " + CONFIG_FILE + ".example");
        } catch (IOException e) {
            System.out.println("生成示例配置文件失败: " + e.getMessage());
        }
    }
}
