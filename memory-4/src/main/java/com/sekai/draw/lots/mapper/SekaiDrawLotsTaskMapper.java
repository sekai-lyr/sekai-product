package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsTaskDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface SekaiDrawLotsTaskMapper {
    int insert(SekaiDrawLotsTaskDO record);
    SekaiDrawLotsTaskDO selectByIdForUser(@Param("id") Long id, @Param("userId") Long userId);
    List<SekaiDrawLotsTaskDO> selectByUser(@Param("userId") Long userId,
                                           @Param("status") String status,
                                           @Param("limit") int limit);
    int countActiveTitle(@Param("userId") Long userId, @Param("title") String title);
    int updateStatusForUser(@Param("id") Long id,
                            @Param("userId") Long userId,
                            @Param("status") String status,
                            @Param("completedTime") LocalDateTime completedTime);
}
