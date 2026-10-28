package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.model.WheelDeck;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface WheelDeckMapper {
    List<WheelDeck> list(@Param("userId") Long userId);
    WheelDeck get(@Param("userId") Long userId, @Param("id") Long id);
    int insert(WheelDeck deck);
    int rename(@Param("userId") Long userId, @Param("id") Long id, @Param("name") String name);
}
