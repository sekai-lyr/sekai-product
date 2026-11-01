package com.ykd.claw.channel.cli;

import com.openilink.auth.LoginCallbacks;
import com.openilink.model.response.LoginResult;
import com.ykd.claw.channel.wechat.ILinkHubService;
import com.ykd.claw.exception.GlobalExceptionHandler;

import java.util.Map;
import java.util.logging.Logger;

/**
 * iLink Hub 管理命令
 * 支持多 Bot 实例管理，实现多用户并发访问
 */
public class ILinkHubCommand implements Command {

    private static final Logger LOGGER = Logger.getLogger(ILinkHubCommand.class.getName());

    private final ILinkHubService hubService;

    public ILinkHubCommand(ILinkHubService hubService) {
        this.hubService = hubService;
    }

    @Override
    public void execute(String... args) {
        if (args == null || args.length == 0 || args[0].isBlank()) {
            printUsage();
            return;
        }

        String subCmd = args[0].toLowerCase();
        switch (subCmd) {
            case "add"      -> doAdd(args);
            case "remove"   -> doRemove(args);
            case "login"    -> doLogin(args);
            case "start"    -> doStart();
            case "stop"     -> doStop();
            case "status"   -> doStatus();
            case "users"    -> doUsers();
            case "send"     -> doSend(args);
            case "help"     -> printUsage();
            default -> {
                System.out.println("未知子命令: " + subCmd);
                printUsage();
            }
        }
    }

    private void doAdd(String[] args) {
        if (args.length < 3) {
            System.out.println("用法: ilinkhub add <botId> <token>");
            System.out.println("示例: ilinkhub add bot1 your_token_here");
            return;
        }

        String botId = args[1];
        String token = args[2];

        try {
            boolean success = hubService.addBot(botId, token);
            if (success) {
                System.out.println("Bot " + botId + " 添加成功");
            } else {
                System.out.println("Bot " + botId + " 添加失败（可能已存在）");
            }
        } catch (Exception e) {
            System.out.println(GlobalExceptionHandler.handleException(e));
            LOGGER.severe("添加 Bot 失败: " + e.getMessage());
        }
    }

    private void doRemove(String[] args) {
        if (args.length < 2) {
            System.out.println("用法: ilinkhub remove <botId>");
            return;
        }

        String botId = args[1];
        try {
            boolean success = hubService.removeBot(botId);
            if (success) {
                System.out.println("Bot " + botId + " 已移除");
            } else {
                System.out.println("Bot " + botId + " 不存在");
            }
        } catch (Exception e) {
            System.out.println(GlobalExceptionHandler.handleException(e));
            LOGGER.severe("移除 Bot 失败: " + e.getMessage());
        }
    }

    private void doLogin(String[] args) {
        if (args.length < 2) {
            System.out.println("用法: ilinkhub login <botId>");
            return;
        }

        String botId = args[1];
        try {
            System.out.println("正在登录 Bot " + botId + "...");
            System.out.println("请将以下链接复制到浏览器中扫码：");
            System.out.println();

            LoginResult result = hubService.loginBot(botId, new LoginCallbacks() {
                @Override
                public void onQRCode(String qrCodeUrl) {
                    System.out.println("========================================");
                    System.out.println("二维码链接（复制到浏览器打开并扫码）：");
                    System.out.println(qrCodeUrl);
                    System.out.println("========================================");
                }

                @Override
                public void onScanned() {
                    System.out.println("已扫码，请在微信 ClawBot 中确认登录...");
                }

                @Override
                public void onExpired(int attempt, int maxAttempts) {
                    System.out.println("二维码已过期，正在刷新 (" + attempt + "/" + maxAttempts + ")...");
                }
            });

            if (result.isConnected()) {
                System.out.println();
                System.out.println("Bot " + botId + " 登录成功！");
                System.out.println("  BotID:  " + result.getBotId());
                System.out.println("  UserID: " + result.getUserId());
            } else {
                System.out.println("登录失败: " + result.getMessage());
            }
        } catch (Exception e) {
            System.out.println(GlobalExceptionHandler.handleException(e));
            LOGGER.severe("登录 Bot " + botId + " 失败: " + e.getMessage());
        }
    }

