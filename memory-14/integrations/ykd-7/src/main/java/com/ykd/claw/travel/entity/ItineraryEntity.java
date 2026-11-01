package com.ykd.claw.travel.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "itinerary", indexes = {
        @Index(name = "idx_itinerary_user_updated", columnList = "user_id, updated_time")
})
public class ItineraryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private String userId;
    @Column(name = "conversation_id", nullable = false)
    private String conversationId;
    @Column(nullable = false)
    private String destination;
    @Column(name = "start_date")
    private LocalDate startDate;
    @Column(name = "end_date")
    private LocalDate endDate;
    private Integer days;
    @Column(nullable = false, length = 200)
    private String title;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;
    @Column(name = "created_time", nullable = false)
    private Instant createdTime;
    @Column(name = "updated_time", nullable = false)
    private Instant updatedTime;

    protected ItineraryEntity() {
    }

    public ItineraryEntity(String userId, String conversationId, String destination,
                           LocalDate startDate, LocalDate endDate, Integer days,
                           String title, String content, Instant now) {
        this.userId = userId;
        this.conversationId = conversationId;
        this.destination = destination;
        this.startDate = startDate;
        this.endDate = endDate;
        this.days = days;
        this.title = title;
        this.content = content;
        this.createdTime = now;
        this.updatedTime = now;
    }

    public void refresh(String destination, LocalDate startDate, LocalDate endDate, Integer days,
                        String title, String content, Instant now) {
        if (destination != null && !destination.isBlank()) this.destination = destination;
        if (startDate != null) this.startDate = startDate;
        if (endDate != null) this.endDate = endDate;
        if (days != null && days > 0) this.days = days;
        if (title != null && !title.isBlank()) this.title = title;
        if (content != null && !content.isBlank()) this.content = content;
        this.updatedTime = now;
    }

    public Long getId() { return id; }
    public String getUserId() { return userId; }
    public String getConversationId() { return conversationId; }
    public String getDestination() { return destination; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public Integer getDays() { return days; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public Instant getCreatedTime() { return createdTime; }
    public Instant getUpdatedTime() { return updatedTime; }
}
