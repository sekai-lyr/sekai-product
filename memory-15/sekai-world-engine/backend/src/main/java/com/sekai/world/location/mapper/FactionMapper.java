package com.sekai.world.location.mapper;

import com.sekai.world.location.model.Faction;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface FactionMapper {
    @Select("SELECT id, world_id, name, description FROM sekai_faction WHERE world_id = #{worldId} ORDER BY id")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "name", column = "name"), @Result(property = "description", column = "description")})
    List<Faction> listByWorld(Long worldId);

    @Insert("INSERT INTO sekai_faction(world_id, name, description) VALUES(#{worldId}, #{name}, #{description})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(FactionDraft faction);

    public class FactionDraft {
        private Long id; private Long worldId; private String name; private String description;
        public FactionDraft(Long worldId, String name, String description) { this.worldId = worldId; this.name = name; this.description = description; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; }
        public Long getWorldId() { return worldId; } public String getName() { return name; } public String getDescription() { return description; }
    }
}
