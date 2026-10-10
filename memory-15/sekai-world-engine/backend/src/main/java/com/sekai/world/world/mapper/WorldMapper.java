package com.sekai.world.world.mapper;

import com.sekai.world.world.model.World;
import com.sekai.world.world.model.WorldBranch;
import com.sekai.world.world.model.WorldClock;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface WorldMapper {
    @Select("SELECT id, owner_id, name, seed, visibility, created_at FROM sekai_world WHERE owner_id = #{ownerId} ORDER BY created_at DESC")
    @Results({
            @Result(property = "id", column = "id"), @Result(property = "ownerId", column = "owner_id"),
            @Result(property = "name", column = "name"), @Result(property = "seed", column = "seed"),
            @Result(property = "visibility", column = "visibility"), @Result(property = "createdAt", column = "created_at")
    })
    List<World> listByOwner(Long ownerId);

    @Select("SELECT id, owner_id, name, seed, visibility, created_at FROM sekai_world WHERE id = #{worldId} AND owner_id = #{ownerId}")
    @Results({
            @Result(property = "id", column = "id"), @Result(property = "ownerId", column = "owner_id"),
            @Result(property = "name", column = "name"), @Result(property = "seed", column = "seed"),
            @Result(property = "visibility", column = "visibility"), @Result(property = "createdAt", column = "created_at")
    })
    World findByIdAndOwner(@Param("worldId") Long worldId, @Param("ownerId") Long ownerId);

    @Insert("INSERT INTO sekai_world(owner_id, name, seed, visibility) VALUES(#{ownerId}, #{name}, #{seed}, #{visibility})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(WorldDraft world);

    @Insert("INSERT INTO sekai_city(world_id, name, description) VALUES(#{worldId}, #{name}, #{description})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertCity(CityDraft city);

    @Insert("INSERT INTO sekai_world_branch(world_id, parent_branch_id, fork_snapshot_id, name, status) VALUES(#{worldId}, #{parentBranchId}, #{forkSnapshotId}, #{name}, #{status})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertBranch(BranchDraft branch);

    @Insert("INSERT INTO sekai_world_clock(branch_id, game_date, last_tick_key, world_seed) VALUES(#{branchId}, #{currentDate}, #{lastTickKey}, #{worldSeed})")
    int insertClock(ClockDraft clock);

    @Select("SELECT id, world_id, parent_branch_id, fork_snapshot_id, name, status, created_at FROM sekai_world_branch WHERE world_id = #{worldId} ORDER BY created_at")
    @Results({
            @Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "parentBranchId", column = "parent_branch_id"), @Result(property = "forkSnapshotId", column = "fork_snapshot_id"),
            @Result(property = "name", column = "name"), @Result(property = "status", column = "status"),
            @Result(property = "createdAt", column = "created_at")
    })
    List<WorldBranch> listBranches(Long worldId);

    @Select("SELECT id, world_id, parent_branch_id, fork_snapshot_id, name, status, created_at FROM sekai_world_branch WHERE id = #{branchId} AND world_id = #{worldId}")
    @Results({
            @Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "parentBranchId", column = "parent_branch_id"), @Result(property = "forkSnapshotId", column = "fork_snapshot_id"),
            @Result(property = "name", column = "name"), @Result(property = "status", column = "status"),
            @Result(property = "createdAt", column = "created_at")
    })
    WorldBranch findBranch(@Param("worldId") Long worldId, @Param("branchId") Long branchId);

    @Select("SELECT branch_id, game_date, last_tick_key, world_seed, version FROM sekai_world_clock WHERE branch_id = #{branchId}")
    @Results({
            @Result(property = "branchId", column = "branch_id"), @Result(property = "currentDate", column = "game_date"),
            @Result(property = "lastTickKey", column = "last_tick_key"), @Result(property = "worldSeed", column = "world_seed"),
            @Result(property = "version", column = "version")
    })
    WorldClock findClock(Long branchId);

    @org.apache.ibatis.annotations.Update("UPDATE sekai_world_clock SET game_date = #{currentDate}, last_tick_key = #{lastTickKey}, version = version + 1 WHERE branch_id = #{branchId} AND version = #{version}")
    int updateClock(@Param("branchId") Long branchId, @Param("currentDate") LocalDate currentDate,
                    @Param("lastTickKey") String lastTickKey, @Param("version") Long version);

    @org.apache.ibatis.annotations.Update("UPDATE sekai_world_branch SET fork_snapshot_id = #{snapshotId} WHERE id = #{branchId}")
    int updateForkSnapshot(@Param("branchId") Long branchId, @Param("snapshotId") Long snapshotId);

    public class WorldDraft {
        private Long id; private Long ownerId; private String name; private Long seed; private String visibility;
        public WorldDraft(Long ownerId, String name, Long seed, String visibility) { this.ownerId = ownerId; this.name = name; this.seed = seed; this.visibility = visibility; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; }
        public Long getOwnerId() { return ownerId; } public String getName() { return name; }
        public Long getSeed() { return seed; } public String getVisibility() { return visibility; }
    }

    public class CityDraft {
        private Long id; private Long worldId; private String name; private String description;
        public CityDraft(Long worldId, String name, String description) { this.worldId = worldId; this.name = name; this.description = description; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; }
        public Long getWorldId() { return worldId; } public String getName() { return name; } public String getDescription() { return description; }
    }

    public class BranchDraft {
        private Long id; private Long worldId; private Long parentBranchId; private Long forkSnapshotId; private String name; private String status;
        public BranchDraft(Long worldId, Long parentBranchId, Long forkSnapshotId, String name, String status) { this.worldId = worldId; this.parentBranchId = parentBranchId; this.forkSnapshotId = forkSnapshotId; this.name = name; this.status = status; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; }
        public Long getWorldId() { return worldId; } public Long getParentBranchId() { return parentBranchId; } public Long getForkSnapshotId() { return forkSnapshotId; }
        public String getName() { return name; } public String getStatus() { return status; }
    }

    public class ClockDraft {
        private Long branchId; private LocalDate currentDate; private String lastTickKey; private Long worldSeed;
        public ClockDraft(Long branchId, LocalDate currentDate, String lastTickKey, Long worldSeed) { this.branchId = branchId; this.currentDate = currentDate; this.lastTickKey = lastTickKey; this.worldSeed = worldSeed; }
        public Long getBranchId() { return branchId; } public LocalDate getCurrentDate() { return currentDate; }
        public String getLastTickKey() { return lastTickKey; } public Long getWorldSeed() { return worldSeed; }
    }
}
