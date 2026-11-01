package com.ykd.claw.config;

import com.ykd.claw.channel.wechat.ILinkBotService;
import com.ykd.claw.channel.wechat.WechatContextTokenStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import java.util.concurrent.Executors;

@Configuration(proxyBeanMethods = false)
public class ApplicationConfig {

    @Bean
    ThreadPoolTaskExecutor memoryExtractionExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("memory-extraction-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();
        return executor;
    }

    @Bean
    ILinkBotService ilinkBotService(@Value("${ilink.token:}") String token,
                                    @Value("${ilink.max-messages:200}") int maxMessages,
                                    @Value("${ilink.sync-buf-file:ilink_sync_buf.dat}") String syncBufferFile,
                                    WechatContextTokenStore contextTokenStore) {
        return new ILinkBotService(token, maxMessages, syncBufferFile, contextTokenStore);
    }

    /**
     * Thread pool for @Async tasks (memory extraction, reminder dispatch, etc.).
     * Uses virtual threads for lightweight concurrent I/O-bound work.
     */
    @Bean(name = "asyncExecutor")
    public AsyncTaskExecutor asyncTaskExecutor() {
        return new TaskExecutorAdapter(Executors.newVirtualThreadPerTaskExecutor());
    }

    /**
     * Thread pool for @Scheduled tasks. Replaces the default single-thread scheduler
     * so that scheduled tasks don't block each other.
     */
    @Bean
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(4);
        scheduler.setThreadNamePrefix("scheduler-");
        return scheduler;
    }
}
