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
@Table(name = "travel_task_state", indexes = {
        @Index(name = "idx_travel_task_conversation",
                columnList = "user_id, conversation_id, updated_time")
})
public class TravelTaskStateEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false) private String userId;
    @Column(name = "conversation_id", nullable = false) private String conversationId;
    private String destination;
    @Column(name = "travel_date") private LocalDate date;
    private Integer duration;
    private String departure;
    private Integer people;
    private Double budget;
    @Column(name = "budget_specified", nullable = false) private boolean budgetSpecified;
    @Column(columnDefinition = "TEXT") private String preference;
    private String transport;
    @Column(name = "hotel_level") private String hotelLevel;
    @Column(name = "food_preference") private String foodPreference;
    @Column(name = "current_stage", nullable = false) private String currentStage;
    @Column(name = "created_time", nullable = false) private Instant createdTime;
    @Column(name = "updated_time", nullable = false) private Instant updatedTime;

    protected TravelTaskStateEntity() { }

    public TravelTaskStateEntity(String userId, String conversationId, Instant now) {
        this.userId = userId;
        this.conversationId = conversationId;
        this.currentStage = "INIT";
        this.createdTime = now;
        this.updatedTime = now;
    }

    public void merge(String destination, LocalDate date, Integer duration, String departure,
                      Integer people, Double budget, Boolean budgetSpecified, String preference,
                      String transport, String hotelLevel, String foodPreference, Instant now) {
        if (present(destination)) this.destination = destination;
        if (date != null) this.date = date;
        if (duration != null && duration > 0) this.duration = duration;
        if (present(departure)) this.departure = departure;
        if (people != null && people > 0) this.people = people;
        if (budget != null && budget > 0) this.budget = budget;
        if (Boolean.TRUE.equals(budgetSpecified)) this.budgetSpecified = true;
        if (present(preference)) this.preference = mergeText(this.preference, preference);
        if (present(transport)) this.transport = transport;
        if (present(hotelLevel)) this.hotelLevel = hotelLevel;
        if (present(foodPreference)) this.foodPreference = foodPreference;
        this.updatedTime = now;
    }

    public void reset(Instant now) {
        this.destination = null;
        this.date = null;
        this.duration = null;
        this.departure = null;
        this.people = null;
        this.budget = null;
        this.budgetSpecified = false;
        this.preference = null;
        this.transport = null;
        this.hotelLevel = null;
        this.foodPreference = null;
        this.currentStage = "INIT";
        this.updatedTime = now;
    }

    public void stage(String value, Instant now) {
        if (present(value)) this.currentStage = value;
        this.updatedTime = now;
    }

    private static boolean present(String value) { return value != null && !value.isBlank(); }
    private static String mergeText(String oldValue, String newValue) {
        if (!present(oldValue)) return newValue;
        return oldValue.contains(newValue) ? oldValue : oldValue + "；" + newValue;
    }

    public Long getId() { return id; }
    public String getUserId() { return userId; }
    public String getConversationId() { return conversationId; }
    public String getDestination() { return destination; }
    public LocalDate getDate() { return date; }
    public Integer getDuration() { return duration; }
    public String getDeparture() { return departure; }
    public Integer getPeople() { return people; }
    public Double getBudget() { return budget; }
    public boolean isBudgetSpecified() { return budgetSpecified; }
    public String getPreference() { return preference; }
    public String getTransport() { return transport; }
    public String getHotelLevel() { return hotelLevel; }
    public String getFoodPreference() { return foodPreference; }
    public String getCurrentStage() { return currentStage; }
}
