package com.ykd.claw.channel.cli;

import com.ykd.claw.agent.DeepSeekRouter;
import com.ykd.claw.channel.wechat.ILinkBotService;
import com.ykd.claw.channel.wechat.ILinkHubService;
import com.ykd.claw.config.ILinkHubConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "app.cli.enabled", havingValue = "true", matchIfMissing = true)
public final class CliApplicationRunner implements CommandLineRunner {
    private final DeepSeekRouter router;
    private final ILinkBotService botService;
    private final ILinkHubService hubService;
    private final ILinkHubConfig hubConfig;
    private final String version;
    private final boolean aiAvailable;

    public CliApplicationRunner(DeepSeekRouter router, ILinkBotService botService,
                                @Value("${app.version:1.0.0}") String version,
                                @Value("${spring.ai.deepseek.api-key:}") String deepSeekApiKey) {
        this.router = router;
        this.botService = botService;
        this.version = version;
        this.aiAvailable = deepSeekApiKey != null && !deepSeekApiKey.isBlank();
        
        // 初始化 Hub 服务
        this.hubService = new ILinkHubService();
        this.hubConfig = new ILinkHubConfig();
        
        // 加载 Hub 配置
        hubConfig.loadFromFile();
        
        // 从配置文件加载 Bot 实例
        loadBotInstancesFromConfig();
        
        // 设置 Hub 消息处理器
        setupHubMessageHandlers();
    }

    /**
     * 从配置文件加载 Bot 实例
     */
    private void loadBotInstancesFromConfig() {
        for (ILinkHubConfig.BotConfig config : hubConfig.getBotConfigs().values()) {
            boolean success = hubService.addBot(config.getBotId(), config.getToken());
            if (success) {
                System.out.println("已加载 Bot: " + config.getBotId() + 
                                 (config.getDescription().isEmpty() ? "" : " (" + config.getDescription() + ")"));
            }
        }
    }

    /**
     * 设置 Hub 消息处理器
     */
    private void setupHubMessageHandlers() {
        // 文本消息处理器
        hubService.setCommandHandler((userId, text) -> {
            System.out.println("[Hub-文本] " + userId + ": " + text);
            try {
                return router.route(userId, "hub-" + userId, text);
            } catch (Exception e) {
                System.out.println("[Hub-错误] 处理消息失败: " + e.getMessage());
                return "抱歉，处理消息时出现错误，请稍后重试。";
            }
        });

        // 图片消息处理器
        hubService.setImageMessageHandler((userId, imagePath) -> {
            System.out.println("[Hub-图片] " + userId);
            try {
                return router.route(userId, "hub-" + userId, "[图片消息]");
            } catch (Exception e) {
                System.out.println("[Hub-错误] 处理图片失败: " + e.getMessage());
                return "抱歉，处理图片时出现错误，请稍后重试。";
            }
        });

        // 语音消息处理器
        hubService.setVoiceMessageHandler((userId, voicePath, encodeType, sampleRate) -> {
            System.out.println("[Hub-语音] " + userId);
            try {
                return router.route(userId, "hub-" + userId, "[语音消息]");
            } catch (Exception e) {
                System.out.println("[Hub-错误] 处理语音失败: " + e.getMessage());
                return "抱歉，处理语音时出现错误，请稍后重试。";
            }
        });

        // 文件消息处理器
        hubService.setFileMessageHandler((userId, filePath, fileName) -> {
            System.out.println("[Hub-文件] " + userId + ": " + fileName);
            try {
                return router.route(userId, "hub-" + userId, "[文件消息: " + fileName + "]");
            } catch (Exception e) {
                System.out.println("[Hub-错误] 处理文件失败: " + e.getMessage());
                return "抱歉，处理文件时出现错误，请稍后重试。";
            }
        });

        // 视频消息处理器
        hubService.setVideoMessageHandler((userId, videoPath) -> {
            System.out.println("[Hub-视频] " + userId);
            try {
                return router.route(userId, "hub-" + userId, "[视频消息]");
            } catch (Exception e) {
                System.out.println("[Hub-错误] 处理视频失败: " + e.getMessage());
                return "抱歉，处理视频时出现错误，请稍后重试。";
            }
        });
    }

    @Override
    public void run(String... args) {
        Map<String, Command> commands = commands();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            botService.stop();
            hubService.stopAll();
        }, "ilink-shutdown"));
        System.out.println("OpenClaw v" + version);
        System.out.println(aiAvailable ? "AI ready - Spring AI tools enabled" : "AI not configured (set DEEPSEEK_API_KEY)");
        
        // 显示 Hub 状态
        if (hubConfig.getBotCount() > 0) {
            System.out.println("iLink Hub: " + hubConfig.getBotCount() + " 个 Bot 配置已加载");
        }
        
        System.out.println("Type anything, or type 'help' for commands");
        new CliLoop(commands, router, botService, aiAvailable).start();
        botService.stop();
        hubService.stopAll();
    }

    private Map<String, Command> commands() {
        Map<String, Command> commands = new LinkedHashMap<>();
        commands.put("help", new HelpCommand(commands));
        commands.put("version", new VersionCommand(version));
        commands.put("status", new StatusCommand(Instant.now(), commands));
        commands.put("ai", aiCommand());
        commands.put("ilink", new ILinkCommand(botService));
        commands.put("ilinkhub", new ILinkHubCommand(hubService));
        commands.put("multi", new MultiUserLoginCommand(router));
        commands.put("exit", new Command() {
            @Override public void execute(String... arguments) {
                botService.stop();
                hubService.stopAll();
                System.out.println("Bye!");
                System.exit(0);
            }
            @Override public String getDescription() { return "Exit"; }
        });
        return commands;
    }

    private Command aiCommand() {
        return new Command() {
            @Override public void execute(String... arguments) {
                if (arguments == null || arguments.length == 0 || arguments[0].isBlank()) {
                    System.out.println("Usage: ai clear | ai status");
                    return;
                }
                switch (arguments[0].toLowerCase()) {
                    case "clear" -> { router.clearSession("default"); System.out.println("Session cleared."); }
                    case "status" -> System.out.println("Session messages: " + router.getSessionMessageCount("default"));
                    default -> System.out.println("Usage: ai clear | ai status");
                }
            }
            @Override public String getDescription() { return "AI session (clear / status)"; }
        };
    }
}
