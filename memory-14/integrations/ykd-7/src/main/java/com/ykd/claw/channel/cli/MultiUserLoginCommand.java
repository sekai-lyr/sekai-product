package com.ykd.claw.channel.cli;

import com.openilink.auth.LoginCallbacks;
import com.openilink.model.response.LoginResult;
import com.ykd.claw.agent.DeepSeekRouter;
import com.ykd.claw.channel.wechat.ILinkBotService;
import com.ykd.claw.exception.GlobalExceptionHandler;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * 多用户登录管理命令
 * 支持多个用户扫码登录，每个用户创建独立的 Bot 实例，实现多用户同时对话
 */
public class MultiUserLoginCommand implements Command {

    private static final Logger LOGGER = Logger.getLogger(MultiUserLoginCommand.class.getName());

    // 用户ID -> Bot实例映射
    private final ConcurrentHashMap<String, UserBotInfo> userBotMap = new ConcurrentHashMap<>();
    
    // DeepSeek路由器（所有 Bot 共享）
    private final DeepSeekRouter router;

    /**
     * 用户 Bot 信息
     */
    public static class UserBotInfo {
        private final String userId;
        private final String botId;
        private final String botToken;
        private final ILinkBotService botService;
        private final long loginTime;
        private volatile boolean active;

        public UserBotInfo(String userId, String botId, String botToken, ILinkBotService botService) {
            this.userId = userId;
            this.botId = botId;
            this.botToken = botToken;
            this.botService = botService;
            this.loginTime = System.currentTimeMillis();
            this.active = true;
        }

        public String getUserId() { return userId; }
        public String getBotId() { return botId; }
        public String getBotToken() { return botToken; }
        public ILinkBotService getBotService() { return botService; }
        public long getLoginTime() { return loginTime; }
        public boolean isActive() { return active; }
        public void setActive(boolean active) { this.active = active; }
    }

    public MultiUserLoginCommand(DeepSeekRouter router) {
        this.router = router;
    }

    @Override
    public void execute(String... args) {
        if (args == null || args.length == 0 || args[0].isBlank()) {
            printUsage();
            return;
        }

        String subCmd = args[0].toLowerCase();
        switch (subCmd) {
            case "login"    -> doLogin();
            case "list"     -> doList();
            case "status"   -> doStatus();
            case "logout"   -> doLogout(args);
            case "help"     -> printUsage();
            default -> {
                System.out.println("未知子命令: " + subCmd);
                printUsage();
            }
        }
    }

    /**
     * 扫码登录 - 创建新的 Bot 实例
     */
    private void doLogin() {
        try {
            System.out.println("========================================");
            System.out.println("多用户扫码登录");
            System.out.println("========================================");
            System.out.println("请将以下链接复制到浏览器中扫码：");
            System.out.println();

            // 创建独立的 Bot 实例
            ILinkBotService botService = new ILinkBotService("", 200);
            
            LoginResult result = botService.login(new LoginCallbacks() {
                @Override
                public void onQRCode(String qrCodeUrl) {
                    System.out.println("二维码链接（复制到浏览器打开并扫码）：");
                    System.out.println("----------------------------------------");
                    System.out.println(qrCodeUrl);
                    System.out.println("----------------------------------------");
                }

                @Override
                public void onScanned() {
                    System.out.println("已扫码，请在微信中确认登录...");
                }

                @Override
                public void onExpired(int attempt, int maxAttempts) {
                    System.out.println("二维码已过期，正在刷新 (" + attempt + "/" + maxAttempts + ")...");
                }
            });

            if (result.isConnected()) {
                String userId = result.getUserId();
                String botId = result.getBotId();
                String botToken = result.getBotToken();

                // 设置消息处理器
                setupMessageHandlers(botId, botService);

                // 确保监听已启动
                if (!botService.isRunning()) {
                    System.out.println("[调试] 启动 Bot " + botId + " 的监听...");
                    botService.startMonitor();
                }

                // 保存用户 Bot 信息
                UserBotInfo botInfo = new UserBotInfo(userId, botId, botToken, botService);
                userBotMap.put(userId, botInfo);

                System.out.println();
                System.out.println("========================================");
                System.out.println("登录成功！");
                System.out.println("========================================");
                System.out.println("用户ID: " + userId);
                System.out.println("BotID:  " + botId);
                System.out.println("监听状态: " + (botService.isRunning() ? "运行中" : "未启动"));
                System.out.println();
                System.out.println("你的 Bot 已创建并开始监听消息！");
                System.out.println("其他用户可以给你的 Bot 发消息，Bot 会自动回复。");
                System.out.println();
                System.out.println("命令：");
                System.out.println("  multi list     - 查看所有已登录的用户");
                System.out.println("  multi status   - 查看当前状态");
                System.out.println("  multi logout <用户ID> - 登出指定用户");
                System.out.println("========================================");
            } else {
                System.out.println("登录失败: " + result.getMessage());
            }
        } catch (Exception e) {
            System.out.println(GlobalExceptionHandler.handleException(e));
            LOGGER.severe("登录失败: " + e.getMessage());
        }
    }

