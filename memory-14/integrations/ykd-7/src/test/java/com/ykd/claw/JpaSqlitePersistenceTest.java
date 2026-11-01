package com.ykd.claw;

import com.ykd.claw.agent.AgentAuditService;
import com.ykd.claw.agent.repository.AgentExecutionJpaRepository;
import com.ykd.claw.memory.ConversationService;
import com.ykd.claw.memory.MemoryCandidate;
import com.ykd.claw.memory.MemoryService;
import com.ykd.claw.reminder.ReminderService;
import com.ykd.claw.reminder.ReminderStartupRecovery;
import com.ykd.claw.reminder.entity.ReminderEntity;
import com.ykd.claw.reminder.repository.ReminderJpaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@ActiveProfiles("sqlite")
@SpringBootTest(properties = {
        "app.cli.enabled=false",
        "spring.ai.deepseek.api-key=test-key",
        "spring.datasource.url=jdbc:sqlite:target/jpa-persistence-test.db",
        "spring.jpa.hibernate.ddl-auto=update",
        "memory.extraction-enabled=false"
})
class JpaSqlitePersistenceTest {
    @Autowired ConversationService conversations;
    @Autowired MemoryService memories;
    @Autowired ReminderService reminders;
    @Autowired ReminderJpaRepository reminderRepository;
    @Autowired ReminderStartupRecovery reminderRecovery;
    @Autowired AgentAuditService auditService;
    @Autowired AgentExecutionJpaRepository agentExecutionRepository;

    @Test
    void persistsConversationMemoryAndReminderThroughJpa() {
        String suffix = UUID.randomUUID().toString();
        String userId = "jpa-user-" + suffix;
        String conversationId = "jpa-conversation-" + suffix;

        conversations.saveTurn(userId, conversationId, "hello", "hi");
        assertEquals(2, conversations.count(userId, conversationId));
        assertEquals("hello", conversations.getHistory(userId, conversationId).getFirst().content());

        MemoryCandidate candidate = new MemoryCandidate("technology_stack", "Uses Java 21", 9);
        memories.saveMemory(userId, candidate);
        memories.saveMemory(userId, candidate);
        assertEquals(1, memories.queryMemory(userId, "Java project").size());

        var reminder = reminders.create(userId, conversationId, "Review migration",
                "2099-01-01T09:00:00+08:00[Asia/Shanghai]", "Verify SQLite persistence");
        assertNotNull(reminder.id());
        assertEquals("scheduled", reminder.status());

        assertEquals("paused", reminders.pause(userId, reminder.id()).status());
        assertEquals("scheduled", reminders.resume(userId, reminder.id()).status());
        assertEquals("cancelled", reminders.cancel(userId, reminder.id()).status());

        Instant now = Instant.now();
        ReminderEntity missed = reminderRepository.saveAndFlush(new ReminderEntity(
                userId, conversationId, "Missed while offline", now.minusSeconds(60),
                "UTC", "", "scheduled", now.minusSeconds(120), "once", null));
        reminders.dispatchDue(missed.getId());
        assertEquals("completed", reminderRepository.findById(missed.getId()).orElseThrow().getStatus());

        ReminderEntity interrupted = reminderRepository.saveAndFlush(new ReminderEntity(
                userId, conversationId, "Interrupted on shutdown", now.plusSeconds(3600),
                "UTC", "", "processing", now, "once", null));
        reminderRecovery.recover();
        assertEquals("scheduled",
                reminderRepository.findById(interrupted.getId()).orElseThrow().getStatus());

        long auditCount = agentExecutionRepository.count();
        String executionId = auditService.startAgent(userId, conversationId, 1, "audit input",
                "system prompt", conversations.getHistory(userId, conversationId),
                memories.queryMemory(userId, "Java"), java.util.List.of("create_reminder"));
        auditService.agentSucceeded(executionId, "audit response");
        assertEquals(auditCount + 1, agentExecutionRepository.count());
    }
}
