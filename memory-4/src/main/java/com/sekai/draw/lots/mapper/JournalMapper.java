package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.model.Wish;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;
import java.util.Map;

@Mapper
public interface JournalMapper {
    int addWish(@Param("userId") Long userId, @Param("title") String title);
    Wish findWish(@Param("userId") Long userId, @Param("title") String title);
    Wish wish(@Param("userId") Long userId, @Param("id") Long id);
    List<Wish> wishes(@Param("userId") Long userId);
    int updateWish(@Param("userId") Long userId, @Param("id") Long id, @Param("completed") boolean completed, @Param("review") String review);
    Map<String, Object> achievementCounts(@Param("userId") Long userId);
    List<String> unlocked(@Param("userId") Long userId);
    int unlock(@Param("userId") Long userId, @Param("code") String code);
}
