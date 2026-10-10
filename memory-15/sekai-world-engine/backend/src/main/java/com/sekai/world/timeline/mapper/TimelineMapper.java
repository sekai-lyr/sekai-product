package com.sekai.world.timeline.mapper;

import com.sekai.world.timeline.model.StateChange;
import com.sekai.world.timeline.model.TimelineEvent;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface TimelineMapper {
    @Select("SELECT id, branch_id, as_of_timeline_event_id, state_json, created_at FROM sekai_world_snapshot WHERE branch_id = #{branchId} AND as_of_timeline_event_id <= #{timelineEventId} ORDER BY as_of_timeline_event_id DESC LIMIT 1")
    @Results({@Result(property = "id", column = "id"), @Result(property = "branchId", column = "branch_id"),
            @Result(property = "asOfTimelineEventId", column = "as_of_timeline_event_id"), @Result(property = "stateJson", column = "state_json"),
            @Result(property = "createdAt", column = "created_at")})
    SnapshotRow findLatestSnapshot(@Param("branchId") Long branchId, @Param("timelineEventId") Long timelineEventId);
    @Select("SELECT id, branch_id, tick_id, event_id, event_type, summary, payload_json, occurred_on FROM sekai_timeline_event WHERE branch_id = #{branchId} ORDER BY id DESC")
    @Results({@Result(property = "id", column = "id"), @Result(property = "branchId", column = "branch_id"), @Result(property = "tickId", column = "tick_id"),
            @Result(property = "eventId", column = "event_id"), @Result(property = "eventType", column = "event_type"), @Result(property = "summary", column = "summary"),
            @Result(property = "payloadJson", column = "payload_json"), @Result(property = "occurredOn", column = "occurred_on")})
    List<TimelineEvent> list(Long branchId);

    @Select("SELECT id, branch_id, tick_id, event_id, event_type, summary, payload_json, occurred_on FROM sekai_timeline_event WHERE id = #{timelineEventId} AND branch_id = #{branchId}")
    @Results({@Result(property = "id", column = "id"), @Result(property = "branchId", column = "branch_id"), @Result(property = "tickId", column = "tick_id"),
            @Result(property = "eventId", column = "event_id"), @Result(property = "eventType", column = "event_type"), @Result(property = "summary", column = "summary"),
            @Result(property = "payloadJson", column = "payload_json"), @Result(property = "occurredOn", column = "occurred_on")})
    TimelineEvent find(@Param("branchId") Long branchId, @Param("timelineEventId") Long timelineEventId);

    @Select("SELECT id, timeline_event_id, entity_type, entity_id, field_path, before_value, after_value FROM sekai_state_change WHERE timeline_event_id = #{timelineEventId} ORDER BY id")
    @Results({@Result(property = "id", column = "id"), @Result(property = "timelineEventId", column = "timeline_event_id"), @Result(property = "entityType", column = "entity_type"),
            @Result(property = "entityId", column = "entity_id"), @Result(property = "fieldPath", column = "field_path"), @Result(property = "beforeValue", column = "before_value"), @Result(property = "afterValue", column = "after_value")})
    List<StateChange> listChanges(Long timelineEventId);

    @Insert("INSERT INTO sekai_timeline_event(branch_id, tick_id, event_id, event_type, summary, payload_json, occurred_on) VALUES(#{branchId}, #{tickId}, #{eventId}, #{eventType}, #{summary}, #{payloadJson}, #{occurredOn})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertTimeline(TimelineDraft event);

    @Insert("INSERT INTO sekai_state_change(timeline_event_id, entity_type, entity_id, field_path, before_value, after_value) VALUES(#{timelineEventId}, #{entityType}, #{entityId}, #{fieldPath}, #{beforeValue}, #{afterValue})")
    int insertChange(ChangeDraft change);

    @Insert("INSERT INTO sekai_world_snapshot(branch_id, as_of_timeline_event_id, state_json) VALUES(#{branchId}, #{asOfTimelineEventId}, #{stateJson})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertSnapshot(SnapshotDraft snapshot);

    public class TimelineDraft {
        private Long id; private Long branchId; private Long tickId; private Long eventId; private String eventType; private String summary; private String payloadJson; private LocalDate occurredOn;
        public TimelineDraft(Long branchId, Long tickId, Long eventId, String eventType, String summary, String payloadJson, LocalDate occurredOn) { this.branchId = branchId; this.tickId = tickId; this.eventId = eventId; this.eventType = eventType; this.summary = summary; this.payloadJson = payloadJson; this.occurredOn = occurredOn; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; } public Long getBranchId() { return branchId; } public Long getTickId() { return tickId; } public Long getEventId() { return eventId; }
        public String getEventType() { return eventType; } public String getSummary() { return summary; } public String getPayloadJson() { return payloadJson; } public LocalDate getOccurredOn() { return occurredOn; }
    }

    public class ChangeDraft {
        private Long timelineEventId; private String entityType; private Long entityId; private String fieldPath; private String beforeValue; private String afterValue;
        public ChangeDraft(Long timelineEventId, String entityType, Long entityId, String fieldPath, String beforeValue, String afterValue) { this.timelineEventId = timelineEventId; this.entityType = entityType; this.entityId = entityId; this.fieldPath = fieldPath; this.beforeValue = beforeValue; this.afterValue = afterValue; }
        public Long getTimelineEventId() { return timelineEventId; } public String getEntityType() { return entityType; } public Long getEntityId() { return entityId; } public String getFieldPath() { return fieldPath; } public String getBeforeValue() { return beforeValue; } public String getAfterValue() { return afterValue; }
    }

    public class SnapshotDraft {
        private Long id; private Long branchId; private Long asOfTimelineEventId; private String stateJson;
        public SnapshotDraft(Long branchId, Long asOfTimelineEventId, String stateJson) { this.branchId = branchId; this.asOfTimelineEventId = asOfTimelineEventId; this.stateJson = stateJson; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; } public Long getBranchId() { return branchId; } public Long getAsOfTimelineEventId() { return asOfTimelineEventId; } public String getStateJson() { return stateJson; }
    }

    public class SnapshotRow {
        private Long id; private Long branchId; private Long asOfTimelineEventId; private String stateJson; private java.time.LocalDateTime createdAt;
        public SnapshotRow() {}
        public SnapshotRow(Long id, Long branchId, Long asOfTimelineEventId, String stateJson, java.time.LocalDateTime createdAt) {
            this.id = id; this.branchId = branchId; this.asOfTimelineEventId = asOfTimelineEventId; this.stateJson = stateJson; this.createdAt = createdAt;
        }
        public Long getId() { return id; } public void setId(Long value) { id = value; }
        public Long getBranchId() { return branchId; } public void setBranchId(Long value) { branchId = value; }
        public Long getAsOfTimelineEventId() { return asOfTimelineEventId; } public void setAsOfTimelineEventId(Long value) { asOfTimelineEventId = value; }
        public String getStateJson() { return stateJson; } public void setStateJson(String value) { stateJson = value; }
        public java.time.LocalDateTime getCreatedAt() { return createdAt; } public void setCreatedAt(java.time.LocalDateTime value) { createdAt = value; }
        public Long id() { return id; } public Long branchId() { return branchId; } public Long asOfTimelineEventId() { return asOfTimelineEventId; }
        public String stateJson() { return stateJson; } public java.time.LocalDateTime createdAt() { return createdAt; }
    }
}
