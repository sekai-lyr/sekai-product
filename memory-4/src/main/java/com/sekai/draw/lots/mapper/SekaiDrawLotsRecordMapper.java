package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsRecordDO;
import com.sekai.draw.lots.model.DrawRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiDrawLotsRecordMapper {
    int insert(SekaiDrawLotsRecordDO record);
    int countByUserId(@Param("userId") Long userId);
    int countTodayByUserId(@Param("userId") Long userId);
    Integer maxScoreByUserId(@Param("userId") Long userId);
    Integer avgScoreByUserId(@Param("userId") Long userId);
    int countStreakDays(@Param("userId") Long userId);
    List<DrawRecord> selectRecentByUserId(@Param("userId") Long userId, @Param("limit") int limit);
    DrawRecord selectByIdForUser(@Param("id") Long id, @Param("userId") Long userId);
    DrawRecord selectTodayDaily(@Param("userId") Long userId);
    List<DrawRecord> selectByFilter(@Param("userId") Long userId,
                                    @Param("keyword") String keyword,
                                    @Param("mood") String mood,
                                    @Param("minScore") Integer minScore,
                                    @Param("limit") int limit);
}