    private void doStart() {
        try {
            hubService.startAll();
            System.out.println("Hub 已启动，共 " + hubService.getBotCount() + " 个 Bot 实例");
        } catch (Exception e) {
            System.out.println(GlobalExceptionHandler.handleException(e));
            LOGGER.severe("启动 Hub 失败: " + e.getMessage());
        }
    }

    private void doStop() {
        try {
            hubService.stopAll();
            System.out.println("Hub 已停止");
        } catch (Exception e) {
            System.out.println(GlobalExceptionHandler.handleException(e));
            LOGGER.severe("停止 Hub 失败: " + e.getMessage());
        }
    }

    private void doStatus() {
        System.out.println("=== iLink Hub 状态 ===");
        System.out.println("运行状态: " + (hubService.isRunning() ? "运行中" : "已停止"));
        System.out.println("Bot 实例数: " + hubService.getBotCount());
        System.out.println("在线 Bot 数: " + hubService.getOnlineBotCount());
        System.out.println();

        Map<String, String> botStatus = hubService.getBotStatus();
        if (botStatus.isEmpty()) {
            System.out.println("暂无 Bot 实例");
        } else {
            System.out.println("Bot 实例详情:");
            System.out.println("----------------------------------------");
            for (Map.Entry<String, String> entry : botStatus.entrySet()) {
                System.out.println("  " + entry.getKey() + ": " + entry.getValue());
            }
        }
    }

    private void doUsers() {
        Map<String, String> mapping = hubService.getUserBotMapping();
        if (mapping.isEmpty()) {
            System.out.println("暂无用户映射");
            return;
        }

        System.out.println("=== 用户到 Bot 映射 ===");
        System.out.println("用户ID -> BotID");
        System.out.println("----------------------------------------");
        for (Map.Entry<String, String> entry : mapping.entrySet()) {
            System.out.println("  " + entry.getKey() + " -> " + entry.getValue());
        }
        System.out.println();
        System.out.println("共 " + mapping.size() + " 个用户");
    }

    private void doSend(String[] args) {
        if (args.length < 3) {
            System.out.println("用法: ilinkhub send <用户ID> <消息内容>");
            System.out.println("示例: ilinkhub send user_abc 你好");
            return;
        }

        String userId = args[1];
        StringBuilder sb = new StringBuilder();
        for (int i = 2; i < args.length; i++) {
            if (i > 2) sb.append(" ");
            sb.append(args[i]);
        }

        try {
            boolean success = hubService.sendMessage(userId, sb.toString());
            if (success) {
                System.out.println("消息已发送");
            } else {
                System.out.println("消息发送失败");
            }
        } catch (Exception e) {
            System.out.println(GlobalExceptionHandler.handleException(e));
            LOGGER.severe("发送消息失败: " + e.getMessage());
        }
    }

    private void printUsage() {
        System.out.println("iLink Hub 管理命令 - 多 Bot 实例管理");
        System.out.println();
        System.out.println("用法: ilinkhub <子命令> [参数]");
        System.out.println();
        System.out.println("子命令:");
        System.out.println("  add <botId> <token>     - 添加一个 Bot 实例");
        System.out.println("  remove <botId>          - 移除一个 Bot 实例");
        System.out.println("  login <botId>           - 登录指定的 Bot");
        System.out.println("  start                   - 启动所有 Bot 实例");
        System.out.println("  stop                    - 停止所有 Bot 实例");
        System.out.println("  status                  - 查看 Hub 状态");
        System.out.println("  users                   - 查看用户到 Bot 的映射");
        System.out.println("  send <用户ID> <内容>    - 发送消息给用户");
        System.out.println("  help                    - 显示此帮助信息");
        System.out.println();
        System.out.println("示例:");
        System.out.println("  ilinkhub add bot1 your_token_1");
        System.out.println("  ilinkhub add bot2 your_token_2");
        System.out.println("  ilinkhub login bot1");
        System.out.println("  ilinkhub login bot2");
        System.out.println("  ilinkhub start");
        System.out.println("  ilinkhub status");
    }

    @Override
    public String getDescription() {
        return "iLink Hub 多 Bot 实例管理";
    }
}
