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
@Table(name = "tool_execution", indexes = {
        @Index(name = "idx_tool_execution_agent", columnList = "execution_id, started_time")
})
public class ToolExecutionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "execution_id", nullable = false, length = 36)
    private String executionId;
    @Column(name = "tool_name", nullable = false)
    private String toolName;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String arguments;
    @Column(columnDefinition = "TEXT")
    private String result;
    @Column(nullable = false, length = 32)
    private String status;
    @Column(columnDefinition = "TEXT")
    private String error;
    @Column(name = "started_time", nullable = false)
    private Instant startedTime;
    @Column(name = "completed_time")
    private Instant completedTime;
    @Column(name = "duration_ms")
    private Long durationMs;

    protected ToolExecutionEntity() {
    }

    public ToolExecutionEntity(String executionId, String toolName, String arguments, Instant startedTime) {
        this.executionId = executionId;
        this.toolName = toolName;
        this.arguments = arguments;
        this.status = "running";
        this.startedTime = startedTime;
    }

    public Long getId() {
        return id;
    }

    public String getExecutionId() {
        return executionId;
    }

    public String getToolName() {
        return toolName;
    }

    public String getArguments() {
        return arguments;
    }

    public String getResult() {
        return result;
    }

    public String getStatus() {
        return status;
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

    public void succeed(String result, Instant completedTime) {
        this.status = "succeeded";
        this.result = result;
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
