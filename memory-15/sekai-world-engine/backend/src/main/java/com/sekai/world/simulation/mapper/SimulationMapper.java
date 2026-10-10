package com.sekai.world.simulation.mapper;

import com.sekai.world.simulation.model.EventTemplate;
import com.sekai.world.simulation.model.SimulationTick;
import com.sekai.world.simulation.model.WorldRule;
import com.sekai.world.actor.model.Actor;
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
public interface SimulationMapper {
    @Select("SELECT a.id, a.world_id, a.faction_id, s.location_id, a.name, a.role, a.profile_json, s.state_json, s.energy, s.mood, s.status FROM sekai_actor a JOIN sekai_branch_actor_state s ON s.actor_id = a.id WHERE a.world_id = #{worldId} AND s.branch_id = #{branchId} ORDER BY a.id")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"), @Result(property = "factionId", column = "faction_id"), @Result(property = "locationId", column = "location_id"), @Result(property = "name", column = "name"), @Result(property = "role", column = "role"), @Result(property = "profileJson", column = "profile_json"), @Result(property = "stateJson", column = "state_json"), @Result(property = "energy", column = "energy"), @Result(property = "mood", column = "mood"), @Result(property = "status", column = "status")})
    List<Actor> listBranchActors(@Param("worldId") Long worldId, @Param("branchId") Long branchId);
    @Insert("INSERT INTO sekai_world_rule(world_id, code, name, condition_type, threshold_value, effect_type, effect_value, condition_json, effect_json, priority, enabled) VALUES(#{worldId}, #{code}, #{name}, #{conditionType}, #{thresholdValue}, #{effectType}, #{effectValue}, #{conditionJson}, #{effectJson}, #{priority}, TRUE)")
    int insertRule(RuleDraft rule);

