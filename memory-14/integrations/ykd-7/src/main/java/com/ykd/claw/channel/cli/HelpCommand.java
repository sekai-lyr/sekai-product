package com.ykd.claw.channel.cli;

import java.util.Map;

public class HelpCommand implements Command {

    private final Map<String, Command> commands;

    public HelpCommand(Map<String, Command> commands) {
        this.commands = commands;
    }

    @Override
    public void execute(String... args) {
        System.out.println("OpenClaw - 智能命令行助手");
        System.out.println();
        System.out.println("直接输入文字即可与 AI 对话，以下为特殊命令：");
        System.out.println();
        for (var entry : commands.entrySet()) {
            System.out.printf("  %-10s - %s%n", entry.getKey(), entry.getValue().getDescription());
        }
        System.out.println();
        System.out.println("提示: 输入任何其他内容都会自动交给 AI 处理。");
    }

    @Override
    public String getDescription() {
        return "显示帮助信息";
    }
}