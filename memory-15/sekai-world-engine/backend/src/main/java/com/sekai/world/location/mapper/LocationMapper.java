package com.sekai.world.location.mapper;

import com.sekai.world.location.model.City;
import com.sekai.world.location.model.Location;
import com.sekai.world.location.model.LocationConnection;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface LocationMapper {
    @Select("SELECT c.id, c.world_id, c.name, c.description FROM sekai_city c WHERE c.world_id = #{worldId}")
    @Results({@Result(property = "id", column = "id"), @Result(property = "worldId", column = "world_id"),
            @Result(property = "name", column = "name"), @Result(property = "description", column = "description")})
    City findCity(Long worldId);

    @Select("SELECT l.id, l.city_id, l.name, l.kind, l.capacity, l.description FROM sekai_location l JOIN sekai_city c ON c.id = l.city_id WHERE c.world_id = #{worldId} ORDER BY l.id")
    @Results({@Result(property = "id", column = "id"), @Result(property = "cityId", column = "city_id"),
            @Result(property = "name", column = "name"), @Result(property = "kind", column = "kind"),
            @Result(property = "capacity", column = "capacity"), @Result(property = "description", column = "description")})
    List<Location> listByWorld(Long worldId);

    @Select("SELECT lc.id, lc.from_location_id, lc.to_location_id, lc.travel_days FROM sekai_location_connection lc JOIN sekai_location l ON l.id = lc.from_location_id JOIN sekai_city c ON c.id = l.city_id WHERE c.world_id = #{worldId} ORDER BY lc.id")
    @Results({@Result(property = "id", column = "id"), @Result(property = "fromLocationId", column = "from_location_id"),
            @Result(property = "toLocationId", column = "to_location_id"), @Result(property = "travelDays", column = "travel_days")})
    List<LocationConnection> listConnections(Long worldId);

    @Insert("INSERT INTO sekai_location(city_id, name, kind, capacity, description) VALUES(#{cityId}, #{name}, #{kind}, #{capacity}, #{description})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(LocationDraft location);

    @Insert("INSERT INTO sekai_location_connection(from_location_id, to_location_id, travel_days) VALUES(#{fromLocationId}, #{toLocationId}, #{travelDays})")
    int insertConnection(ConnectionDraft connection);

    public class LocationDraft {
        private Long id; private Long cityId; private String name; private String kind; private int capacity; private String description;
        public LocationDraft(Long cityId, String name, String kind, int capacity, String description) { this.cityId = cityId; this.name = name; this.kind = kind; this.capacity = capacity; this.description = description; }
        public Long getId() { return id; } public void setId(Long id) { this.id = id; }
        public Long getCityId() { return cityId; } public String getName() { return name; } public String getKind() { return kind; }
        public int getCapacity() { return capacity; } public String getDescription() { return description; }
    }

    public class ConnectionDraft {
        private Long fromLocationId; private Long toLocationId; private int travelDays;
        public ConnectionDraft(Long fromLocationId, Long toLocationId, int travelDays) { this.fromLocationId = fromLocationId; this.toLocationId = toLocationId; this.travelDays = travelDays; }
        public Long getFromLocationId() { return fromLocationId; } public Long getToLocationId() { return toLocationId; } public int getTravelDays() { return travelDays; }
    }
}
