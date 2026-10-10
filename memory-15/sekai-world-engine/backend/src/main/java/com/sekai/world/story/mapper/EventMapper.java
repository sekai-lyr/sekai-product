package com.sekai.world.story.mapper;

import com.sekai.world.story.model.EventChoice;
import com.sekai.world.story.model.WorldEvent;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface EventMapper {
    @Select("SELECT e.id, e.branch_id, e.template_id, e.occurred_on, e.status, e.title, e.description, e.payload_json, e.idempotency_key FROM sekai_world_event e JOIN sekai_world_branch b ON b.id = e.branch_id WHERE b.world_id = #{worldId} AND e.branch_id = #{branchId} ORDER BY e.id DESC")
    @Results({@Result(property = "id", column = "id"), @Result(property = "branchId", column = "branch_id"),
            @Result(property = "templateId", column = "template_id"), @Result(property = "occurredOn", column = "occurred_on"),
            @Result(property = "status", column = "status"), @Result(property = "title", column = "title"),
            @Result(property = "description", column = "description"), @Result(property = "payloadJson", column = "payload_json"),
            @Result(property = "idempotencyKey", column = "idempotency_key")})
    List<WorldEvent> list(@Param("worldId") Long worldId, @Param("branchId") Long branchId);

    @Select("SELECT id, branch_id, template_id, occurred_on, status, title, description, payload_json, idempotency_key FROM sekai_world_event WHERE id = #{eventId} AND branch_id = #{branchId}")
    @Results({@Result(property = "id", column = "id"), @Result(property = "branchId", column = "branch_id"),
            @Result(property = "templateId", column = "template_id"), @Result(property = "occurredOn", column = "occurred_on"),
            @Result(property = "status", column = "status"), @Result(property = "title", column = "title"),
            @Result(property = "description", column = "description"), @Result(property = "payloadJson", column = "payload_json"),
            @Result(property = "idempotencyKey", column = "idempotency_key")})
    WorldEvent find(@Param("eventId") Long eventId, @Param("branchId") Long branchId);

    @Select("SELECT id, event_id, code, label, required_mood_min, mood_delta, condition_json, effect_json, sort_order FROM sekai_event_choice WHERE event_id = #{eventId} ORDER BY sort_order")
    @Results({@Result(property = "id", column = "id"), @Result(property = "eventId", column = "event_id"), @Result(property = "code", column = "code"),
            @Result(property = "label", column = "label"), @Result(property = "requiredMoodMin", column = "required_mood_min"), @Result(property = "moodDelta", column = "mood_delta"),
            @Result(property = "conditionJson", column = "condition_json"), @Result(property = "effectJson", column = "effect_json"), @Result(property = "sortOrder", column = "sort_order")})
    List<EventChoice> listChoices(Long eventId);

    @Select("SELECT id, event_id, code, label, required_mood_min, mood_delta, condition_json, effect_json, sort_order FROM sekai_event_choice WHERE event_id = #{eventId} AND code = #{code}")
    @Results({@Result(property = "id", column = "id"), @Result(property = "eventId", column = "event_id"), @Result(property = "code", column = "code"),
            @Result(property = "label", column = "label"), @Result(property = "requiredMoodMin", column = "required_mood_min"), @Result(property = "moodDelta", column = "mood_delta"),
            @Result(property = "conditionJson", column = "condition_json"), @Result(property = "effectJson", column = "effect_json"), @Result(property = "sortOrder", column = "sort_order")})
    EventChoice findChoice(@Param("eventId") Long eventId, @Param("code") String code);

    @Insert("INSERT INTO sekai_world_event(branch_id, template_id, occurred_on, status, title, description, payload_json, idempotency_key) VALUES(#{branchId}, #{templateId}, #{occurredOn}, #{status}, #{title}, #{description}, #{payloadJson}, #{idempotencyKey})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(EventDraft event);

    @Insert("INSERT INTO sekai_event_choice(event_id, code, label, required_mood_min, mood_delta, condition_json, effect_json, sort_order) VALUES(#{eventId}, #{code}, #{label}, #{requiredMoodMin}, #{moodDelta}, #{conditionJson}, #{effectJson}, #{sortOrder})")
    int insertChoice(ChoiceDraft choice);

    @Update("UPDATE sekai_world_event SET status = #{status} WHERE id = #{eventId} AND status = 'PENDING'")
    int markHandled(@Param("eventId") Long eventId, @Param("status") String status);

    public class EventDraft {
        private Long id; private Long branchId; private Long templateId; private LocalDate occurredOn; private String status; private String title; private String description; private String payloadJson; private String idempotencyKey;
        public EventDraft(Long branchId, Long templateId, LocalDate occurredOn, String status, String title, String description, String payloadJson, String idempotencyKey) { this.branchId = branchId; this.templateId = templateId; this.occurredOn = occurredOn; this.status = status; this.title = title; this.description = description; this.payloadJson = payloadJson; this.idempotencyKey = idempotencyKey; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; }
        public Long getBranchId() { return branchId; } public Long getTemplateId() { return templateId; } public LocalDate getOccurredOn() { return occurredOn; } public String getStatus() { return status; }
        public String getTitle() { return title; } public String getDescription() { return description; } public String getPayloadJson() { return payloadJson; } public String getIdempotencyKey() { return idempotencyKey; }
    }

    public class ChoiceDraft {
        private Long eventId; private String code; private String label; private int requiredMoodMin; private int moodDelta; private String conditionJson; private String effectJson; private int sortOrder;
        public ChoiceDraft(Long eventId, String code, String label, int requiredMoodMin, int moodDelta, String conditionJson, String effectJson, int sortOrder) { this.eventId = eventId; this.code = code; this.label = label; this.requiredMoodMin = requiredMoodMin; this.moodDelta = moodDelta; this.conditionJson = conditionJson; this.effectJson = effectJson; this.sortOrder = sortOrder; }
        public Long getEventId() { return eventId; } public String getCode() { return code; } public String getLabel() { return label; } public int getRequiredMoodMin() { return requiredMoodMin; } public int getMoodDelta() { return moodDelta; }
        public String getConditionJson() { return conditionJson; } public String getEffectJson() { return effectJson; } public int getSortOrder() { return sortOrder; }
    }
}
