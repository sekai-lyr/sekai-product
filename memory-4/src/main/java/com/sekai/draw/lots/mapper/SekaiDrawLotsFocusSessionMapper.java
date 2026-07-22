package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsFocusSessionDO;
import com.sekai.draw.lots.model.InsightMetric;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface SekaiDrawLotsFocusSessionMapper {
    int insert(SekaiDrawLotsFocusSessionDO record);
    SekaiDrawLotsFocusSessionDO selectByPrimaryKey(@Param("id") Long id);
    List<SekaiDrawLotsFocusSessionDO> selectRecentByUserId(@Param("userId") Long userId, @Param("limit") int limit);
    Integer sumMinutesSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);
    Integer sumMinutesBetween(@Param("userId") Long userId,
                              @Param("start") LocalDateTime start,
                              @Param("end") LocalDateTime end);
    int countSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);
    int countAllByUserId(@Param("userId") Long userId);
    int countActiveDaysSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);
    List<InsightMetric> selectDailyMinutes(@Param("userId") Long userId, @Param("since") LocalDateTime since);
}
