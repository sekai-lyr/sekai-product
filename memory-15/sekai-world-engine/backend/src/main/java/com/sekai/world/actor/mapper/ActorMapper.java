package com.sekai.world.actor.mapper;

import com.sekai.world.actor.model.Actor;
import com.sekai.world.actor.model.ActorSchedule;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface ActorMapper {
    @Select("SELECT id, world_id, faction_id, location_id, name, role, profile_json, state_json, energy, mood, status FROM sekai_actor WHERE world_id = #{worldId} ORDER BY id")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "factionId", column = "faction_id"), @Result(property = "locationId", column = "location_id"),
            @Result(property = "name", column = "name"), @Result(property = "role", column = "role"),
            @Result(property = "profileJson", column = "profile_json"), @Result(property = "stateJson", column = "state_json"),
            @Result(property = "energy", column = "energy"), @Result(property = "mood", column = "mood"), @Result(property = "status", column = "status")})
    List<Actor> listByWorld(Long worldId);

    @Select("SELECT id, world_id, faction_id, location_id, name, role, profile_json, state_json, energy, mood, status FROM sekai_actor WHERE id = #{actorId} AND world_id = #{worldId}")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "factionId", column = "faction_id"), @Result(property = "locationId", column = "location_id"),
            @Result(property = "name", column = "name"), @Result(property = "role", column = "role"),
            @Result(property = "profileJson", column = "profile_json"), @Result(property = "stateJson", column = "state_json"),
            @Result(property = "energy", column = "energy"), @Result(property = "mood", column = "mood"), @Result(property = "status", column = "status")})
    Actor find(@Param("worldId") Long worldId, @Param("actorId") Long actorId);

    @Select("SELECT s.id, s.actor_id, s.day_of_week, s.start_time, s.location_id, s.activity, s.priority, s.energy_delta, s.mood_delta FROM sekai_actor_schedule s JOIN sekai_actor a ON a.id = s.actor_id WHERE a.world_id = #{worldId} ORDER BY s.actor_id, s.priority DESC, s.start_time")
    @Results({@Result(property = "id", column = "id"), @Result(property = "actorId", column = "actor_id"),
            @Result(property = "dayOfWeek", column = "day_of_week"), @Result(property = "startTime", column = "start_time"),
            @Result(property = "locationId", column = "location_id"), @Result(property = "activity", column = "activity"),
            @Result(property = "priority", column = "priority"), @Result(property = "energyDelta", column = "energy_delta"),
            @Result(property = "moodDelta", column = "mood_delta")})
    List<ActorSchedule> listSchedules(Long worldId);

    @Insert("INSERT INTO sekai_actor(world_id, faction_id, location_id, name, role, profile_json, state_json, energy, mood, status) VALUES(#{worldId}, #{factionId}, #{locationId}, #{name}, #{role}, #{profileJson}, #{stateJson}, #{energy}, #{mood}, #{status})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(ActorDraft actor);

    @Insert("INSERT INTO sekai_actor_schedule(actor_id, day_of_week, start_time, location_id, activity, priority, energy_delta, mood_delta) VALUES(#{actorId}, #{dayOfWeek}, #{startTime}, #{locationId}, #{activity}, #{priority}, #{energyDelta}, #{moodDelta})")
    int insertSchedule(ScheduleDraft schedule);

    @Update("UPDATE sekai_actor SET location_id = #{locationId}, energy = #{energy}, mood = #{mood}, status = #{status}, state_json = #{stateJson} WHERE id = #{actorId}")
    int updateState(@Param("actorId") Long actorId, @Param("locationId") Long locationId, @Param("energy") int energy,
                    @Param("mood") int mood, @Param("status") String status, @Param("stateJson") String stateJson);

    @Insert("INSERT INTO sekai_branch_actor_state(branch_id, actor_id, location_id, energy, mood, status, state_json) VALUES(#{branchId}, #{actorId}, #{locationId}, #{energy}, #{mood}, #{status}, #{stateJson})")
    int insertBranchState(BranchStateDraft state);

    @Update("UPDATE sekai_branch_actor_state SET location_id = #{locationId}, energy = #{energy}, mood = #{mood}, status = #{status}, state_json = #{stateJson} WHERE branch_id = #{branchId} AND actor_id = #{actorId}")
    int updateBranchState(@Param("branchId") Long branchId, @Param("actorId") Long actorId, @Param("locationId") Long locationId,
                          @Param("energy") int energy, @Param("mood") int mood, @Param("status") String status, @Param("stateJson") String stateJson);

    @Select("SELECT a.id, a.world_id, a.faction_id, s.location_id, a.name, a.role, a.profile_json, s.state_json, s.energy, s.mood, s.status FROM sekai_actor a JOIN sekai_branch_actor_state s ON s.actor_id = a.id WHERE a.world_id = #{worldId} AND s.branch_id = #{branchId} ORDER BY a.id")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"), @Result(property = "factionId", column = "faction_id"), @Result(property = "locationId", column = "location_id"), @Result(property = "name", column = "name"), @Result(property = "role", column = "role"), @Result(property = "profileJson", column = "profile_json"), @Result(property = "stateJson", column = "state_json"), @Result(property = "energy", column = "energy"), @Result(property = "mood", column = "mood"), @Result(property = "status", column = "status")})
    List<Actor> listByBranch(@Param("worldId") Long worldId, @Param("branchId") Long branchId);

    public class ActorDraft {
        private Long id; private Long worldId; private Long factionId; private Long locationId; private String name; private String role; private String profileJson; private String stateJson; private int energy; private int mood; private String status;
        public ActorDraft(Long worldId, Long factionId, Long locationId, String name, String role, String profileJson, String stateJson, int energy, int mood, String status) { this.worldId = worldId; this.factionId = factionId; this.locationId = locationId; this.name = name; this.role = role; this.profileJson = profileJson; this.stateJson = stateJson; this.energy = energy; this.mood = mood; this.status = status; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; }
        public Long getWorldId() { return worldId; } public Long getFactionId() { return factionId; } public Long getLocationId() { return locationId; }
        public String getName() { return name; } public String getRole() { return role; } public String getProfileJson() { return profileJson; } public String getStateJson() { return stateJson; }
        public int getEnergy() { return energy; } public int getMood() { return mood; } public String getStatus() { return status; }
    }

    public class ScheduleDraft {
        private Long actorId; private int dayOfWeek; private java.time.LocalTime startTime; private Long locationId; private String activity; private int priority; private int energyDelta; private int moodDelta;
        public ScheduleDraft(Long actorId, int dayOfWeek, java.time.LocalTime startTime, Long locationId, String activity, int priority, int energyDelta, int moodDelta) { this.actorId = actorId; this.dayOfWeek = dayOfWeek; this.startTime = startTime; this.locationId = locationId; this.activity = activity; this.priority = priority; this.energyDelta = energyDelta; this.moodDelta = moodDelta; }
        public Long getActorId() { return actorId; } public int getDayOfWeek() { return dayOfWeek; } public java.time.LocalTime getStartTime() { return startTime; }
        public Long getLocationId() { return locationId; } public String getActivity() { return activity; } public int getPriority() { return priority; } public int getEnergyDelta() { return energyDelta; } public int getMoodDelta() { return moodDelta; }
    }

    public class BranchStateDraft {
        private Long branchId; private Long actorId; private Long locationId; private int energy; private int mood; private String status; private String stateJson;
        public BranchStateDraft(Long branchId, Long actorId, Long locationId, int energy, int mood, String status, String stateJson) { this.branchId = branchId; this.actorId = actorId; this.locationId = locationId; this.energy = energy; this.mood = mood; this.status = status; this.stateJson = stateJson; }
        public Long getBranchId() { return branchId; } public Long getActorId() { return actorId; } public Long getLocationId() { return locationId; } public int getEnergy() { return energy; } public int getMood() { return mood; } public String getStatus() { return status; } public String getStateJson() { return stateJson; }
    }
}
