package com.ykd.claw;

import com.ykd.claw.exception.GlobalExceptionHandler;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.PrintStream;
import java.nio.charset.StandardCharsets;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class App {
    public static void main(String[] args) {
        System.setOut(new PrintStream(System.out, true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(System.err, true, StandardCharsets.UTF_8));
        GlobalExceptionHandler.register();
        SpringApplication.run(App.class, args);
    }
}
