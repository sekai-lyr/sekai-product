package com.ykd.claw.channel.cli;

public interface Command {
    void execute(String... args);
    String getDescription();
}
