package com.sekai.world.relationship.mapper;

import com.sekai.world.relationship.model.Relationship;
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
public interface RelationshipMapper {
    @Select("SELECT id, world_id, from_actor_id, to_actor_id, affinity, trust, hostility, influence FROM sekai_relationship WHERE world_id = #{worldId} ORDER BY id")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "fromActorId", column = "from_actor_id"), @Result(property = "toActorId", column = "to_actor_id"),
            @Result(property = "affinity", column = "affinity"), @Result(property = "trust", column = "trust"),
            @Result(property = "hostility", column = "hostility"), @Result(property = "influence", column = "influence")})
    List<Relationship> listByWorld(Long worldId);

    @Select("SELECT id, world_id, from_actor_id, to_actor_id, affinity, trust, hostility, influence FROM sekai_relationship WHERE world_id = #{worldId} AND (from_actor_id = #{actorId} OR to_actor_id = #{actorId}) ORDER BY id")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "fromActorId", column = "from_actor_id"), @Result(property = "toActorId", column = "to_actor_id"),
            @Result(property = "affinity", column = "affinity"), @Result(property = "trust", column = "trust"),
            @Result(property = "hostility", column = "hostility"), @Result(property = "influence", column = "influence")})
    List<Relationship> listByActor(@Param("worldId") Long worldId, @Param("actorId") Long actorId);

    @Insert("INSERT INTO sekai_relationship(world_id, from_actor_id, to_actor_id, affinity, trust, hostility, influence) VALUES(#{worldId}, #{fromActorId}, #{toActorId}, #{affinity}, #{trust}, #{hostility}, #{influence})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(RelationshipDraft relationship);

    @Update("UPDATE sekai_relationship SET affinity = GREATEST(-100, LEAST(100, affinity + #{affinityDelta})), trust = GREATEST(-100, LEAST(100, trust + #{trustDelta})), hostility = GREATEST(0, LEAST(100, hostility + #{hostilityDelta})), influence = GREATEST(0, LEAST(100, influence + #{influenceDelta})) WHERE id = #{relationshipId}")
    int applyDelta(@Param("relationshipId") Long relationshipId, @Param("affinityDelta") int affinityDelta,
                   @Param("trustDelta") int trustDelta, @Param("hostilityDelta") int hostilityDelta,
                   @Param("influenceDelta") int influenceDelta);

    public class RelationshipDraft {
        private Long id; private Long worldId; private Long fromActorId; private Long toActorId; private int affinity; private int trust; private int hostility; private int influence;
        public RelationshipDraft(Long worldId, Long fromActorId, Long toActorId, int affinity, int trust, int hostility, int influence) { this.worldId = worldId; this.fromActorId = fromActorId; this.toActorId = toActorId; this.affinity = affinity; this.trust = trust; this.hostility = hostility; this.influence = influence; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; }
        public Long getWorldId() { return worldId; } public Long getFromActorId() { return fromActorId; } public Long getToActorId() { return toActorId; }
        public int getAffinity() { return affinity; } public int getTrust() { return trust; } public int getHostility() { return hostility; } public int getInfluence() { return influence; }
    }
}
