package com.ykd.claw.memory;

import com.ykd.claw.agent.AgentAuditService;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Runs non-critical long-term-memory extraction after the reply has been returned. */
@Service
public class MemoryExtractionCoordinator {
    private static final Logger LOGGER = LoggerFactory.getLogger("AGENT_FULL_TRACE");
    private final TaskExecutor memoryExtractionExecutor;
    private final MemoryService memoryService;

    public MemoryExtractionCoordinator(TaskExecutor memoryExtractionExecutor, MemoryService memoryService) {
        this.memoryExtractionExecutor = memoryExtractionExecutor;
        this.memoryService = memoryService;
    }

    public void extractIfUseful(String executionId, String userId, String userMessage, String assistantMessage) {
        if (!hasDurableSignal(userMessage)) {
            LOGGER.info("MEMORY_EXTRACTION_SKIPPED executionId=" + executionId + " reason=no_durable_signal");
            return;
        }
        memoryExtractionExecutor.execute(() -> {
            long started = System.nanoTime();
            try {
                int count = memoryService.extractMemory(userId, userMessage, assistantMessage).size();
                LOGGER.info("MEMORY_EXTRACTION_SUCCESS executionId=" + executionId
                        + " candidates=" + count + " durationMs=" + elapsedMs(started));
            } catch (RuntimeException e) {
                LOGGER.warn( "MEMORY_EXTRACTION_FAILED executionId=" + executionId
                        + " durationMs=" + elapsedMs(started), e);
            }
        });
    }

    static boolean hasDurableSignal(String userMessage) {
        if (userMessage == null || userMessage.isBlank()) return false;
        String text = userMessage.toLowerCase(Locale.ROOT);
        return text.contains("我喜欢") || text.contains("我偏好") || text.contains("我的习惯")
                || text.contains("我一直") || text.contains("我从事") || text.contains("我是")
                || text.contains("长期") || text.contains("以后") || text.contains("i like")
                || text.contains("i prefer") || text.contains("my job") || text.contains("i am a ");
    }

    private static long elapsedMs(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