    /**
     * 设置消息处理器
     */
    private void setupMessageHandlers(String botId, ILinkBotService botService) {
        // 文本消息处理器
        botService.setCommandHandler((userId, text) -> {
            System.out.println("[Bot-" + botId + "] 收到消息 from " + userId + ": " + text);
            try {
                String reply = router.route(userId, botId + "-" + userId, text);
                System.out.println("[Bot-" + botId + "] 回复 " + userId + ": " + reply);
                return reply;
            } catch (Exception e) {
                System.out.println("[Bot-" + botId + "] 处理消息失败: " + e.getMessage());
                return "抱歉，处理消息时出现错误，请稍后重试。";
            }
        });

        // 图片消息处理器
        botService.setImageMessageHandler((userId, imagePath) -> {
            System.out.println("[Bot-" + botId + "] 收到图片 from " + userId);
            try {
                return router.route(userId, botId + "-" + userId, "[图片消息]");
            } catch (Exception e) {
                System.out.println("[Bot-" + botId + "] 处理图片失败: " + e.getMessage());
                return "抱歉，处理图片时出现错误，请稍后重试。";
            }
        });

        // 语音消息处理器
        botService.setVoiceMessageHandler((userId, voicePath, encodeType, sampleRate) -> {
            System.out.println("[Bot-" + botId + "] 收到语音 from " + userId);
            try {
                return router.route(userId, botId + "-" + userId, "[语音消息]");
            } catch (Exception e) {
                System.out.println("[Bot-" + botId + "] 处理语音失败: " + e.getMessage());
                return "抱歉，处理语音时出现错误，请稍后重试。";
            }
        });

        // 文件消息处理器
        botService.setFileMessageHandler((userId, filePath, fileName) -> {
            System.out.println("[Bot-" + botId + "] 收到文件 from " + userId + ": " + fileName);
            try {
                return router.route(userId, botId + "-" + userId, "[文件消息: " + fileName + "]");
            } catch (Exception e) {
                System.out.println("[Bot-" + botId + "] 处理文件失败: " + e.getMessage());
                return "抱歉，处理文件时出现错误，请稍后重试。";
            }
        });

        // 视频消息处理器
        botService.setVideoMessageHandler((userId, videoPath) -> {
            System.out.println("[Bot-" + botId + "] 收到视频 from " + userId);
            try {
                return router.route(userId, botId + "-" + userId, "[视频消息]");
            } catch (Exception e) {
                System.out.println("[Bot-" + botId + "] 处理视频失败: " + e.getMessage());
                return "抱歉，处理视频时出现错误，请稍后重试。";
            }
        });
    }

    /**
     * 列出所有已登录的用户
     */
    private void doList() {
        if (userBotMap.isEmpty()) {
            System.out.println("暂无已登录的用户");
            System.out.println("使用 'multi login' 命令扫码登录");
            return;
        }

        System.out.println("=== 已登录的用户 ===");
        System.out.println("----------------------------------------");
        for (UserBotInfo info : userBotMap.values()) {
            System.out.println("用户ID: " + info.getUserId());
            System.out.println("  BotID: " + info.getBotId());
            System.out.println("  状态: " + (info.isActive() ? "在线" : "离线"));
            System.out.println("  登录时间: " + new Date(info.getLoginTime()));
            System.out.println("----------------------------------------");
        }
        System.out.println("共 " + userBotMap.size() + " 个用户");
    }

    /**
     * 查看当前状态
     */
    private void doStatus() {
        if (userBotMap.isEmpty()) {
            System.out.println("当前没有已登录的用户");
            System.out.println("使用 'multi login' 命令扫码登录");
            return;
        }

        System.out.println("=== 当前状态 ===");
        System.out.println("已登录用户数: " + userBotMap.size());
        System.out.println();
        
        for (UserBotInfo info : userBotMap.values()) {
            System.out.println("用户: " + info.getUserId());
            System.out.println("  BotID: " + info.getBotId());
            System.out.println("  状态: " + (info.isActive() ? "在线" : "离线"));
            System.out.println("  Bot 运行状态: " + info.getBotService().getState());
            System.out.println("  监听状态: " + (info.getBotService().isRunning() ? "运行中" : "未启动"));
            System.out.println();
        }
    }

    /**
     * 登出指定用户
     */
    private void doLogout(String[] args) {
        if (args.length < 2) {
            System.out.println("用法: multi logout <用户ID>");
            return;
        }

        String userId = args[1];
        UserBotInfo info = userBotMap.remove(userId);
        if (info == null) {
            System.out.println("用户 " + userId + " 不存在");
            return;
        }

        // 停止 Bot
        info.getBotService().stop();
        info.getBotService().logout();
        info.setActive(false);

        System.out.println("用户 " + userId + " 已登出");
    }

    /**
     * 打印使用说明
     */
    private void printUsage() {
        System.out.println("多用户登录管理 - 支持多个用户同时与 Bot 对话");
        System.out.println();
        System.out.println("用法: multi <子命令> [参数]");
        System.out.println();
        System.out.println("子命令:");
        System.out.println("  login               - 扫码登录创建新 Bot");
        System.out.println("  list                - 列出所有已登录的用户");
        System.out.println("  status              - 查看当前状态");
        System.out.println("  logout <用户ID>     - 登出指定用户");
        System.out.println("  help                - 显示此帮助信息");
        System.out.println();
        System.out.println("使用流程:");
        System.out.println("  1. multi login        - 你扫码登录创建你的 Bot");
        System.out.println("  2. multi login        - 让朋友也扫码登录创建他的 Bot");
        System.out.println("  3. 每个人给自己的 Bot 发消息，Bot 会自动回复");
        System.out.println();
        System.out.println("特点:");
        System.out.println("  - 每个用户有独立的 Bot 实例");
        System.out.println("  - 多个用户可以同时与自己的 Bot 对话");
        System.out.println("  - 互不干扰，独立运行");
    }

    @Override
    public String getDescription() {
        return "多用户登录管理";
    }
}