    @Insert("INSERT INTO sekai_event_template(world_id, code, name, description, probability_percent, priority, condition_json, payload_json, enabled, choice_positive_label, choice_positive_mood_delta, choice_negative_label, choice_negative_mood_delta) VALUES(#{worldId}, #{code}, #{name}, #{description}, #{probabilityPercent}, #{priority}, '{}', '{}', TRUE, #{choicePositiveLabel}, #{choicePositiveMoodDelta}, #{choiceNegativeLabel}, #{choiceNegativeMoodDelta})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertTemplate(TemplateDraft template);

    @Select("SELECT id, world_id, code, name, condition_type, threshold_value, effect_type, effect_value, priority, enabled FROM sekai_world_rule WHERE world_id = #{worldId} AND enabled = TRUE ORDER BY priority DESC, code")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "code", column = "code"), @Result(property = "name", column = "name"), @Result(property = "conditionType", column = "condition_type"),
            @Result(property = "thresholdValue", column = "threshold_value"), @Result(property = "effectType", column = "effect_type"),
            @Result(property = "effectValue", column = "effect_value"), @Result(property = "priority", column = "priority"), @Result(property = "enabled", column = "enabled")})
    List<WorldRule> listRules(Long worldId);

    @Select("SELECT id, world_id, code, name, description, probability_percent, priority, enabled, choice_positive_label, choice_positive_mood_delta, choice_negative_label, choice_negative_mood_delta FROM sekai_event_template WHERE world_id = #{worldId} AND enabled = TRUE ORDER BY priority DESC, code")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "code", column = "code"), @Result(property = "name", column = "name"), @Result(property = "description", column = "description"),
            @Result(property = "probabilityPercent", column = "probability_percent"), @Result(property = "priority", column = "priority"), @Result(property = "enabled", column = "enabled"),
            @Result(property = "choicePositiveLabel", column = "choice_positive_label"), @Result(property = "choicePositiveMoodDelta", column = "choice_positive_mood_delta"),
            @Result(property = "choiceNegativeLabel", column = "choice_negative_label"), @Result(property = "choiceNegativeMoodDelta", column = "choice_negative_mood_delta")})
    List<EventTemplate> listTemplates(Long worldId);

    @Select("SELECT id, branch_id, tick_key, from_date, to_date, result_json FROM sekai_simulation_tick WHERE branch_id = #{branchId} AND tick_key = #{tickKey}")
    @Results({@Result(property = "id", column = "id"), @Result(property = "branchId", column = "branch_id"),
            @Result(property = "tickKey", column = "tick_key"), @Result(property = "fromDate", column = "from_date"),
            @Result(property = "toDate", column = "to_date"), @Result(property = "resultJson", column = "result_json")})
    SimulationTick findTick(@Param("branchId") Long branchId, @Param("tickKey") String tickKey);

    @Insert("INSERT INTO sekai_simulation_tick(branch_id, tick_key, from_date, to_date, result_json) VALUES(#{branchId}, #{tickKey}, #{fromDate}, #{toDate}, #{resultJson})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertTick(TickDraft tick);

    public class TickDraft {
        private Long id; private Long branchId; private String tickKey; private LocalDate fromDate; private LocalDate toDate; private String resultJson;
        public TickDraft(Long branchId, String tickKey, LocalDate fromDate, LocalDate toDate, String resultJson) { this.branchId = branchId; this.tickKey = tickKey; this.fromDate = fromDate; this.toDate = toDate; this.resultJson = resultJson; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; }
        public Long getBranchId() { return branchId; } public String getTickKey() { return tickKey; } public LocalDate getFromDate() { return fromDate; }
        public LocalDate getToDate() { return toDate; } public String getResultJson() { return resultJson; }
    }

    public class RuleDraft {
        private Long worldId; private String code; private String name; private String conditionType; private int thresholdValue; private String effectType; private int effectValue; private String conditionJson; private String effectJson; private int priority;
        public RuleDraft(Long worldId, String code, String name, String conditionType, int thresholdValue, String effectType, int effectValue, String conditionJson, String effectJson, int priority) { this.worldId = worldId; this.code = code; this.name = name; this.conditionType = conditionType; this.thresholdValue = thresholdValue; this.effectType = effectType; this.effectValue = effectValue; this.conditionJson = conditionJson; this.effectJson = effectJson; this.priority = priority; }
        public Long getWorldId() { return worldId; } public String getCode() { return code; } public String getName() { return name; } public String getConditionType() { return conditionType; } public int getThresholdValue() { return thresholdValue; } public String getEffectType() { return effectType; } public int getEffectValue() { return effectValue; } public String getConditionJson() { return conditionJson; } public String getEffectJson() { return effectJson; } public int getPriority() { return priority; }
    }

    public class TemplateDraft {
        private Long id; private Long worldId; private String code; private String name; private String description; private int probabilityPercent; private int priority; private String choicePositiveLabel; private int choicePositiveMoodDelta; private String choiceNegativeLabel; private int choiceNegativeMoodDelta;
        public TemplateDraft(Long worldId, String code, String name, String description, int probabilityPercent, int priority, String choicePositiveLabel, int choicePositiveMoodDelta, String choiceNegativeLabel, int choiceNegativeMoodDelta) { this.worldId = worldId; this.code = code; this.name = name; this.description = description; this.probabilityPercent = probabilityPercent; this.priority = priority; this.choicePositiveLabel = choicePositiveLabel; this.choicePositiveMoodDelta = choicePositiveMoodDelta; this.choiceNegativeLabel = choiceNegativeLabel; this.choiceNegativeMoodDelta = choiceNegativeMoodDelta; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; } public Long getWorldId() { return worldId; } public String getCode() { return code; } public String getName() { return name; } public String getDescription() { return description; } public int getProbabilityPercent() { return probabilityPercent; } public int getPriority() { return priority; } public String getChoicePositiveLabel() { return choicePositiveLabel; } public int getChoicePositiveMoodDelta() { return choicePositiveMoodDelta; } public String getChoiceNegativeLabel() { return choiceNegativeLabel; } public int getChoiceNegativeMoodDelta() { return choiceNegativeMoodDelta; }
    }
}
