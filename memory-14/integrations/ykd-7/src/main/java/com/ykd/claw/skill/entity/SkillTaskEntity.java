package com.ykd.claw.skill.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "skill_task", indexes = {
        @Index(name = "idx_skill_task_active",
                columnList = "user_id, conversation_id, status, updated_time")
})
public class SkillTaskEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(name = "skill_name", nullable = false, length = 100)
    private String skillName;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "accumulated_input", nullable = false, columnDefinition = "TEXT")
    private String accumulatedInput;

    @Column(name = "missing_information", nullable = false, columnDefinition = "TEXT")
    private String missingInformation;

    @Column(name = "created_time", nullable = false)
    private Instant createdTime;

    @Column(name = "updated_time", nullable = false)
    private Instant updatedTime;

    protected SkillTaskEntity() {
    }

    public SkillTaskEntity(String userId, String conversationId, String skillName,
                           String accumulatedInput, Instant now) {
        this.userId = userId;
        this.conversationId = conversationId;
        this.skillName = skillName;
        this.status = "running";
        this.accumulatedInput = accumulatedInput;
        this.missingInformation = "[]";
        this.createdTime = now;
        this.updatedTime = now;
    }

    public Long getId() {
        return id;
    }

    public String getSkillName() {
        return skillName;
    }

    public String getStatus() {
        return status;
    }

    public String getAccumulatedInput() {
        return accumulatedInput;
    }

    public String getMissingInformation() {
        return missingInformation;
    }

    public Instant getUpdatedTime() {
        return updatedTime;
    }

    public void appendInput(String input, Instant now) {
        accumulatedInput += "\nFollow-up user message:\n" + input;
        status = "running";
        updatedTime = now;
    }

    public void waitForUser(String missingInformation, Instant now) {
        status = "waiting";
        this.missingInformation = missingInformation;
        updatedTime = now;
    }

    public void ready(Instant now) {
        status = "ready";
        missingInformation = "[]";
        updatedTime = now;
    }

    public void supersede(Instant now) {
        status = "superseded";
        updatedTime = now;
    }
}
