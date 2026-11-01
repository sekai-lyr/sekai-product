package com.ykd.claw.channel.cli;

import com.ykd.claw.exception.GlobalExceptionHandler;
import com.ykd.claw.channel.wechat.ILinkBotService;
import com.openilink.auth.LoginCallbacks;
import com.openilink.model.response.LoginResult;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ILinkCommand implements Command {

    private static final Logger LOGGER = LoggerFactory.getLogger(ILinkCommand.class.getName());

    private final ILinkBotService botService;

    public ILinkCommand(ILinkBotService botService) {
        this.botService = botService;
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
            case "send"     -> doSend(args);
            case "status"   -> doStatus();
            case "messages" -> doMessages();
            case "stop"     -> doStop();
            case "start"    -> doStart();
            case "logout"   -> doLogout();
            default -> {
                System.out.println("未知子命令: " + subCmd);
                printUsage();
            }
        }
    }

    private void doLogin() {
        if (botService.isLoggedIn() && botService.isRunning()) {
            System.out.println("已登录且监听中，无需重复登录。如需重登请先 ilink logout");
            return;
        }

        // Try restoring previous session first
        if (botService.tryRestoreSession()) {
            System.out.println("Session restored from previous login!");
            System.out.println("BotID: " + botService.getLoginResult().getBotId());
            return;
        }

        System.out.println("正在连接微信 ClawBot...");
        System.out.println("请将以下链接复制到浏览器中扫码：");
        System.out.println();

        try {
            LoginResult result = botService.login(new LoginCallbacks() {
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
                System.out.println("登录成功！监听已自动启动");
                System.out.println("  BotID:  " + result.getBotId());
                System.out.println("  UserID: " + result.getUserId());
                System.out.println();
                System.out.println("现在用微信给 Bot 发消息，控制台会实时显示。");
                System.out.println("发送: ilink send <用户ID> <内容>");
            } else {
                System.out.println("登录失败: " + result.getMessage());
            }
        } catch (Exception e) {
            System.out.println(GlobalExceptionHandler.handleException(e));
            LOGGER.error("iLink 登录异常: " + e.getMessage());
        }
    }

    private void doStart() {
        botService.startMonitor();
    }

    private void doSend(String[] args) {
        if (args.length < 3) {
            System.out.println("用法: ilink send <用户ID> <消息内容>");
            System.out.println("示例: ilink send user_abc 你好");
            System.out.println("提示: 先用微信给 Bot 发消息，用户ID 会显示在控制台");
            return;
        }

        String toUserId = args[1];
        StringBuilder sb = new StringBuilder();
        for (int i = 2; i < args.length; i++) {
            if (i > 2) sb.append(" ");
            sb.append(args[i]);
        }
        botService.sendText(toUserId, sb.toString())
                .ifPresent(System.out::println);
    }

    private void doStatus() {
        System.out.println("状态: " + botService.getState());
        if (botService.isLoggedIn()) {
            LoginResult r = botService.getLoginResult();
            System.out.println("  BotID:  " + r.getBotId());
            System.out.println("  UserID: " + r.getUserId());
            String runInfo = botService.isRunning()
                    ? "运行中 (已轮询" + botService.getLoopCount() + " 次)"
                    : "未启动";
            System.out.println("  监控:   " + runInfo);
        }
        System.out.println("  已缓存消息: " + botService.getReceivedMessages().size() + " 条");
    }

    private void doMessages() {
        if (!botService.isLoggedIn()) {
            System.out.println("请先执行 ilink login");
            return;
        }
        if (!botService.isRunning()) {
            System.out.println("监听未启动，请执行 ilink start 或重新 ilink login");
            return;
        }

        List<ILinkBotService.ReceivedMessage> msgs = botService.getReceivedMessages();
        if (msgs.isEmpty()) {
            System.out.println("暂无消息。请用微信向 Bot 发一条消息试试");
            return;
        }
        System.out.println("最近消息 (" + msgs.size() + " 条):");
        System.out.println("----------------------------------------");
        for (int i = 0; i < Math.min(msgs.size(), 20); i++) {
            System.out.println((i + 1) + ". " + msgs.get(i));
        }
    }

    private void doStop() {
        if (!botService.isRunning()) {
            System.out.println("监听未在运行");
            return;
        }
        botService.stop();
        System.out.println("监听已停止");
    }

    private void doLogout() {
        botService.logout();
        System.out.println("已登出");
    }

    private void printUsage() {
        System.out.println("iLink 微信 ClawBot 命令:");
        System.out.println("  ilink login              - 扫码登录（自动监听）");
        System.out.println("  ilink send <用户> <内容>   - 发送消息");
        System.out.println("  ilink status             - 查看状态");
        System.out.println("  ilink messages           - 查看消息");
        System.out.println("  ilink stop               - 停止监听");
        System.out.println("  ilink logout             - 登出");
    }

    @Override
    public String getDescription() {
        return "微信 ClawBot 消息收发";
    }
}
