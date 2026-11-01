package com.ykd.claw.channel.cli;

public class VersionCommand implements Command {

    private final String version;

    public VersionCommand(String version) {
        this.version = version;
    }

    @Override
    public void execute(String... args) {
        System.out.println("OpenClaw 版本: " + version);
    }

    @Override
    public String getDescription() {
        return "打印版本号";
    }
}
