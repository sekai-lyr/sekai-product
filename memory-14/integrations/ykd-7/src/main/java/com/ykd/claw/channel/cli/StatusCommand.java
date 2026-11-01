package com.ykd.claw.channel.cli;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

public class StatusCommand implements Command {

    private final Instant startTime;
    private final Map<String, Command> commands;

    public StatusCommand(Instant startTime, Map<String, Command> commands) {
        this.startTime = startTime;
        this.commands = commands;
    }

    @Override
    public void execute(String... args) {
        Duration uptime = Duration.between(startTime, Instant.now());
        long hours = uptime.toHours();
        long minutes = uptime.toMinutesPart();
        long seconds = uptime.toSecondsPart();
        System.out.printf("运行时长: %d 小时 %d 分 %d 秒%n", hours, minutes, seconds);
        System.out.println("已注册命令数量: " + commands.size());
    }

    @Override
    public String getDescription() {
        return "显示程序运行状态";
    }
}
