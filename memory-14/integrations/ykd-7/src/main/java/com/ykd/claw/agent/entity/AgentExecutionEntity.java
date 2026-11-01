package com.ykd.claw.agent.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "agent_execution", indexes = {
        @Index(name = "idx_agent_execution_conversation", columnList = "user_id, conversation_id, started_time"),
        @Index(name = "idx_agent_execution_id", columnList = "execution_id")
})
public class AgentExecutionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "execution_id", nullable = false, unique = true, length = 36)
    private String executionId;
    @Column(name = "user_id", nullable = false)
    private String userId;
    @Column(name = "conversation_id", nullable = false)
    private String conversationId;
    @Column(nullable = false)
    private int attempt;
    @Column(nullable = false, length = 32)
    private String status;
    @Column(name = "user_message", nullable = false, columnDefinition = "TEXT")
    private String userMessage;
    @Column(name = "system_prompt", nullable = false, columnDefinition = "TEXT")
    private String systemPrompt;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String history;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String memories;
    @Column(name = "selected_tools", nullable = false, columnDefinition = "TEXT")
    private String selectedTools;
    @Column(columnDefinition = "TEXT")
    private String response;
    @Column(columnDefinition = "TEXT")
    private String error;
    @Column(name = "started_time", nullable = false)
    private Instant startedTime;
    @Column(name = "completed_time")
    private Instant completedTime;
    @Column(name = "duration_ms")
    private Long durationMs;

    protected AgentExecutionEntity() {
    }

    public AgentExecutionEntity(String executionId, String userId, String conversationId, int attempt,
                                String userMessage, String systemPrompt, String history, String memories,
                                String selectedTools, Instant startedTime) {
        this.executionId = executionId;
        this.userId = userId;
        this.conversationId = conversationId;
        this.attempt = attempt;
        this.status = "running";
        this.userMessage = userMessage;
        this.systemPrompt = systemPrompt;
        this.history = history;
        this.memories = memories;
        this.selectedTools = selectedTools;
        this.startedTime = startedTime;
    }

    public String getExecutionId() {
        return executionId;
    }

    public String getUserId() {
        return userId;
    }

    public String getConversationId() {
        return conversationId;
    }

    public int getAttempt() {
        return attempt;
    }

    public String getStatus() {
        return status;
    }

    public String getUserMessage() {
        return userMessage;
    }

    public String getSystemPrompt() {
        return systemPrompt;
    }

    public String getHistory() {
        return history;
    }

    public String getMemories() {
        return memories;
    }

    public String getSelectedTools() {
        return selectedTools;
    }

    public String getResponse() {
        return response;
    }

    public String getError() {
        return error;
    }

    public Instant getStartedTime() {
        return startedTime;
    }

    public Instant getCompletedTime() {
        return completedTime;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void updateSystemPrompt(String systemPrompt) {
        this.systemPrompt = systemPrompt;
    }

    public void succeed(String response, Instant completedTime) {
        this.status = "succeeded";
        this.response = response;
        complete(completedTime);
    }

    public void fail(String error, Instant completedTime) {
        this.status = "failed";
        this.error = error;
        complete(completedTime);
    }

    private void complete(Instant completedTime) {
        this.completedTime = completedTime;
        this.durationMs = completedTime.toEpochMilli() - startedTime.toEpochMilli();
    }
}
